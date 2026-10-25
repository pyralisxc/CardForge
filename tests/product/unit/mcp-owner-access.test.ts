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

import { auth } from '@clerk/nextjs/server';
import { getAccountToolAccessForUserId } from '@/features/account/server';
import { getMcpOwnerAccess } from '@/features/owner/server/mcpOwnerAccess';

const user = {
  id: 'owner-account',
  email: 'owner@example.com',
  emailAddresses: ['owner@example.com'],
  firstName: 'Owner',
  lastName: 'Operator',
  privateMetadata: {},
};

describe('CardForge Owner MCP access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ userId: 'clerk-owner' } as never);
    vi.mocked(getAccountToolAccessForUserId).mockResolvedValue({
      user,
      entitlement: { accessMode: 'owner' },
      isOwner: true,
      email: user.email,
      displayName: 'Owner Operator',
      capabilities: ['studio.ai.create'],
    } as never);
  });

  it('fails closed before account lookup when OAuth has no linked user', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);

    await expect(getMcpOwnerAccess()).rejects.toMatchObject({ status: 401 });
    expect(getAccountToolAccessForUserId).not.toHaveBeenCalled();
  });

  it('rejects a normal CardForge account even though Studio MCP remains available', async () => {
    vi.mocked(getAccountToolAccessForUserId).mockResolvedValue({
      user,
      entitlement: { accessMode: 'free' },
      isOwner: false,
      email: user.email,
      displayName: 'Owner Operator',
      capabilities: ['studio.ai.create'],
    } as never);

    await expect(getMcpOwnerAccess()).rejects.toMatchObject({
      status: 403,
      message: 'CardForge Owner access is required for this plugin.',
    });
  });

  it('reuses the normal linked CardForge account identity for an Owner', async () => {
    await expect(getMcpOwnerAccess()).resolves.toMatchObject({
      isOwner: true,
      user,
      email: user.email,
    });
    expect(getAccountToolAccessForUserId).toHaveBeenCalledWith('clerk-owner');
  });
});
