import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  buildProductReality,
  checkProductReality,
  diffProductReality,
  generateProductReality,
  queryProductReality,
  renderProductSurfaceMap,
} from '../../scripts/product-reality-lib.mjs';
import {
  classifySourcePath,
  resolveLocalImport,
} from '../../scripts/repository-analysis.mjs';

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

describe('repository-analysis kernel', () => {
  it('owns source classification and local-import resolution used by repository projections', () => {
    expect(classifySourcePath('features/project/client.ts')).toMatchObject({
      kind: 'feature',
      featureName: 'project',
      publicEntry: 'client',
    });
    expect(classifySourcePath('app/api/cards/route.ts')).toMatchObject({ kind: 'app' });
    const sourceRoot = path.join('/repo', 'src');
    expect(resolveLocalImport({
      importerPath: path.join(sourceRoot, 'features', 'desk', 'client.ts'),
      sourceRoot,
      specifier: '@/features/project/client',
    })).toBe('features/project/client');
  });
});

describe('Product Reality graph', () => {
  it('derives product surfaces, actions, contextual Studio tools, owners, MCP, routes, providers, workflows, and literal test evidence', async () => {
    const root = await makeRoot();
    await put(root, 'src/features/app-shell/environment/model.ts', `
      export const ENVIRONMENT_ZONE_IDS = ['desk', 'library', 'profile'] as const;
    `);
    await put(root, 'src/features/desk/model/actions.ts', `
      import type { Thing } from '@/features/card-generator/client';
      import Stripe from 'stripe';
      export type DeskContextualToolId = 'design' | 'generate' | 'output' | 'pipeline';
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
    await put(root, 'src/app/mcp/route.ts', `
      import { register } from '@/features/studio-documents/server';
      export function make(server: { registerTool: (...args: unknown[]) => void }) {
        server.registerTool('route_tool', {}, async () => ({}));
        return register(server);
      }
    `);
    await put(root, 'src/app/api/cards/route.ts', `import '@/features/card-generator/server'; export const GET = () => null;`);
    await put(root, 'src/features/card-generator/server.ts', 'export const server = true;');
    await put(root, 'src/app/studio/page.tsx', `import '@/features/card-generator/client'; export default function Page(){ return null; }`);
    await put(root, 'src/app/about/page.tsx', `export default function Page(){ return null; }`);
    await put(root, 'tests/product/unit/generate.test.ts', `import '@/features/card-generator/client'; test('x', () => {});`);
    await put(root, '.github/workflows/ci.yml', 'name: CI\nsteps:\n  - run: npm run verify:full\n');

    const graph = await buildProductReality(root);
    const ids = new Set(graph.nodes.map((node: { id: string }) => node.id));
    for (const id of [
      'surface:desk',
      'surface:library',
      'surface:profile',
      'surface:studio',
      'surface:public',
      'action:desk.generate-set',
      'feature:card-generator',
      'tool:design',
      'tool:generate',
      'tool:output',
      'tool:pipeline',
      'mcp:upsert_cards',
      'mcp:route_tool',
      'api:/api/cards',
      'provider:stripe',
      'test:tests/product/unit/generate.test.ts',
      'workflow:.github/workflows/ci.yml',
    ]) expect(ids.has(id)).toBe(true);
    expect(ids.has('surface:owner')).toBe(false);

    const surface = graph.nodes.find((node: { id: string }) => node.id === 'surface:studio') as { role: string };
    expect(surface.role).toBe('workbench');

    const relations = new Set(
      graph.edges.map((edge: { from: string; relation: string; to: string }) => `${edge.from}|${edge.relation}|${edge.to}`),
    );
    expect(relations.has('surface:desk|exposes|action:desk.generate-set')).toBe(true);
    expect(relations.has('surface:studio|exposes|tool:generate')).toBe(true);
    expect(relations.has('action:desk.generate-set|owned-by|feature:card-generator')).toBe(true);
    expect(relations.has('action:desk.generate-set|automated-by|mcp:upsert_cards')).toBe(true);
    expect(relations.has('action:desk.generate-set|opens|tool:generate')).toBe(true);
    expect(relations.has('tool:generate|owned-by|feature:card-generator')).toBe(true);
    expect(relations.has('api:/api/cards|calls|feature:card-generator')).toBe(true);
    expect(relations.has('feature:desk|integrates-with|provider:stripe')).toBe(true);
    expect(relations.has('feature:card-generator|referenced-by-test|test:tests/product/unit/generate.test.ts')).toBe(true);
    expect(relations.has('route:/mcp|exposes|mcp:route_tool')).toBe(true);
    expect([...relations].some((value) => value === 'mcp:route_tool|implemented-by|feature:studio-documents')).toBe(false);
  });

  it('requires direct provider evidence instead of ordinary provider copy', async () => {
    const root = await makeRoot();
    await put(root, 'src/features/account/components/DriveMessage.tsx', `
      export const copy = 'Save a copy to Google Drive';
    `);
    await put(root, 'src/features/project/server/google.ts', `
      export const endpoint = 'https://www.googleapis.com/drive/v3/files';
    `);

    const graph = await buildProductReality(root);
    const relations = graph.edges.map((edge: { from: string; relation: string; to: string }) => `${edge.from}|${edge.relation}|${edge.to}`);
    expect(relations).not.toContain('feature:account|integrates-with|provider:google-drive');
    expect(relations).toContain('feature:project|integrates-with|provider:google-drive');
  });

  it('renders a compact descriptive dashboard and uses topology rather than evidence bytes as the human fingerprint', async () => {
    const root = await makeRoot();
    await put(root, 'src/features/app-shell/environment/model.ts', `export const ENVIRONMENT_ZONE_IDS = ['desk'] as const;`);
    await put(root, 'src/features/desk/model/action.ts', `export const action = {
      id:'desk.open-set', label:'Open Set', ownerFeature:'project', supportedObjectKinds:['set'], supportedSources:['browser-local'],
      revisionPolicy:'none', requiredPermission:'guest', scope:'object', hierarchy:'primary', availability:{kind:'available'}, commitment:'none',
      automation:{kind:'human-only', owner:'cardforge'}, result:'navigation'
    } as const;`);
    const first = await buildProductReality(root);
    const markdown = renderProductSurfaceMap(first);
    expect(markdown).toContain('Generated current-state projection');
    expect(markdown).toContain('Topology fingerprint');
    expect(markdown).toContain('`desk.open-set`');
    expect(markdown).toContain('`project`');
    expect(markdown).not.toContain('## Direction');
    expect(markdown).not.toContain('## Future');

    await put(root, 'src/features/desk/model/action.ts', `// evidence-only comment
      export const action = {
        id:'desk.open-set', label:'Open Set', ownerFeature:'project', supportedObjectKinds:['set'], supportedSources:['browser-local'],
        revisionPolicy:'none', requiredPermission:'guest', scope:'object', hierarchy:'primary', availability:{kind:'available'}, commitment:'none',
        automation:{kind:'human-only', owner:'cardforge'}, result:'navigation'
      } as const;`);
    const second = await buildProductReality(root);
    expect(second.topologyFingerprint).toBe(first.topologyFingerprint);
    expect(second.evidenceFingerprint).not.toBe(first.evidenceFingerprint);
    expect(renderProductSurfaceMap(second)).toBe(markdown);
  });

  it('diffs semantic topology and unknown state while ignoring evidence-only movement', () => {
    const base = {
      nodes: [{ id: 'action:desk.open-set', kind: 'action', label: 'Open', owner: 'project', evidence: [{ path: 'a.ts', line: 4 }] }],
      edges: [{ from: 'surface:desk', relation: 'exposes', to: 'action:desk.open-set', confidence: 'observed', evidence: [{ path: 'a.ts', line: 4 }] }],
      unknowns: [{ kind: 'action-owner', message: 'Action x is dynamic.', path: 'a.ts', line: 5 }],
    };
    const sameTopology = {
      nodes: [{ id: 'action:desk.open-set', kind: 'action', label: 'Open', owner: 'project', evidence: [{ path: 'b.ts', line: 40 }] }],
      edges: [{ from: 'surface:desk', relation: 'exposes', to: 'action:desk.open-set', confidence: 'observed', evidence: [{ path: 'b.ts', line: 40 }] }],
      unknowns: [{ kind: 'action-owner', message: 'Action x is dynamic.', path: 'b.ts', line: 50 }],
    };
    expect(diffProductReality(base, sameTopology)).toEqual({
      addedNodes: [],
      removedNodes: [],
      changedNodes: [],
      addedEdges: [],
      removedEdges: [],
      changedEdges: [],
      addedUnknowns: [],
      removedUnknowns: [],
    });
    const changed = structuredClone(sameTopology);
    changed.nodes[0].owner = 'card-generator';
    changed.unknowns = [];
    const delta = diffProductReality(base, changed);
    expect(delta.changedNodes).toEqual(['action:desk.open-set']);
    expect(delta.removedUnknowns).toEqual(['action-owner|Action x is dynamic.']);
  });

  it('queries a bounded two-hop neighborhood so a surface reaches tools and their owners without loading the whole graph', () => {
    const graph = {
      nodes: [
        { id: 'surface:studio', kind: 'surface', label: 'studio' },
        { id: 'tool:generate', kind: 'tool', label: 'generate' },
        { id: 'feature:card-generator', kind: 'feature', label: 'card-generator' },
        { id: 'provider:stripe', kind: 'provider', label: 'Stripe' },
        { id: 'feature:billing', kind: 'feature', label: 'billing' },
      ],
      edges: [
        { from: 'surface:studio', relation: 'exposes', to: 'tool:generate', confidence: 'declared' },
        { from: 'tool:generate', relation: 'owned-by', to: 'feature:card-generator', confidence: 'declared' },
        { from: 'feature:billing', relation: 'integrates-with', to: 'provider:stripe', confidence: 'observed' },
      ],
      unknowns: [],
    };
    const output = (queryProductReality as unknown as (
      value: typeof graph,
      options: { surface: string },
    ) => string)(graph, { surface: 'studio' });
    expect(output).toContain('surface:studio');
    expect(output).toContain('tool:generate');
    expect(output).toContain('feature:card-generator');
    expect(output).not.toContain('provider:stripe');
    expect(output).not.toContain('feature:billing');
  });

  it('makes generated truth code-like by detecting graph-only evidence drift separately from human map drift', async () => {
    const root = await makeRoot();
    await put(root, 'src/features/app-shell/environment/model.ts', `export const ENVIRONMENT_ZONE_IDS = ['desk'] as const;`);
    await generateProductReality(root);
    expect((await checkProductReality(root)).stale).toEqual([]);

    await put(root, 'src/features/app-shell/environment/model.ts', `// comment only
      export const ENVIRONMENT_ZONE_IDS = ['desk'] as const;`);
    const evidenceOnly = await checkProductReality(root);
    expect(evidenceOnly.stale).toEqual(['docs/generated/product-reality.json']);

    await generateProductReality(root);
    await put(root, 'src/features/app-shell/environment/model.ts', `export const ENVIRONMENT_ZONE_IDS = ['desk', 'library'] as const;`);
    const topology = await checkProductReality(root);
    expect(topology.stale.sort()).toEqual(['docs/generated/product-reality.json', 'docs/product-surface-map.md']);
    expect(await readFile(path.join(root, 'docs/product-surface-map.md'), 'utf8')).not.toContain('**library**');
  });
});
