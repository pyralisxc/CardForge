import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { PUBLIC_NAVIGATION } from '@/features/public-site/client';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('consolidated public routes and account navigation', () => {
  it('keeps one direct account destination and removes redundant marketing destinations', () => {
    const primaryLinks = PUBLIC_NAVIGATION.primary.map((link) => link.href);
    const footerLinks = PUBLIC_NAVIGATION.footerGroups.flatMap((group) => group.links.map((link) => link.href));

    expect(primaryLinks).toContain('/account');
    expect(footerLinks).toContain('/account');
    expect([...primaryLinks, ...footerLinks]).not.toContain('/examples');
    expect([...primaryLinks, ...footerLinks]).not.toContain('/access');
    expect(footerLinks).not.toContain('/cameron#support');
    expect(PUBLIC_NAVIGATION.primary.map((link) => link.href)).not.toContain('/cameron');
    expect(PUBLIC_NAVIGATION.primary.map((link) => link.href)).not.toContain('/developer');
  });

  it('deletes the redundant route implementations instead of keeping redirects or dead pages', () => {
    expect(existsSync(resolve(process.cwd(), 'src/app/examples/page.tsx'))).toBe(false);
    expect(existsSync(resolve(process.cwd(), 'src/app/access/page.tsx'))).toBe(false);
  });

  it('uses the shared public header on account and owner pages', () => {
    for (const path of ['src/app/account/page.tsx', 'src/app/owner/page.tsx']) {
      const source = readSource(path);
      expect(source).toContain("from '@/features/public-site/client/shell'");
      expect(source).toContain('getCachedBusinessIdentity');
      expect(source).toContain('<PublicSiteHeader');
      expect(source).toContain('accountSlot={<PublicAuthControls />}');
      expect(source).toContain('className="cardforge-public-tokens"');
      expect(source).not.toContain('className="cardforge-public"');
      expect(source).not.toContain('StudioHeader');
    }
  });

  it('keeps Clerk controls available in the mobile menu and names identity management separately', () => {
    const header = readSource('src/features/public-site/components/PublicSiteHeader.tsx');
    expect(header).toContain('{accountSlot ? (');
    expect(header).toContain('cardforge-public-auth-status border-t');

    const authControls = readSource('src/features/account/components/PublicAuthControls.tsx');
    expect(authControls).toContain('if (!isClerkPublicConfigPresent()) return null;');


    const account = readSource('src/features/account/components/AccountProfilePage.tsx');
    expect(account).toContain('Profile &amp; security');
    expect(account).not.toContain('>Manage Account</Link>');
  });
});
