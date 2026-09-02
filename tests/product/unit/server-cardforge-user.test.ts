import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const clerk = vi.hoisted(() => ({
  clerkClient: vi.fn(),
  currentUser: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({
  clerkClient: clerk.clerkClient,
  currentUser: clerk.currentUser,
}));

import {
  getCardforgeUserAccessForUserId,
  getCurrentCardforgeUserAccess,
} from '@/features/account/lib/serverCardforgeUser';

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

  it('uses Clerk currentUser as the one current-account identity read', async () => {
    clerk.currentUser.mockResolvedValue({
      id: 'user_123',
      emailAddresses: [{ emailAddress: 'owner@example.com' }],
      primaryEmailAddress: { emailAddress: 'owner@example.com' },
      firstName: 'Pyralis',
      lastName: 'Cameron',
      publicMetadata: {},
      privateMetadata: { cardforgeRole: 'owner' },
    });

    const access = await getCurrentCardforgeUserAccess();

    expect(clerk.currentUser).toHaveBeenCalledOnce();
    expect(clerk.clerkClient).not.toHaveBeenCalled();
    expect(access).toMatchObject({
      user: {
        id: 'user_123',
        email: 'owner@example.com',
        source: 'clerk_user',
      },
      ownerAccess: {
        isOwner: true,
        source: 'clerk_private_metadata',
      },
    });
  });

  it('reports Clerk resolution failure as unavailable instead of signed out', async () => {
    clerk.currentUser.mockRejectedValue(new Error('Clerk backend unavailable'));

    const access = getCurrentCardforgeUserAccess();

    await expect(access).rejects.toThrow('Account identity is temporarily unavailable.');
    expect(clerk.currentUser).toHaveBeenCalledOnce();
    expect(clerk.clerkClient).not.toHaveBeenCalled();
  });

  it('returns no user when Clerk reports a signed-out request', async () => {
    clerk.currentUser.mockResolvedValue(null);

    const access = await getCurrentCardforgeUserAccess();

    expect(clerk.currentUser).toHaveBeenCalledOnce();
    expect(access.user).toBeNull();
  });

  it('uses Clerk Backend API only when resolving an explicit user id', async () => {
    clerk.getUser.mockResolvedValue({
      id: 'user_mcp',
      emailAddresses: [{ emailAddress: 'contributor@example.com' }],
      primaryEmailAddress: { emailAddress: 'contributor@example.com' },
      firstName: 'Dev',
      lastName: 'User',
      publicMetadata: {},
      privateMetadata: { cardforgeAccess: 'contributor' },
    });

    const access = await getCardforgeUserAccessForUserId('user_mcp');

    expect(clerk.currentUser).not.toHaveBeenCalled();
    expect(clerk.clerkClient).toHaveBeenCalledOnce();
    expect(clerk.getUser).toHaveBeenCalledWith('user_mcp');
    expect(access.user?.id).toBe('user_mcp');
  });
});
