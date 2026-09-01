import { access, readFile } from 'node:fs/promises';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_BUSINESS_IDENTITY,
  OwnerBusinessIdentityPanel,
} from '@/features/business-identity/client';

Object.defineProperty(globalThis, 'React', {
  value: React,
  configurable: true,
});

const rootPath = (...parts: string[]) => path.join(process.cwd(), ...parts);

const pathExists = async (...parts: string[]) => {
  try {
    await access(rootPath(...parts));
    return true;
  } catch {
    return false;
  }
};

describe('business identity runtime cutover', () => {
  it('keeps an unverified assumed name read-only and out of routine DBA actions', () => {
    const html = renderToStaticMarkup(React.createElement(OwnerBusinessIdentityPanel, {
      businessIdentity: { ...DEFAULT_BUSINESS_IDENTITY },
      onSave: async () => undefined,
    }));

    expect(html).toContain('Assumed business name status');
    expect(html).toContain('Unverified');
    expect(html).toContain('documented external verification');
    expect(html).toContain('separate reviewed update');
    expect(html).not.toContain('value="registered"');
    expect(html).not.toContain('Registered</option>');
    expect(html).not.toContain('d/b/a');
  });

  it('retires public-site ownership of operator identity', async () => {
    await expect(pathExists('src/features/public-site/model/siteOperator.ts')).resolves.toBe(false);
    await expect(pathExists('src/features/public-site/client/operator.ts')).resolves.toBe(false);

    const publicClient = await readFile(rootPath('src/features/public-site/client.ts'), 'utf8');
    const publicServer = await readFile(rootPath('src/features/public-site/server.ts'), 'utf8');
    const contentStore = await readFile(rootPath('src/features/public-site/server/contentStore.ts'), 'utf8');

    for (const source of [publicClient, publicServer, contentStore]) {
      expect(source).not.toContain('SiteOperatorSettings');
      expect(source).not.toContain('SiteOperator');
      expect(source).not.toContain('OperatorSettings');
    }
  });

  it('uses one explicit business identity update contract in the owner API', async () => {
    const route = await readFile(rootPath('src/app/api/owner/console/route.ts'), 'utf8');

    expect(route).toContain("body.kind === 'businessIdentity'");
    expect(route).toContain('body.businessIdentity');
    expect(route).toContain('body.expectedIdentityVersion');
    expect(route).toContain('updateBusinessIdentity(');
    expect(route).toContain('error instanceof BusinessIdentityStoreError');
    expect(route).not.toContain("body.kind === 'settings'");
    expect(route).not.toContain('updateSiteOperatorSettings');
  });

  it('renders the brand separately from the Oregon legal operator description', async () => {
    const component = await readFile(
      rootPath('src/features/legal/components/PublicLegalPage.tsx'),
      'utf8',
    );
    const store = await readFile(
      rootPath('src/features/legal/server/legalDocumentStore.ts'),
      'utf8',
    );
    const footer = await readFile(
      rootPath('src/features/public-site/components/PublicSiteFooter.tsx'),
      'utf8',
    );

    expect(store).toContain('getBusinessIdentity');
    expect(store).toContain('businessIdentity: BusinessIdentity');
    expect(store).not.toContain('getSiteOperatorSettings');
    expect(component).toContain('businessIdentity={businessIdentity}');
    expect(component).toContain('formatBusinessIdentityDescription(businessIdentity)');
    expect(component).toContain('businessIdentity.legalOperatorName');
    expect(component).toContain('businessIdentity.jurisdictionState');
    expect(footer).toContain('businessIdentity.brandName');
    expect(footer).toContain('businessIdentity.legalOperatorName');
    expect(footer).toContain('businessIdentity.jurisdictionState');
    expect(component).not.toContain('settings.businessName');
    expect(component).not.toContain('d/b/a');
  });

  it('loads direct support identity instead of using a legal document as a proxy', async () => {
    for (const pagePath of [
      'src/app/contributors/page.tsx',
      'src/app/roadmap/page.tsx',
    ]) {
      const source = await readFile(rootPath(pagePath), 'utf8');
      expect(source, pagePath).toContain('getCachedBusinessIdentity');
      expect(source, pagePath).not.toContain('getPublishedLegalDocument');
    }
  });

  it('passes runtime identity from the homepage into the shared public shell and footer', async () => {
    const homepage = await readFile(rootPath('src/app/page.tsx'), 'utf8');
    const shell = await readFile(rootPath('src/features/public-site/components/PublicSiteShell.tsx'), 'utf8');
    const footer = await readFile(rootPath('src/features/public-site/components/PublicSiteFooter.tsx'), 'utf8');

    expect(homepage).toContain('getCachedBusinessIdentity');
    expect(homepage).toContain('Promise.all([');
    expect(homepage).toContain('getCachedBusinessIdentity()');
    expect(homepage).toContain('businessIdentity={businessIdentity}');
    expect(shell).toContain('<PublicSiteFooter businessIdentity={businessIdentity}');
    expect(footer).toContain('businessIdentity.brandName');
    expect(footer).toContain('businessIdentity.legalOperatorName');
    expect(footer).toContain('businessIdentity.copyrightHolder');
    expect(homepage).not.toContain('d/b/a');
  });

  it('passes a minimal fail-soft runtime identity from Account into the contextual Studio tool', async () => {
    const studioPage = await readFile(rootPath('src/app/studio/page.tsx'), 'utf8');
    const accountPage = await readFile(rootPath('src/app/account/page.tsx'), 'utf8');
    const homeDesk = await readFile(rootPath('src/features/home/components/HomeDesk.tsx'), 'utf8');
    const library = await readFile(rootPath('src/features/storage-management/components/UnifiedAccountLibrary.tsx'), 'utf8');
    const studioClient = await readFile(rootPath('src/features/app-shell/client/studio.ts'), 'utf8');
    const studioShell = await readFile(
      rootPath('src/features/app-shell/components/CardForgeStudioShell.tsx'),
      'utf8',
    );

    expect(studioPage).toContain('export default async function StudioPage({');
    expect(studioPage).toContain('redirect(contextualHref)');
    expect(studioPage).not.toContain('StudioRuntimeLoader');
    expect(accountPage).toContain("getCachedBusinessIdentity } from '@/features/business-identity/server';");
    expect(accountPage).toContain('getCachedBusinessIdentity()');
    expect(accountPage).toContain('brandName: businessIdentity.brandName');
    expect(accountPage).toContain('copyrightHolder: businessIdentity.copyrightHolder');
    expect(homeDesk).toContain('businessIdentity={businessIdentity}');
    expect(accountPage).toContain("activeSection === 'home' || activeSection === 'library'");
    expect(library).toContain('businessIdentity: StudioBusinessIdentity');
    expect(library).toContain('businessIdentity={businessIdentity}');
    expect(library).not.toContain("brandName: 'CardForge', copyrightHolder: 'CardForge'");
    expect(studioClient).toContain('type StudioBusinessIdentity');
    expect(studioShell).toContain('businessIdentity.brandName');
    expect(studioShell).toContain('businessIdentity.copyrightHolder');
    expect(studioShell).not.toContain('DEFAULT_BUSINESS_IDENTITY');
  });
});
