import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import * as clerkConfig from '@/infrastructure/auth/clerk';

describe('public header authentication controls', () => {
  it('distinguishes connecting, signed-out, and signed-in Clerk states', () => {
    const getState = Reflect.get(clerkConfig, 'getPublicAuthControlState');
    expect(getState).toBeTypeOf('function');
    expect(getState({ authConfigured: false, isLoaded: false, isSignedIn: false })).toBe('unconfigured');
    expect(getState({ authConfigured: true, isLoaded: false, isSignedIn: false })).toBe('connecting');
    expect(getState({ authConfigured: true, isLoaded: true, isSignedIn: false })).toBe('signed-out');
    expect(getState({ authConfigured: true, isLoaded: true, isSignedIn: true })).toBe('signed-in');
  });

  it('builds Clerk-native same-site auth journeys with preserved return intent', () => {
    expect(clerkConfig.createAuthRouteHref('/sign-in', '/contributors')).toBe('/sign-in?redirect_url=%2Fcontributors');
    expect(clerkConfig.createAuthRouteHref('/sign-up', '/studio?document=abc')).toBe('/sign-up?redirect_url=%2Fstudio%3Fdocument%3Dabc');
    expect(clerkConfig.createAuthRouteHref('/sign-in', 'https://evil.example/studio')).toBe('/sign-in?redirect_url=%2Faccount');
  });

  it('uses route navigation instead of Clerk sign-in modals across CardForge entry surfaces', () => {
    const sources = [
      'src/features/account/components/PublicAuthControls.tsx',
      'src/features/account/components/AccountControls.tsx',
      'src/features/home/components/HomeDesk.tsx',
      'src/features/account/components/ProfileManagementPage.tsx',
      'src/features/contributor-program/components/ContributorProgramPage.tsx',
    ].map((relativePath) => readFileSync(resolve(process.cwd(), relativePath), 'utf8'));

    for (const source of sources) {
      expect(source).not.toContain('SignInButton');
      expect(source).not.toContain('mode="modal"');
    }
    expect(sources[0]).toContain("createAuthRouteHref('/sign-in', returnTo)");
    expect(sources[1]).toContain("createAuthRouteHref('/sign-in', returnTo)");
    expect(sources[2]).toContain("createAuthRouteHref('/sign-up', '/account')");
    expect(sources[3]).toContain("createAuthRouteHref('/sign-in', '/account?section=profile')");
    expect(sources[4]).toContain("createAuthRouteHref('/sign-in', '/contributors')");
  });

  it('lets the account-owned control provide Profile or sign-in state beside one Desk entry', () => {
    const headerSource = readFileSync(
      resolve(process.cwd(), 'src/features/public-site/components/PublicSiteHeader.tsx'),
      'utf8',
    );
    const sheetStart = headerSource.indexOf('<SheetContent');
    const sheetEnd = headerSource.indexOf('</SheetContent>');
    const sheetSource = headerSource.slice(sheetStart, sheetEnd);

    expect(sheetStart).toBeGreaterThan(-1);
    expect(sheetEnd).toBeGreaterThan(sheetStart);
    expect(headerSource).toContain('cardforge-public-auth-status hidden shrink-0 xl:block');
    expect(sheetSource).toContain('{accountSlot}');
    expect(headerSource).toContain("item.visible && item.href !== '/account'");
    expect(headerSource).toContain("const primaryCtaLabel = 'Open Desk'");
  });

  it('keeps public auth lightweight instead of reconciling contributor entitlements in the header', () => {
    const contributorAuthSource = readFileSync(
      resolve(process.cwd(), 'src/features/contributor-access/components/ContributorPublicAuthControls.tsx'),
      'utf8',
    );

    expect(contributorAuthSource).toContain('<PublicAuthControls />');
    expect(contributorAuthSource).not.toContain('useAccountEntitlement');
    expect(contributorAuthSource).not.toContain('setTimeout');
    expect(contributorAuthSource).not.toContain('refreshEntitlement');
  });

  it('opens the CardForge account from the signed-in public control', () => {
    const controlsSource = readFileSync(
      resolve(process.cwd(), 'src/features/account/components/PublicAuthControls.tsx'),
      'utf8',
    );

    expect(controlsSource).toContain('userProfileUrl="/account"');
    expect(controlsSource).toContain('href="/account?section=profile"');
    expect(controlsSource).not.toContain('userProfileUrl="/profile"');
  });

  it('keeps Clerk session ownership at the root and provides dedicated sign-in and sign-up pages', () => {
    const headerSource = readFileSync(
      resolve(process.cwd(), 'src/features/public-site/components/PublicSiteHeader.tsx'),
      'utf8',
    );
    const authControlsSource = readFileSync(
      resolve(process.cwd(), 'src/features/account/components/PublicAuthControls.tsx'),
      'utf8',
    );
    const rootLayoutSource = readFileSync(
      resolve(process.cwd(), 'src/app/layout.tsx'),
      'utf8',
    );
    const pageProvidersSource = readFileSync(
      resolve(process.cwd(), 'src/features/app-shell/server/CardForgeAppProviders.tsx'),
      'utf8',
    );
    const signInPageSource = readFileSync(
      resolve(process.cwd(), 'src/app/sign-in/[[...sign-in]]/page.tsx'),
      'utf8',
    );
    const signUpPageSource = readFileSync(
      resolve(process.cwd(), 'src/app/sign-up/[[...sign-up]]/page.tsx'),
      'utf8',
    );

    expect(authControlsSource).toContain('const returnTo = useSafeCurrentReturnPath()');
    expect(authControlsSource).toContain("createAuthRouteHref('/sign-in', returnTo)");
    expect(headerSource).not.toContain('@clerk/nextjs');
    expect(rootLayoutSource).toContain("import { ClerkProvider } from '@clerk/nextjs'");
    expect(pageProvidersSource).not.toContain('ClerkProvider');
    expect(signInPageSource).toContain("import { SignIn } from '@clerk/nextjs'");
    expect(signInPageSource).toContain('fallbackRedirectUrl={fallbackRedirectUrl}');
    expect(signInPageSource).toContain("signUpUrl={createAuthRouteHref('/sign-up', fallbackRedirectUrl)}");
    expect(signUpPageSource).toContain("import { SignUp } from '@clerk/nextjs'");
    expect(signUpPageSource).toContain("signInUrl={createAuthRouteHref('/sign-in', fallbackRedirectUrl)}");
  });

  it('server-gates Owner while contributor work stays behind account and API capability checks', () => {
    const ownerPageSource = readFileSync(resolve(process.cwd(), 'src/app/owner/page.tsx'), 'utf8');
    const metaCallbackSource = readFileSync(resolve(process.cwd(), 'src/app/api/owner/marketing/meta/callback/route.ts'), 'utf8');
    const accountPageSource = readFileSync(resolve(process.cwd(), 'src/app/account/page.tsx'), 'utf8');

    expect(ownerPageSource).toContain("import { auth } from '@clerk/nextjs/server'");
    expect(ownerPageSource).toContain("redirect(createAuthRouteHref('/sign-in'");
    expect(ownerPageSource).toContain('getCurrentOwnerAccess()');
    expect(ownerPageSource).toContain('if (!ownerAccess.isOwner)');
    expect(ownerPageSource).toContain("new URLSearchParams({ section: 'profile', utility: 'owner' })");
    expect(ownerPageSource).toContain("redirect(createAuthRouteHref('/sign-in', target))");
    expect(ownerPageSource).toContain("targetParams.set('ownerWorkspace', workspace)");
    expect(metaCallbackSource).toContain("new URL('/account', getPublicAppUrl())");
    expect(metaCallbackSource).toContain("url.searchParams.set('ownerWorkspace', 'marketing')");
    expect(accountPageSource).toContain('getCurrentContributorAccessSessionState()');
    expect(accountPageSource).toContain('hasContributionScope(contributionScopes');
    expect(accountPageSource).toContain('<UnifiedAccountLibrary');
  });

  it('keeps Studio compatibility ingress free of contributor boot ownership', () => {
    const studioPageSource = readFileSync(resolve(process.cwd(), 'src/app/studio/page.tsx'), 'utf8');

    expect(studioPageSource).toContain('createContextualStudioHref');
    expect(studioPageSource).not.toContain('getCurrentContributorAccessSessionState');
    expect(studioPageSource).not.toContain('StudioRuntimeLoader');
  });

  it('lets the broad proxy matcher establish Clerk context without a second route allowlist', () => {
    const proxySource = readFileSync(resolve(process.cwd(), 'src/proxy.ts'), 'utf8');
    const middlewareSource = readFileSync(
      resolve(process.cwd(), 'src/infrastructure/auth/middleware.ts'),
      'utf8',
    );

    expect(proxySource).toContain("'/(api|trpc)(.*)'");
    expect(proxySource).toContain("'/__clerk/(.*)'");
    expect(middlewareSource).toContain('clerkMiddleware({');
    expect(middlewareSource).toContain('authorizedParties: getClerkAuthorizedParties()');
    expect(middlewareSource).not.toContain('shouldRunClerkMiddlewareForRequest');
  });

  it('accepts only same-site relative sign-in destinations', () => {
    expect(clerkConfig.getSafeLocalReturnPath('/studio?document=abc')).toBe('/studio?document=abc');
    expect(clerkConfig.getSafeLocalReturnPath('/account#billing')).toBe('/account#billing');
    expect(clerkConfig.getSafeLocalReturnPath('https://evil.example/studio')).toBe('/account');
    expect(clerkConfig.getSafeLocalReturnPath('//evil.example/studio')).toBe('/account');
    expect(clerkConfig.getSafeLocalReturnPath(undefined)).toBe('/account');
  });

  it('protects Studio document deep links before translating them into the contextual Desk tool', () => {
    const studioPageSource = readFileSync(resolve(process.cwd(), 'src/app/studio/page.tsx'), 'utf8');

    expect(studioPageSource).toContain("import { auth } from '@clerk/nextjs/server'");
    expect(studioPageSource).toContain('const authConfigured = isClerkServerConfigPresent()');
    expect(studioPageSource).toContain('if (authConfigured)');
    expect(studioPageSource).toContain('if (!isAuthenticated)');
    expect(studioPageSource).toContain('redirectToSignIn');
    expect(studioPageSource).toContain('returnBackUrl: contextualHref');
    expect(studioPageSource).toContain('redirect(contextualHref)');
    expect(studioPageSource).not.toContain('createProjectPersistenceScope');
  });

  it('removes the superseded app-shell public header', () => {
    expect(existsSync(resolve(process.cwd(), 'src/features/app-shell/components/PublicSiteHeader.tsx'))).toBe(false);
    expect(existsSync(resolve(process.cwd(), 'src/features/app-shell/client/publicSite.ts'))).toBe(false);
  });
});
