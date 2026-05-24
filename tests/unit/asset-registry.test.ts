import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getAssetRegistryPayload, mapAssetRegistryRowsToPayload } from '@/lib/assetRegistry';

describe('asset registry', () => {
  const originalSupabaseUrl = process.env.SUPABASE_URL;
  const originalSupabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  beforeEach(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  afterEach(() => {
    process.env.SUPABASE_URL = originalSupabaseUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalSupabaseServiceRoleKey;
  });

  it('falls back to shipped registry assets and marks them official', async () => {
    const payload = await getAssetRegistryPayload();

    expect(payload.registry.source).toBe('shipped-files');
    expect(payload.registry.total).toBeGreaterThanOrEqual(20);
    expect(payload.textures.length).toBeGreaterThan(0);
    expect(payload.dividers.length).toBeGreaterThan(0);
    expect(Array.isArray(payload.icons)).toBe(true);
    expect(Array.isArray(payload.imageAssets)).toBe(true);
    expect(Array.isArray(payload.templates)).toBe(true);
    expect(Array.isArray(payload.elementPresets)).toBe(true);
    expect(payload.textures.every((asset) => asset.accessTier === 'official')).toBe(true);
    expect(payload.dividers.every((asset) => asset.registryStatus === 'published')).toBe(true);
  });

  it('maps every developer registry asset class, preserving metadata with provenance fields', () => {
    const payload = mapAssetRegistryRowsToPayload([
      {
        asset_id: 'developer-textures-1',
        name: 'Developer Texture',
        asset_type: 'texture',
        url: 'https://storage.example.test/texture.svg',
        status: 'published',
        access_tier: 'free',
        library_source: 'developer',
        file_size_bytes: 2048,
        metadata: {
          developerId: 'dev-1',
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
        asset_id: 'developer-templates-1',
        name: 'Developer Template',
        asset_type: 'template',
        url: 'https://storage.example.test/template.json',
        status: 'published',
        access_tier: 'paid',
        library_source: 'developer',
        file_size_bytes: 4096,
        metadata: { developerId: 'dev-1' },
      },
      {
        asset_id: 'developer-elementPresets-1',
        name: 'Developer Element Preset',
        asset_type: 'elementPreset',
        url: 'https://storage.example.test/preset.json',
        status: 'published',
        access_tier: 'official',
        library_source: 'developer',
        file_size_bytes: 1024,
        metadata: { developerId: 'dev-1' },
      },
    ]);

    expect(payload?.registry.total).toBe(3);
    expect(payload?.textures).toHaveLength(1);
    expect(payload?.textures[0]).toMatchObject({
      librarySource: 'developer',
      allowedTargets: ['shape', 'template'],
      defaultBlendMode: 'overlay',
      defaultOpacity: 33,
      defaultScale: 140,
    });
    expect(payload?.templates[0]).toMatchObject({
      id: 'developer-templates-1',
      kind: 'template',
      accessTier: 'paid',
    });
    expect(payload?.elementPresets[0]).toMatchObject({
      id: 'developer-elementPresets-1',
      kind: 'elementPreset',
      accessTier: 'official',
    });
  });
});
