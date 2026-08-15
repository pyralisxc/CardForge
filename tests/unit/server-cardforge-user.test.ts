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

  it('does not call Clerk user lookup without a signed-in session', async () => {
    clerk.auth.mockResolvedValue({ userId: null, sessionClaims: null });

    const access = await getCurrentCardforgeUserAccess();

    expect(clerk.currentUser).not.toHaveBeenCalled();
    expect(access.user).toBeNull();
  });
});
