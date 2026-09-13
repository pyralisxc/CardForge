import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  buildCheckpointProductReality,
  renderCheckpointSurfaceMap,
} from '../../scripts/product-reality-checkpoint-lib.mjs';

const roots: string[] = [];
const makeRoot = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cardforge-product-reality-map-'));
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

describe('Product Reality human projection', () => {
  it('counts honest uses-feature API relationships in the Feature owners table', async () => {
    const root = await makeRoot();
    await put(root, 'src/features/project/server.ts', 'export const project = true;');
    await put(root, 'src/app/api/project/route.ts', `import '@/features/project/server'; export const GET = () => null;`);

    const graph = await buildCheckpointProductReality(root);
    expect(graph.edges).toContainEqual(expect.objectContaining({
      from: 'api:/api/project',
      relation: 'uses-feature',
      to: 'feature:project',
    }));
    expect(graph.edges).not.toContainEqual(expect.objectContaining({
      from: 'api:/api/project',
      relation: 'calls',
      to: 'feature:project',
    }));

    const map = renderCheckpointSurfaceMap(graph);
    const projectRow = map.split('\n').find((line) => line.startsWith('| `project` |'));
    expect(projectRow).toBeDefined();
    expect(projectRow?.split('|').map((value) => value.trim())[5]).toBe('1');
  });
});
