import { describe, expect, it } from 'vitest';

import { shouldRunClerkMiddlewareForRequest } from '@/infrastructure/auth/clerk';

describe('Clerk middleware route selection', () => {
  it('leaves the owner console shell renderable while protecting owner APIs', () => {
    expect(shouldRunClerkMiddlewareForRequest('/owner', 'GET')).toBe(false);
    expect(shouldRunClerkMiddlewareForRequest('/owner', 'POST')).toBe(false);
    expect(shouldRunClerkMiddlewareForRequest('/api/owner/console', 'GET')).toBe(true);
    expect(shouldRunClerkMiddlewareForRequest('/api/owner/console', 'PUT')).toBe(true);
  });
});
