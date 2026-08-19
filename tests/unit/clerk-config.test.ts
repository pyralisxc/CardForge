import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { getClerkAuthorizedParties } from '@/infrastructure/auth/clerk';

describe('Clerk middleware configuration', () => {
  it('uses the standard broad Next matcher as the single route-selection boundary', () => {
    const proxy = readFileSync(resolve(process.cwd(), 'src/proxy.ts'), 'utf8');
    const middleware = readFileSync(
      resolve(process.cwd(), 'src/infrastructure/auth/middleware.ts'),
      'utf8',
    );
    const clerkConfig = readFileSync(
      resolve(process.cwd(), 'src/infrastructure/auth/clerk.ts'),
      'utf8',
    );

    expect(proxy).toContain("'/(api|trpc)(.*)'");
    expect(proxy).toContain("'/__clerk/(.*)'");
    expect(middleware).toContain('clerkMiddleware({');
    expect(middleware).not.toContain('shouldRunClerkMiddlewareForRequest');
    expect(clerkConfig).not.toContain('CLERK_PAGE_PREFIXES');
    expect(clerkConfig).not.toContain('CLERK_API_PREFIXES');
    expect(clerkConfig).not.toContain('CLERK_MUTATION_API_PREFIXES');
  });

  it('uses Clerk authorized parties instead of a CardForge request-origin workaround', () => {
    const middleware = readFileSync(
      resolve(process.cwd(), 'src/infrastructure/auth/middleware.ts'),
      'utf8',
    );

    expect(middleware).toContain('authorizedParties: getClerkAuthorizedParties()');
    expect(getClerkAuthorizedParties({
      NODE_ENV: 'production',
      NEXT_PUBLIC_APP_URL: 'https://cardforges.com',
      VERCEL_URL: 'cardforge-preview.vercel.app',
    })).toEqual([
      'https://cardforges.com',
      'https://cardforge-preview.vercel.app',
    ]);
  });

  it('keeps the established Clerk middleware flow without an unconfigured Frontend API proxy', () => {
    const middleware = readFileSync(
      resolve(process.cwd(), 'src/infrastructure/auth/middleware.ts'),
      'utf8',
    );

    expect(middleware).toContain('clerkMiddleware({');
    expect(middleware).not.toContain('frontendApiProxy');
  });

  it('keeps local development renderable when Clerk server configuration is absent', () => {
    const middleware = readFileSync(
      resolve(process.cwd(), 'src/infrastructure/auth/middleware.ts'),
      'utf8',
    );

    expect(middleware).toContain('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY');
    expect(middleware).toContain('CLERK_SECRET_KEY');
    expect(middleware).toContain('NextResponse.next()');
  });
});
