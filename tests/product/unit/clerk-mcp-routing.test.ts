import type { NextFetchEvent, NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const handlers = vi.hoisted(() => ({
  browser: vi.fn(() => new Response('browser')),
  oauth: vi.fn(() => new Response('oauth')),
}));

vi.mock('@clerk/nextjs/server', () => ({
  clerkMiddleware: (options?: unknown) => options ? handlers.browser : handlers.oauth,
}));

import { cardforgeMiddleware } from '@/infrastructure/auth/middleware';

describe('Clerk MCP route selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    vi.stubEnv('CLERK_SECRET_KEY', 'sk_test_configured');
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each(['/mcp', '/mcp/owner'])('uses OAuth middleware for %s', (pathname) => {
    const request = { nextUrl: { pathname } } as NextRequest;
    const event = {} as NextFetchEvent;
    cardforgeMiddleware(request, event);
    expect(handlers.oauth).toHaveBeenCalledWith(request, event);
    expect(handlers.browser).not.toHaveBeenCalled();
  });

  it.each(['/account', '/api/profile', '/mcp/owners', '/mcp/unregistered'])
    ('keeps browser middleware for %s', (pathname) => {
      const request = { nextUrl: { pathname } } as NextRequest;
      const event = {} as NextFetchEvent;
      cardforgeMiddleware(request, event);
      expect(handlers.browser).toHaveBeenCalledWith(request, event);
      expect(handlers.oauth).not.toHaveBeenCalled();
    });

  it('keeps the unconfigured local development bypass', () => {
    vi.stubEnv('CLERK_SECRET_KEY', '');
    cardforgeMiddleware({ nextUrl: { pathname: '/mcp/owner' } } as NextRequest, {} as NextFetchEvent);
    expect(handlers.oauth).not.toHaveBeenCalled();
    expect(handlers.browser).not.toHaveBeenCalled();
  });
});
