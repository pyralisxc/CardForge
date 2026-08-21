import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/features/developer-access/server', () => ({
  DeveloperCockpitAccessError: class DeveloperCockpitAccessError extends Error {
    constructor(message: string, public readonly status: number) {
      super(message);
    }
  },
  getDeveloperCockpitAccessForUserId: vi.fn(),
}));

import { auth } from '@clerk/nextjs/server';

import { getDeveloperCockpitAccessForUserId } from '@/features/developer-access/server';
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
    vi.mocked(getDeveloperCockpitAccessForUserId).mockResolvedValue({
      user,
      entitlement: { accessMode: 'free' },
      isDeveloper: false,
      isOwner: false,
      scopes: ['studio.ai.create'],
    } as never);
  });

  it('fails closed before account lookup when the OAuth token has no user', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);

    await expect(getMcpStudioAccess()).rejects.toMatchObject({ status: 401 });
    expect(getDeveloperCockpitAccessForUserId).not.toHaveBeenCalled();
  });

  it('gives a signed-in Free or Creator account only the shared Studio assistant scope', async () => {
    await expect(getMcpStudioAccess()).resolves.toMatchObject({
      isDeveloper: false,
      isOwner: false,
      scopes: ['studio.ai.create'],
      user,
    });
    expect(getDeveloperCockpitAccessForUserId).toHaveBeenCalledOnce();
  });

  it('keeps developer scope validation behind the developer-access authority', async () => {
    const developerAccess = { user, isDeveloper: true, isOwner: false, scopes: ['studio.ai.create', 'assets.read'] };
    vi.mocked(getDeveloperCockpitAccessForUserId).mockResolvedValue(developerAccess as never);

    await expect(getMcpStudioAccess()).resolves.toBe(developerAccess);
    expect(getDeveloperCockpitAccessForUserId).toHaveBeenCalledWith('clerk_123');
  });

  it('routes owner access through the same developer-access authority', async () => {
    const ownerAccess = { user, isDeveloper: true, isOwner: true, scopes: ['studio.ai.create', 'assets.read'] };
    vi.mocked(getDeveloperCockpitAccessForUserId).mockResolvedValue(ownerAccess as never);

    await expect(getMcpStudioAccess()).resolves.toBe(ownerAccess);
    expect(getDeveloperCockpitAccessForUserId).toHaveBeenCalledWith('clerk_123');
  });
});
