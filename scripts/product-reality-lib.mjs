import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import ts from 'typescript';

export const PRODUCT_REALITY_SCHEMA_VERSION = 1;
export const PRODUCT_REALITY_GRAPH_PATH = 'docs/generated/product-reality.json';
export const PRODUCT_REALITY_SURFACE_MAP_PATH = 'docs/product-surface-map.md';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);
const TEST_EXTENSIONS = ['.test.ts', '.spec.ts'];
const WORKFLOW_EXTENSIONS = new Set(['.yml', '.yaml']);
const PRIVATE_SURFACE_IDS = new Set(['desk', 'library', 'profile', 'studio']);
const ACTION_ID_PATTERN = /^[a-z][a-z0-9-]*\.[a-z0-9.-]+$/u;

const PROVIDERS = [
  {
    id: 'clerk',
    label: 'Clerk',
    imports: [/^@clerk\//u],
    hosts: [/clerk\.com/iu],
    paths: [],
  },
  {
    id: 'supabase',
    label: 'Supabase',
    imports: [/^@supabase\//u],
    hosts: [/supabase\.(?:co|com)/iu],
    paths: [],
  },
  {
    id: 'stripe',
    label: 'Stripe',
    imports: [/^stripe$/u],
    hosts: [/api\.stripe\.com/iu],
    paths: [],
  },
  {
    id: 'google-drive',
    label: 'Google Drive',
    imports: [],
    hosts: [/drive\.googleapis\.com/iu, /accounts\.google\.com\/o\/oauth2/iu],
    paths: [/(?:^|\/)(?:google-drive|googleDrive)(?:\/|\.|$)/u],
  },
  {
    id: 'resend',
    label: 'Resend',
    imports: [/^resend$/u],
    hosts: [/api\.resend\.com/iu],
    paths: [],
  },
  {
    id: 'meta',
    label: 'Meta',
    imports: [],
    hosts: [/graph\.facebook\.com/iu, /graph\.instagram\.com/iu],
    paths: [],
  },
  {
    id: 'posthog',
    label: 'PostHog',
    imports: [/^posthog(?:-js|-node)?$/u],
    hosts: [/posthog\.com/iu],
    paths: [],
  },
  {
    id: 'google-analytics',
    label: 'Google Analytics',
    imports: [],
    hosts: [/google-analytics\.com/iu, /googletagmanager\.com/iu],
    paths: [],
  },
  {
    id: 'vercel',
    label: 'Vercel',
    imports: [/^@vercel\//u],
    hosts: [/api\.vercel\.com/iu],
    paths: [],
  },
];

const toPosixPath = (value) => value.split(path.sep).join('/');
const stripModuleSuffix = (value) => value.replace(/\.(?:[cm]?[jt]sx?)$/u, '').replace(/\/index$/u, '');
const uniq = (values) => [...new Set(values)];
const canonicalJson = (value) => `${JSON.stringify(value, null, 2)}\n`;
const edgeKey = (edge) => `${edge.from}|${edge.relation}|${edge.to}`;

const walkFiles = async (directory, predicate = () => true) => {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walkFiles(entryPath, predicate));
    else if (predicate(entryPath)) files.push(entryPath);
  }
  return files;
};

export const classifyProductRealitySourcePath = (relativePath) => {
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
      kind: 'feature',
      modulePath,
      parts,
      featureName,
      featurePath,
      publicEntry: featureEntry === 'client' || featureEntry === 'server' ? featureEntry : null,
    };
  }
  if (root === 'components' && featureName === 'ui') return { kind: 'ui', modulePath, parts };
  if (root === 'lib' || root === 'store' || root === 'types') return { kind: 'legacy', modulePath, parts, legacyRoot: root };
  return { kind: 'unowned', modulePath, parts, unownedRoot: root };
};

export const resolveProductRealityLocalImport = ({ importerPath, sourceRoot, specifier }) => {
  let absoluteTarget;
  if (specifier.startsWith('@/')) absoluteTarget = path.join(sourceRoot, specifier.slice(2));
  else if (specifier.startsWith('.')) absoluteTarget = path.resolve(path.dirname(importerPath), specifier);
  else return null;
  const relativeTarget = path.relative(sourceRoot, absoluteTarget);
  if (
    relativeTarget === ''
    || relativeTarget === '..'
    || relativeTarget.startsWith(`..${path.sep}`)
    || path.isAbsolute(relativeTarget)
  ) return null;
  return stripModuleSuffix(toPosixPath(relativeTarget));
};

const routeFromModulePath = (modulePath, leaf) => {
  const withoutApp = modulePath.replace(/^app\//u, '').replace(new RegExp(`(?:^|/)${leaf}$`, 'u'), '');
  const parts = withoutApp.split('/').filter((part) => part && !/^\(.+\)$/u.test(part));
  return `/${parts.join('/')}`.replace(/\/$/u, '') || '/';
};

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
  const result = new Map();
  for (const property of current.properties) {
    if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) continue;
    const name = propertyName(property.name);
    if (!name) continue;
    result.set(name, ts.isPropertyAssignment(property) ? property.initializer : property.name);
  }
  return result;
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

const stringCandidates = (node) => {
  const current = unwrapExpression(node);
  if (!current) return [];
  const direct = staticString(current);
  if (direct !== null) return [direct];
  if (ts.isConditionalExpression(current)) {
    return uniq([
      ...stringCandidates(current.whenTrue),
      ...stringCandidates(current.whenFalse),
    ]);
  }
  if (ts.isBinaryExpression(current) && current.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) {
    return uniq([...stringCandidates(current.left), ...stringCandidates(current.right)]);
  }
  return [];
};

const stringLiteralUnionValues = (typeNode) => {
  if (!typeNode) return [];
  if (ts.isUnionTypeNode(typeNode)) return uniq(typeNode.types.flatMap(stringLiteralUnionValues));
  if (ts.isLiteralTypeNode(typeNode) && ts.isStringLiteral(typeNode.literal)) return [typeNode.literal.text];
  return [];
};

const staticAutomation = (node) => {
  const props = objectProperties(node);
  const kind = staticString(props.get('kind'));
  const tools = staticArrayStrings(props.get('tools')) ?? [];
  return { kind: kind ?? 'unknown', tools };
};

const collectToolIds = (node) => {
  const values = new Set();
  const visit = (current) => {
    if (ts.isObjectLiteralExpression(current)) {
      const toolId = staticString(objectProperties(current).get('toolId'));
      if (toolId) values.add(toolId);
    }
    ts.forEachChild(current, visit);
  };
  visit(node);
  return [...values];
};

const providerEvidence = ({ importedSpecifiers, source, relativePath }) => {
  const results = [];
  for (const provider of PROVIDERS) {
    const byImport = provider.imports.some((pattern) => importedSpecifiers.some((specifier) => pattern.test(specifier)));
    const byHost = provider.hosts.some((pattern) => pattern.test(source));
    const byPath = provider.paths.some((pattern) => pattern.test(relativePath));
    if (byImport || byHost || byPath) {
      results.push({
        id: provider.id,
        label: provider.label,
        reason: byImport ? 'provider import' : byHost ? 'provider host' : 'provider-specific source path',
      });
    }
  }
  return results;
};

const createAccumulator = () => {
  const nodes = new Map();
  const edges = new Map();
  const unknowns = new Map();

  const mergeEvidence = (current = [], incoming = []) => {
    const merged = new Map();
    for (const evidence of [...current, ...incoming]) {
      merged.set(`${evidence.path}:${evidence.line ?? 0}:${evidence.reason ?? ''}`, evidence);
    }
    return [...merged.values()].sort((left, right) => (
      `${left.path}:${left.line ?? 0}:${left.reason ?? ''}`.localeCompare(`${right.path}:${right.line ?? 0}:${right.reason ?? ''}`)
    ));
  };

  const addNode = (node, evidence = []) => {
    const current = nodes.get(node.id);
    nodes.set(node.id, current
      ? { ...current, ...node, evidence: mergeEvidence(current.evidence, evidence) }
      : { ...node, evidence: mergeEvidence([], evidence) });
  };

  const addEdge = (edge, evidence = []) => {
    const key = edgeKey(edge);
    const current = edges.get(key);
    edges.set(key, current
      ? { ...current, ...edge, evidence: mergeEvidence(current.evidence, evidence) }
      : { ...edge, evidence: mergeEvidence([], evidence) });
  };

  const addUnknown = (unknown) => {
    const key = `${unknown.kind}|${unknown.path}|${unknown.line ?? 0}|${unknown.message}`;
    unknowns.set(key, unknown);
  };

  return { nodes, edges, unknowns, addNode, addEdge, addUnknown };
};

const addFeatureNode = (accumulator, featureName, evidence = []) => {
  accumulator.addNode({ id: `feature:${featureName}`, kind: 'feature', label: featureName }, evidence);
};

const addSurfaceNode = (accumulator, surfaceId, evidence = []) => {
  accumulator.addNode({ id: `surface:${surfaceId}`, kind: 'surface', label: surfaceId }, evidence);
};

const addToolNode = (accumulator, toolId, evidence = []) => {
  accumulator.addNode({ id: `tool:${toolId}`, kind: 'tool', label: toolId }, evidence);
};

const addActionNode = ({ accumulator, id, label, owners, props, evidence }) => {
  const owner = owners.length === 1 ? owners[0] : owners.length > 1 ? 'contextual' : 'unknown';
  const automation = staticAutomation(props.get('automation'));
  accumulator.addNode({
    id: `action:${id}`,
    kind: 'action',
    label: label ?? id,
    owner,
    owners,
    scope: staticString(props.get('scope')) ?? 'unknown',
    result: staticString(props.get('result')) ?? 'unknown',
    objectKinds: staticArrayStrings(props.get('supportedObjectKinds')) ?? [],
    sources: staticArrayStrings(props.get('supportedSources')) ?? [],
    permission: staticString(props.get('requiredPermission')) ?? 'unknown',
    commitment: staticString(props.get('commitment')) ?? 'unknown',
    automation: automation.kind,
  }, evidence);

  for (const ownerFeature of owners) {
    addFeatureNode(accumulator, ownerFeature, evidence);
    accumulator.addEdge({
      from: `action:${id}`,
      to: `feature:${ownerFeature}`,
      relation: 'owned-by',
      confidence: owners.length === 1 ? 'declared' : 'contextual',
    }, evidence);
  }

  const namespace = id.split('.')[0];
  if (PRIVATE_SURFACE_IDS.has(namespace)) {
    addSurfaceNode(accumulator, namespace, evidence);
    accumulator.addEdge({ from: `surface:${namespace}`, to: `action:${id}`, relation: 'exposes', confidence: 'observed' }, evidence);
  }

  if (automation.kind === 'published-mcp') {
    for (const tool of automation.tools) {
      accumulator.addNode({ id: `mcp:${tool}`, kind: 'mcp', label: tool }, evidence);
      accumulator.addEdge({ from: `action:${id}`, to: `mcp:${tool}`, relation: 'automated-by', confidence: 'declared' }, evidence);
    }
  }
};

const buildSourceEvidence = async ({ root, accumulator, fingerprint }) => {
  const sourceRoot = path.join(root, 'src');
  const sourceFiles = await walkFiles(sourceRoot, (filePath) => (
    SOURCE_EXTENSIONS.has(path.extname(filePath)) && !filePath.endsWith('.d.ts')
  ));

  for (const filePath of sourceFiles) {
    const relativePath = toPosixPath(path.relative(root, filePath));
    const sourceRelative = toPosixPath(path.relative(sourceRoot, filePath));
    const classification = classifyProductRealitySourcePath(sourceRelative);
    const source = await readFile(filePath, 'utf8');
    fingerprint.update(relativePath).update('\0').update(source).update('\0');

    const sourceFile = ts.createSourceFile(
      filePath,
      source,
      ts.ScriptTarget.Latest,
      true,
      filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const lineFor = (node) => sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
    const importedSpecifiers = ts.preProcessFile(source, true, true).importedFiles.map((entry) => entry.fileName);
    const importedFeatureNames = new Set();

    if (classification.kind === 'feature') addFeatureNode(accumulator, classification.featureName, [{ path: relativePath }]);

    for (const specifier of importedSpecifiers) {
      const targetPath = resolveProductRealityLocalImport({ importerPath: filePath, sourceRoot, specifier });
      if (!targetPath) continue;
      const target = classifyProductRealitySourcePath(targetPath);
      if (target.kind !== 'feature') continue;
      importedFeatureNames.add(target.featureName);
      addFeatureNode(accumulator, target.featureName, [{ path: relativePath }]);
      if (classification.kind === 'feature' && classification.featureName !== target.featureName) {
        accumulator.addEdge({
          from: `feature:${classification.featureName}`,
          to: `feature:${target.featureName}`,
          relation: 'depends-on',
          confidence: 'observed',
        }, [{ path: relativePath, reason: `imports ${specifier}` }]);
      }
    }

    const providers = providerEvidence({ importedSpecifiers, source, relativePath });
    for (const provider of providers) {
      const evidence = [{ path: relativePath, reason: provider.reason }];
      accumulator.addNode({ id: `provider:${provider.id}`, kind: 'provider', label: provider.label }, evidence);
      if (classification.kind === 'feature') {
        accumulator.addEdge({
          from: `feature:${classification.featureName}`,
          to: `provider:${provider.id}`,
          relation: 'integrates-with',
          confidence: 'observed',
        }, evidence);
      }
    }

    let currentRouteId = null;
    if (classification.kind === 'app' && classification.modulePath.endsWith('/page')) {
      const route = routeFromModulePath(classification.modulePath, 'page');
      currentRouteId = `route:${route}`;
      accumulator.addNode({ id: currentRouteId, kind: 'route', label: route }, [{ path: relativePath }]);
      for (const featureName of importedFeatureNames) {
        accumulator.addEdge({ from: currentRouteId, to: `feature:${featureName}`, relation: 'composes', confidence: 'observed' }, [{ path: relativePath }]);
      }
      if (route === '/studio') {
        addSurfaceNode(accumulator, 'studio', [{ path: relativePath }]);
        accumulator.addEdge({ from: 'surface:studio', to: currentRouteId, relation: 'exposes', confidence: 'observed' }, [{ path: relativePath }]);
      }
    }

    if (classification.kind === 'app' && classification.modulePath.endsWith('/route')) {
      const route = routeFromModulePath(classification.modulePath, 'route');
      const kind = route.startsWith('/api/') || route === '/api' ? 'api' : 'route';
      currentRouteId = `${kind}:${route}`;
      accumulator.addNode({ id: currentRouteId, kind, label: route }, [{ path: relativePath }]);
      for (const featureName of importedFeatureNames) {
        accumulator.addEdge({
          from: currentRouteId,
          to: `feature:${featureName}`,
          relation: kind === 'api' ? 'calls' : 'composes',
          confidence: 'observed',
        }, [{ path: relativePath }]);
      }
      for (const provider of providers) {
        accumulator.addEdge({
          from: currentRouteId,
          to: `provider:${provider.id}`,
          relation: 'integrates-with',
          confidence: 'observed',
        }, [{ path: relativePath, reason: provider.reason }]);
      }
    }

    const visit = (node) => {
      if (
        ts.isVariableDeclaration(node)
        && ts.isIdentifier(node.name)
        && node.name.text === 'ENVIRONMENT_ZONE_IDS'
        && node.initializer
      ) {
        for (const id of staticArrayStrings(node.initializer) ?? []) {
          if (!PRIVATE_SURFACE_IDS.has(id)) continue;
          const evidence = [{ path: relativePath, line: lineFor(node) }];
          addSurfaceNode(accumulator, id, evidence);
        }
      }

      if (ts.isTypeAliasDeclaration(node) && node.name.text === 'StudioContextTool') {
        const evidence = [{ path: relativePath, line: lineFor(node), reason: 'StudioContextTool literal union' }];
        addSurfaceNode(accumulator, 'studio', evidence);
        for (const toolId of stringLiteralUnionValues(node.type)) {
          addToolNode(accumulator, toolId, evidence);
          accumulator.addEdge({ from: 'surface:studio', to: `tool:${toolId}`, relation: 'exposes', confidence: 'declared' }, evidence);
          if (classification.kind === 'feature') {
            accumulator.addEdge({ from: `tool:${toolId}`, to: `feature:${classification.featureName}`, relation: 'composed-by', confidence: 'declared' }, evidence);
          }
        }
      }

      if (ts.isObjectLiteralExpression(node)) {
        const props = objectProperties(node);
        const id = staticString(props.get('id'));
        const scope = staticString(props.get('scope'));
        const result = staticString(props.get('result'));
        const looksLikeAction = Boolean(id && ACTION_ID_PATTERN.test(id) && (scope || result || props.has('automation')));
        if (looksLikeAction) {
          const evidence = [{ path: relativePath, line: lineFor(node) }];
          const owners = stringCandidates(props.get('ownerFeature'));
          addActionNode({
            accumulator,
            id,
            label: staticString(props.get('label')),
            owners,
            props,
            evidence,
          });
          if (owners.length === 0) {
            accumulator.addUnknown({
              kind: 'action-owner',
              path: relativePath,
              line: lineFor(node),
              message: `Action ${id} has no statically provable ownerFeature.`,
            });
          }
        }

        const toolId = staticString(props.get('toolId'));
        if (toolId) {
          const evidence = [{ path: relativePath, line: lineFor(node) }];
          addToolNode(accumulator, toolId, evidence);
          if (classification.kind === 'feature') {
            accumulator.addEdge({
              from: `tool:${toolId}`,
              to: `feature:${classification.featureName}`,
              relation: 'composed-by',
              confidence: 'observed',
            }, evidence);
          }
        }
      }

      if (ts.isPropertyAssignment(node)) {
        const actionId = propertyName(node.name);
        if (actionId && ACTION_ID_PATTERN.test(actionId)) {
          for (const toolId of collectToolIds(node.initializer)) {
            const evidence = [{ path: relativePath, line: lineFor(node) }];
            addToolNode(accumulator, toolId, evidence);
            accumulator.addEdge({ from: `action:${actionId}`, to: `tool:${toolId}`, relation: 'opens', confidence: 'observed' }, evidence);
          }
        }
      }

      if (ts.isCallExpression(node)) {
        const calleeName = ts.isPropertyAccessExpression(node.expression)
          ? node.expression.name.text
          : ts.isIdentifier(node.expression) ? node.expression.text : null;

        if (calleeName === 'registerTool') {
          const toolName = staticString(node.arguments[0]);
          if (toolName) {
            const evidence = [{ path: relativePath, line: lineFor(node) }];
            accumulator.addNode({ id: `mcp:${toolName}`, kind: 'mcp', label: toolName }, evidence);
            if (classification.kind === 'feature') {
              accumulator.addEdge({
                from: `mcp:${toolName}`,
                to: `feature:${classification.featureName}`,
                relation: 'implemented-by',
                confidence: 'observed',
              }, evidence);
            } else if (currentRouteId) {
              accumulator.addEdge({
                from: currentRouteId,
                to: `mcp:${toolName}`,
                relation: 'exposes',
                confidence: 'observed',
              }, evidence);
            }
          }
        }

        const factoryId = staticString(node.arguments[0]);
        const factoryLooksActionLike = Boolean(
          calleeName
          && /(?:Action|zoneAction)$/u.test(calleeName)
          && factoryId
          && ACTION_ID_PATTERN.test(factoryId)
        );
        if (factoryLooksActionLike) {
          const actionNodeId = `action:${factoryId}`;
          const evidence = [{ path: relativePath, line: lineFor(node), reason: `action factory ${calleeName}` }];
          if (!accumulator.nodes.has(actionNodeId)) {
            accumulator.addNode({
              id: actionNodeId,
              kind: 'action',
              label: staticString(node.arguments[1]) ?? factoryId,
              owner: 'unknown',
              owners: [],
              scope: 'unknown',
              result: 'unknown',
              objectKinds: [],
              sources: [],
              permission: 'unknown',
              commitment: 'unknown',
              automation: 'unknown',
            }, evidence);
            const namespace = factoryId.split('.')[0];
            if (PRIVATE_SURFACE_IDS.has(namespace)) {
              addSurfaceNode(accumulator, namespace, evidence);
              accumulator.addEdge({ from: `surface:${namespace}`, to: actionNodeId, relation: 'exposes', confidence: 'observed' }, evidence);
            }
            accumulator.addUnknown({
              kind: 'action-factory',
              path: relativePath,
              line: lineFor(node),
              message: `Action ${factoryId} is observable through ${calleeName}, but its full descriptor is dynamic.`,
            });
          }
        }
      }

      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
};

const buildTestEvidence = async ({ root, accumulator, fingerprint }) => {
  const testsRoot = path.join(root, 'tests');
  const sourceRoot = path.join(root, 'src');
  const testFiles = await walkFiles(testsRoot, (filePath) => TEST_EXTENSIONS.some((extension) => filePath.endsWith(extension)));
  for (const filePath of testFiles) {
    const relativePath = toPosixPath(path.relative(root, filePath));
    const source = await readFile(filePath, 'utf8');
    fingerprint.update(relativePath).update('\0').update(source).update('\0');
    const importedSpecifiers = ts.preProcessFile(source, true, true).importedFiles.map((entry) => entry.fileName);
    const featureNames = new Set();
    for (const specifier of importedSpecifiers) {
      const targetPath = resolveProductRealityLocalImport({ importerPath: filePath, sourceRoot, specifier });
      if (!targetPath) continue;
      const classification = classifyProductRealitySourcePath(targetPath);
      if (classification.kind === 'feature') featureNames.add(classification.featureName);
    }
    if (featureNames.size === 0) continue;
    accumulator.addNode({ id: `test:${relativePath}`, kind: 'test', label: relativePath }, [{ path: relativePath }]);
    for (const featureName of featureNames) {
      addFeatureNode(accumulator, featureName);
      accumulator.addEdge({
        from: `feature:${featureName}`,
        to: `test:${relativePath}`,
        relation: 'covered-by',
        confidence: 'observed',
      }, [{ path: relativePath }]);
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
    const label = /^name:\s*(.+)$/mu.exec(source)?.[1]?.trim() ?? path.basename(relativePath);
    accumulator.addNode({ id: `workflow:${relativePath}`, kind: 'workflow', label, commands }, [{ path: relativePath }]);
  }
};

const summarizeKinds = (nodes) => {
  const counts = {};
  for (const node of nodes) counts[node.kind] = (counts[node.kind] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
};

const normalizeGraph = ({ accumulator, fingerprint }) => {
  const nodes = [...accumulator.nodes.values()].sort((left, right) => left.id.localeCompare(right.id));
  const edges = [...accumulator.edges.values()].sort((left, right) => edgeKey(left).localeCompare(edgeKey(right)));
  const unknowns = [...accumulator.unknowns.values()].sort((left, right) => (
    `${left.path}:${left.line ?? 0}:${left.kind}:${left.message}`.localeCompare(`${right.path}:${right.line ?? 0}:${right.kind}:${right.message}`)
  ));
  return {
    schemaVersion: PRODUCT_REALITY_SCHEMA_VERSION,
    sourceFingerprint: fingerprint.digest('hex').slice(0, 20),
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
};

export async function buildProductReality(root = process.cwd()) {
  const accumulator = createAccumulator();
  const fingerprint = createHash('sha256');
  await buildSourceEvidence({ root, accumulator, fingerprint });
  await buildTestEvidence({ root, accumulator, fingerprint });
  await buildWorkflowEvidence({ root, accumulator, fingerprint });
  return normalizeGraph({ accumulator, fingerprint });
}

const relationsFrom = (graph, id, relation = null) => graph.edges.filter((edge) => (
  edge.from === id && (!relation || edge.relation === relation)
));
const relationsTo = (graph, id, relation = null) => graph.edges.filter((edge) => (
  edge.to === id && (!relation || edge.relation === relation)
));
const nodeLabel = (id) => id.includes(':') ? id.slice(id.indexOf(':') + 1) : id;
const labelForId = (graph, id) => graph.nodes.find((node) => node.id === id)?.label ?? nodeLabel(id);

export function renderProductSurfaceMap(graph) {
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
    `- ${graph.summary.kinds.surface ?? 0} product surfaces, ${graph.summary.kinds.action ?? 0} semantic actions, ${graph.summary.kinds.tool ?? 0} tools, ${graph.summary.kinds.feature ?? 0} feature owners, ${graph.summary.kinds.api ?? 0} API routes, ${graph.summary.kinds.mcp ?? 0} MCP tools, ${graph.summary.kinds.provider ?? 0} providers, ${graph.summary.kinds.test ?? 0} linked tests`,
    '',
    '## Product surfaces',
    '',
    '| Surface | Actions | Tools | Routes | Connected feature owners | MCP parity links |',
    '| --- | ---: | ---: | ---: | --- | ---: |',
  ];

  const surfaces = graph.nodes.filter((node) => node.kind === 'surface');
  for (const surface of surfaces) {
    const actionIds = relationsFrom(graph, surface.id, 'exposes').map((edge) => edge.to).filter((id) => id.startsWith('action:'));
    const toolIds = relationsFrom(graph, surface.id, 'exposes').map((edge) => edge.to).filter((id) => id.startsWith('tool:'));
    const routeIds = relationsFrom(graph, surface.id, 'exposes').map((edge) => edge.to).filter((id) => id.startsWith('route:'));
    const ownerIds = uniq([
      ...actionIds.flatMap((id) => relationsFrom(graph, id, 'owned-by').map((edge) => edge.to)),
      ...toolIds.flatMap((id) => relationsFrom(graph, id, 'composed-by').map((edge) => edge.to)),
      ...routeIds.flatMap((id) => relationsFrom(graph, id, 'composes').map((edge) => edge.to)),
    ]).filter((id) => id.startsWith('feature:'));
    const mcpCount = actionIds.flatMap((id) => relationsFrom(graph, id, 'automated-by')).length;
    lines.push(`| **${surface.label}** | ${actionIds.length} | ${toolIds.length} | ${routeIds.length} | ${ownerIds.map((id) => `\`${labelForId(graph, id)}\``).join(', ') || '—'} | ${mcpCount} |`);
  }

  lines.push('', '### Surface actions and tools', '');
  for (const surface of surfaces) {
    const actionIds = relationsFrom(graph, surface.id, 'exposes').map((edge) => edge.to).filter((id) => id.startsWith('action:')).sort();
    const toolIds = relationsFrom(graph, surface.id, 'exposes').map((edge) => edge.to).filter((id) => id.startsWith('tool:')).sort();
    if (actionIds.length === 0 && toolIds.length === 0) continue;
    lines.push(`#### ${surface.label}`, '');
    if (actionIds.length > 0) {
      lines.push('| Action | Owner | Scope | Result | Automation |', '| --- | --- | --- | --- | --- |');
      for (const actionId of actionIds) {
        const action = graph.nodes.find((node) => node.id === actionId);
        if (!action) continue;
        const ownerLabel = action.owners?.length > 0 ? action.owners.map((owner) => `\`${owner}\``).join(', ') : '`unknown`';
        lines.push(`| \`${nodeLabel(actionId)}\` | ${ownerLabel} | ${action.scope ?? 'unknown'} | ${action.result ?? 'unknown'} | ${action.automation ?? 'unknown'} |`);
      }
      lines.push('');
    }
    if (toolIds.length > 0) {
      lines.push(`Tools: ${toolIds.map((id) => `\`${labelForId(graph, id)}\``).join(', ')}.`, '');
    }
  }

  lines.push('## Feature owners', '', '| Feature | Actions | Depends on | Used by | APIs | MCP tools | Providers | Linked tests |', '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const feature of graph.nodes.filter((node) => node.kind === 'feature')) {
    const actionCount = relationsTo(graph, feature.id, 'owned-by').length;
    const dependsOn = relationsFrom(graph, feature.id, 'depends-on').length;
    const usedBy = relationsTo(graph, feature.id, 'depends-on').length;
    const apiCount = relationsTo(graph, feature.id, 'calls').filter((edge) => edge.from.startsWith('api:')).length;
    const mcpCount = relationsTo(graph, feature.id, 'implemented-by').filter((edge) => edge.from.startsWith('mcp:')).length;
    const providerCount = relationsFrom(graph, feature.id, 'integrates-with').length;
    const testCount = relationsFrom(graph, feature.id, 'covered-by').length;
    lines.push(`| \`${feature.label}\` | ${actionCount} | ${dependsOn} | ${usedBy} | ${apiCount} | ${mcpCount} | ${providerCount} | ${testCount} |`);
  }

  const providers = graph.nodes.filter((node) => node.kind === 'provider');
  if (providers.length > 0) {
    lines.push('', '## Provider boundaries', '', '| Provider | Feature owners with direct evidence | API routes with direct evidence |', '| --- | --- | --- |');
    for (const provider of providers) {
      const owners = relationsTo(graph, provider.id, 'integrates-with')
        .filter((edge) => edge.from.startsWith('feature:'))
        .map((edge) => `\`${labelForId(graph, edge.from)}\``);
      const apis = relationsTo(graph, provider.id, 'integrates-with')
        .filter((edge) => edge.from.startsWith('api:'))
        .map((edge) => `\`${labelForId(graph, edge.from)}\``);
      lines.push(`| ${provider.label} | ${uniq(owners).join(', ') || '—'} | ${uniq(apis).join(', ') || '—'} |`);
    }
  }

  const mcpTools = graph.nodes.filter((node) => node.kind === 'mcp');
  if (mcpTools.length > 0) {
    lines.push('', '## MCP topology', '', '| MCP tool | Implementation/route evidence | Human action parity |', '| --- | --- | --- |');
    for (const tool of mcpTools) {
      const implementations = relationsFrom(graph, tool.id, 'implemented-by').map((edge) => `\`${labelForId(graph, edge.to)}\``);
      const routes = relationsTo(graph, tool.id, 'exposes').filter((edge) => edge.from.startsWith('route:')).map((edge) => `\`${labelForId(graph, edge.from)}\``);
      const parity = relationsTo(graph, tool.id, 'automated-by').map((edge) => `\`${nodeLabel(edge.from)}\``);
      lines.push(`| \`${tool.label}\` | ${[...implementations, ...routes].join(', ') || '—'} | ${parity.join(', ') || 'supporting/none declared'} |`);
    }
  }

  lines.push('', '## Observability gaps', '');
  if (graph.unknowns.length === 0) {
    lines.push('No unresolved observations were emitted by the current scanner.');
  } else {
    lines.push(`The scanner found ${graph.unknowns.length} observation${graph.unknowns.length === 1 ? '' : 's'} it could not fully resolve. Unknown does not mean healthy or broken; it means the repository does not currently expose enough deterministic static evidence.`, '');
    for (const unknown of graph.unknowns.slice(0, 20)) {
      lines.push(`- **${unknown.kind}** — ${unknown.message} (\`${unknown.path}:${unknown.line ?? 1}\`)`);
    }
    if (graph.unknowns.length > 20) lines.push(`- … ${graph.unknowns.length - 20} more; run \`npm run product-reality:query -- --unknown\`.`);
  }

  lines.push(
    '',
    '## Reading this map',
    '',
    '- This map describes **observed current reality**, not desired placement or UX quality.',
    '- Provider relationships are emitted only from provider imports, provider hosts, or explicitly provider-specific source paths; ordinary UI copy does not create an integration edge.',
    '- MCP tools registered in app composition are attached to their route, not guessed onto every imported feature.',
    '- File/function detail remains evidence on graph nodes and edges rather than expanding this dashboard into a source dump.',
    '- A missing relationship may be a real removal or a scanner limit; inspect evidence and `--unknown` before treating it as dead code.',
    '- PR review should use `npm run product-reality:diff -- --base <ref>` to inspect the A→B topology delta.',
    '',
  );
  return lines.join('\n');
}

export async function generateProductReality(root = process.cwd()) {
  const graph = await buildProductReality(root);
  const graphOutput = canonicalJson(graph);
  const mapOutput = `${renderProductSurfaceMap(graph).trimEnd()}\n`;
  await mkdir(path.join(root, path.dirname(PRODUCT_REALITY_GRAPH_PATH)), { recursive: true });
  await writeFile(path.join(root, PRODUCT_REALITY_GRAPH_PATH), graphOutput, 'utf8');
  await writeFile(path.join(root, PRODUCT_REALITY_SURFACE_MAP_PATH), mapOutput, 'utf8');
  return { graph, graphOutput, mapOutput };
}

export async function checkProductReality(root = process.cwd()) {
  const graph = await buildProductReality(root);
  const expectedGraph = canonicalJson(graph);
  const expectedMap = `${renderProductSurfaceMap(graph).trimEnd()}\n`;
  const currentGraph = await readFile(path.join(root, PRODUCT_REALITY_GRAPH_PATH), 'utf8').catch(() => '');
  const currentMap = await readFile(path.join(root, PRODUCT_REALITY_SURFACE_MAP_PATH), 'utf8').catch(() => '');
  const stale = [];
  if (currentGraph !== expectedGraph) stale.push(PRODUCT_REALITY_GRAPH_PATH);
  if (currentMap !== expectedMap) stale.push(PRODUCT_REALITY_SURFACE_MAP_PATH);
  return { stale, graph };
}

const semanticNode = (node) => Object.fromEntries(Object.entries(node).filter(([key]) => key !== 'evidence'));
const semanticEdge = (edge) => Object.fromEntries(Object.entries(edge).filter(([key]) => key !== 'evidence'));
const sameJson = (left, right) => JSON.stringify(left) === JSON.stringify(right);

export function diffProductReality(baseGraph, currentGraph) {
  const baseNodes = new Map(baseGraph.nodes.map((node) => [node.id, node]));
  const currentNodes = new Map(currentGraph.nodes.map((node) => [node.id, node]));
  const baseEdges = new Map(baseGraph.edges.map((edge) => [edgeKey(edge), edge]));
  const currentEdges = new Map(currentGraph.edges.map((edge) => [edgeKey(edge), edge]));
  return {
    addedNodes: [...currentNodes.keys()].filter((id) => !baseNodes.has(id)).sort(),
    removedNodes: [...baseNodes.keys()].filter((id) => !currentNodes.has(id)).sort(),
    changedNodes: [...currentNodes.keys()].filter((id) => baseNodes.has(id) && !sameJson(semanticNode(baseNodes.get(id)), semanticNode(currentNodes.get(id)))).sort(),
    addedEdges: [...currentEdges.keys()].filter((key) => !baseEdges.has(key)).sort(),
    removedEdges: [...baseEdges.keys()].filter((key) => !currentEdges.has(key)).sort(),
    changedEdges: [...currentEdges.keys()].filter((key) => baseEdges.has(key) && !sameJson(semanticEdge(baseEdges.get(key)), semanticEdge(currentEdges.get(key)))).sort(),
  };
}

export function formatProductRealityDelta(delta, { baseLabel = 'base', currentLabel = 'working tree' } = {}) {
  const total = delta.addedNodes.length
    + delta.removedNodes.length
    + delta.changedNodes.length
    + delta.addedEdges.length
    + delta.removedEdges.length
    + delta.changedEdges.length;
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
  if (total === 0) return [...lines, '', 'No product-topology change observed.', ''].join('\n');
  const section = (title, values, format = (value) => `\`${value}\``) => {
    if (values.length === 0) return;
    lines.push('', `### ${title}`, '');
    for (const value of values.slice(0, 60)) lines.push(`- ${format(value)}`);
    if (values.length > 60) lines.push(`- … ${values.length - 60} more`);
  };
  section('Added nodes', delta.addedNodes);
  section('Removed nodes', delta.removedNodes);
  section('Changed nodes', delta.changedNodes);
  section('Added relationships', delta.addedEdges, (value) => `\`${value.replaceAll('|', ' → ')}\``);
  section('Removed relationships', delta.removedEdges, (value) => `\`${value.replaceAll('|', ' → ')}\``);
  section('Changed relationships', delta.changedEdges, (value) => `\`${value.replaceAll('|', ' → ')}\``);
  return `${lines.join('\n')}\n`;
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
  const extract = spawnSync('tar', ['-xf', '-', '-C', tempRoot], {
    input: archive.stdout,
    encoding: null,
    maxBuffer: 128 * 1024 * 1024,
  });
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

export function queryProductReality(graph, { surface = null, feature = null, kind = null, unknown = false } = {}) {
  if (unknown) {
    if (graph.unknowns.length === 0) return 'No unresolved observations.\n';
    return `${graph.unknowns.map((entry) => `${entry.kind}\t${entry.path}:${entry.line ?? 1}\t${entry.message}`).join('\n')}\n`;
  }

  const seeds = new Set();
  if (surface) seeds.add(`surface:${surface}`);
  else if (feature) seeds.add(`feature:${feature}`);
  else if (kind) for (const node of graph.nodes.filter((candidate) => candidate.kind === kind)) seeds.add(node.id);
  else for (const node of graph.nodes) seeds.add(node.id);

  const included = new Set(seeds);
  for (const edge of graph.edges) {
    if (seeds.has(edge.from) || seeds.has(edge.to)) {
      included.add(edge.from);
      included.add(edge.to);
    }
  }

  const lines = ['NODES'];
  for (const node of graph.nodes.filter((candidate) => included.has(candidate.id))) lines.push(`${node.id}\t${node.label}`);
  lines.push('', 'RELATIONSHIPS');
  for (const edge of graph.edges.filter((candidate) => included.has(candidate.from) && included.has(candidate.to))) {
    lines.push(`${edge.from}\t${edge.relation}\t${edge.to}`);
  }
  return `${lines.join('\n')}\n`;
}
