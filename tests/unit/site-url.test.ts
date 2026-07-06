import { describe, expect, it } from 'vitest';

import { getPublicAppUrl } from '@/lib/siteUrl';

describe('site URL resolution', () => {
  it('uses the explicit app URL when it is valid', () => {
    expect(getPublicAppUrl({
      NEXT_PUBLIC_APP_URL: ' https://cardforge.example/ ',
      VERCEL_URL: 'preview.vercel.app',
    })).toBe('https://cardforge.example');
  });

  it('falls back to the Vercel production URL when the explicit URL is not an app host', () => {
    expect(getPublicAppUrl({
      NEXT_PUBLIC_APP_URL: 'https://mpmmhjjhdxjedbmuctiv.supabase.co',
      VERCEL_PROJECT_PRODUCTION_URL: 'card-forge-snowy.vercel.app',
    })).toBe('https://card-forge-snowy.vercel.app');
  });

  it('falls back to the local development URL outside hosted environments', () => {
    expect(getPublicAppUrl({})).toBe('http://localhost:9002');
  });
});
