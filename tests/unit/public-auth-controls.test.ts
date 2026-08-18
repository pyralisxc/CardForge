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

  it('keeps Clerk session ownership at the root while preserving a lightweight public header', () => {
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

    expect(headerSource).toContain('href="/sign-in"');
    expect(headerSource).toContain('Sign in');
    expect(headerSource).not.toContain('@clerk/nextjs');
    expect(rootLayoutSource).toContain("import { ClerkProvider } from '@clerk/nextjs'");
    expect(pageProvidersSource).not.toContain('ClerkProvider');
    expect(signInPageSource).toContain("import { SignIn } from '@clerk/nextjs'");
    expect(signInPageSource).not.toContain('ClerkProvider');
    expect(signInPageSource).toContain('fallbackRedirectUrl={fallbackRedirectUrl}');
  });

  it('keeps Studio and Studio-document requests inside the shared Clerk middleware lifecycle', () => {
    expect(clerkConfig.shouldRunClerkMiddlewareForRequest('/studio', 'GET')).toBe(true);
    expect(clerkConfig.shouldRunClerkMiddlewareForRequest('/studio/something', 'GET')).toBe(true);
    expect(clerkConfig.shouldRunClerkMiddlewareForRequest('/api/studio-documents/123', 'GET')).toBe(true);
  });

  it('accepts only same-site relative sign-in destinations', () => {
    expect(clerkConfig.getSafeLocalReturnPath('/studio?document=abc')).toBe('/studio?document=abc');
    expect(clerkConfig.getSafeLocalReturnPath('/account#billing')).toBe('/account#billing');
    expect(clerkConfig.getSafeLocalReturnPath('https://evil.example/studio')).toBe('/account');
    expect(clerkConfig.getSafeLocalReturnPath('//evil.example/studio')).toBe('/account');
    expect(clerkConfig.getSafeLocalReturnPath(undefined)).toBe('/account');
  });

  it('removes the superseded app-shell public header', () => {
    expect(existsSync(resolve(process.cwd(), 'src/features/app-shell/components/PublicSiteHeader.tsx'))).toBe(false);
    expect(existsSync(resolve(process.cwd(), 'src/features/app-shell/client/publicSite.ts'))).toBe(false);
  });
});
