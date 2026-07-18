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

  it('removes the superseded app-shell public header', () => {
    expect(existsSync(resolve(process.cwd(), 'src/features/app-shell/components/PublicSiteHeader.tsx'))).toBe(false);
    expect(existsSync(resolve(process.cwd(), 'src/features/app-shell/client/publicSite.ts'))).toBe(false);
  });
});
