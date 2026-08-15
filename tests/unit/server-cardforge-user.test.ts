import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const clerk = vi.hoisted(() => ({
  auth: vi.fn(),
  clerkClient: vi.fn(),
  currentUser: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({
  auth: clerk.auth,
  clerkClient: clerk.clerkClient,
  currentUser: clerk.currentUser,
}));

import { getCurrentCardforgeUserAccess } from '@/features/account/lib/serverCardforgeUser';

describe('server CardForge user resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_cardforge');
    vi.stubEnv('CLERK_SECRET_KEY', 'sk_test_cardforge');
    vi.stubEnv('CARDFORGE_OWNER_ACCOUNT_EMAILS', 'owner@example.com');
    clerk.clerkClient.mockResolvedValue({
      users: { getUser: clerk.getUser },
    });
  });

  afterEach(() => vi.unstubAllEnvs());

  it('resolves the Clerk session and full user through one shared access owner', async () => {
    clerk.auth.mockResolvedValue({ userId: 'user_123', sessionClaims: {} });
    clerk.currentUser.mockResolvedValue({
      id: 'user_123',
      emailAddresses: [{ emailAddress: 'owner@example.com' }],
      primaryEmailAddress: { emailAddress: 'owner@example.com' },
      firstName: 'Pyralis',
      lastName: 'Cameron',
      publicMetadata: {},
      privateMetadata: {},
    });

    const access = await getCurrentCardforgeUserAccess();

    expect(clerk.auth).toHaveBeenCalledOnce();
    expect(clerk.currentUser).toHaveBeenCalledOnce();
    expect(clerk.clerkClient).not.toHaveBeenCalled();
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
    expect(clerk.clerkClient).not.toHaveBeenCalled();
    expect(access.user?.id).toBe('user_456');
  });

  it('returns no user when both Clerk reads are signed out', async () => {
    clerk.auth.mockResolvedValue({ userId: null, sessionClaims: null });
    clerk.currentUser.mockResolvedValue(null);

    const access = await getCurrentCardforgeUserAccess();

    expect(clerk.currentUser).toHaveBeenCalledOnce();
    expect(clerk.clerkClient).not.toHaveBeenCalled();
    expect(access.user).toBeNull();
  });

  it('resolves the full Clerk identity when the session has an id but currentUser is unavailable', async () => {
    clerk.auth.mockResolvedValue({
      userId: 'user_owner',
      sessionClaims: {},
    });
    clerk.currentUser.mockResolvedValue(null);
    clerk.getUser.mockResolvedValue({
      id: 'user_owner',
      emailAddresses: [{ emailAddress: 'owner@example.com' }],
      primaryEmailAddress: { emailAddress: 'owner@example.com' },
      firstName: 'Pyralis',
      lastName: 'Cameron',
      publicMetadata: {},
      privateMetadata: { cardforgeRole: 'owner' },
    });

    await expect(getCurrentCardforgeUserAccess()).resolves.toMatchObject({
      user: {
        id: 'user_owner',
        email: 'owner@example.com',
        source: 'clerk_user',
      },
      ownerAccess: {
        isOwner: true,
        source: 'clerk_private_metadata',
      },
    });
    expect(clerk.getUser).toHaveBeenCalledWith('user_owner');
  });
});
