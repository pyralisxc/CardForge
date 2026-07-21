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

  it('opens the CardForge account from the signed-in public control', () => {
    const controlsSource = readFileSync(
      resolve(process.cwd(), 'src/features/account/components/PublicAuthControls.tsx'),
      'utf8',
    );

    expect(controlsSource).toContain('userProfileUrl="/account"');
    expect(controlsSource).not.toContain('userProfileUrl="/profile"');
  });

  it('keeps a direct public sign-in path without restoring Clerk to the public header bundle', () => {
    const headerSource = readFileSync(
      resolve(process.cwd(), 'src/features/public-site/components/PublicSiteHeader.tsx'),
      'utf8',
    );
    const signInPageSource = readFileSync(
      resolve(process.cwd(), 'src/app/sign-in/[[...sign-in]]/page.tsx'),
      'utf8',
    );
    const clerkInfrastructureSource = readFileSync(
      resolve(process.cwd(), 'src/infrastructure/auth/clerk.ts'),
      'utf8',
    );

    expect(headerSource).toContain('href="/sign-in"');
    expect(headerSource).toContain('Sign in');
    expect(headerSource).not.toContain('@clerk/nextjs');
    expect(signInPageSource).toContain("import { ClerkProvider, SignIn } from '@clerk/nextjs'");
    expect(signInPageSource).toContain('<SignIn fallbackRedirectUrl="/account" />');
    expect(clerkInfrastructureSource).toContain("'/sign-in'");
  });

  it('removes the superseded app-shell public header', () => {
    expect(existsSync(resolve(process.cwd(), 'src/features/app-shell/components/PublicSiteHeader.tsx'))).toBe(false);
    expect(existsSync(resolve(process.cwd(), 'src/features/app-shell/client/publicSite.ts'))).toBe(false);
  });
});
