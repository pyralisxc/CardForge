import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  buildCheckpointProductReality,
  formatCheckpointHeatMap,
  parseCheckpointGraph,
  serializeCheckpointGraph,
} from '../../scripts/product-reality-checkpoint-lib.mjs';

const roots: string[] = [];
const makeRoot = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cardforge-product-reality-stability-'));
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

describe('Product Reality accepted checkpoint stability', () => {
  it('keeps supporting test evidence out of durable A/B checkpoint bytes', async () => {
    const root = await makeRoot();
    await put(root, 'src/features/project/client.ts', 'export const project = true;');

    const before = await buildCheckpointProductReality(root);
    const beforeCheckpoint = serializeCheckpointGraph(before);
    const accepted = parseCheckpointGraph(beforeCheckpoint);

    await put(root, 'tests/product/unit/project.test.ts', `import '@/features/project/client'; test('project', () => {});`);
    const after = await buildCheckpointProductReality(root);

    expect(after.topologyFingerprint).toBe(before.topologyFingerprint);
    expect(after.evidenceFingerprint).not.toBe(before.evidenceFingerprint);
    expect(serializeCheckpointGraph(after)).toBe(beforeCheckpoint);
    expect(beforeCheckpoint).not.toContain('"kind":"test"');
    expect(beforeCheckpoint).not.toContain('"evidence"');

    const heatMap = formatCheckpointHeatMap(accepted, after);
    expect(heatMap.supportingDelta).toBeNull();
    expect(heatMap.report).toContain('Supporting evidence remains live/queryable');
    expect(heatMap.report).not.toMatch(/📎 \d+ supporting evidence\/test\/workflow changes/);
  });
});
