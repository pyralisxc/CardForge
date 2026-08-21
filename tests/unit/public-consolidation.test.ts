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
    expect(primaryLinks).toContain('/plans');
    expect(footerLinks).toContain('/account');
    expect(footerLinks).toContain('/plans');
    expect([...primaryLinks, ...footerLinks]).not.toContain('/examples');
    expect([...primaryLinks, ...footerLinks]).not.toContain('/access');
    expect(footerLinks).not.toContain('/cameron#support');
    expect(PUBLIC_NAVIGATION.primary.map((link) => link.href)).not.toContain('/cameron');
    expect(PUBLIC_NAVIGATION.primary.map((link) => link.href)).not.toContain('/developer');
  });

  it('provides one canonical public plans page backed by owner-controlled allowances and copy', () => {
    const plansPage = readSource('src/app/plans/page.tsx');
    const plansPresentation = readSource('src/features/public-site/components/PlansPageContent.tsx');
    const ownerCopy = readSource('src/features/owner/components/OwnerPublicContentPanel.tsx');

    expect(plansPage).toContain("getCachedSiteContentBlocks('plans')");
    expect(plansPage).toContain('getMcpAllowances()');
    expect(plansPresentation).toContain('<PlanChoiceGrid plans={plans} />');
    expect(ownerCopy).toContain("plans: 'Plans page'");
  });

  it('keeps sign-up in front of paid plan checkout intent', () => {
    const signUp = readSource('src/app/sign-up/[[...sign-up]]/page.tsx');
    expect(signUp).toContain('redirect_url=%2Faccount%3Fintent%3Dcreator%23account-and-billing#create-account');
    expect(signUp).toContain('redirect_url=%2Faccount%3Fintent%3Ddesigner%23account-and-billing#create-account');
    expect(signUp).not.toContain("'/account#account-actions'");
    expect(signUp).toContain('Create the account first. You will return directly to Plan &amp; billing');
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
      expect(source).toContain('accountSlot={authConfigured ? <DeveloperPublicAuthSlot /> : undefined}');
      expect(source).toContain('className="cardforge-public-tokens"');
      expect(source).not.toContain('className="cardforge-public"');
      expect(source).not.toContain('StudioHeader');
    }
  });

  it('shows live account state on every public marketing shell', () => {
    for (const path of ['src/app/page.tsx', 'src/app/about/page.tsx', 'src/app/cameron/page.tsx']) {
      const source = readSource(path);
      expect(source).toContain('<CardForgeAppProviders>');
      expect(source).toContain('<DeveloperPublicAuthSlot />');
      expect(source).toContain('isClerkServerConfigPresent');
      expect(source).toContain('accountSlot={authConfigured ? <DeveloperPublicAuthSlot /> : undefined}');
    }
  });

  it('keeps public account controls lightweight and lets developer access stay optional to Studio', () => {
    const slot = readSource('src/features/developer-access/server/DeveloperPublicAuthSlot.tsx');
    const controls = readSource('src/features/developer-access/components/DeveloperPublicAuthControls.tsx');
    const studioPage = readSource('src/app/studio/page.tsx');

    expect(slot).toContain('<DeveloperPublicAuthControls />');
    expect(slot).not.toContain('getCurrentDeveloperAccessSessionState');
    expect(controls).toContain('<PublicAuthControls />');
    expect(controls).not.toContain('useAccountEntitlement');
    expect(controls).not.toContain('accountSessionConfirmed');
    expect(controls).not.toContain('setTimeout');
    const accountEntitlementRoute = readSource('src/app/api/account/entitlement/route.ts');
    expect(accountEntitlementRoute).toContain('getCurrentCardforgeUserAccess()');
    expect(accountEntitlementRoute).toContain('accountUserId: user?.id ?? null');
    const developerAccess = readSource('src/features/developer-access/server/access.ts');
    expect(developerAccess).toContain('ownerAccess,');
    expect(developerAccess).not.toContain('resolveOwnerAccessForServerUser');
    expect(developerAccess).not.toContain('session_profile');
    expect(studioPage).toContain('getCurrentDeveloperAccessSessionState().catch');
    expect(studioPage).toContain('EMPTY_DEVELOPER_ACCESS_SESSION_STATE');
    expect(studioPage).toContain('initialDeveloperAccess={initialDeveloperAccess}');
  });

  it('keeps Clerk controls out of the mobile modal and names identity management separately', () => {
    const header = readSource('src/features/public-site/components/PublicSiteHeader.tsx');
    expect(header).toContain('cardforge-public-auth-status hidden shrink-0 xl:block');
    expect(header).toContain("href={accountSlot ? '/account' : '/sign-in'}");
    expect(header).not.toContain('cardforge-public-auth-status border-t');

    const authControls = readSource('src/features/account/components/PublicAuthControls.tsx');
    expect(authControls).toContain('if (!isClerkPublicConfigPresent()) return null;');
    expect(authControls).toContain("createAuthRouteHref('/sign-in', pathname)");
    expect(authControls).not.toContain('SignInButton');

    const account = readSource('src/features/account/components/AccountProfilePage.tsx');
    expect(account).toContain('Profile &amp; security');
    expect(account).not.toContain('>Manage Account</Link>');
  });
});
