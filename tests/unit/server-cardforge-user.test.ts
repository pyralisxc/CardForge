import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const clerk = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => clerk);

import { getCurrentCardforgeUserAccess } from '@/features/account/lib/serverCardforgeUser';

describe('server CardForge user resolution', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_cardforge');
    vi.stubEnv('CLERK_SECRET_KEY', 'sk_test_cardforge');
    clerk.auth.mockReset();
    clerk.currentUser.mockReset();
  });

  afterEach(() => vi.unstubAllEnvs());

  it('establishes the Clerk session before requesting the full user', async () => {
    const calls: string[] = [];
    clerk.auth.mockImplementation(async () => {
      calls.push('auth');
      return { userId: 'user_123', sessionClaims: {} };
    });
    clerk.currentUser.mockImplementation(async () => {
      calls.push('currentUser');
      return {
        id: 'user_123',
        emailAddresses: [{ emailAddress: 'owner@example.com' }],
        primaryEmailAddress: { emailAddress: 'owner@example.com' },
        firstName: 'Pyralis',
        lastName: 'Cameron',
        publicMetadata: {},
        privateMetadata: {},
      };
    });

    const access = await getCurrentCardforgeUserAccess();

    expect(calls).toEqual(['auth', 'currentUser']);
    expect(access.user?.id).toBe('user_123');
  });

  it('uses the authoritative Clerk user when the lightweight auth read is temporarily empty', async () => {
    clerk.auth.mockResolvedValue({ userId: null, sessionClaims: null });
    clerk.currentUser.mockResolvedValue({
      id: 'user_456',
      emailAddresses: [{ emailAddress: 'owner@example.com' }],
      primaryEmailAddress: { emailAddress: 'owner@example.com' },
      firstName: 'Pyralis',
      lastName: 'Cameron',
      publicMetadata: {},
      privateMetadata: {},
    });

    const access = await getCurrentCardforgeUserAccess();

    expect(clerk.currentUser).toHaveBeenCalledOnce();
    expect(access.user?.id).toBe('user_456');
  });

  it('returns no user when both Clerk reads are signed out', async () => {
    clerk.auth.mockResolvedValue({ userId: null, sessionClaims: null });
    clerk.currentUser.mockResolvedValue(null);

    const access = await getCurrentCardforgeUserAccess();

    expect(clerk.currentUser).toHaveBeenCalledOnce();
    expect(access.user).toBeNull();
  });
});
