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

  it('builds same-site route-based auth journeys with preserved return intent', () => {
    expect(clerkConfig.createAuthRouteHref('/sign-in', '/developer')).toBe('/sign-in?returnTo=%2Fdeveloper');
    expect(clerkConfig.createAuthRouteHref('/sign-up', '/studio?document=abc')).toBe('/sign-up?returnTo=%2Fstudio%3Fdocument%3Dabc');
    expect(clerkConfig.createAuthRouteHref('/sign-in', 'https://evil.example/studio')).toBe('/sign-in?returnTo=%2Faccount');
  });

  it('uses route navigation instead of Clerk sign-in modals across CardForge entry surfaces', () => {
    const sources = [
      'src/features/account/components/PublicAuthControls.tsx',
      'src/features/account/components/AccountControls.tsx',
      'src/features/account/components/AccountProfilePage.tsx',
      'src/features/account/components/ProfileManagementPage.tsx',
      'src/features/developer-program/components/DeveloperProgramPage.tsx',
    ].map((relativePath) => readFileSync(resolve(process.cwd(), relativePath), 'utf8'));

    for (const source of sources) {
      expect(source).not.toContain('SignInButton');
      expect(source).not.toContain('mode="modal"');
    }
    expect(sources[0]).toContain("createAuthRouteHref('/sign-in', pathname)");
    expect(sources[1]).toContain("createAuthRouteHref('/sign-in', '/studio')");
    expect(sources[2]).toContain("createAuthRouteHref('/sign-up', '/account')");
    expect(sources[3]).toContain("createAuthRouteHref('/sign-in', '/profile')");
    expect(sources[4]).toContain("createAuthRouteHref('/sign-in', '/developer')");
  });

  it('mounts the dynamic public account control only in the desktop header, never inside the mobile dialog', () => {
    const headerSource = readFileSync(
      resolve(process.cwd(), 'src/features/public-site/components/PublicSiteHeader.tsx'),
      'utf8',
    );
    const dialogStart = headerSource.indexOf('<DialogContent');
    const dialogEnd = headerSource.indexOf('</DialogContent>');
    const dialogSource = headerSource.slice(dialogStart, dialogEnd);

    expect(dialogStart).toBeGreaterThan(-1);
    expect(dialogEnd).toBeGreaterThan(dialogStart);
    expect(headerSource).toContain('cardforge-public-auth-status hidden shrink-0 xl:block');
    expect(dialogSource).not.toContain('{accountSlot}');
    expect(dialogSource).toContain("href={accountSlot ? '/account' : '/sign-in'}");
  });

  it('keeps public auth lightweight instead of reconciling developer entitlements in the header', () => {
    const developerAuthSource = readFileSync(
      resolve(process.cwd(), 'src/features/developer-access/components/DeveloperPublicAuthControls.tsx'),
      'utf8',
    );

    expect(developerAuthSource).toContain('<PublicAuthControls />');
    expect(developerAuthSource).not.toContain('useAccountEntitlement');
    expect(developerAuthSource).not.toContain('setTimeout');
    expect(developerAuthSource).not.toContain('refreshEntitlement');
  });

  it('opens the CardForge account from the signed-in public control', () => {
    const controlsSource = readFileSync(
      resolve(process.cwd(), 'src/features/account/components/PublicAuthControls.tsx'),
      'utf8',
    );

    expect(controlsSource).toContain('userProfileUrl="/account"');
    expect(controlsSource).not.toContain('userProfileUrl="/profile"');
  });

  it('keeps Clerk session ownership at the root and provides dedicated sign-in and sign-up pages', () => {
    const headerSource = readFileSync(
      resolve(process.cwd(), 'src/features/public-site/components/PublicSiteHeader.tsx'),
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

    expect(headerSource).toContain('href="/sign-in"');
    expect(headerSource).not.toContain('@clerk/nextjs');
    expect(rootLayoutSource).toContain("import { ClerkProvider } from '@clerk/nextjs'");
    expect(pageProvidersSource).not.toContain('ClerkProvider');
    expect(signInPageSource).toContain("import { SignIn } from '@clerk/nextjs'");
    expect(signInPageSource).toContain('fallbackRedirectUrl={fallbackRedirectUrl}');
    expect(signInPageSource).toContain("signUpUrl={createAuthRouteHref('/sign-up', fallbackRedirectUrl)}");
    expect(signUpPageSource).toContain("import { SignUp } from '@clerk/nextjs'");
    expect(signUpPageSource).toContain("signInUrl={createAuthRouteHref('/sign-in', fallbackRedirectUrl)}");
  });

  it('server-gates owner and developer workspaces before their client shells load', () => {
    const ownerPageSource = readFileSync(resolve(process.cwd(), 'src/app/owner/page.tsx'), 'utf8');
    const developerPageSource = readFileSync(resolve(process.cwd(), 'src/app/developer/cockpit/page.tsx'), 'utf8');

    for (const source of [ownerPageSource, developerPageSource]) {
      expect(source).toContain("import { auth } from '@clerk/nextjs/server'");
      expect(source).toContain("redirect(createAuthRouteHref('/sign-in'");
    }
    expect(ownerPageSource).toContain('getCurrentOwnerAccess()');
    expect(ownerPageSource).toContain('if (!ownerAccess.isOwner)');
    expect(developerPageSource).toContain('getCurrentDeveloperAccessSessionState()');
    expect(developerPageSource).toContain('if (!developerAccess.projection.hasCockpitAccess)');
  });

  it('lets optional developer projection fail soft without blocking Studio boot', () => {
    const studioPageSource = readFileSync(resolve(process.cwd(), 'src/app/studio/page.tsx'), 'utf8');

    expect(studioPageSource).toContain('EMPTY_DEVELOPER_ACCESS_SESSION_STATE');
    expect(studioPageSource).toContain('getCurrentDeveloperAccessSessionState().catch');
    expect(studioPageSource).toContain('Unable to load optional Studio developer access');
  });

  it('lets the broad proxy matcher establish Clerk context without a second route allowlist', () => {
    const proxySource = readFileSync(resolve(process.cwd(), 'src/proxy.ts'), 'utf8');
    const middlewareSource = readFileSync(
      resolve(process.cwd(), 'src/infrastructure/auth/middleware.ts'),
      'utf8',
    );

    expect(proxySource).toContain("'/(api|trpc)(.*)'");
    expect(proxySource).toContain("'/__clerk/(.*)'");
    expect(middlewareSource).toContain('clerkMiddleware()');
    expect(middlewareSource).not.toContain('shouldRunClerkMiddlewareForRequest');
  });

  it('accepts only same-site relative sign-in destinations', () => {
    expect(clerkConfig.getSafeLocalReturnPath('/studio?document=abc')).toBe('/studio?document=abc');
    expect(clerkConfig.getSafeLocalReturnPath('/account#billing')).toBe('/account#billing');
    expect(clerkConfig.getSafeLocalReturnPath('https://evil.example/studio')).toBe('/account');
    expect(clerkConfig.getSafeLocalReturnPath('//evil.example/studio')).toBe('/account');
    expect(clerkConfig.getSafeLocalReturnPath(undefined)).toBe('/account');
  });

  it('protects Studio document deep links on the server while leaving plain Studio independently loadable', () => {
    const studioPageSource = readFileSync(resolve(process.cwd(), 'src/app/studio/page.tsx'), 'utf8');

    expect(studioPageSource).toContain("import { auth } from '@clerk/nextjs/server'");
    expect(studioPageSource).toContain('const authConfigured = isClerkServerConfigPresent()');
    expect(studioPageSource).toContain('if (authConfigured)');
    expect(studioPageSource).toContain('if (documentId && !isAuthenticated)');
    expect(studioPageSource).toContain('redirectToSignIn');
    expect(studioPageSource).toContain('returnBackUrl: `/studio?document=${encodeURIComponent(documentId)}`');
    expect(studioPageSource).toContain('accountUserId = userId');
    expect(studioPageSource).toContain('createProjectPersistenceScope({');
    expect(studioPageSource).not.toContain('if (!isAuthenticated)' + " return redirectToSignIn()" );
  });

  it('removes the superseded app-shell public header', () => {
    expect(existsSync(resolve(process.cwd(), 'src/features/app-shell/components/PublicSiteHeader.tsx'))).toBe(false);
    expect(existsSync(resolve(process.cwd(), 'src/features/app-shell/client/publicSite.ts'))).toBe(false);
  });
});
