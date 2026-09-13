import { execFileSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

import ts from 'typescript';

import { collectSourceModules } from './repository-analysis.mjs';

const FILE_SIZE_REVIEW_THRESHOLD = 500;

const parseArguments = (values) => {
  const args = {
    root: process.cwd(),
    base: undefined,
    changed: false,
    report: false,
  };

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === '--root' || value === '--base') {
      const nextValue = values[index + 1];
      if (!nextValue) throw new Error(`${value} requires a path.`);
      args[value.slice(2)] = nextValue;
      index += 1;
      continue;
    }
    if (value === '--changed' || value === '--report') {
      args[value.slice(2)] = true;
      continue;
    }
    throw new Error(`Unknown architecture option: ${value}`);
  }

  return { ...args, root: path.resolve(args.root) };
};

const runGit = (root, args) => execFileSync('git', args, {
  cwd: root,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});

const collectChangedPaths = (root, explicitBase) => {
  const paths = new Set();
  const addOutput = (output) => {
    for (const filePath of output.split(/\r?\n/u).map((value) => value.trim()).filter(Boolean)) {
      paths.add(filePath.replaceAll('\\', '/'));
    }
  };
  const base = explicitBase
    ?? process.env.CARDFORGE_VERIFY_BASE?.trim()
    ?? (process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : 'origin/main');

  try {
    runGit(root, ['rev-parse', '--verify', base]);
    addOutput(runGit(root, ['diff', '--name-only', `${base}...HEAD`]));
  } catch {
    runGit(root, ['rev-parse', '--verify', 'HEAD']);
  }
  addOutput(runGit(root, ['diff', '--name-only', 'HEAD']));
  addOutput(runGit(root, ['ls-files', '--others', '--exclude-standard']));
  return paths;
};

const isClientModule = (classification, source) => {
  if (/^\s*['"]use client['"];?/u.test(source)) return true;
  if (classification.kind !== 'feature') return false;
  const [firstSegment] = classification.featurePath.split('/');
  return classification.publicEntry === 'client'
    || firstSegment === 'components'
    || firstSegment === 'hooks';
};

const createViolation = (code, source, target, message) => ({
  code,
  source,
  target,
  message,
  key: `${code}|${source}|${target}`,
});

const countPublicExports = (sourceContent, filePath) => {
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceContent,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  let exportCount = 0;
  for (const statement of sourceFile.statements) {
    if (ts.isExportDeclaration(statement)) {
      exportCount += statement.exportClause && ts.isNamedExports(statement.exportClause)
        ? statement.exportClause.elements.length
        : 1;
      continue;
    }
    const exported = statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false;
    if (!exported) continue;
    exportCount += ts.isVariableStatement(statement) ? statement.declarationList.declarations.length : 1;
  }
  return exportCount;
};

const analyzeDependency = ({ source, target, sourceContent }) => {
  const violations = [];
  const sourceLabel = `src/${source.modulePath}`;
  const targetLabel = `src/${target.modulePath}`;

  if (target.kind === 'legacy') {
    violations.push(createViolation(
      'legacy-import-target', sourceLabel, targetLabel,
      `${sourceLabel} imports retired root ${target.legacyRoot}.`,
    ));
  }
  if (target.kind === 'unowned') {
    violations.push(createViolation(
      'unowned-import-target', sourceLabel, targetLabel,
      `${sourceLabel} imports source without an approved owner.`,
    ));
  }
  if (source.kind === 'shared' && target.kind !== 'shared') {
    violations.push(createViolation(
      'shared-imports-upward', sourceLabel, targetLabel,
      'Shared utilities cannot depend on CardForge product layers.',
    ));
  }
  if (source.kind === 'domain' && target.kind !== 'domain' && target.kind !== 'shared') {
    violations.push(createViolation(
      'domain-imports-upward', sourceLabel, targetLabel,
      'Domain modules can depend only on domain and shared modules.',
    ));
  }
  if (source.kind === 'ui' && target.kind !== 'ui' && target.kind !== 'shared') {
    violations.push(createViolation(
      'ui-imports-product', sourceLabel, targetLabel,
      'Generic UI components cannot import product code.',
    ));
  }
  if (
    source.kind === 'infrastructure'
    && target.kind !== 'infrastructure'
    && target.kind !== 'domain'
    && target.kind !== 'shared'
  ) {
    violations.push(createViolation(
      'infrastructure-imports-upward', sourceLabel, targetLabel,
      'Infrastructure adapters cannot depend on features, app composition, or product UI.',
    ));
  }
  if (source.kind === 'feature' && target.kind === 'app') {
    violations.push(createViolation(
      'feature-imports-app', sourceLabel, targetLabel,
      'Features cannot import Next.js app composition.',
    ));
  }
  if (
    source.kind === 'feature'
    && target.kind === 'feature'
    && isClientModule(source, sourceContent)
    && (target.publicEntry === 'server' || target.featurePath.startsWith('server/'))
  ) {
    violations.push(createViolation(
      'client-imports-server', sourceLabel, targetLabel,
      'Client code cannot import feature server code.',
    ));
  }
  if (
    source.kind === 'feature'
    && target.kind === 'feature'
    && source.featureName !== target.featureName
    && !target.publicEntry
  ) {
    violations.push(createViolation(
      'cross-feature-internal', sourceLabel, targetLabel,
      `${source.featureName} bypasses the ${target.featureName} public interface.`,
    ));
  }
  if (source.kind === 'app' && target.kind === 'feature' && !target.publicEntry) {
    violations.push(createViolation(
      'app-imports-feature-internal', sourceLabel, targetLabel,
      'App routes and pages must use a feature public interface.',
    ));
  }
  return violations;
};

const canReachFeature = (graph, start, goal) => {
  const pending = [start];
  const visited = new Set();
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === goal) return true;
    if (!current || visited.has(current)) continue;
    visited.add(current);
    for (const next of graph.get(current) ?? []) pending.push(next);
  }
  return false;
};

const analyzeRepository = async (root) => {
  const { modules } = await collectSourceModules(root);
  const violations = new Map();
  const sizeWarnings = [];
  const featureGraph = new Map();
  const allFeatureNames = new Set();
  const publicInterfaces = [];

  for (const module of modules) {
    const {
      filePath,
      relativePath,
      source: sourceContent,
      classification: sourceClassification,
      localImports,
    } = module;
    const sourceLabel = `src/${sourceClassification.modulePath}`;
    const lineCount = sourceContent.split(/\r?\n/u).length;
    if (sourceClassification.kind === 'feature') allFeatureNames.add(sourceClassification.featureName);

    if (lineCount > FILE_SIZE_REVIEW_THRESHOLD) {
      sizeWarnings.push({ path: `src/${relativePath}`, lineCount });
    }
    if (sourceClassification.kind === 'feature' && sourceClassification.publicEntry) {
      publicInterfaces.push({
        path: `src/${relativePath}`,
        featureName: sourceClassification.featureName,
        exportCount: countPublicExports(sourceContent, filePath),
      });
    }
    if (sourceClassification.kind === 'legacy') {
      const violation = createViolation(
        'legacy-source-root', sourceLabel, `root:${sourceClassification.legacyRoot}`,
        `${sourceLabel} remains under retired source root ${sourceClassification.legacyRoot}.`,
      );
      violations.set(violation.key, violation);
    } else if (sourceClassification.kind === 'unowned') {
      const violation = createViolation(
        'unowned-source-root', sourceLabel, `root:${sourceClassification.unownedRoot}`,
        `${sourceLabel} has no approved source owner.`,
      );
      violations.set(violation.key, violation);
    }

    for (const localImport of localImports) {
      const targetClassification = localImport.classification;
      for (const violation of analyzeDependency({
        source: sourceClassification,
        target: targetClassification,
        sourceContent,
      })) violations.set(violation.key, violation);

      if (
        sourceClassification.kind === 'feature'
        && targetClassification.kind === 'feature'
        && sourceClassification.featureName !== targetClassification.featureName
      ) {
        const targets = featureGraph.get(sourceClassification.featureName) ?? new Set();
        targets.add(targetClassification.featureName);
        featureGraph.set(sourceClassification.featureName, targets);
      }
    }
  }

  for (const [sourceFeature, targetFeatures] of featureGraph) {
    for (const targetFeature of targetFeatures) {
      if (!canReachFeature(featureGraph, targetFeature, sourceFeature)) continue;
      const violation = createViolation(
        'feature-cycle-edge', `feature:${sourceFeature}`, `feature:${targetFeature}`,
        `${sourceFeature} -> ${targetFeature} participates in a feature dependency cycle.`,
      );
      violations.set(violation.key, violation);
    }
  }

  const featureNames = new Set(allFeatureNames);
  for (const targets of featureGraph.values()) for (const target of targets) featureNames.add(target);
  const featureGravity = [...featureNames].map((featureName) => {
    let fanIn = 0;
    for (const targets of featureGraph.values()) if (targets.has(featureName)) fanIn += 1;
    return {
      featureName,
      fanIn,
      fanOut: featureGraph.get(featureName)?.size ?? 0,
      publicExports: publicInterfaces
        .filter((entry) => entry.featureName === featureName)
        .reduce((total, entry) => total + entry.exportCount, 0),
    };
  }).sort((left, right) => (
    (right.fanIn * 2 + right.fanOut + right.publicExports / 10)
    - (left.fanIn * 2 + left.fanOut + left.publicExports / 10)
  ) || left.featureName.localeCompare(right.featureName));

  return {
    featureGravity,
    publicInterfaces: publicInterfaces.sort((left, right) => (
      right.exportCount - left.exportCount || left.path.localeCompare(right.path)
    )),
    violations: [...violations.values()].sort((left, right) => left.key.localeCompare(right.key)),
    sizeWarnings: sizeWarnings.sort((left, right) => left.path.localeCompare(right.path)),
  };
};

const run = async () => {
  const args = parseArguments(process.argv.slice(2));
  const analysis = await analyzeRepository(args.root);
  const changedPaths = args.changed ? collectChangedPaths(args.root, args.base) : null;
  const relevantSizeWarnings = changedPaths
    ? analysis.sizeWarnings.filter((warning) => changedPaths.has(warning.path))
    : analysis.sizeWarnings;

  if (args.report) {
    for (const hotspot of analysis.featureGravity.slice(0, 10)) {
      console.log(`Dependency gravity: ${hotspot.featureName} fan-in ${hotspot.fanIn}, fan-out ${hotspot.fanOut}, public exports ${hotspot.publicExports}.`);
    }
    for (const publicInterface of analysis.publicInterfaces.filter((entry) => entry.exportCount > 0).slice(0, 10)) {
      console.log(`Public-interface breadth: ${publicInterface.path} exposes ${publicInterface.exportCount} export${publicInterface.exportCount === 1 ? '' : 's'}.`);
    }
    for (const warning of relevantSizeWarnings) {
      console.log(`File-size review warning: ${warning.path} has ${warning.lineCount} lines (threshold ${FILE_SIZE_REVIEW_THRESHOLD}).`);
    }
  }

  for (const violation of analysis.violations) {
    console.error(`Architecture violation: ${violation.key}\n  ${violation.message}`);
  }
  if (analysis.violations.length > 0) {
    process.exitCode = 1;
    return;
  }

  const warningLabel = `${relevantSizeWarnings.length} ${args.changed ? 'changed ' : ''}size warning${relevantSizeWarnings.length === 1 ? '' : 's'}`;
  console.log(`Architecture check passed (0 violations; ${warningLabel}).`);
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
