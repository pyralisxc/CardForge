import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  buildProductReality,
  buildProductRealityAtRef,
  diffProductReality,
  formatProductRealityDelta,
  queryProductReality,
  renderProductSurfaceMap,
} from './product-reality-lib.mjs';
import { collectSourceModules } from './repository-analysis.mjs';
import { collectProductRealitySemantics } from './product-reality-semantics.mjs';

export const PRODUCT_REALITY_CHECKPOINT_PATH = 'docs/generated/product-reality.ndjson';
export const PRODUCT_REALITY_LEGACY_PATH = 'docs/generated/product-reality.json';
export const PRODUCT_REALITY_SURFACE_MAP_PATH = 'docs/product-surface-map.md';

const SUPPORTING_NODE_KINDS = new Set(['test', 'workflow', 'script']);
const uniq = (values) => [...new Set(values)];
const edgeKey = (edge) => `${edge.from}|${edge.relation}|${edge.to}`;
const unknownKey = (unknown) => `${unknown.kind}|${unknown.message}`;
const stableEvidence = (values = []) => [...new Map(values.filter((value) => value?.path).map((value) => {
  const entry = { path: value.path, ...(value.reason ? { reason: value.reason } : {}) };
  return [`${entry.path}|${entry.reason ?? ''}`, entry];
})).values()].sort((a, b) => `${a.path}|${a.reason ?? ''}`.localeCompare(`${b.path}|${b.reason ?? ''}`));
const stripEvidence = (value) => Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'evidence'));
const relationCount = (delta) => Object.values(delta).reduce((sum, values) => sum + values.length, 0);

const normalizedGraph = (graph) => ({
  schemaVersion: graph.schemaVersion ?? 1,
  nodes: graph.nodes.map((node) => ({ ...node, evidence: stableEvidence(node.evidence) })),
  edges: graph.edges.map((edge) => ({ ...edge, relation: edge.relation === 'calls' ? 'uses-feature' : edge.relation, evidence: stableEvidence(edge.evidence) })),
  unknowns: graph.unknowns.map((entry) => ({ kind: entry.kind, message: entry.message, ...(entry.path ? { path: entry.path } : {}) })),
});

const accumulator = (graph) => {
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const edges = new Map(graph.edges.map((edge) => [edgeKey(edge), edge]));
  const unknowns = new Map(graph.unknowns.map((entry) => [unknownKey(entry), entry]));
  const addNode = (node, evidence = []) => {
    const current = nodes.get(node.id);
    nodes.set(node.id, current
      ? { ...current, ...node, evidence: stableEvidence([...(current.evidence ?? []), ...evidence]) }
      : { ...node, evidence: stableEvidence(evidence) });
  };
  const addEdge = (edge, evidence = []) => {
    const normalized = { ...edge, relation: edge.relation === 'calls' ? 'uses-feature' : edge.relation };
    const key = edgeKey(normalized);
    const current = edges.get(key);
    edges.set(key, current
      ? { ...current, ...normalized, evidence: stableEvidence([...(current.evidence ?? []), ...evidence]) }
      : { ...normalized, evidence: stableEvidence(evidence) });
  };
  const addUnknown = (entry) => unknowns.set(unknownKey(entry), entry);
  const clearActionUnknowns = (id) => {
    for (const [key, entry] of unknowns) if (entry.message.includes(`Action ${id} `)) unknowns.delete(key);
  };
  return { nodes, edges, unknowns, addNode, addEdge, addUnknown, clearActionUnknowns };
};

const addAction = (acc, { id, label = id, owners = [], scope = 'object', result = 'navigation', automation = 'human-only', mcpTools = [], evidence = [] }) => {
  acc.addNode({ id: `action:${id}`, kind: 'action', label, owner: owners.length === 1 ? owners[0] : owners.length > 1 ? 'contextual' : 'unknown', owners, scope, result, automation }, evidence);
  for (const owner of owners) {
    acc.addNode({ id: `feature:${owner}`, kind: 'feature', label: owner });
    acc.addEdge({ from: `action:${id}`, to: `feature:${owner}`, relation: 'owned-by', confidence: owners.length === 1 ? 'declared' : 'contextual' }, evidence);
  }
  for (const tool of mcpTools) {
    acc.addNode({ id: `mcp:${tool}`, kind: 'mcp', label: tool }, evidence);
    acc.addEdge({ from: `action:${id}`, to: `mcp:${tool}`, relation: 'automated-by', confidence: automation === 'contextual' ? 'contextual' : 'declared' }, evidence);
  }
  if (owners.length && scope !== 'unknown' && result !== 'unknown' && automation !== 'unknown') acc.clearActionUnknowns(id);
};

const addObservedSemantics = async (root, acc) => {
  const semantics = await collectProductRealitySemantics(root);
  for (const surface of semantics.surfaces) {
    acc.addNode({ id: `surface:${surface.id}`, kind: 'surface', label: surface.label, role: surface.role }, surface.evidence);
  }
  for (const capability of semantics.capabilities) {
    const capabilityId = `capability:${capability.id}`;
    acc.addNode({ id: capabilityId, kind: 'capability', label: capability.label, category: capability.category }, capability.evidence);
    if (capability.ownerFeature) {
      acc.addNode({ id: `feature:${capability.ownerFeature}`, kind: 'feature', label: capability.ownerFeature });
      acc.addEdge({ from: capabilityId, to: `feature:${capability.ownerFeature}`, relation: 'owned-by', confidence: 'declared' }, capability.evidence);
    }
    for (const surface of capability.surfaces) {
      const surfaceId = `surface:${surface}`;
      if (!acc.nodes.has(surfaceId)) {
        acc.addUnknown({ kind: 'capability-surface', message: `Capability ${capability.id} declares unobserved surface ${surface}.`, path: capability.evidence?.[0]?.path });
        continue;
      }
      acc.addEdge({ from: surfaceId, to: capabilityId, relation: 'exposes', confidence: 'declared' }, capability.evidence);
    }
  }
};

const enrichCardForgeSemantics = async (root, acc) => {
  const { modules } = await collectSourceModules(root);
  for (const module of modules) {
    const source = module.source;
    const evidence = [{ path: `src/${module.relativePath}` }];
    const relativePath = evidence[0].path;

    if (source.includes("const human =") && source.includes("kind: 'human-only'")) {
      for (const action of [...acc.nodes.values()].filter((node) => node.kind === 'action' && node.automation === 'unknown' && node.evidence?.some((entry) => entry.path === relativePath))) {
        addAction(acc, { id: action.id.slice(7), label: action.label, owners: action.owners ?? [], scope: action.scope, result: action.result, automation: 'human-only', evidence });
      }
    }
    if (source.includes("zoneAction('desk.create-set'")) addAction(acc, { id: 'desk.create-set', label: 'New Set', owners: ['card-generator'], scope: 'zone', result: 'tool-opened', evidence });
    if (source.includes("id: 'desk.send-pipeline'")) addAction(acc, { id: 'desk.send-pipeline', label: 'Send to Pipeline', owners: ['pipeline'], result: 'tool-opened', evidence });
    if (source.includes("id: 'library.send-pipeline'")) addAction(acc, { id: 'library.send-pipeline', label: 'Send to Pipeline', owners: ['pipeline'], result: 'tool-opened', evidence });
    if (source.includes('createLibraryZoneAction') && source.includes("'library.close-locations'") && source.includes("'library.close-tool'")) {
      for (const id of ['library.refresh', 'library.close-locations', 'library.close-tool']) {
        addAction(acc, { id, owners: ['storage-management'], scope: 'zone', result: id === 'library.refresh' ? 'refresh-requested' : 'navigation', evidence });
      }
    }
    if (source.includes("id: 'desk.open-set'")) {
      addAction(acc, {
        id: 'desk.open-set',
        label: acc.nodes.get('action:desk.open-set')?.label ?? 'Open Set',
        owners: ['marketing-content', 'pipeline', 'studio-documents', 'project'],
        result: 'contextual',
        automation: 'contextual',
        mcpTools: source.includes('list_connected_projects') && source.includes('checkout_project') ? ['list_connected_projects', 'checkout_project'] : [],
        evidence,
      });
    }
    if (source.includes("id: 'library.open'")) {
      addAction(acc, {
        id: 'library.open',
        label: acc.nodes.get('action:library.open')?.label ?? 'Open',
        owners: ['project', 'studio-documents', 'template-editor', 'card-generator'],
        result: 'navigation',
        automation: 'contextual',
        mcpTools: source.includes('list_connected_projects') && source.includes('checkout_project') ? ['list_connected_projects', 'checkout_project'] : [],
        evidence,
      });
    }
  }
};

const connectActionsToObservedSurfaces = (acc) => {
  for (const action of [...acc.nodes.values()].filter((node) => node.kind === 'action')) {
    const actionName = action.id.slice('action:'.length);
    const namespace = actionName.split('.')[0];
    const surfaceId = `surface:${namespace}`;
    if (!acc.nodes.has(surfaceId)) continue;
    acc.addEdge({ from: surfaceId, to: action.id, relation: 'exposes', confidence: 'observed' }, action.evidence ?? []);
  }
};

const productProjection = (graph) => {
  const supportingIds = new Set(graph.nodes.filter((node) => SUPPORTING_NODE_KINDS.has(node.kind)).map((node) => node.id));
  const nodes = graph.nodes.filter((node) => !supportingIds.has(node.id));
  const edges = graph.edges.filter((edge) => !supportingIds.has(edge.from) && !supportingIds.has(edge.to));
  const kinds = {};
  for (const node of nodes) kinds[node.kind] = (kinds[node.kind] ?? 0) + 1;
  return { ...graph, nodes, edges, summary: { nodes: nodes.length, edges: edges.length, unknowns: graph.unknowns.length, kinds } };
};

const finalize = (acc, schemaVersion = 1) => {
  for (const workflow of [...acc.nodes.values()].filter((node) => node.kind === 'workflow')) {
    for (const command of workflow.commands ?? []) {
      acc.addNode({ id: `script:${command}`, kind: 'script', label: command }, workflow.evidence ?? []);
      acc.addEdge({ from: workflow.id, to: `script:${command}`, relation: 'runs', confidence: 'observed' }, workflow.evidence ?? []);
    }
  }
  connectActionsToObservedSurfaces(acc);
  for (const [key, entry] of [...acc.unknowns]) {
    const match = /Action ([^ ]+) /.exec(entry.message);
    if (!match) continue;
    const node = acc.nodes.get(`action:${match[1]}`);
    if (node && node.owner !== 'unknown' && node.scope !== 'unknown' && node.result !== 'unknown' && node.automation !== 'unknown') acc.unknowns.delete(key);
  }
  for (const node of acc.nodes.values()) {
    if (node.kind !== 'action') continue;
    for (const field of ['owner', 'scope', 'result', 'automation']) {
      if (node[field] === 'unknown') acc.addUnknown({ kind: 'action-field', message: `Action ${node.id.slice(7)} has unresolved ${field} semantics.`, ...(node.evidence?.[0]?.path ? { path: node.evidence[0].path } : {}) });
    }
  }
  const nodes = [...acc.nodes.values()].sort((a, b) => a.id.localeCompare(b.id));
  const edges = [...acc.edges.values()].sort((a, b) => edgeKey(a).localeCompare(edgeKey(b)));
  const unknowns = [...acc.unknowns.values()].sort((a, b) => unknownKey(a).localeCompare(unknownKey(b)));
  const full = { schemaVersion, nodes, edges, unknowns };
  const product = productProjection(full);
  const topology = {
    schemaVersion,
    nodes: product.nodes.map(stripEvidence),
    edges: product.edges.map(stripEvidence),
    unknowns: unknowns.map((entry) => ({ kind: entry.kind, message: entry.message })),
  };
  const topologyFingerprint = createHash('sha256').update(JSON.stringify(topology)).digest('hex').slice(0, 20);
  const evidenceFingerprint = createHash('sha256').update(JSON.stringify({
    nodes: nodes.map((node) => [node.id, stripEvidence(node), node.evidence ?? []]),
    edges: edges.map((edge) => [edgeKey(edge), stripEvidence(edge), edge.evidence ?? []]),
    unknowns: unknowns.map((entry) => [unknownKey(entry), entry.path ?? null]),
  })).digest('hex').slice(0, 20);
  const kinds = {};
  for (const node of nodes) kinds[node.kind] = (kinds[node.kind] ?? 0) + 1;
  return { schemaVersion, topologyFingerprint, evidenceFingerprint, summary: { nodes: nodes.length, edges: edges.length, unknowns: unknowns.length, kinds }, nodes, edges, unknowns };
};

export async function buildCheckpointProductReality(root = process.cwd()) {
  const raw = normalizedGraph(await buildProductReality(root));
  const acc = accumulator(raw);
  await addObservedSemantics(root, acc);
  await enrichCardForgeSemantics(root, acc);
  return finalize(acc, raw.schemaVersion);
}

const records = (graph) => [
  { type: 'meta', schemaVersion: graph.schemaVersion, topologyFingerprint: graph.topologyFingerprint, evidenceFingerprint: graph.evidenceFingerprint, summary: graph.summary },
  ...graph.nodes.map((node) => ({ type: 'node', ...node })),
  ...graph.edges.map((edge) => ({ type: 'edge', ...edge })),
  ...graph.unknowns.map((entry) => ({ type: 'unknown', ...entry })),
];
export const serializeCheckpointGraph = (graph) => `${records(graph).map((record) => JSON.stringify(record)).join('\n')}\n`;
export const parseCheckpointGraph = (content) => {
  const values = content.split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line));
  const meta = values.find((value) => value.type === 'meta');
  if (!meta) throw new Error('Product Reality checkpoint is missing its meta record.');
  return {
    schemaVersion: meta.schemaVersion,
    topologyFingerprint: meta.topologyFingerprint,
    evidenceFingerprint: meta.evidenceFingerprint,
    summary: meta.summary,
    nodes: values.filter((value) => value.type === 'node').map(({ type: _type, ...value }) => value),
    edges: values.filter((value) => value.type === 'edge').map(({ type: _type, ...value }) => value),
    unknowns: values.filter((value) => value.type === 'unknown').map(({ type: _type, ...value }) => value),
  };
};

const relationsFrom = (graph, id, relation = null) => graph.edges.filter((edge) => edge.from === id && (!relation || edge.relation === relation));
const relationsTo = (graph, id, relation = null) => graph.edges.filter((edge) => edge.to === id && (!relation || edge.relation === relation));
const labelFor = (graph, id) => graph.nodes.find((node) => node.id === id)?.label ?? id.slice(id.indexOf(':') + 1);
const renderCapabilitySection = (graph) => {
  const capabilities = graph.nodes.filter((node) => node.kind === 'capability');
  if (!capabilities.length) return '';
  const rows = capabilities.map((capability) => {
    const owners = relationsFrom(graph, capability.id, 'owned-by').map((edge) => `\`${labelFor(graph, edge.to)}\``);
    const surfaces = relationsTo(graph, capability.id, 'exposes').filter((edge) => edge.from.startsWith('surface:')).map((edge) => `\`${labelFor(graph, edge.from)}\``);
    return `| \`${capability.label}\` | ${capability.category ?? 'product'} | ${owners.join(', ') || '—'} | ${surfaces.join(', ') || '—'} |`;
  });
  return `\n## User-visible capabilities\n\n| Capability | Category | Native owner | Observed surfaces |\n| --- | --- | --- | --- |\n${rows.join('\n')}\n`;
};

export const renderCheckpointSurfaceMap = (graph) => {
  const product = productProjection(graph);
  const base = renderProductSurfaceMap(product).trimEnd();
  const marker = '\n## Feature owners\n';
  const index = base.indexOf(marker);
  const capabilities = renderCapabilitySection(product);
  return index === -1 ? `${base}${capabilities}\n` : `${base.slice(0, index)}${capabilities}${base.slice(index)}\n`;
};

export async function sealProductReality(root = process.cwd()) {
  const graph = await buildCheckpointProductReality(root);
  const graphOutput = serializeCheckpointGraph(graph);
  const mapOutput = renderCheckpointSurfaceMap(graph);
  await mkdir(path.join(root, path.dirname(PRODUCT_REALITY_CHECKPOINT_PATH)), { recursive: true });
  await writeFile(path.join(root, PRODUCT_REALITY_CHECKPOINT_PATH), graphOutput, 'utf8');
  await writeFile(path.join(root, PRODUCT_REALITY_SURFACE_MAP_PATH), mapOutput, 'utf8');
  return { graph, graphOutput, mapOutput };
}
export async function checkSealedProductReality(root = process.cwd()) {
  const graph = await buildCheckpointProductReality(root);
  const expectedGraph = serializeCheckpointGraph(graph);
  const expectedMap = renderCheckpointSurfaceMap(graph);
  const currentGraph = await readFile(path.join(root, PRODUCT_REALITY_CHECKPOINT_PATH), 'utf8').catch(() => '');
  const currentMap = await readFile(path.join(root, PRODUCT_REALITY_SURFACE_MAP_PATH), 'utf8').catch(() => '');
  const stale = [];
  if (currentGraph !== expectedGraph) stale.push(PRODUCT_REALITY_CHECKPOINT_PATH);
  if (currentMap !== expectedMap) stale.push(PRODUCT_REALITY_SURFACE_MAP_PATH);
  return { stale, graph };
}

const gitShow = (root, ref, filePath) => {
  const result = spawnSync('git', ['show', `${ref}:${filePath}`], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return result.status === 0 ? result.stdout : null;
};
const normalizeLegacy = (graph) => finalize(accumulator(normalizedGraph(graph)), graph.schemaVersion ?? 1);
export async function loadAcceptedProductReality(root, ref) {
  const current = gitShow(root, ref, PRODUCT_REALITY_CHECKPOINT_PATH);
  if (current) return parseCheckpointGraph(current);
  const legacy = gitShow(root, ref, PRODUCT_REALITY_LEGACY_PATH);
  if (legacy) return normalizeLegacy(JSON.parse(legacy));
  return normalizeLegacy(await buildProductRealityAtRef(root, ref));
}

const subtractDelta = (full, product) => Object.fromEntries(Object.keys(full).map((key) => {
  const productValues = new Set(product[key] ?? []);
  return [key, (full[key] ?? []).filter((value) => !productValues.has(value))];
}));

export const formatCheckpointHeatMap = (baseGraph, currentGraph, { baseLabel = 'accepted checkpoint A', currentLabel = 'candidate B' } = {}) => {
  const fullDelta = diffProductReality(baseGraph, currentGraph);
  const productDelta = diffProductReality(productProjection(baseGraph), productProjection(currentGraph));
  const supportingDelta = subtractDelta(fullDelta, productDelta);
  const changed = productDelta.addedNodes.length + productDelta.changedNodes.length + productDelta.addedEdges.length + productDelta.changedEdges.length;
  const currentProduct = productProjection(currentGraph);
  const unchanged = Math.max(0, currentProduct.nodes.length + currentProduct.edges.length - changed);
  return {
    delta: productDelta,
    fullDelta,
    supportingDelta,
    report: [
      '# Product Reality heat map', '', `Comparing **${baseLabel}** → **${currentLabel}**.`, '',
      `- 🟢 ${unchanged} product-semantic nodes/relationships unchanged`,
      `- 🔵 ${productDelta.addedNodes.length + productDelta.addedEdges.length} newly observed product semantics`,
      `- 🟡 ${productDelta.changedNodes.length + productDelta.changedEdges.length} product-semantic changes`,
      `- 🔴 ${productDelta.removedNodes.length + productDelta.removedEdges.length} disappeared product observations`,
      `- ⚪ ${productDelta.addedUnknowns.length} new unresolved observations`,
      `- ✅ ${productDelta.removedUnknowns.length} unresolved observations resolved/removed`,
      `- 📎 ${relationCount(supportingDelta)} supporting evidence/test/workflow changes (secondary signal)`, '',
      formatProductRealityDelta(productDelta, { baseLabel, currentLabel }).trim(), '',
    ].join('\n'),
  };
};
export async function diffAgainstAccepted(root, ref) {
  const [baseGraph, currentGraph] = await Promise.all([loadAcceptedProductReality(root, ref), buildCheckpointProductReality(root)]);
  return { baseGraph, currentGraph, ...formatCheckpointHeatMap(baseGraph, currentGraph, { baseLabel: ref, currentLabel: 'working tree' }) };
}
export async function createTemporaryProductRealityAudit(root = process.cwd(), ref = 'origin/main') {
  const { currentGraph, report } = await diffAgainstAccepted(root, ref);
  const directory = await mkdtemp(path.join(os.tmpdir(), 'cardforge-product-reality-audit-'));
  const reportPath = path.join(directory, 'heat-map.md');
  const graphPath = path.join(directory, 'working-product-reality.ndjson');
  await writeFile(reportPath, report, 'utf8');
  await writeFile(graphPath, serializeCheckpointGraph(currentGraph), 'utf8');
  return { directory, reportPath, graphPath, report, graph: currentGraph };
}

export function queryCheckpointProductReality(graph, { node = null, match = null, ...options } = {}) {
  if (!node && !match) return queryProductReality(graph, options);
  const needle = match?.toLocaleLowerCase() ?? null;
  const seeds = graph.nodes.filter((candidate) => node
    ? candidate.id === node
    : candidate.id.toLocaleLowerCase().includes(needle) || String(candidate.label ?? '').toLocaleLowerCase().includes(needle));
  if (!seeds.length) return 'No matching Product Reality nodes.\n';
  const included = new Set(seeds.map((candidate) => candidate.id));
  let frontier = new Set(included);
  for (let hop = 0; hop < (options.depth ?? 2) && frontier.size; hop += 1) {
    const next = new Set();
    for (const edge of graph.edges) {
      if (frontier.has(edge.from) && !included.has(edge.to)) next.add(edge.to);
      if (frontier.has(edge.to) && !included.has(edge.from)) next.add(edge.from);
    }
    for (const id of next) included.add(id);
    frontier = next;
  }
  const lines = ['NODES'];
  for (const candidate of graph.nodes.filter((entry) => included.has(entry.id))) {
    lines.push(`${candidate.id}\t${candidate.label}${candidate.kind === 'workflow' && candidate.commands?.length ? `\tcommands=${candidate.commands.join(',')}` : ''}`);
  }
  lines.push('', 'RELATIONSHIPS');
  for (const edge of graph.edges.filter((entry) => included.has(entry.from) && included.has(entry.to))) {
    lines.push(`${edge.from}\t${edge.relation}\t${edge.to}\t${edge.confidence ?? 'observed'}`);
  }
  return `${lines.join('\n')}\n`;
}
