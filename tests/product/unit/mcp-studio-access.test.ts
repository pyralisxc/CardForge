import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  hasContributionScope: (scopes: string[], scope: string) => scopes.includes(scope),
}));
vi.mock('@/features/studio-documents/server/studioDocumentAccess', () => ({
  getStudioDocumentRetentionHours: vi.fn(),
}));
vi.mock('@/features/studio-documents/server/studioDocumentStore', () => ({
  getStudioDocument: vi.fn(),
  listStudioDocuments: vi.fn(),
}));
vi.mock('@/features/mcp-usage/server', () => ({
  observeMcpToolExecution: ({ execute }: { execute: () => Promise<unknown> }) => execute(),
}));

import { auth } from '@clerk/nextjs/server';

import { getAccountToolAccessForUserId } from '@/features/account/server';
import { getContributorCapabilities } from '@/features/contributor-access/server';
import { registerAccountWorkflowTools } from '@/features/studio-documents/server/mcpAccountWorkflowTools';
import { getMcpStudioAccess } from '@/features/studio-documents/server/mcpStudioAccess';
import { getStudioDocument, listStudioDocuments } from '@/features/studio-documents/server/studioDocumentStore';

const user = {
  id: 'account_123',
  email: 'creator@example.com',
  emailAddresses: ['creator@example.com'],
  firstName: 'Card',
  lastName: 'Creator',
  privateMetadata: {},
};

describe('MCP Studio access', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });
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

  it.each([
    ['preview', 'https://private-user:private-value@stage-ref.supabase.co/private?secret=private-value', 'stage-ref.supabase.co'],
    ['production', 'https://production-ref.supabase.co', 'production-ref.supabase.co'],
    [undefined, 'invalid-url', null],
  ])('reports the actual %s deployment and authenticated subject without credentials', async (environment, databaseUrl, databaseHost) => {
    vi.stubEnv('VERCEL_ENV', environment);
    vi.stubEnv('SUPABASE_URL', databaseUrl);
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'a'.repeat(40));
    vi.mocked(getAccountToolAccessForUserId).mockResolvedValue({
      user,
      entitlement: { accessMode: 'free', isSignedIn: true, canExportClean: false, capabilities: {} },
      capabilities: ['studio.ai.create'],
      isOwner: false,
    } as never);
    const handlers = new Map<string, () => Promise<unknown>>();
    registerAccountWorkflowTools({
      server: { registerTool: (name: string, _options: unknown, handler: () => Promise<unknown>) => { handlers.set(name, handler); } } as never,
      publicOrigin: 'https://misleading-preview.example',
      getAccess: getMcpStudioAccess,
      toolError: (error) => ({ isError: true, content: [{ type: 'text', text: String(error) }] }),
    });
    const result = await handlers.get('get_cardforge_capabilities')!();
    expect(result).toMatchObject({
      structuredContent: {
        account: { userId: user.id, isOwner: false, accessMode: 'free' },
        guidance: { serverIdentity: {
          environment: environment ?? 'unknown',
          publicOrigin: 'https://misleading-preview.example',
          databaseHost,
          sourceRevision: 'a'.repeat(40),
        } },
      },
    });
    expect(JSON.stringify(result)).not.toContain('private-value');
    expect(JSON.stringify(result)).not.toContain(user.email);
    expect(getStudioDocument).not.toHaveBeenCalled();
    expect(listStudioDocuments).not.toHaveBeenCalled();
  });
});
