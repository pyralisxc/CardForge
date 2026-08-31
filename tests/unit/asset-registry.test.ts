import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getAssetRegistryPayload, mapAssetRegistryRowsToPayload } from '@/features/pipeline/lib/assetRegistry';
import { getVisibleRegistryAccessTiers } from '@/features/pipeline/lib/registryContentAssets';

describe('asset registry', () => {
  const originalSupabaseUrl = process.env.SUPABASE_URL;
  const originalSupabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
  const originalSupabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  beforeEach(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SECRET_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  afterEach(() => {
    process.env.SUPABASE_URL = originalSupabaseUrl;
    process.env.SUPABASE_SECRET_KEY = originalSupabaseSecretKey;
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalSupabaseServiceRoleKey;
  });

  it('returns an empty database catalog instead of starter-file fallbacks when Supabase is not configured', async () => {
    const payload = await getAssetRegistryPayload();

    expect(payload.registry.source).toBe('database');
    expect(payload.registry.configured).toBe(false);
    expect(payload.registry.total).toBe(0);
    expect(payload.textures).toHaveLength(0);
    expect(payload.dividers).toHaveLength(0);
    expect(Array.isArray(payload.icons)).toBe(true);
    expect(Array.isArray(payload.imageAssets)).toBe(true);
    expect(Array.isArray(payload.templates)).toBe(true);
    expect(Array.isArray(payload.elementPresets)).toBe(true);
  });

  it('enforces free, Creator Pass, and contributor visibility from one policy', () => {
    expect(getVisibleRegistryAccessTiers('free')).toEqual(['free']);
    expect(getVisibleRegistryAccessTiers('paid')).toEqual(['free', 'paid']);
    expect(getVisibleRegistryAccessTiers('contributor')).toEqual(['free', 'paid', 'contributor']);
  });

  it('maps every contributor registry asset class, preserving metadata with provenance fields', () => {
    const payload = mapAssetRegistryRowsToPayload([
      {
        asset_id: 'contributor-textures-1',
        name: 'Contributor Texture',
        asset_type: 'texture',
        url: 'https://storage.example.test/texture.svg',
        status: 'published',
        access_tier: 'free',
        library_source: 'contributor',
        file_size_bytes: 2048,
        metadata: {
          contributorId: 'contributor-1',
          sourceMimeType: 'image/svg+xml',
          tileMode: 'repeat',
          seamless: true,
          allowedTargets: ['shape', 'template'],
          defaultBlendMode: 'overlay',
          defaultOpacity: 33,
          defaultScale: 140,
        },
      },
      {
        asset_id: 'contributor-templates-1',
        name: 'Contributor Template',
        asset_type: 'template',
        url: 'https://storage.example.test/template.json',
        status: 'published',
        access_tier: 'paid',
        library_source: 'contributor',
        file_size_bytes: 4096,
        metadata: { contributorId: 'contributor-1' },
      },
      {
        asset_id: 'contributor-dividers-1',
        name: 'Contributor Divider',
        asset_type: 'divider',
        url: 'https://storage.example.test/divider.svg',
        status: 'published',
        access_tier: 'free',
        library_source: 'contributor',
        file_size_bytes: 1024,
        metadata: { contributorId: 'contributor-1', tileMode: 'stretch', allowedTargets: ['divider'] },
      },
      {
        asset_id: 'contributor-icons-1',
        name: 'Contributor Icon',
        asset_type: 'icon',
        url: 'https://storage.example.test/icon.svg',
        status: 'published',
        access_tier: 'free',
        library_source: 'contributor',
        file_size_bytes: 1024,
        metadata: { contributorId: 'contributor-1', defaultWidth: 64, defaultHeight: 64 },
      },
      {
        asset_id: 'contributor-images-1',
        name: 'Contributor Image',
        asset_type: 'image',
        url: 'https://storage.example.test/image.png',
        preview_url: 'https://storage.example.test/image-preview.webp',
        status: 'published',
        access_tier: 'paid',
        library_source: 'contributor',
        file_size_bytes: 8192,
        metadata: { contributorId: 'contributor-1', defaultWidth: 300, defaultHeight: 180 },
      },
      {
        asset_id: 'contributor-elementPresets-1',
        name: 'Contributor Element Preset',
        asset_type: 'elementPreset',
        url: 'https://storage.example.test/preset.json',
        status: 'published',
        access_tier: 'free',
        library_source: 'contributor',
        file_size_bytes: 1024,
        metadata: { contributorId: 'contributor-1' },
      },
    ]);

    expect(payload?.registry.total).toBe(6);
    expect(payload?.textures).toHaveLength(1);
    expect(payload?.dividers).toHaveLength(1);
    expect(payload?.icons).toHaveLength(1);
    expect(payload?.imageAssets).toHaveLength(1);
    expect(payload?.templates).toHaveLength(1);
    expect(payload?.elementPresets).toHaveLength(1);
    expect(payload?.textures[0]).toMatchObject({
      librarySource: 'contributor',
      allowedTargets: ['shape', 'template'],
      defaultBlendMode: 'overlay',
      defaultOpacity: 33,
      defaultScale: 140,
    });
    expect(payload?.templates[0]).toMatchObject({
      id: 'contributor-templates-1',
      kind: 'template',
      accessTier: 'paid',
    });
    expect(payload?.imageAssets[0]?.previewUrl).toBe('https://storage.example.test/image-preview.webp');
    expect(payload?.elementPresets[0]).toMatchObject({
      id: 'contributor-elementPresets-1',
      kind: 'elementPreset',
      accessTier: 'free',
    });
  });
});
