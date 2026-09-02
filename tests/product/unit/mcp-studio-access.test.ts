import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/features/account/server', () => ({
  AccountToolAccessError: class AccountToolAccessError extends Error {
    constructor(message: string, public readonly status: number) {
      super(message);
    }
  },
  getAccountToolAccessForUserId: vi.fn(),
}));
vi.mock('@/features/contributor-access/server', () => ({
  getContributorCapabilities: vi.fn(),
}));

import { auth } from '@clerk/nextjs/server';

import { getAccountToolAccessForUserId } from '@/features/account/server';
import { getContributorCapabilities } from '@/features/contributor-access/server';
import { getMcpStudioAccess } from '@/app/mcp/mcpStudioAccess';

const user = {
  id: 'account_123',
  email: 'creator@example.com',
  emailAddresses: ['creator@example.com'],
  firstName: 'Card',
  lastName: 'Creator',
  privateMetadata: {},
};

describe('MCP Studio access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ userId: 'clerk_123' } as never);
    vi.mocked(getAccountToolAccessForUserId).mockResolvedValue({
      user,
      entitlement: { accessMode: 'free' },
      isOwner: false,
    } as never);
    vi.mocked(getContributorCapabilities).mockResolvedValue({ active: false, scopes: [] });
  });

  it('fails closed before account lookup when the OAuth token has no user', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);

    await expect(getMcpStudioAccess()).rejects.toMatchObject({ status: 401 });
    expect(getAccountToolAccessForUserId).not.toHaveBeenCalled();
  });

  it('gives a signed-in Free or Creator account only the shared Studio assistant scope', async () => {
    await expect(getMcpStudioAccess()).resolves.toMatchObject({
      isContributor: false,
      isOwner: false,
      scopes: [],
      user,
    });
    expect(getAccountToolAccessForUserId).toHaveBeenCalledOnce();
    expect(getContributorCapabilities).toHaveBeenCalledOnce();
  });

  it('adds contribution scopes without replacing normal account access', async () => {
    vi.mocked(getContributorCapabilities).mockResolvedValue({ active: true, scopes: ['assets.review'] });

    await expect(getMcpStudioAccess()).resolves.toMatchObject({
      user,
      isContributor: true,
      scopes: ['assets.review'],
    });
    expect(getAccountToolAccessForUserId).toHaveBeenCalledWith('clerk_123');
  });

  it('projects owner contribution capabilities through the same contributor authority', async () => {
    vi.mocked(getAccountToolAccessForUserId).mockResolvedValue({
      user,
      entitlement: { accessMode: 'owner' },
      isOwner: true,
    } as never);
    vi.mocked(getContributorCapabilities).mockResolvedValue({ active: true, scopes: ['library.publish'] });

    await expect(getMcpStudioAccess()).resolves.toMatchObject({
      isContributor: true,
      isOwner: true,
      scopes: ['library.publish'],
    });
    expect(getAccountToolAccessForUserId).toHaveBeenCalledWith('clerk_123');
  });
});
