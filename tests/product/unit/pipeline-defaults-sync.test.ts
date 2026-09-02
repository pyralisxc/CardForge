import { createHash } from 'node:crypto';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { buildDeterministicStarterSetPackage } from '../../../scripts/sync-pipeline-defaults.mjs';

describe('Pipeline default synchronization', () => {
  it('builds byte-identical starter packages independently of execution time', async () => {
    const manifest = {
      cardforgeProject: 2,
      name: 'Deterministic Set',
      savedAt: '2026-09-02T00:00:00.000Z',
      projectRevision: 'revision-1',
      project: { artifacts: [] },
      assets: [],
    };

    const first = await buildDeterministicStarterSetPackage(manifest);
    const second = await buildDeterministicStarterSetPackage(manifest);
    const decoded = await JSZip.loadAsync(first);

    expect(decoded.file('cardforge-project.json')?.date.toISOString()).toBe(manifest.savedAt);
    expect(createHash('sha256').update(first).digest('hex'))
      .toBe(createHash('sha256').update(second).digest('hex'));
  });
});
