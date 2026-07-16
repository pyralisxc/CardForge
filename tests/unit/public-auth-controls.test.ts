import { readFileSync } from 'node:fs';
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

  it('places the authentication control in the shared public header', () => {
    const headerSource = readFileSync(
      resolve(process.cwd(), 'src/features/app-shell/components/PublicSiteHeader.tsx'),
      'utf8',
    );

    expect(headerSource).toContain("import { PublicAuthControls } from '@/features/account/client/auth'");
    expect(headerSource).toContain('rightSlot ?? <PublicAuthControls />');
    expect(headerSource).toContain('src="/brand/cardforge-studio/brand-mark.svg"');
    expect(headerSource).not.toContain('<Hammer');
  });
});
