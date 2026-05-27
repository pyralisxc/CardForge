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
        asset_id: 'developer-dividers-1',
        name: 'Developer Divider',
        asset_type: 'divider',
        url: 'https://storage.example.test/divider.svg',
        status: 'published',
        access_tier: 'free',
        library_source: 'developer',
        file_size_bytes: 1024,
        metadata: { developerId: 'dev-1', tileMode: 'stretch', allowedTargets: ['divider'] },
      },
      {
        asset_id: 'developer-icons-1',
        name: 'Developer Icon',
        asset_type: 'icon',
        url: 'https://storage.example.test/icon.svg',
        status: 'published',
        access_tier: 'free',
        library_source: 'developer',
        file_size_bytes: 1024,
        metadata: { developerId: 'dev-1', defaultWidth: 64, defaultHeight: 64 },
      },
      {
        asset_id: 'developer-images-1',
        name: 'Developer Image',
        asset_type: 'image',
        url: 'https://storage.example.test/image.png',
        status: 'published',
        access_tier: 'paid',
        library_source: 'developer',
        file_size_bytes: 8192,
        metadata: { developerId: 'dev-1', defaultWidth: 300, defaultHeight: 180 },
      },
      {
        asset_id: 'developer-parts-1',
        name: 'Developer Overlay',
        asset_type: 'part',
        url: 'https://storage.example.test/overlay.svg',
        status: 'published',
        access_tier: 'free',
        library_source: 'developer',
        file_size_bytes: 1024,
        metadata: { developerId: 'dev-1', partRole: 'ornament', allowedTargets: ['imageFrame', 'shape', 'template'] },
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

    expect(payload?.registry.total).toBe(7);
    expect(payload?.textures).toHaveLength(1);
    expect(payload?.dividers).toHaveLength(1);
    expect(payload?.icons).toHaveLength(1);
    expect(payload?.imageAssets).toHaveLength(1);
    expect(payload?.parts).toHaveLength(1);
    expect(payload?.templates).toHaveLength(1);
    expect(payload?.elementPresets).toHaveLength(1);
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
    expect(payload?.parts[0]).toMatchObject({
      id: 'developer-parts-1',
      kind: 'part',
      allowedTargets: ['imageFrame', 'shape', 'template'],
    });
    expect(payload?.elementPresets[0]).toMatchObject({
      id: 'developer-elementPresets-1',
      kind: 'elementPreset',
      accessTier: 'official',
    });
  });
});
