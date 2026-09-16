import { afterEach, describe, expect, it } from 'vitest';

import { GET } from '@/app/card-assets/[...assetPath]/route';

const previousPublicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

afterEach(() => {
  if (previousPublicSupabaseUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = previousPublicSupabaseUrl;
});

describe('legacy card asset route', () => {
  it('redirects an old Arcane Forge texture to its immutable catalog object', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    const response = await GET(new Request('https://cardforges.test/card-assets/textures/arcane-forge/frame-playing-premium.webp'), {
      params: Promise.resolve({ assetPath: ['textures', 'arcane-forge', 'frame-playing-premium.webp'] }),
    });

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://example.supabase.co/storage/v1/object/public/cardforge-contributor-assets/owner-defaults/textures/arcane-forge/frame-playing-premium.webp');
  });

  it('does not turn arbitrary card-asset paths into storage redirects', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    const response = await GET(new Request('https://cardforges.test/card-assets/images/default-company-logo.svg'), {
      params: Promise.resolve({ assetPath: ['images', 'default-company-logo.svg'] }),
    });

    expect(response.status).toBe(404);
  });
});
