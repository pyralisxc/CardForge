import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  buildProductReality,
  checkProductReality,
  diffProductReality,
  generateProductReality,
  renderSurfaceMap,
} from '../../scripts/product-reality.mjs';

const tempRoots: string[] = [];
const makeRoot = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cardforge-product-reality-test-'));
  tempRoots.push(root);
  return root;
};
const put = async (root: string, relativePath: string, content: string) => {
  const filePath = path.join(root, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf8');
};

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('Product Reality graph', () => {
  it('derives surfaces, semantic actions, owners, MCP parity, routes, providers, and tests from repository evidence', async () => {
    const root = await makeRoot();
    await put(root, 'src/features/app-shell/environment/model.ts', `
      export const ENVIRONMENT_ZONE_IDS = ['desk', 'library', 'profile'] as const;
    `);
    await put(root, 'src/features/desk/model/actions.ts', `
      import type { Thing } from '@/features/card-generator/client';
      import Stripe from 'stripe';
      export const action = {
        id: 'desk.generate-set', label: 'Generate cards', ownerFeature: 'card-generator',
        supportedObjectKinds: ['set'], supportedSources: ['browser-local'], revisionPolicy: 'none', requiredPermission: 'guest',
        scope: 'object', hierarchy: 'supporting', availability: { kind: 'available' }, commitment: 'none',
        automation: { kind: 'published-mcp', tools: ['upsert_cards'] }, result: 'tool-opened',
      } as const;
      export const ops = { 'desk.generate-set': () => ({ kind: 'tool-opened', toolId: 'generate' }) };
    `);
    await put(root, 'src/features/card-generator/client.ts', 'export type Thing = string;');
    await put(root, 'src/features/studio-documents/server/mcp.ts', `
      export function register(server: { registerTool: (...args: unknown[]) => void }) {
        server.registerTool('upsert_cards', {}, async () => ({}));
      }
    `);
    await put(root, 'src/app/api/cards/route.ts', `import '@/features/card-generator/server'; export const GET = () => null;`);
    await put(root, 'src/features/card-generator/server.ts', 'export const server = true;');
    await put(root, 'src/app/studio/page.tsx', `import '@/features/card-generator/client'; export default function Page(){ return null; }`);
    await put(root, 'tests/product/unit/generate.test.ts', `import '@/features/card-generator/client'; test('x', () => {});`);
    await put(root, '.github/workflows/ci.yml', 'name: CI\nsteps:\n  - run: npm run verify:full\n');

    const graph = await buildProductReality(root);
    const ids = new Set(graph.nodes.map((node: { id: string }) => node.id));
    for (const id of [
      'surface:desk',
      'surface:studio',
      'action:desk.generate-set',
      'feature:card-generator',
      'tool:generate',
      'mcp:upsert_cards',
      'api:/api/cards',
      'provider:stripe',
      'test:tests/product/unit/generate.test.ts',
      'workflow:.github/workflows/ci.yml',
    ]) expect(ids.has(id)).toBe(true);

    const relations = new Set(graph.edges.map((edge: { from: string; relation: string; to: string }) => `${edge.from}|${edge.relation}|${edge.to}`));
    expect(relations.has('surface:desk|exposes|action:desk.generate-set')).toBe(true);
    expect(relations.has('action:desk.generate-set|owned-by|feature:card-generator')).toBe(true);
    expect(relations.has('action:desk.generate-set|automated-by|mcp:upsert_cards')).toBe(true);
    expect(relations.has('action:desk.generate-set|opens|tool:generate')).toBe(true);
    expect(relations.has('api:/api/cards|calls|feature:card-generator')).toBe(true);
    expect(relations.has('feature:desk|integrates-with|provider:stripe')).toBe(true);
    expect(relations.has('feature:card-generator|covered-by|test:tests/product/unit/generate.test.ts')).toBe(true);
  });

  it('renders a compact descriptive dashboard rather than future/product-direction prose', async () => {
    const root = await makeRoot();
    await put(root, 'src/features/app-shell/environment/model.ts', `export const ENVIRONMENT_ZONE_IDS = ['desk'] as const;`);
    await put(root, 'src/features/desk/model/action.ts', `export const action = {
      id:'desk.open-set', label:'Open Set', ownerFeature:'project', supportedObjectKinds:['set'], supportedSources:['browser-local'],
      revisionPolicy:'none', requiredPermission:'guest', scope:'object', hierarchy:'primary', availability:{kind:'available'}, commitment:'none',
      automation:{kind:'human-only', owner:'cardforge'}, result:'navigation'
    } as const;`);
    const graph = await buildProductReality(root);
    const markdown = renderSurfaceMap(graph);
    expect(markdown).toContain('Generated current-state projection');
    expect(markdown).toContain('`desk.open-set`');
    expect(markdown).toContain('`project`');
    expect(markdown).not.toContain('## Direction');
    expect(markdown).not.toContain('## Future');
  });

  it('diffs semantic topology while ignoring evidence-only movement', () => {
    const base = {
      nodes: [{ id: 'action:desk.open-set', kind: 'action', label: 'Open', owner: 'project', evidence: [{ path: 'a.ts', line: 4 }] }],
      edges: [{ from: 'surface:desk', relation: 'exposes', to: 'action:desk.open-set', confidence: 'observed', evidence: [{ path: 'a.ts', line: 4 }] }],
    };
    const sameTopology = {
      nodes: [{ id: 'action:desk.open-set', kind: 'action', label: 'Open', owner: 'project', evidence: [{ path: 'b.ts', line: 40 }] }],
      edges: [{ from: 'surface:desk', relation: 'exposes', to: 'action:desk.open-set', confidence: 'observed', evidence: [{ path: 'b.ts', line: 40 }] }],
    };
    expect(diffProductReality(base, sameTopology)).toEqual({
      addedNodes: [], removedNodes: [], changedNodes: [], addedEdges: [], removedEdges: [], changedEdges: [],
    });
    const changed = structuredClone(sameTopology);
    changed.nodes[0].owner = 'card-generator';
    expect(diffProductReality(base, changed).changedNodes).toEqual(['action:desk.open-set']);
  });

  it('makes generated truth code-like by detecting stale graph and Markdown projections', async () => {
    const root = await makeRoot();
    await put(root, 'src/features/app-shell/environment/model.ts', `export const ENVIRONMENT_ZONE_IDS = ['desk'] as const;`);
    await generateProductReality(root);
    expect((await checkProductReality(root)).stale).toEqual([]);
    await put(root, 'src/features/app-shell/environment/model.ts', `export const ENVIRONMENT_ZONE_IDS = ['desk', 'library'] as const;`);
    const stale = await checkProductReality(root);
    expect(stale.stale.sort()).toEqual(['docs/generated/product-reality.json', 'docs/product-surface-map.md']);
    expect(await readFile(path.join(root, 'docs/product-surface-map.md'), 'utf8')).not.toContain('**library**');
  });
});
