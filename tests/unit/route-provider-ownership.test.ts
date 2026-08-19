import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const readSource = (relativePath: string) => readFileSync(
  resolve(process.cwd(), relativePath),
  'utf8',
);

describe('route provider ownership', () => {
  it('keeps the root layout free of public presentation and analytics runtime state', () => {
    const root = readSource('src/app/layout.tsx');

    expect(root).toContain("import { ClerkProvider } from '@clerk/nextjs'");
    expect(root).not.toContain('AnalyticsProvider');
    expect(root).not.toContain('getCachedFounderProfile');
    expect(root).not.toContain('getCachedAllSiteContentBlocks');
    expect(root).not.toContain('FounderProfileProvider');
    expect(root).not.toContain('SiteContentProvider');
    expect(root).not.toContain('BrandPresentationProvider');
  });

  it('makes the public app provider own public presentation, sharing, and analytics', () => {
    const providers = readSource('src/features/app-shell/server/CardForgeAppProviders.tsx');

    expect(providers).toContain('getCachedFounderProfile');
    expect(providers).toContain('getCachedAllSiteContentBlocks');
    expect(providers).toContain('getCachedExperienceSettings');
    expect(providers).toContain('<BrandPresentationProvider');
    expect(providers).toContain('<SiteContentProvider');
    expect(providers).toContain('<FounderProfileProvider');
    expect(providers).toContain('<PublicShareSettingsProvider');
    expect(providers).toContain('<ScopedAnalyticsProvider');
  });

  it('gives Studio a smaller provider boundary without founder or full public-copy hydration', () => {
    const providers = readSource('src/features/app-shell/server/StudioAppProviders.tsx');
    const studioPage = readSource('src/app/studio/page.tsx');

    expect(providers).toContain('getCachedSiteContentBlocks(\'sharing\')');
    expect(providers).toContain('getCachedExperienceSettings');
    expect(providers).not.toContain('getCachedAllSiteContentBlocks');
    expect(providers).not.toContain('getCachedFounderProfile');
    expect(studioPage).toContain('StudioAppProviders');
    expect(studioPage).not.toContain('CardForgeAppProviders');
    expect(studioPage).toContain('getCachedBusinessIdentity');
  });

  it('keeps analytics UI outside the app content and off private owner/developer routes', () => {
    const scopedAnalytics = readSource('src/features/app-shell/components/ScopedAnalyticsProvider.tsx');

    expect(scopedAnalytics).toContain("createPortal(<AnalyticsProvider presentation={presentation} />, document.body)");
    expect(scopedAnalytics).toContain("['/owner', '/developer/cockpit']");
    expect(scopedAnalytics).toContain('PRIVATE_PATH_PREFIXES.some');
  });

  it('fails soft only for cached public business-identity reads', () => {
    const cache = readSource('src/features/business-identity/server/publicIdentityCache.ts');
    const store = readSource('src/features/business-identity/server/businessIdentityStore.ts');

    expect(cache).toContain('return await getBusinessIdentity()');
    expect(cache).toContain('DEFAULT_BUSINESS_IDENTITY');
    expect(cache).toContain('using compiled defaults');
    expect(store).toContain("throw new BusinessIdentityStoreError('Unable to load business identity.')");
  });
});
