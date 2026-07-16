import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import ts from 'typescript';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);
const FILE_SIZE_REVIEW_THRESHOLD = 500;

const toPosixPath = (value) => value.split(path.sep).join('/');

const parseArguments = (values) => {
  const args = {
    root: process.cwd(),
  };

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === '--root') {
      const nextValue = values[index + 1];
      if (!nextValue) throw new Error(`${value} requires a path.`);
      args.root = nextValue;
      index += 1;
      continue;
    }
    throw new Error(`Unknown architecture option: ${value}`);
  }

  return { root: path.resolve(args.root) };
};

const collectSourceFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectSourceFiles(entryPath));
    } else if (
      SOURCE_EXTENSIONS.has(path.extname(entry.name))
      && !entry.name.endsWith('.d.ts')
    ) {
      files.push(entryPath);
    }
  }

  return files;
};

const stripModuleSuffix = (value) => value
  .replace(/\.(?:[cm]?[jt]sx?)$/u, '')
  .replace(/\/index$/u, '');

const resolveLocalImport = ({ importerPath, sourceRoot, specifier }) => {
  let absoluteTarget;
  if (specifier.startsWith('@/')) {
    absoluteTarget = path.join(sourceRoot, specifier.slice(2));
  } else if (specifier.startsWith('.')) {
    absoluteTarget = path.resolve(path.dirname(importerPath), specifier);
  } else {
    return null;
  }

  const relativeTarget = path.relative(sourceRoot, absoluteTarget);
  if (
    relativeTarget === ''
    || relativeTarget.startsWith(`..${path.sep}`)
    || relativeTarget === '..'
    || path.isAbsolute(relativeTarget)
  ) {
    return null;
  }

  return stripModuleSuffix(toPosixPath(relativeTarget));
};

const classifySourcePath = (relativePath) => {
  const modulePath = stripModuleSuffix(relativePath);
  const parts = modulePath.split('/');
  const [root, featureName] = parts;

  if (modulePath === 'middleware') return { kind: 'app', modulePath, parts };
  if (root === 'app') return { kind: 'app', modulePath, parts };
  if (root === 'domain') return { kind: 'domain', modulePath, parts };
  if (root === 'infrastructure') return { kind: 'infrastructure', modulePath, parts };
  if (root === 'shared') return { kind: 'shared', modulePath, parts };
  if (root === 'features' && featureName) {
    const featurePath = parts.slice(2).join('/');
    const [featureEntry] = featurePath.split('/');
    return {
      kind: 'feature',
      modulePath,
      parts,
      featureName,
      featurePath,
      publicEntry: featureEntry === 'client' || featureEntry === 'server' ? featureEntry : null,
    };
  }
  if (root === 'components' && featureName === 'ui') {
    return { kind: 'ui', modulePath, parts };
  }
  if (root === 'lib' || root === 'store' || root === 'types') {
    return { kind: 'legacy', modulePath, parts, legacyRoot: root };
  }
  return { kind: 'unowned', modulePath, parts, unownedRoot: root };
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

const analyzeDependency = ({ source, target, sourceContent }) => {
  const violations = [];
  const sourceLabel = `src/${source.modulePath}`;
  const targetLabel = `src/${target.modulePath}`;

  if (target.kind === 'legacy') {
    violations.push(createViolation(
      'legacy-import-target',
      sourceLabel,
      targetLabel,
      `${sourceLabel} imports retired root ${target.legacyRoot}.`,
    ));
  }
  if (target.kind === 'unowned') {
    violations.push(createViolation(
      'unowned-import-target',
      sourceLabel,
      targetLabel,
      `${sourceLabel} imports source without an approved owner.`,
    ));
  }

  if (source.kind === 'shared' && target.kind !== 'shared') {
    violations.push(createViolation(
      'shared-imports-upward',
      sourceLabel,
      targetLabel,
      'Shared utilities cannot depend on CardForge product layers.',
    ));
  }

  if (source.kind === 'domain' && target.kind !== 'domain' && target.kind !== 'shared') {
    violations.push(createViolation(
      'domain-imports-upward',
      sourceLabel,
      targetLabel,
      'Domain modules can depend only on domain and shared modules.',
    ));
  }

  if (source.kind === 'ui' && target.kind !== 'ui' && target.kind !== 'shared') {
    violations.push(createViolation(
      'ui-imports-product',
      sourceLabel,
      targetLabel,
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
      'infrastructure-imports-upward',
      sourceLabel,
      targetLabel,
      'Infrastructure adapters cannot depend on features, app composition, or product UI.',
    ));
  }

  if (source.kind === 'feature' && target.kind === 'app') {
    violations.push(createViolation(
      'feature-imports-app',
      sourceLabel,
      targetLabel,
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
      'client-imports-server',
      sourceLabel,
      targetLabel,
      'Client code cannot import feature server code.',
    ));
  }

  if (
    source.kind === 'feature'
    && target.kind === 'feature'
    && source.featureName !== target.featureName
  ) {
    if (!target.publicEntry) {
      violations.push(createViolation(
        'cross-feature-internal',
        sourceLabel,
        targetLabel,
        `${source.featureName} bypasses the ${target.featureName} public interface.`,
      ));
    }
  }

  if (source.kind === 'app' && target.kind === 'feature' && !target.publicEntry) {
    violations.push(createViolation(
      'app-imports-feature-internal',
      sourceLabel,
      targetLabel,
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
  const sourceRoot = path.join(root, 'src');
  const sourceFiles = await collectSourceFiles(sourceRoot);
  const violations = new Map();
  const sizeWarnings = [];
  const featureGraph = new Map();

  for (const filePath of sourceFiles) {
    const relativePath = toPosixPath(path.relative(sourceRoot, filePath));
    const sourceClassification = classifySourcePath(relativePath);
    const sourceContent = await readFile(filePath, 'utf8');
    const sourceLabel = `src/${sourceClassification.modulePath}`;
    const lineCount = sourceContent.split(/\r?\n/u).length;

    if (lineCount > FILE_SIZE_REVIEW_THRESHOLD) {
      sizeWarnings.push({ path: `src/${relativePath}`, lineCount });
    }
    if (sourceClassification.kind === 'legacy') {
      const violation = createViolation(
        'legacy-source-root',
        sourceLabel,
        `root:${sourceClassification.legacyRoot}`,
        `${sourceLabel} remains under retired source root ${sourceClassification.legacyRoot}.`,
      );
      violations.set(violation.key, violation);
    } else if (sourceClassification.kind === 'unowned') {
      const violation = createViolation(
        'unowned-source-root',
        sourceLabel,
        `root:${sourceClassification.unownedRoot}`,
        `${sourceLabel} has no approved source owner.`,
      );
      violations.set(violation.key, violation);
    }

    const importedFiles = ts.preProcessFile(sourceContent, true, true).importedFiles;
    for (const importedFile of importedFiles) {
      const targetPath = resolveLocalImport({
        importerPath: filePath,
        sourceRoot,
        specifier: importedFile.fileName,
      });
      if (!targetPath) continue;

      const targetClassification = classifySourcePath(targetPath);
      for (const violation of analyzeDependency({
        source: sourceClassification,
        target: targetClassification,
        sourceContent,
      })) {
        violations.set(violation.key, violation);
      }

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
        'feature-cycle-edge',
        `feature:${sourceFeature}`,
        `feature:${targetFeature}`,
        `${sourceFeature} -> ${targetFeature} participates in a feature dependency cycle.`,
      );
      violations.set(violation.key, violation);
    }
  }

  return {
    violations: [...violations.values()].sort((left, right) => left.key.localeCompare(right.key)),
    sizeWarnings: sizeWarnings.sort((left, right) => left.path.localeCompare(right.path)),
  };
};

const run = async () => {
  const args = parseArguments(process.argv.slice(2));
  const analysis = await analyzeRepository(args.root);
  for (const warning of analysis.sizeWarnings) {
    console.log(`File-size review warning: ${warning.path} has ${warning.lineCount} lines (threshold ${FILE_SIZE_REVIEW_THRESHOLD}).`);
  }

  for (const violation of analysis.violations) {
    console.error(`Architecture violation: ${violation.key}\n  ${violation.message}`);
  }
  if (analysis.violations.length > 0) {
    process.exitCode = 1;
    return;
  }
  console.log(`Architecture check passed (0 violations; ${analysis.sizeWarnings.length} size warnings).`);
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
