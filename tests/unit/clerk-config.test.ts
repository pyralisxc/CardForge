import { describe, expect, it } from 'vitest';

import { shouldRunClerkMiddlewareForRequest } from '@/infrastructure/auth/clerk';

describe('Clerk middleware route selection', () => {
  it('leaves the owner console shell renderable while protecting owner APIs', () => {
    expect(shouldRunClerkMiddlewareForRequest('/owner', 'GET')).toBe(false);
    expect(shouldRunClerkMiddlewareForRequest('/owner', 'POST')).toBe(false);
    expect(shouldRunClerkMiddlewareForRequest('/api/owner/console', 'GET')).toBe(true);
    expect(shouldRunClerkMiddlewareForRequest('/api/owner/console', 'PUT')).toBe(true);
    expect(shouldRunClerkMiddlewareForRequest('/api/owner/founder-profile/portrait', 'POST')).toBe(true);
  });

  it('runs for the public creator-support checkout so optional Clerk identity is available', () => {
    expect(shouldRunClerkMiddlewareForRequest('/api/billing/support/checkout', 'POST')).toBe(true);
  });

  it('runs for the dedicated public sign-in route', () => {
    expect(shouldRunClerkMiddlewareForRequest('/sign-in', 'GET')).toBe(true);
    expect(shouldRunClerkMiddlewareForRequest('/sign-in/sso-callback', 'GET')).toBe(true);
  });
});
