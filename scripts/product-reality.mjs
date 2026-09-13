import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import ts from 'typescript';

const GRAPH_SCHEMA_VERSION = 1;
const GRAPH_PATH = 'docs/generated/product-reality.json';
const SURFACE_MAP_PATH = 'docs/product-surface-map.md';
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);
const TEST_EXTENSIONS = ['.test.ts', '.spec.ts'];
const WORKFLOW_EXTENSIONS = new Set(['.yml', '.yaml']);
const STATIC_SURFACE_IDS = new Set(['desk', 'library', 'profile', 'studio', 'owner', 'public']);
const PROVIDER_PATTERNS = [
  { id: 'clerk', label: 'Clerk', importPattern: /^@clerk\//u, sourcePatterns: [/clerk\.com/iu] },
  { id: 'supabase', label: 'Supabase', importPattern: /^@supabase\//u, sourcePatterns: [/supabase\.(?:co|com)/iu] },
  { id: 'stripe', label: 'Stripe', importPattern: /^stripe$/u, sourcePatterns: [/api\.stripe\.com/iu] },
  { id: 'google-drive', label: 'Google Drive', importPattern: null, sourcePatterns: [/drive\.googleapis\.com/iu, /google drive/iu] },
  { id: 'resend', label: 'Resend', importPattern: /^resend$/u, sourcePatterns: [/api\.resend\.com/iu] },
  { id: 'meta', label: 'Meta', importPattern: null, sourcePatterns: [/graph\.facebook\.com/iu, /graph\.instagram\.com/iu] },
  { id: 'posthog', label: 'PostHog', importPattern: /^posthog(?:-js|-node)?$/u, sourcePatterns: [/posthog\.com/iu] },
  { id: 'google-analytics', label: 'Google Analytics', importPattern: null, sourcePatterns: [/google-analytics\.com/iu, /googletagmanager\.com/iu, /GA4/gu] },
  { id: 'vercel', label: 'Vercel', importPattern: /^@vercel\//u, sourcePatterns: [/vercel\.app/iu, /api\.vercel\.com/iu] },
];

const toPosixPath = (value) => value.split(path.sep).join('/');
const stripModuleSuffix = (value) => value.replace(/\.(?:[cm]?[jt]sx?)$/u, '').replace(/\/index$/u, '');
const uniq = (values) => [...new Set(values)];
const canonicalJson = (value) => `${JSON.stringify(value, null, 2)}\n`;

const walkFiles = async (directory, predicate = () => true) => {
  const files = [];
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walkFiles(entryPath, predicate));
    else if (predicate(entryPath)) files.push(entryPath);
  }
  return files;
};

export const classifySourcePath = (relativePath) => {
  const modulePath = stripModuleSuffix(relativePath);
  const parts = modulePath.split('/');
  const [root, featureName] = parts;
  if (modulePath === 'proxy') return { kind: 'app', modulePath, parts };
  if (root === 'app') return { kind: 'app', modulePath, parts };
  if (root === 'domain') return { kind: 'domain', modulePath, parts };
  if (root === 'infrastructure') return { kind: 'infrastructure', modulePath, parts };
  if (root === 'shared') return { kind: 'shared', modulePath, parts };
  if (root === 'features' && featureName) {
    const featurePath = parts.slice(2).join('/');
    const [featureEntry] = featurePath.split('/');
    return {
      kind: 'feature', modulePath, parts, featureName, featurePath,
      publicEntry: featureEntry === 'client' || featureEntry === 'server' ? featureEntry : null,
    };
  }
  if (root === 'components' && featureName === 'ui') return { kind: 'ui', modulePath, parts };
  if (root === 'lib' || root === 'store' || root === 'types') return { kind: 'legacy', modulePath, parts, legacyRoot: root };
  return { kind: 'unowned', modulePath, parts, unownedRoot: root };
};

export const resolveLocalImport = ({ importerPath, sourceRoot, specifier }) => {
  let absoluteTarget;
  if (specifier.startsWith('@/')) absoluteTarget = path.join(sourceRoot, specifier.slice(2));
  else if (specifier.startsWith('.')) absoluteTarget = path.resolve(path.dirname(importerPath), specifier);
  else return null;
  const relativeTarget = path.relative(sourceRoot, absoluteTarget);
  if (relativeTarget === '' || relativeTarget.startsWith(`..${path.sep}`) || relativeTarget === '..' || path.isAbsolute(relativeTarget)) return null;
  return stripModuleSuffix(toPosixPath(relativeTarget));
};

const routeFromModulePath = (modulePath, leaf) => {
  const withoutApp = modulePath.replace(/^app\//u, '').replace(new RegExp(`(?:^|/)${leaf}$`, 'u'), '');
  const parts = withoutApp.split('/').filter((part) => part && !/^\(.+\)$/u.test(part));
  return `/${parts.join('/')}`.replace(/\/$/u, '') || '/';
};

const lineFor = (sourceFile, node) => sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;

const unwrapExpression = (node) => {
  let current = node;
  while (current && (
    ts.isAsExpression(current)
    || ts.isSatisfiesExpression?.(current)
    || ts.isParenthesizedExpression(current)
    || ts.isTypeAssertionExpression(current)
  )) current = current.expression;
  return current;
};

const staticString = (node) => {
  const current = unwrapExpression(node);
  if (!current) return null;
  if (ts.isStringLiteral(current) || ts.isNoSubstitutionTemplateLiteral(current)) return current.text;
  return null;
};

const propertyName = (node) => {
  if (!node) return null;
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return node.text;
  return null;
};

const objectProperties = (node) => {
  const current = unwrapExpression(node);
  if (!current || !ts.isObjectLiteralExpression(current)) return new Map();
  const map = new Map();
  for (const property of current.properties) {
    if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) continue;
    const name = propertyName(property.name);
    if (!name) continue;
    map.set(name, ts.isPropertyAssignment(property) ? property.initializer : property.name);
  }
  return map;
};

const staticArrayStrings = (node) => {
  const current = unwrapExpression(node);
  if (!current || !ts.isArrayLiteralExpression(current)) return null;
  const values = [];
  for (const element of current.elements) {
    const value = staticString(element);
    if (value === null) return null;
    values.push(value);
  }
  return values;
};

const staticObjectStrings = (node) => {
  const props = objectProperties(node);
  const result = {};
  for (const [key, valueNode] of props) {
    const value = staticString(valueNode);
    if (value !== null) result[key] = value;
    const values = staticArrayStrings(valueNode);
    if (values) result[key] = values;
  }
  return result;
};

const collectToolIds = (node) => {
  const values = new Set();
  const visit = (current) => {
    if (ts.isObjectLiteralExpression(current)) {
      const props = objectProperties(current);
      const toolId = staticString(props.get('toolId'));
      if (toolId) values.add(toolId);
    }
    ts.forEachChild(current, visit);
  };
  visit(node);
  return [...values];
};

const detectProviders = ({ importedSpecifiers, source }) => {
  const matches = new Set();
  for (const provider of PROVIDER_PATTERNS) {
    if (provider.importPattern && importedSpecifiers.some((specifier) => provider.importPattern.test(specifier))) matches.add(provider.id);
    if (provider.sourcePatterns.some((pattern) => {
      pattern.lastIndex = 0;
      return pattern.test(source);
    })) matches.add(provider.id);
  }
  return [...matches];
};

const buildAccumulator = () => {
  const nodes = new Map();
  const edges = new Map();
  const unknowns = new Map();

  const mergeEvidence = (current = [], incoming = []) => {
    const merged = new Map();
    for (const evidence of [...current, ...incoming]) merged.set(`${evidence.path}:${evidence.line ?? 0}:${evidence.reason ?? ''}`, evidence);
    return [...merged.values()].sort((left, right) => `${left.path}:${left.line ?? 0}`.localeCompare(`${right.path}:${right.line ?? 0}`));
  };

  const addNode = (node, evidence = []) => {
    const current = nodes.get(node.id);
    const merged = current ? { ...current, ...node, evidence: mergeEvidence(current.evidence, evidence) } : { ...node, evidence: mergeEvidence([], evidence) };
    nodes.set(node.id, merged);
    return merged;
  };

  const addEdge = (edge, evidence = []) => {
    const key = `${edge.from}|${edge.relation}|${edge.to}`;
    const current = edges.get(key);
    const merged = current ? { ...current, ...edge, evidence: mergeEvidence(current.evidence, evidence) } : { ...edge, evidence: mergeEvidence([], evidence) };
    edges.set(key, merged);
    return merged;
  };

  const addUnknown = (unknown) => {
    const key = `${unknown.kind}|${unknown.path}|${unknown.line ?? 0}|${unknown.message}`;
    unknowns.set(key, unknown);
  };

  return { addNode, addEdge, addUnknown, nodes, edges, unknowns };
};

const nodeLabel = (id) => id.includes(':') ? id.slice(id.indexOf(':') + 1) : id;

const buildSourceEvidence = async ({ root, accumulator, fingerprint }) => {
  const sourceRoot = path.join(root, 'src');
  const sourceFiles = await walkFiles(sourceRoot, (filePath) => SOURCE_EXTENSIONS.has(path.extname(filePath)) && !filePath.endsWith('.d.ts'));
  const featureNames = new Set();
  const environmentZones = new Set();

  for (const filePath of sourceFiles) {
    const relativePath = toPosixPath(path.relative(root, filePath));
    const sourceRelative = toPosixPath(path.relative(sourceRoot, filePath));
    const classification = classifySourcePath(sourceRelative);
    const source = await readFile(filePath, 'utf8');
    fingerprint.update(relativePath).update('\0').update(source).update('\0');
    const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const importedFiles = ts.preProcessFile(source, true, true).importedFiles.map((entry) => entry.fileName);
    const importedFeatureNames = new Set();

    if (classification.kind === 'feature') {
      featureNames.add(classification.featureName);
      accumulator.addNode({ id: `feature:${classification.featureName}`, kind: 'feature', label: classification.featureName }, [{ path: relativePath }]);
    }

    for (const specifier of importedFiles) {
      const targetPath = resolveLocalImport({ importerPath: filePath, sourceRoot, specifier });
      if (!targetPath) continue;
      const target = classifySourcePath(targetPath);
      if (target.kind !== 'feature') continue;
      importedFeatureNames.add(target.featureName);
      featureNames.add(target.featureName);
      accumulator.addNode({ id: `feature:${target.featureName}`, kind: 'feature', label: target.featureName }, [{ path: relativePath }]);
      if (classification.kind === 'feature' && classification.featureName !== target.featureName) {
        accumulator.addEdge({ from: `feature:${classification.featureName}`, to: `feature:${target.featureName}`, relation: 'depends-on', confidence: 'observed' }, [{ path: relativePath }]);
      }
    }

    const providerIds = detectProviders({ importedSpecifiers: importedFiles, source });
    for (const providerId of providerIds) {
      const provider = PROVIDER_PATTERNS.find((candidate) => candidate.id === providerId);
      accumulator.addNode({ id: `provider:${providerId}`, kind: 'provider', label: provider?.label ?? providerId }, [{ path: relativePath }]);
      if (classification.kind === 'feature') {
        accumulator.addEdge({ from: `feature:${classification.featureName}`, to: `provider:${providerId}`, relation: 'integrates-with', confidence: 'observed' }, [{ path: relativePath }]);
      }
    }

    if (classification.kind === 'app' && classification.modulePath.endsWith('/page')) {
      const route = routeFromModulePath(classification.modulePath, 'page');
      accumulator.addNode({ id: `route:${route}`, kind: 'route', label: route }, [{ path: relativePath }]);
      for (const featureName of importedFeatureNames) {
        accumulator.addEdge({ from: `route:${route}`, to: `feature:${featureName}`, relation: 'composes', confidence: 'observed' }, [{ path: relativePath }]);
      }
      const [topLevel] = route.split('/').filter(Boolean);
      if (topLevel && STATIC_SURFACE_IDS.has(topLevel)) {
        environmentZones.add(topLevel);
        accumulator.addNode({ id: `surface:${topLevel}`, kind: 'surface', label: topLevel }, [{ path: relativePath }]);
        accumulator.addEdge({ from: `surface:${topLevel}`, to: `route:${route}`, relation: 'exposes', confidence: 'observed' }, [{ path: relativePath }]);
      }
    }

    if (classification.kind === 'app' && classification.modulePath.endsWith('/route')) {
      const route = routeFromModulePath(classification.modulePath, 'route');
      const kind = route.startsWith('/api/') || route === '/api' ? 'api' : 'route';
      const prefix = kind === 'api' ? 'api' : 'route';
      accumulator.addNode({ id: `${prefix}:${route}`, kind, label: route }, [{ path: relativePath }]);
      for (const featureName of importedFeatureNames) {
        accumulator.addEdge({ from: `${prefix}:${route}`, to: `feature:${featureName}`, relation: kind === 'api' ? 'calls' : 'composes', confidence: 'observed' }, [{ path: relativePath }]);
      }
      for (const providerId of providerIds) {
        accumulator.addEdge({ from: `${prefix}:${route}`, to: `provider:${providerId}`, relation: 'integrates-with', confidence: 'observed' }, [{ path: relativePath }]);
      }
    }

    const visit = (node) => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'ENVIRONMENT_ZONE_IDS' && node.initializer) {
        const ids = staticArrayStrings(node.initializer);
        for (const id of ids ?? []) {
          environmentZones.add(id);
          accumulator.addNode({ id: `surface:${id}`, kind: 'surface', label: id }, [{ path: relativePath, line: lineFor(sourceFile, node) }]);
        }
      }

      if (ts.isObjectLiteralExpression(node)) {
        const props = objectProperties(node);
        const id = staticString(props.get('id'));
        const ownerFeature = staticString(props.get('ownerFeature'));
        const scope = staticString(props.get('scope'));
        const result = staticString(props.get('result'));
        const looksLikeAction = Boolean(id && /^[a-z][a-z0-9-]*\.[a-z0-9.-]+$/u.test(id) && (scope || result || props.has('automation')));
        if (looksLikeAction && ownerFeature) {
          const line = lineFor(sourceFile, node);
          const evidence = [{ path: relativePath, line }];
          featureNames.add(ownerFeature);
          accumulator.addNode({ id: `feature:${ownerFeature}`, kind: 'feature', label: ownerFeature }, evidence);
          const action = {
            id: `action:${id}`,
            kind: 'action',
            label: staticString(props.get('label')) ?? id,
            owner: ownerFeature,
            scope: scope ?? 'unknown',
            result: result ?? 'unknown',
            objectKinds: staticArrayStrings(props.get('supportedObjectKinds')) ?? [],
            sources: staticArrayStrings(props.get('supportedSources')) ?? [],
            permission: staticString(props.get('requiredPermission')) ?? 'unknown',
            commitment: staticString(props.get('commitment')) ?? 'unknown',
          };
          const automation = staticObjectStrings(props.get('automation'));
          action.automation = typeof automation.kind === 'string' ? automation.kind : 'unknown';
          accumulator.addNode(action, evidence);
          accumulator.addEdge({ from: `action:${id}`, to: `feature:${ownerFeature}`, relation: 'owned-by', confidence: 'observed' }, evidence);

          const namespace = id.split('.')[0];
          if (environmentZones.has(namespace) || STATIC_SURFACE_IDS.has(namespace)) {
            accumulator.addNode({ id: `surface:${namespace}`, kind: 'surface', label: namespace }, evidence);
            accumulator.addEdge({ from: `surface:${namespace}`, to: `action:${id}`, relation: 'exposes', confidence: 'observed' }, evidence);
          }

          if (automation.kind === 'published-mcp' && Array.isArray(automation.tools)) {
            for (const tool of automation.tools) {
              accumulator.addNode({ id: `mcp:${tool}`, kind: 'mcp', label: tool }, evidence);
              accumulator.addEdge({ from: `action:${id}`, to: `mcp:${tool}`, relation: 'automated-by', confidence: 'declared' }, evidence);
            }
          }
        } else if (looksLikeAction && !ownerFeature) {
          accumulator.addUnknown({
            kind: 'action-owner', path: relativePath, line: lineFor(sourceFile, node),
            message: `Action ${id} has no statically observable ownerFeature.`,
          });
        }

        const toolId = staticString(props.get('toolId'));
        if (toolId) {
          const evidence = [{ path: relativePath, line: lineFor(sourceFile, node) }];
          accumulator.addNode({ id: `tool:${toolId}`, kind: 'tool', label: toolId }, evidence);
          if (classification.kind === 'feature') accumulator.addEdge({ from: `tool:${toolId}`, to: `feature:${classification.featureName}`, relation: 'implemented-by', confidence: 'observed' }, evidence);
        }
      }

      if (ts.isPropertyAssignment(node)) {
        const actionId = propertyName(node.name);
        if (actionId && /^[a-z][a-z0-9-]*\.[a-z0-9.-]+$/u.test(actionId)) {
          for (const toolId of collectToolIds(node.initializer)) {
            const evidence = [{ path: relativePath, line: lineFor(sourceFile, node) }];
            accumulator.addNode({ id: `tool:${toolId}`, kind: 'tool', label: toolId }, evidence);
            accumulator.addEdge({ from: `action:${actionId}`, to: `tool:${toolId}`, relation: 'opens', confidence: 'observed' }, evidence);
          }
        }
      }

      if (ts.isCallExpression(node)) {
        const expressionName = ts.isPropertyAccessExpression(node.expression)
          ? node.expression.name.text
          : ts.isIdentifier(node.expression) ? node.expression.text : null;
        if (expressionName === 'registerTool') {
          const toolName = staticString(node.arguments[0]);
          if (toolName) {
            const evidence = [{ path: relativePath, line: lineFor(sourceFile, node) }];
            accumulator.addNode({ id: `mcp:${toolName}`, kind: 'mcp', label: toolName }, evidence);
            if (classification.kind === 'feature') {
              accumulator.addEdge({ from: `mcp:${toolName}`, to: `feature:${classification.featureName}`, relation: 'implemented-by', confidence: 'observed' }, evidence);
            } else {
              for (const featureName of importedFeatureNames) accumulator.addEdge({ from: `mcp:${toolName}`, to: `feature:${featureName}`, relation: 'calls', confidence: 'observed' }, evidence);
            }
          }
        }
      }

      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  for (const featureName of featureNames) accumulator.addNode({ id: `feature:${featureName}`, kind: 'feature', label: featureName });
};

const buildTestEvidence = async ({ root, accumulator, fingerprint }) => {
  const testsRoot = path.join(root, 'tests');
  const sourceRoot = path.join(root, 'src');
  const testFiles = await walkFiles(testsRoot, (filePath) => TEST_EXTENSIONS.some((extension) => filePath.endsWith(extension)));
  for (const filePath of testFiles) {
    const relativePath = toPosixPath(path.relative(root, filePath));
    const source = await readFile(filePath, 'utf8');
    fingerprint.update(relativePath).update('\0').update(source).update('\0');
    const importedFiles = ts.preProcessFile(source, true, true).importedFiles.map((entry) => entry.fileName);
    const featureNames = new Set();
    for (const specifier of importedFiles) {
      const targetPath = resolveLocalImport({ importerPath: filePath, sourceRoot, specifier });
      if (!targetPath) continue;
      const classification = classifySourcePath(targetPath);
      if (classification.kind === 'feature') featureNames.add(classification.featureName);
    }
    if (featureNames.size === 0) continue;
    accumulator.addNode({ id: `test:${relativePath}`, kind: 'test', label: relativePath }, [{ path: relativePath }]);
    for (const featureName of featureNames) {
      accumulator.addNode({ id: `feature:${featureName}`, kind: 'feature', label: featureName });
      accumulator.addEdge({ from: `feature:${featureName}`, to: `test:${relativePath}`, relation: 'covered-by', confidence: 'observed' }, [{ path: relativePath }]);
    }
  }
};

const buildWorkflowEvidence = async ({ root, accumulator, fingerprint }) => {
  const workflowRoot = path.join(root, '.github', 'workflows');
  const workflowFiles = await walkFiles(workflowRoot, (filePath) => WORKFLOW_EXTENSIONS.has(path.extname(filePath)));
  for (const filePath of workflowFiles) {
    const relativePath = toPosixPath(path.relative(root, filePath));
    const source = await readFile(filePath, 'utf8');
    fingerprint.update(relativePath).update('\0').update(source).update('\0');
    const commands = uniq([...source.matchAll(/npm run ([a-zA-Z0-9:_-]+)/gu)].map((match) => match[1])).sort();
    const labelMatch = /^name:\s*(.+)$/mu.exec(source);
    accumulator.addNode({
      id: `workflow:${relativePath}`,
      kind: 'workflow',
      label: labelMatch?.[1]?.trim() ?? path.basename(relativePath),
      commands,
    }, [{ path: relativePath }]);
  }
};

const summarizeKinds = (nodes) => {
  const summary = {};
  for (const node of nodes) summary[node.kind] = (summary[node.kind] ?? 0) + 1;
  return Object.fromEntries(Object.entries(summary).sort(([left], [right]) => left.localeCompare(right)));
};

export async function buildProductReality(root = process.cwd()) {
  const accumulator = buildAccumulator();
  const fingerprint = createHash('sha256');
  await buildSourceEvidence({ root, accumulator, fingerprint });
  await buildTestEvidence({ root, accumulator, fingerprint });
  await buildWorkflowEvidence({ root, accumulator, fingerprint });

  const nodes = [...accumulator.nodes.values()].sort((left, right) => left.id.localeCompare(right.id));
  const edges = [...accumulator.edges.values()].sort((left, right) => `${left.from}|${left.relation}|${left.to}`.localeCompare(`${right.from}|${right.relation}|${right.to}`));
  const unknowns = [...accumulator.unknowns.values()].sort((left, right) => `${left.path}:${left.line ?? 0}:${left.kind}`.localeCompare(`${right.path}:${right.line ?? 0}:${right.kind}`));
  const sourceFingerprint = fingerprint.digest('hex').slice(0, 20);
  return {
    schemaVersion: GRAPH_SCHEMA_VERSION,
    sourceFingerprint,
    summary: {
      nodes: nodes.length,
      edges: edges.length,
      unknowns: unknowns.length,
      kinds: summarizeKinds(nodes),
    },
    nodes,
    edges,
    unknowns,
  };
}

const relationsFrom = (graph, id, relation = null) => graph.edges.filter((edge) => edge.from === id && (!relation || edge.relation === relation));
const relationsTo = (graph, id, relation = null) => graph.edges.filter((edge) => edge.to === id && (!relation || edge.relation === relation));
const labelForId = (graph, id) => graph.nodes.find((node) => node.id === id)?.label ?? nodeLabel(id);

export function renderSurfaceMap(graph) {
  const lines = [
    '# CardForge Product Surface Map',
    '',
    '> **Generated current-state projection. Do not edit this file by hand.**',
    '>',
    '> Source code is authoritative. `docs/product-direction.md` owns desired/future product behavior; `docs/architecture.md` owns architectural rules and invariants. This map reports only relationships the Product Reality scanner can observe in the current repository.',
    '',
    `Source fingerprint: \`${graph.sourceFingerprint}\``,
    '',
    'Regenerate with `npm run product-reality:generate`. Query narrower slices with `npm run product-reality:query -- --surface studio`, `--feature project`, `--kind mcp`, or `--unknown`.',
    '',
    '## Topology summary',
    '',
    `- ${graph.summary.nodes} observed nodes`,
    `- ${graph.summary.edges} observed relationships`,
    `- ${graph.summary.unknowns} unresolved observations`,
    `- ${graph.summary.kinds.surface ?? 0} surfaces, ${graph.summary.kinds.action ?? 0} semantic actions, ${graph.summary.kinds.feature ?? 0} feature owners, ${graph.summary.kinds.api ?? 0} API routes, ${graph.summary.kinds.mcp ?? 0} MCP tools, ${graph.summary.kinds.provider ?? 0} providers, ${graph.summary.kinds.test ?? 0} linked tests`,
    '',
    '## Surfaces',
    '',
    '| Surface | Actions | Feature owners | Tool opens | Published MCP links |',
    '| --- | ---: | --- | --- | ---: |',
  ];

  const surfaces = graph.nodes.filter((node) => node.kind === 'surface');
  for (const surface of surfaces) {
    const actionIds = relationsFrom(graph, surface.id, 'exposes').map((edge) => edge.to).filter((id) => id.startsWith('action:'));
    const ownerIds = uniq(actionIds.flatMap((actionId) => relationsFrom(graph, actionId, 'owned-by').map((edge) => edge.to)));
    const toolIds = uniq(actionIds.flatMap((actionId) => relationsFrom(graph, actionId, 'opens').map((edge) => edge.to)));
    const mcpCount = actionIds.flatMap((actionId) => relationsFrom(graph, actionId, 'automated-by')).length;
    lines.push(`| **${surface.label}** | ${actionIds.length} | ${ownerIds.map((id) => `\`${labelForId(graph, id)}\``).join(', ') || '—'} | ${toolIds.map((id) => `\`${labelForId(graph, id)}\``).join(', ') || '—'} | ${mcpCount} |`);
  }

  lines.push('', '### Surface actions', '');
  for (const surface of surfaces) {
    const actionIds = relationsFrom(graph, surface.id, 'exposes').map((edge) => edge.to).filter((id) => id.startsWith('action:'));
    if (actionIds.length === 0) continue;
    lines.push(`#### ${surface.label}`, '', '| Action | Owner | Scope | Result | Automation |', '| --- | --- | --- | --- | --- |');
    for (const actionId of actionIds.sort()) {
      const action = graph.nodes.find((node) => node.id === actionId);
      if (!action) continue;
      lines.push(`| \`${nodeLabel(actionId)}\` | \`${action.owner ?? 'unknown'}\` | ${action.scope ?? 'unknown'} | ${action.result ?? 'unknown'} | ${action.automation ?? 'unknown'} |`);
    }
    lines.push('');
  }

  lines.push('## Feature owners', '', '| Feature | Actions | Depends on | Used by | APIs | MCP tools | Providers | Linked tests |', '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  const features = graph.nodes.filter((node) => node.kind === 'feature');
  for (const feature of features) {
    const actionCount = relationsTo(graph, feature.id, 'owned-by').length;
    const dependsOn = relationsFrom(graph, feature.id, 'depends-on').length;
    const usedBy = relationsTo(graph, feature.id, 'depends-on').length;
    const apis = relationsTo(graph, feature.id, 'calls').filter((edge) => edge.from.startsWith('api:')).length;
    const mcp = [...relationsTo(graph, feature.id, 'implemented-by'), ...relationsTo(graph, feature.id, 'calls')].filter((edge) => edge.from.startsWith('mcp:')).length;
    const providers = relationsFrom(graph, feature.id, 'integrates-with').length;
    const tests = relationsFrom(graph, feature.id, 'covered-by').length;
    lines.push(`| \`${feature.label}\` | ${actionCount} | ${dependsOn} | ${usedBy} | ${apis} | ${mcp} | ${providers} | ${tests} |`);
  }

  const providers = graph.nodes.filter((node) => node.kind === 'provider');
  if (providers.length > 0) {
    lines.push('', '## Provider boundaries', '', '| Provider | Observed feature owners | API routes |', '| --- | --- | --- |');
    for (const provider of providers) {
      const owners = relationsTo(graph, provider.id, 'integrates-with').filter((edge) => edge.from.startsWith('feature:')).map((edge) => `\`${labelForId(graph, edge.from)}\``);
      const apis = relationsTo(graph, provider.id, 'integrates-with').filter((edge) => edge.from.startsWith('api:')).map((edge) => `\`${labelForId(graph, edge.from)}\``);
      lines.push(`| ${provider.label} | ${uniq(owners).join(', ') || '—'} | ${uniq(apis).join(', ') || '—'} |`);
    }
  }

  const mcpNodes = graph.nodes.filter((node) => node.kind === 'mcp');
  if (mcpNodes.length > 0) {
    lines.push('', '## MCP topology', '', '| MCP tool | Observed feature relationships | Human action parity |', '| --- | --- | --- |');
    for (const tool of mcpNodes) {
      const featureIds = uniq([...relationsFrom(graph, tool.id, 'implemented-by'), ...relationsFrom(graph, tool.id, 'calls')].map((edge) => edge.to).filter((id) => id.startsWith('feature:')));
      const humanActions = relationsTo(graph, tool.id, 'automated-by').map((edge) => `\`${nodeLabel(edge.from)}\``);
      lines.push(`| \`${tool.label}\` | ${featureIds.map((id) => `\`${labelForId(graph, id)}\``).join(', ') || '—'} | ${humanActions.join(', ') || 'supporting/none observed'} |`);
    }
  }

  lines.push('', '## Observability gaps', '');
  if (graph.unknowns.length === 0) lines.push('No unresolved observations were emitted by the current scanner.');
  else {
    lines.push(`The scanner found ${graph.unknowns.length} relationship${graph.unknowns.length === 1 ? '' : 's'} it could not prove. Unknown never means healthy or broken; it means the repository does not currently expose enough static evidence.`, '');
    for (const unknown of graph.unknowns.slice(0, 20)) lines.push(`- **${unknown.kind}** — ${unknown.message} (\`${unknown.path}:${unknown.line ?? 1}\`)`);
    if (graph.unknowns.length > 20) lines.push(`- … ${graph.unknowns.length - 20} more; run \`npm run product-reality:query -- --unknown\`.`);
  }

  lines.push('', '## Reading this map', '', '- This map describes **observed current reality**, not desired placement or UX quality.', '- File/function detail is retained as evidence on graph nodes and edges rather than expanded into this dashboard.', '- A missing relationship may be a real removal or a scanner limit; use the evidence paths and `--unknown` before treating it as dead code.', '- PR review should use `npm run product-reality:diff -- --base <ref>` to inspect the A→B topology delta.', '');
  return lines.join('\n');
}

export async function generateProductReality(root = process.cwd()) {
  const graph = await buildProductReality(root);
  const graphOutput = canonicalJson(graph);
  const mapOutput = `${renderSurfaceMap(graph).trimEnd()}\n`;
  await mkdir(path.join(root, path.dirname(GRAPH_PATH)), { recursive: true });
  await writeFile(path.join(root, GRAPH_PATH), graphOutput, 'utf8');
  await writeFile(path.join(root, SURFACE_MAP_PATH), mapOutput, 'utf8');
  return { graph, graphOutput, mapOutput };
}

export async function checkProductReality(root = process.cwd()) {
  const graph = await buildProductReality(root);
  const expectedGraph = canonicalJson(graph);
  const expectedMap = `${renderSurfaceMap(graph).trimEnd()}\n`;
  const currentGraph = await readFile(path.join(root, GRAPH_PATH), 'utf8').catch(() => '');
  const currentMap = await readFile(path.join(root, SURFACE_MAP_PATH), 'utf8').catch(() => '');
  const stale = [];
  if (currentGraph !== expectedGraph) stale.push(GRAPH_PATH);
  if (currentMap !== expectedMap) stale.push(SURFACE_MAP_PATH);
  return { stale, graph };
}

const semanticNode = (node) => Object.fromEntries(Object.entries(node).filter(([key]) => key !== 'evidence'));
const semanticEdge = (edge) => Object.fromEntries(Object.entries(edge).filter(([key]) => key !== 'evidence'));
const edgeKey = (edge) => `${edge.from}|${edge.relation}|${edge.to}`;
const sameJson = (left, right) => JSON.stringify(left) === JSON.stringify(right);

export function diffProductReality(baseGraph, currentGraph) {
  const baseNodes = new Map(baseGraph.nodes.map((node) => [node.id, node]));
  const currentNodes = new Map(currentGraph.nodes.map((node) => [node.id, node]));
  const baseEdges = new Map(baseGraph.edges.map((edge) => [edgeKey(edge), edge]));
  const currentEdges = new Map(currentGraph.edges.map((edge) => [edgeKey(edge), edge]));
  const addedNodes = [...currentNodes.keys()].filter((id) => !baseNodes.has(id)).sort();
  const removedNodes = [...baseNodes.keys()].filter((id) => !currentNodes.has(id)).sort();
  const changedNodes = [...currentNodes.keys()].filter((id) => baseNodes.has(id) && !sameJson(semanticNode(baseNodes.get(id)), semanticNode(currentNodes.get(id)))).sort();
  const addedEdges = [...currentEdges.keys()].filter((key) => !baseEdges.has(key)).sort();
  const removedEdges = [...baseEdges.keys()].filter((key) => !currentEdges.has(key)).sort();
  const changedEdges = [...currentEdges.keys()].filter((key) => baseEdges.has(key) && !sameJson(semanticEdge(baseEdges.get(key)), semanticEdge(currentEdges.get(key)))).sort();
  return { addedNodes, removedNodes, changedNodes, addedEdges, removedEdges, changedEdges };
}

export function formatProductRealityDelta(delta, { baseLabel = 'base', currentLabel = 'working tree' } = {}) {
  const count = delta.addedNodes.length + delta.removedNodes.length + delta.changedNodes.length + delta.addedEdges.length + delta.removedEdges.length + delta.changedEdges.length;
  const lines = [
    '## Product Reality topology delta',
    '',
    `Comparing \`${baseLabel}\` → \`${currentLabel}\`.`,
    '',
    `- ${delta.addedNodes.length} added nodes`,
    `- ${delta.removedNodes.length} removed nodes`,
    `- ${delta.changedNodes.length} changed nodes`,
    `- ${delta.addedEdges.length} added relationships`,
    `- ${delta.removedEdges.length} removed relationships`,
    `- ${delta.changedEdges.length} changed relationships`,
  ];
  if (count === 0) return [...lines, '', 'No product-topology change observed.', ''].join('\n');
  const section = (title, values, formatter = (value) => `\`${value}\``) => {
    if (values.length === 0) return;
    lines.push('', `### ${title}`, '');
    for (const value of values.slice(0, 60)) lines.push(`- ${formatter(value)}`);
    if (values.length > 60) lines.push(`- … ${values.length - 60} more`);
  };
  section('Added nodes', delta.addedNodes);
  section('Removed nodes', delta.removedNodes);
  section('Changed nodes', delta.changedNodes);
  section('Added relationships', delta.addedEdges, (value) => `\`${value.replaceAll('|', ' → ')}\``);
  section('Removed relationships', delta.removedEdges, (value) => `\`${value.replaceAll('|', ' → ')}\``);
  section('Changed relationships', delta.changedEdges, (value) => `\`${value.replaceAll('|', ' → ')}\``);
  lines.push('');
  return lines.join('\n');
}

const archiveGitRef = async (root, ref) => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'cardforge-product-reality-'));
  const archive = spawnSync('git', ['archive', '--format=tar', ref, 'src', 'tests', '.github/workflows'], {
    cwd: root,
    encoding: null,
    maxBuffer: 128 * 1024 * 1024,
  });
  if (archive.status !== 0) {
    await rm(tempRoot, { recursive: true, force: true });
    throw new Error(`Unable to archive ${ref}: ${archive.stderr?.toString('utf8') || 'git archive failed'}`);
  }
  const extract = spawnSync('tar', ['-xf', '-', '-C', tempRoot], { input: archive.stdout, encoding: null, maxBuffer: 128 * 1024 * 1024 });
  if (extract.status !== 0) {
    await rm(tempRoot, { recursive: true, force: true });
    throw new Error(`Unable to extract ${ref}: ${extract.stderr?.toString('utf8') || 'tar failed'}`);
  }
  return tempRoot;
};

export async function buildProductRealityAtRef(root, ref) {
  const tempRoot = await archiveGitRef(root, ref);
  try {
    return await buildProductReality(tempRoot);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

const parseArgs = (values) => {
  const [command = 'query', ...rest] = values;
  const args = { command, base: null, surface: null, feature: null, kind: null, unknown: false };
  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index];
    if (value === '--unknown') args.unknown = true;
    else if (['--base', '--surface', '--feature', '--kind'].includes(value)) {
      const next = rest[index + 1];
      if (!next) throw new Error(`${value} requires a value.`);
      args[value.slice(2)] = next;
      index += 1;
    } else throw new Error(`Unknown Product Reality option: ${value}`);
  }
  return args;
};

const queryGraph = (graph, args) => {
  if (args.unknown) {
    if (graph.unknowns.length === 0) return 'No unresolved observations.\n';
    return `${graph.unknowns.map((entry) => `${entry.kind}\t${entry.path}:${entry.line ?? 1}\t${entry.message}`).join('\n')}\n`;
  }
  const seedIds = new Set();
  if (args.surface) seedIds.add(`surface:${args.surface}`);
  else if (args.feature) seedIds.add(`feature:${args.feature}`);
  else if (args.kind) for (const node of graph.nodes.filter((candidate) => candidate.kind === args.kind)) seedIds.add(node.id);
  else for (const node of graph.nodes) seedIds.add(node.id);

  const included = new Set(seedIds);
  for (const edge of graph.edges) {
    if (seedIds.has(edge.from) || seedIds.has(edge.to)) {
      included.add(edge.from);
      included.add(edge.to);
    }
  }
  const lines = ['NODES'];
  for (const node of graph.nodes.filter((candidate) => included.has(candidate.id))) lines.push(`${node.id}\t${node.label}`);
  lines.push('', 'RELATIONSHIPS');
  for (const edge of graph.edges.filter((candidate) => included.has(candidate.from) && included.has(candidate.to))) lines.push(`${edge.from}\t${edge.relation}\t${edge.to}`);
  return `${lines.join('\n')}\n`;
};

const isDirectExecution = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isDirectExecution) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const root = process.cwd();
    if (args.command === 'generate') {
      const { graph } = await generateProductReality(root);
      console.log(`Product Reality generated (${graph.summary.nodes} nodes, ${graph.summary.edges} relationships, fingerprint ${graph.sourceFingerprint}).`);
    } else if (args.command === 'check') {
      const result = await checkProductReality(root);
      if (result.stale.length > 0) {
        console.error(`Product Reality is stale: ${result.stale.join(', ')}. Run npm run product-reality:generate and commit the result.`);
        process.exitCode = 1;
      } else console.log(`Product Reality is current (${result.graph.summary.nodes} nodes, ${result.graph.summary.edges} relationships).`);
    } else if (args.command === 'query') {
      const graph = await buildProductReality(root);
      process.stdout.write(queryGraph(graph, args));
    } else if (args.command === 'diff') {
      const base = args.base ?? process.env.CARDFORGE_VERIFY_BASE?.trim() ?? 'origin/main';
      const [baseGraph, currentGraph] = await Promise.all([buildProductRealityAtRef(root, base), buildProductReality(root)]);
      process.stdout.write(formatProductRealityDelta(diffProductReality(baseGraph, currentGraph), { baseLabel: base }));
    } else throw new Error(`Unknown Product Reality command: ${args.command}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
