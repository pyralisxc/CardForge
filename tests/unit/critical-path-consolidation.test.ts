import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const readSource = (relativePath: string) => readFileSync(
  resolve(process.cwd(), relativePath),
  'utf8',
);

describe('critical-path provider ownership', () => {
  it('keeps the root layout free of public marketing and founder data', () => {
    const root = readSource('src/app/layout.tsx');

    expect(root).toContain("import { ClerkProvider } from '@clerk/nextjs'");
    expect(root).toContain('getCachedExperienceSettings');
    expect(root).toContain('<AnalyticsProvider presentation={experienceSettings.analyticsConsentPresentation} />');
    expect(root).not.toContain('getCachedFounderProfile');
    expect(root).not.toContain('getCachedAllSiteContentBlocks');
    expect(root).not.toContain('getCachedSiteMedia');
    expect(root).not.toContain('getCachedBusinessIdentity');
    expect(root).not.toContain('BrandPresentationProvider');
    expect(root).not.toContain('SiteContentProvider');
    expect(root).not.toContain('FounderProfileProvider');
  });

  it('moves live presentation into one explicit provider boundary with smaller shell and Studio scopes', () => {
    const providers = readSource('src/features/app-shell/server/CardForgeAppProviders.tsx');

    expect(providers).toContain("export type CardForgeAppProviderScope = 'public' | 'shell' | 'studio'");
    expect(providers).toContain("scope === 'studio'");
    expect(providers).toContain("scope === 'shell'");
    expect(providers).toContain('getCachedAllSiteContentBlocks()');
    expect(providers).toContain("getCachedSiteContentBlocks('shell')");
    expect(providers).toContain("getCachedSiteContentBlocks('sharing')");
    expect(providers).toContain('getCachedFounderProfile()');
    expect(providers).toContain('<BrandPresentationProvider value={brand}>');
    expect(providers).toContain('<SiteContentProvider content={siteContent}>');
    expect(providers).toContain('<PublicShareSettingsProvider settings={shareSettings}>');
  });

  it('keeps Studio on the reduced provider scope and a fail-soft public identity read', () => {
    const studio = readSource('src/app/studio/page.tsx');
    const identityCache = readSource('src/features/business-identity/server/publicIdentityCache.ts');

    expect(studio).toContain('getCachedBusinessIdentity');
    expect(studio).not.toContain('getBusinessIdentity');
    expect(studio).toContain('<CardForgeAppProviders scope="studio">');
    expect(identityCache).toContain('readCachedBusinessIdentity');
    expect(identityCache).toContain('try {');
    expect(identityCache).toContain('DEFAULT_BUSINESS_IDENTITY');
    expect(identityCache).toContain('using the compiled CardForge identity');
  });

  it('uses the shell-only provider for account and protected workspaces', () => {
    for (const path of [
      'src/app/account/page.tsx',
      'src/app/owner/page.tsx',
    ]) {
      expect(readSource(path)).toContain('<CardForgeAppProviders scope="shell">');
    }
    expect(readSource('src/app/profile/page.tsx')).toContain("redirect('/account?section=profile')");
  });

  it('does not allow analytics consent UI to intercept auth, account, private, or MCP preview routes', () => {
    const analytics = readSource('src/features/analytics/components/AnalyticsProvider.tsx');

    for (const prefix of [
      "'/owner'",
      "'/account'",
      "'/profile'",
      "'/sign-in'",
      "'/sign-up'",
      "'/mcp-template-preview'",
    ]) expect(analytics).toContain(prefix);
    expect(analytics).toContain('const requiredChoice = trackablePath');
    expect(analytics).toContain('if (!enabled || !preferenceReady || !trackablePath) return null;');
  });

  it('keeps auth and MCP preview outside the public presentation provider', () => {
    for (const path of [
      'src/app/sign-in/[[...sign-in]]/page.tsx',
      'src/app/sign-up/[[...sign-up]]/page.tsx',
      'src/app/mcp-template-preview/page.tsx',
    ]) {
      expect(readSource(path)).not.toContain('CardForgeAppProviders');
    }
  });

  it('gives legal routes live presentation without returning public data to the root layout', () => {
    const wrapper = readSource('src/features/legal/server/ConfiguredPublicLegalPage.tsx');
    expect(wrapper).toContain('<CardForgeAppProviders>');
    expect(wrapper).toContain('<PublicLegalPage {...props} />');

    for (const path of [
      'src/app/privacy/page.tsx',
      'src/app/terms/page.tsx',
      'src/app/refund/page.tsx',
      'src/app/contact/page.tsx',
      'src/app/accessibility/page.tsx',
      'src/app/creator-pass-terms/page.tsx',
      'src/app/supporter-terms/page.tsx',
      'src/app/developer-terms/page.tsx',
      'src/app/creator-pool/page.tsx',
    ]) {
      expect(readSource(path)).toContain('ConfiguredPublicLegalPage');
    }
  });

  it('keeps public legal identity reads on the fail-soft cache while owner writes remain strict', () => {
    const publicLegalCache = readSource('src/features/legal/server/publicLegalCache.ts');
    const legalStore = readSource('src/features/legal/server/legalDocumentStore.ts');

    expect(publicLegalCache).toContain('getCachedBusinessIdentity()');
    expect(legalStore).toContain("import { getBusinessIdentity } from '@/features/business-identity/server'");
    expect(legalStore).toContain('getBusinessIdentity(),');
  });
});
