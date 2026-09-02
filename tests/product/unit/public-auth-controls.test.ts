import { describe, expect, it } from 'vitest';

import {
  createAuthRouteHref,
  getPublicAuthControlState,
  getSafeLocalReturnPath,
} from '@/infrastructure/auth/clerk';

describe('public authentication routing', () => {
  it.each([
    [{ authConfigured: false, isLoaded: false, isSignedIn: false }, 'unconfigured'],
    [{ authConfigured: true, isLoaded: false, isSignedIn: false }, 'connecting'],
    [{ authConfigured: true, isLoaded: true, isSignedIn: false }, 'signed-out'],
    [{ authConfigured: true, isLoaded: true, isSignedIn: true }, 'signed-in'],
  ] as const)('projects Clerk state %o as %s', (state, expected) => {
    expect(getPublicAuthControlState(state)).toBe(expected);
  });

  it('preserves safe local return intent in Clerk-native routes', () => {
    expect(createAuthRouteHref('/sign-in', '/contributors')).toBe('/sign-in?redirect_url=%2Fcontributors');
    expect(createAuthRouteHref('/sign-up', '/studio?document=abc')).toBe('/sign-up?redirect_url=%2Fstudio%3Fdocument%3Dabc');
    expect(createAuthRouteHref('/sign-in', 'https://evil.example/studio')).toBe('/sign-in?redirect_url=%2Faccount');
  });

  it.each([
    ['/studio?document=abc', '/studio?document=abc'],
    ['/account#billing', '/account#billing'],
    ['https://evil.example/studio', '/account'],
    ['//evil.example/studio', '/account'],
    [undefined, '/account'],
  ] as const)('sanitizes return destination %s', (returnTo, expected) => {
    expect(getSafeLocalReturnPath(returnTo)).toBe(expected);
  });
});
