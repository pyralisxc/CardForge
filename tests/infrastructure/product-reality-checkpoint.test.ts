import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  buildCheckpointProductReality,
  parseCheckpointGraph,
  queryCheckpointProductReality,
  serializeCheckpointGraph,
} from '../../scripts/product-reality-checkpoint-lib.mjs';

const roots: string[] = [];
const makeRoot = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cardforge-product-reality-checkpoint-'));
  roots.push(root);
  return root;
};
const put = async (root: string, relativePath: string, content: string) => {
  const filePath = path.join(root, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf8');
};

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('Product Reality checkpoint projection', () => {
  it('resolves recurring action factories and contextual MCP parity without inventing a second action owner', async () => {
    const root = await makeRoot();
    await put(root, 'src/features/app-shell/environment/model.ts', `export const ENVIRONMENT_ZONE_IDS = ['desk', 'library', 'profile'] as const;`);
    await put(root, 'src/features/desk/model/actions.ts', `
      const openAutomation = true
        ? { kind: 'published-mcp', tools: ['list_connected_projects', 'checkout_project'] }
        : { kind: 'human-only', owner: 'cardforge' };
      export const open = {
        id: 'desk.open-set', label: 'Open Set', ownerFeature: true ? 'project' : 'studio-documents',
        supportedObjectKinds: ['set'], supportedSources: ['browser-local'], revisionPolicy: 'none', requiredPermission: 'guest',
        scope: 'object', hierarchy: 'primary', availability: { kind: 'available' }, commitment: 'none', automation: openAutomation, result: 'navigation'
      } as const;
      export const zoneAction = (id: string, label: string, result = 'navigation') => ({
        id, label, ownerFeature: id === 'desk.create-set' ? 'card-generator' : 'project', supportedObjectKinds: [], supportedSources: [],
        revisionPolicy: 'none', requiredPermission: 'guest', scope: 'zone', hierarchy: 'primary', availability: { kind: 'available' },
        commitment: 'none', automation: { kind: 'human-only', owner: 'cardforge' }, result,
      });
      zoneAction('desk.create-set', 'New Set', 'tool-opened');
      function createSendToPipelineActionDescriptor(input: { id: string }) { return input; }
      createSendToPipelineActionDescriptor({ id: 'desk.send-pipeline' });
    `);
    await put(root, 'src/features/storage-management/components/LibraryObjectPresentation.tsx', `
      export const createLibraryZoneAction = (id: 'library.refresh' | 'library.close-locations' | 'library.close-tool', label: string) => ({
        id, label, ownerFeature: 'storage-management', supportedObjectKinds: [], supportedSources: [], revisionPolicy: 'none', requiredPermission: 'guest',
        scope: 'zone', hierarchy: 'primary', availability: { kind: 'available' }, commitment: 'none', automation: { kind: 'human-only', owner: 'cardforge' },
        result: id === 'library.refresh' ? 'refresh-requested' : 'navigation'
      });
    `);
    await put(root, '.github/workflows/ci.yml', 'name: CI\nsteps:\n  - run: npm run verify:full\n');

    const graph = await buildCheckpointProductReality(root);
    const actions = new Set(graph.nodes.filter((node: { kind: string }) => node.kind === 'action').map((node: { id: string }) => node.id));
    for (const id of [
      'action:desk.open-set',
      'action:desk.create-set',
      'action:desk.send-pipeline',
      'action:library.refresh',
      'action:library.close-locations',
      'action:library.close-tool',
    ]) expect(actions.has(id)).toBe(true);

    const edges = new Set(graph.edges.map((edge: { from: string; relation: string; to: string }) => `${edge.from}|${edge.relation}|${edge.to}`));
    expect(edges.has('action:desk.open-set|automated-by|mcp:list_connected_projects')).toBe(true);
    expect(edges.has('action:desk.open-set|automated-by|mcp:checkout_project')).toBe(true);
    expect(edges.has('action:desk.send-pipeline|owned-by|feature:pipeline')).toBe(true);
    expect(edges.has('workflow:.github/workflows/ci.yml|runs|script:verify:full')).toBe(true);
    expect(graph.unknowns.some((entry: { message: string }) => entry.message.includes('desk.create-set'))).toBe(false);
  });

  it('keeps accepted checkpoint bytes stable across comment-only source changes', async () => {
    const root = await makeRoot();
    await put(root, 'src/features/app-shell/environment/model.ts', `export const ENVIRONMENT_ZONE_IDS = ['desk'] as const;`);
    const first = await buildCheckpointProductReality(root);
    const firstBytes = serializeCheckpointGraph(first);
    await put(root, 'src/features/app-shell/environment/model.ts', `// comment only\nexport const ENVIRONMENT_ZONE_IDS = ['desk'] as const;`);
    const second = await buildCheckpointProductReality(root);
    expect(second.topologyFingerprint).toBe(first.topologyFingerprint);
    expect(second.evidenceFingerprint).toBe(first.evidenceFingerprint);
    expect(serializeCheckpointGraph(second)).toBe(firstBytes);
  });

  it('round-trips NDJSON checkpoints and supports exact-node or fuzzy development queries', async () => {
    const root = await makeRoot();
    await put(root, 'src/features/app-shell/environment/model.ts', `export const ENVIRONMENT_ZONE_IDS = ['desk'] as const;`);
    await put(root, 'src/features/project/client.ts', 'export const project = true;');
    await put(root, 'src/features/desk/model/action.ts', `export const action = {
      id:'desk.open-set', label:'Open Set', ownerFeature:'project', supportedObjectKinds:['set'], supportedSources:['browser-local'],
      revisionPolicy:'none', requiredPermission:'guest', scope:'object', hierarchy:'primary', availability:{kind:'available'}, commitment:'none',
      automation:{kind:'human-only', owner:'cardforge'}, result:'navigation'
    } as const;`);
    const graph = await buildCheckpointProductReality(root);
    const parsed = parseCheckpointGraph(serializeCheckpointGraph(graph));
    expect(parsed.topologyFingerprint).toBe(graph.topologyFingerprint);
    expect(queryCheckpointProductReality(graph, { node: 'action:desk.open-set', depth: 2 })).toContain('feature:project');
    expect(queryCheckpointProductReality(graph, { match: 'open set', depth: 1 })).toContain('action:desk.open-set');
  });

  it('uses honest dependency vocabulary for API-to-feature import evidence', async () => {
    const root = await makeRoot();
    await put(root, 'src/app/api/project/route.ts', `import '@/features/project/server'; export const GET = () => null;`);
    await put(root, 'src/features/project/server.ts', 'export const project = true;');
    const graph = await buildCheckpointProductReality(root);
    const edges = graph.edges.map((edge: { from: string; relation: string; to: string }) => `${edge.from}|${edge.relation}|${edge.to}`);
    expect(edges).toContain('api:/api/project|uses-feature|feature:project');
    expect(edges).not.toContain('api:/api/project|calls|feature:project');
  });
});
