import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { storePipelineTemplateAsset } from '@/features/pipeline/lib/pipelineTemplateAssets';
import {
  verifySelectedPublishedManagedRaster, applyVerifiedManagedRasterToTemplate,
  type ManagedRasterSelection,
} from '@/features/pipeline/lib/managedRasterAdoption';
import type { TCGCardTemplate } from '@/domain/templates';

vi.mock('@/infrastructure/database/supabaseServer', () => ({ getSupabaseServerClient: vi.fn() }));
vi.mock('@/features/pipeline/lib/pipelineTemplateAssets', () => ({ storePipelineTemplateAsset: vi.fn() }));
const choice: ManagedRasterSelection = {
  registryAssetId: 'raster-live', publishedSubmissionId: 'submission-v3', elementId: 'art',
};
const source = {
  id: 'submission-v3', lineage_id: 'lineage-A', revision_number: 3,
  status: 'published', published_at: '2026-10-28T00:00:00Z',
  target_registry_asset_id: 'raster-live', source_storage_bucket: 'managed-public',
  source_storage_path: 'owned/revision-3.png', source_mime_type: 'image/png', source_file_size_bytes: 4,
};
const bytes = new Uint8Array([1,2,3,4]);
const template: TCGCardTemplate & { id: string } = { id: 'new-template', name: 'New',
  aspectRatio: '63:88', freeformCanvas: { width: 630, height: 880, elements: [
    { id: 'art', name: 'Artwork', type: 'image', x: 0, y: 0, width: 40, height: 40, zIndex: 1, imageSource: '' },
  ] },
};
const api = (options: { registry?: Record<string, unknown> | null; source?: Record<string, unknown> | null;
  lastRegistry?: Record<string, unknown> | null; file?: Uint8Array | null } = {}) => {
  let registryReads = 0;
  const registry = options.registry === undefined
    ? { asset_id: 'raster-live', asset_type: 'image', status: 'published', contributor_submission_id: 'submission-v3' }
    : options.registry;
  const query = (table: string) => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => {
      if (table === 'cardforge_asset_registry') {
        registryReads += 1;
        return { data: registryReads === 1 ? registry : options.lastRegistry ?? registry, error: null };
      }
      return { data: options.source === undefined ? source : options.source, error: null };
    } }) }),
  });
  const storage = { from: () => ({ download: async () => ({
    data: options.file === null ? null : new Blob([options.file ?? bytes]), error: null,
  }) }) };
  vi.mocked(getSupabaseServerClient).mockReturnValue({ from: query, storage } as never);
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(storePipelineTemplateAsset).mockResolvedValue('cardforge-pipeline-asset://'+'b'.repeat(64));
  api();
});
describe('exact published managed raster adoption preflight', () => {
  it('separates original managed digest from normalized Template digest and changes only selected slot', async () => {
    const verified = await verifySelectedPublishedManagedRaster(choice);
    expect(verified).toMatchObject({ lineageId:'lineage-A', submissionId:'submission-v3', revisionNumber:3,
      originalSha256:createHash('sha256').update(bytes).digest('hex'),
      templateWebpSha256:'b'.repeat(64),
    });
    const adopted = applyVerifiedManagedRasterToTemplate(template,choice,verified);
    expect(adopted.freeformCanvas?.elements[0]?.imageSource).toBe(verified.normalizedReference);
    expect(template.freeformCanvas?.elements[0]?.imageSource).toBe('');
  });
  it('rejects spoofed source identity or wrong published revision', async () => {
    api({registry: {asset_type:'image',status:'published',contributor_submission_id:'another-revision'}});
    await expect(verifySelectedPublishedManagedRaster(choice)).rejects.toMatchObject({status:409});
    api({source: {...source, lineage_id:'different', target_registry_asset_id:'another-asset'}});
    await expect(verifySelectedPublishedManagedRaster(choice)).rejects.toMatchObject({status:409});
  });
  it('rejects current pointer changes after byte verification', async () => {
    api({lastRegistry: {status:'published',contributor_submission_id:'new-revision'}});
    await expect(verifySelectedPublishedManagedRaster(choice)).rejects.toMatchObject({status:409});
  });
  it('rejects missing, wrong-sized or missing normalized bytes', async () => {
    api({file:null}); await expect(verifySelectedPublishedManagedRaster(choice)).rejects.toMatchObject({status:503});
    api({source:{...source,source_file_size_bytes:5}});
    await expect(verifySelectedPublishedManagedRaster(choice)).rejects.toMatchObject({status:409});
    vi.mocked(storePipelineTemplateAsset).mockResolvedValue('not-a-managed-reference');
    await expect(verifySelectedPublishedManagedRaster(choice)).rejects.toMatchObject({status:409});
  });
  it('never treats an independently matching digest as the selected lineage', async () => {
    api({source:{...source,target_registry_asset_id:'raster-live',id:'independent-submission'}});
    await expect(verifySelectedPublishedManagedRaster(choice)).rejects.toMatchObject({status:409});
  });
  it('rejects attempting to write provenance into a missing or nonimage element', async () => {
    const verified=await verifySelectedPublishedManagedRaster(choice);
    expect(() => applyVerifiedManagedRasterToTemplate({...template,freeformCanvas:{...template.freeformCanvas!,elements:[]}},choice,verified))
      .toThrow();
  });
});
