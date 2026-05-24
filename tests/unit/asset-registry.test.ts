import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getAssetRegistryPayload } from '@/lib/assetRegistry';

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
    expect(payload.textures.every((asset) => asset.accessTier === 'official')).toBe(true);
    expect(payload.dividers.every((asset) => asset.registryStatus === 'published')).toBe(true);
  });
});
