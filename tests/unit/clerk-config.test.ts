import { describe, expect, it } from 'vitest';

import { shouldRunClerkMiddlewareForRequest } from '@/lib/clerkConfig';

describe('Clerk route gating', () => {
  it('keeps public studio and bootstrap routes out of Clerk middleware', () => {
    expect(shouldRunClerkMiddlewareForRequest('/', 'GET')).toBe(false);
    expect(shouldRunClerkMiddlewareForRequest('/studio', 'GET')).toBe(false);
    expect(shouldRunClerkMiddlewareForRequest('/api/assets', 'GET')).toBe(false);
  });

  it('runs Clerk middleware only for account-aware routes and mutating shared state', () => {
    expect(shouldRunClerkMiddlewareForRequest('/account', 'GET')).toBe(true);
    expect(shouldRunClerkMiddlewareForRequest('/profile', 'GET')).toBe(true);
    expect(shouldRunClerkMiddlewareForRequest('/owner', 'GET')).toBe(true);
    expect(shouldRunClerkMiddlewareForRequest('/api/account/entitlement', 'GET')).toBe(true);
    expect(shouldRunClerkMiddlewareForRequest('/api/developer-assets', 'GET')).toBe(true);
    expect(shouldRunClerkMiddlewareForRequest('/api/developer-assets/asset-1/vote', 'POST')).toBe(true);
    expect(shouldRunClerkMiddlewareForRequest('/api/roadmap', 'GET')).toBe(true);
    expect(shouldRunClerkMiddlewareForRequest('/api/roadmap', 'POST')).toBe(true);
    expect(shouldRunClerkMiddlewareForRequest('/api/roadmap/votes', 'POST')).toBe(true);
    expect(shouldRunClerkMiddlewareForRequest('/api/templates', 'GET')).toBe(true);
    expect(shouldRunClerkMiddlewareForRequest('/api/styles', 'GET')).toBe(true);
  });
});
