import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { cacheRegistrations, revalidateTag } = vi.hoisted(() => ({
  cacheRegistrations: [] as Array<{
    keys?: string[];
    options?: { tags?: string[]; revalidate?: number | false };
  }>,
  revalidateTag: vi.fn(),
}));

vi.mock('next/cache', () => ({
  unstable_cache: vi.fn((callback: unknown, keys?: string[], options?: { tags?: string[]; revalidate?: number | false }) => {
    cacheRegistrations.push({ keys, options });
    return callback;
  }),
  revalidateTag,
}));

import {
  PUBLIC_IDENTITY_TAG,
  revalidatePublicIdentityCache,
} from '@/features/business-identity/server';
import {
  FOUNDER_PROFILE_TAG,
  revalidateFounderProfile,
  revalidateSiteContentCache,
  siteContentTag,
} from '@/features/public-site/server';
import {
  legalDocumentTag,
  revalidateLegalDocumentCache,
} from '@/features/legal/server';

describe('public cache tags and publication invalidation', () => {
  beforeEach(() => revalidateTag.mockClear());

  it('registers bounded public caches with exact feature-owned tags', () => {
    expect(PUBLIC_IDENTITY_TAG).toBe('public:business-identity');
    expect(siteContentTag('landing')).toBe('public:site-content:landing');
    expect(FOUNDER_PROFILE_TAG).toBe('public:founder-profile');
    expect(legalDocumentTag('privacy')).toBe('public:legal:privacy');

    expect(cacheRegistrations.some(({ options }) => (
      options?.tags?.includes(FOUNDER_PROFILE_TAG) && options.revalidate === 3600
    ))).toBe(true);
    expect(cacheRegistrations.some(({ options }) => (
      options?.tags?.includes(PUBLIC_IDENTITY_TAG) && options.revalidate === 3600
    ))).toBe(true);
    expect(cacheRegistrations.some(({ options }) => (
      options?.tags?.includes(siteContentTag('about')) && options.revalidate === 3600
    ))).toBe(true);
    expect(cacheRegistrations.some(({ options }) => (
      options?.tags?.includes(legalDocumentTag('terms'))
      && options.tags.includes(PUBLIC_IDENTITY_TAG)
      && options.revalidate === 3600
    ))).toBe(true);
  });

  it('invalidates only the affected tag', () => {
    revalidatePublicIdentityCache();
    expect(revalidateTag).toHaveBeenLastCalledWith(PUBLIC_IDENTITY_TAG);

    revalidateSiteContentCache('access');
    expect(revalidateTag).toHaveBeenLastCalledWith(siteContentTag('access'));

    revalidateFounderProfile();
    expect(revalidateTag).toHaveBeenLastCalledWith(FOUNDER_PROFILE_TAG);

    revalidateLegalDocumentCache('refund');
    expect(revalidateTag).toHaveBeenLastCalledWith(legalDocumentTag('refund'));
  });

  it('runs invalidation only after successful owner mutations', () => {
    const route = readFileSync(
      join(process.cwd(), 'src/app/api/owner/console/route.ts'),
      'utf8',
    );

    expect(route.indexOf('await updateBusinessIdentity(')).toBeLessThan(
      route.indexOf('revalidatePublicIdentityCache();'),
    );
    expect(route.indexOf('await updateSiteContentBlock(')).toBeLessThan(
      route.indexOf('revalidateSiteContentCache('),
    );
    expect(route.indexOf('await publishLegalDocument(')).toBeLessThan(
      route.indexOf('revalidateLegalDocumentCache('),
    );
    expect(route.indexOf('await updateFounderProfile(')).toBeLessThan(
      route.indexOf('revalidateFounderProfile();'),
    );
  });
});
