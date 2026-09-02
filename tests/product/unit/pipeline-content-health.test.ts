import { describe, expect, it } from 'vitest';

import { buildPipelineContentHealth } from '@/features/pipeline/lib/pipelineContentHealth';

describe('Pipeline content health', () => {
  it('projects repairable lineage, preview, duplicate-name, and Set package issues', () => {
    const health = buildPipelineContentHealth({
      catalog: {
        version: 'test', access: 'free',
        templates: { defaults: [], userTemplates: [] },
        styles: { version: 1, styles: [] },
        assets: { templates: [], textures: [], dividers: [], icons: [], imageAssets: [], elementPresets: [], registry: { configured: true, source: 'database', total: 0 } },
        fonts: { fonts: [], registry: { configured: true, source: 'database', total: 0 } },
        sets: { items: [{ id: 'starter', name: 'Starter', packageUrl: 'http://unsafe.test/set.cardforge', previewUrl: null, access: 'free', source: 'official', fileSizeBytes: 20, revision: 1, description: 'Starter', specialtyTags: [], useCaseTags: [] }] },
        pipeline: { items: [
          { id: 'one', lineageId: null, name: 'Duplicate', assetType: 'image', previewUrl: null, access: 'free', source: 'official', fileSizeBytes: 1, updatedAt: null },
          { id: 'two', lineageId: 'lineage-two', name: 'Duplicate', assetType: 'image', previewUrl: '/preview.png', access: 'free', source: 'official', fileSizeBytes: 1, updatedAt: null },
        ] },
      },
      program: null,
    });

    expect(health.checkedCount).toBe(2);
    expect(health.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(['missing-lineage', 'missing-preview', 'duplicate-name', 'invalid-package', 'missing-taxonomy']));
    expect(health.errors).toBeGreaterThan(0);
  });
});
