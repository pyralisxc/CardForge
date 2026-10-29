import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import {
  externalizePipelineTemplateAssets,
  storePipelineTemplateAsset,
  hydratePipelineTemplateAssetReferences,
} from '@/features/pipeline/lib/pipelineTemplateAssets';
import { mapRegistryRowsToTemplateLibrary } from '@/features/pipeline/lib/repositoryCatalog';

vi.mock('@/infrastructure/database/supabaseServer', () => ({
  getSupabaseServerClient: vi.fn(),
}));

const mockedGetSupabaseServerClient = vi.mocked(getSupabaseServerClient);
const onePixelPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';

describe('Pipeline Template assets', () => {
  beforeEach(() => {
    mockedGetSupabaseServerClient.mockReset();
  });

  it('decodes actual raster bytes into a separate verified WebP content identity', async () => {
    const source = Buffer.from(onePixelPng.split(',')[1]!, 'base64');
    const writes: Buffer[] = [];
    const upload = vi.fn(async (_path: string, bytes: Buffer) => {
      writes.push(Buffer.from(bytes)); return { error: null };
    });
    const upsert = vi.fn().mockResolvedValue({ error: null });
    mockedGetSupabaseServerClient.mockReturnValue({
      storage: { from: () => ({ exists: async () => ({ data: false, error: null }), upload }) },
      from: () => ({ upsert }),
    } as never);
    const normalizedReference = await storePipelineTemplateAsset(source);
    expect(writes).toHaveLength(1);
    expect((await sharp(writes[0]).metadata()).format).toBe('webp');
    const originalSha = createHash('sha256').update(source).digest('hex');
    const normalizedSha = createHash('sha256').update(writes[0]).digest('hex');
    expect(normalizedSha).not.toBe(originalSha);
    expect(normalizedReference).toBe('cardforge-pipeline-asset://' + normalizedSha);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      asset_id: normalizedSha, storage_path: 'template-assets/' + normalizedSha + '.webp',
    }), { onConflict: 'asset_id' });
  });

  it('stores repeated embedded artwork once and persists only content-addressed references', async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    const exists = vi.fn().mockResolvedValue({ data: false, error: null });
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const getPublicUrl = vi.fn((path: string) => ({
      data: { publicUrl: `https://assets.example/${path}` },
    }));
    mockedGetSupabaseServerClient.mockReturnValue({
      storage: { from: vi.fn(() => ({ exists, upload, getPublicUrl })) },
      from: vi.fn(() => ({ upsert })),
    } as never);

    const stored = await externalizePipelineTemplateAssets({
      id: 'template-1',
      name: 'Template',
      aspectRatio: '63:88',
      cardBackgroundImageUrl: onePixelPng,
      templatePreviewData: { Artwork: onePixelPng },
    });

    expect(JSON.stringify(stored)).not.toContain('data:image');
    const references = JSON.stringify(stored).match(/cardforge-pipeline-asset:\/\/[a-f0-9]{64}/g) ?? [];
    expect(references).toHaveLength(2);
    expect(new Set(references)).toHaveLength(1);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledTimes(1);

    const hydrated = hydratePipelineTemplateAssetReferences(stored);
    expect(JSON.stringify(hydrated)).toContain('https://assets.example/template-assets/');

    const [published] = await mapRegistryRowsToTemplateLibrary([{
      asset_id: 'template-1',
      contributor_submission_id: 'revision-1',
      name: 'Template',
      url: '/api/templates#template-1',
      status: 'published',
      access_tier: 'free',
      library_source: 'official',
      metadata: {
        revisionNumber: 2,
        template: { id: 'stale-registry-copy', name: 'Stale', aspectRatio: '1:1' },
      },
      content_payload: stored,
    }]);
    expect(published.id).toBe('template-1');
    expect(published.cardBackgroundImageUrl).toContain('https://assets.example/template-assets/');
    expect(published.templatePreviewData?.Artwork).toContain('https://assets.example/template-assets/');
    expect(published.name).toBe('Template');

    const retiredRegistryCopy = await mapRegistryRowsToTemplateLibrary([{
      asset_id: 'template-without-revision',
      contributor_submission_id: 'missing-revision',
      name: 'Legacy registry copy',
      url: '/api/templates#template-without-revision',
      status: 'published',
      access_tier: 'free',
      library_source: 'official',
      metadata: {
        template: { id: 'retired-copy', name: 'Retired', aspectRatio: '1:1' },
      },
    }]);
    expect(retiredRegistryCopy).toEqual([]);
  });
});
