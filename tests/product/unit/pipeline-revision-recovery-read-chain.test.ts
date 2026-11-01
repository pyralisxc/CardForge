import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ account: vi.fn(), auth: vi.fn(), db: vi.fn(), write: vi.fn(), rpc: vi.fn(), profileStatus: 'active' }));
vi.mock('server-only', () => ({}));
vi.mock('@clerk/nextjs/server', () => ({ auth: m.auth }));
vi.mock('@/features/account/server', async importOriginal => ({ ...(await importOriginal<Record<string, unknown>>()),
  getCurrentAccountToolAccess: m.account, getAccountToolAccessForUserId: m.account }));
vi.mock('@/infrastructure/database/supabaseServer', () => ({ getSupabaseServerClient: m.db, getSupabaseServerConfigStatus: () => ({ configured: true }) }));
// Usage instrumentation is separate from the product-state read authority.
vi.mock('@/features/mcp-usage/server', () => ({ observeMcpToolExecution: ({ execute }: { execute: () => unknown }) => execute() }));
import { readRevisionRecovery } from '@/features/pipeline/server/revisionRecovery';
import { GET } from '@/app/api/pipeline/[submissionId]/lifecycle/route';
import { getMcpStudioReadAccess } from '@/features/studio-documents/server/mcpStudioAccess';
import { registerRevisionRecoveryTools } from '@/features/studio-documents/server/mcpRevisionRecoveryTools';
import { getContributorCapabilities } from '@/features/contributor-access/server/access';

const id = '00000000-0000-4000-8000-000000000001';
const account = { isOwner: false, user: { id: 'native-account', email: null, firstName: null, lastName: null },
  entitlement: { authorities: { contributor: true } }, scopes: [] };
const snapshot = { name: 'Read-only ordinary revision', state: { scope: 'revision', submissionId: id,
  lineageId: '00000000-0000-4000-8000-000000000002', revisionNumber: 1, registrySubmissionId: null,
  revisionHighWater: 1, recoveryVersion: '0', status: 'voting', updatedAt: '2026-10-31T18:00:00Z',
  trashedAt: null, purgeAfter: null, held: false }, retentionDays: 30, trashActor: null,
  trashReasons: [], restoreReasons: ['revision_not_trashed'], canHold: false, publicationRetained: false, sourceUncertainty: null };
beforeEach(() => {
  vi.clearAllMocks(); m.profileStatus = 'active'; m.account.mockResolvedValue(account); m.auth.mockResolvedValue({ userId: 'oauth-account' });
  m.write.mockImplementation(() => { throw new Error('Product READ attempted INSERT/UPDATE/UPSERT'); });
  m.rpc.mockImplementation(async (name: string) => {
    if (name !== 'cardforge_read_revision_recovery') throw new Error('Unexpected product write RPC');
    return { data: snapshot, error: null };
  });
  m.db.mockReturnValue({ rpc: m.rpc, from: (table: string) => {
    if (table !== 'cardforge_contributor_profiles') throw new Error(`Unexpected read table ${table}`);
    const q = { select: () => q, eq: () => q,
      limit: async () => ({ data: [{ status: m.profileStatus, can_draft_campaigns: false }], error: null }),
      insert: m.write, update: m.write, upsert: m.write, delete: m.write };
    return q;
  } });
});
it('uses the real Contributor profile SELECT/pure scope chain for service and HTTP GET without enrollment', async () => {
  expect(await readRevisionRecovery('session', id)).toEqual(snapshot);
  const response = await GET(new Request('http://localhost/lifecycle'), { params: Promise.resolve({ submissionId: id }) });
  expect(response.status).toBe(200); expect(await response.json()).toEqual(snapshot);
  expect(m.write).not.toHaveBeenCalled();
  expect(m.rpc).toHaveBeenCalledWith('cardforge_read_revision_recovery', { p_submission_id: id, p_actor_user_id: 'native-account', p_is_owner: false });
});
it('routes the real OAuth read access and MCP recovery read through SELECTs without invoking mutation enrollment', async () => {
  const callbacks = new Map<string, (input: unknown) => Promise<unknown>>();
  const mutationAccess = vi.fn(() => { throw new Error('Mutation access used by READ'); });
  registerRevisionRecoveryTools({ server: { registerTool: (name: string, _schema: unknown, callback: (input: unknown) => Promise<unknown>) => callbacks.set(name, callback) } as never,
    getAccess: mutationAccess, getReadAccess: getMcpStudioReadAccess, publicOrigin: 'http://localhost',
    toolError: error => { throw error; } });
  expect(await callbacks.get('get_pipeline_revision_recovery')!({ submissionId: id })).toMatchObject({ structuredContent: snapshot });
  expect(m.auth).toHaveBeenCalledWith({ acceptsToken: 'oauth_token' });
  expect(mutationAccess).not.toHaveBeenCalled(); expect(m.write).not.toHaveBeenCalled();
});
it('denies inactive existing profiles without enrolling them or reading private revision data', async () => {
  m.profileStatus = 'suspended';
  const response = await GET(new Request('http://localhost/lifecycle'), { params: Promise.resolve({ submissionId: id }) });
  expect(response.status).toBe(403); expect(m.rpc).not.toHaveBeenCalled(); expect(m.write).not.toHaveBeenCalled();
});
it('retains canonical enrollment for explicit mutation capability resolution', async () => {
  m.write.mockResolvedValue({ error: null });
  expect(await getContributorCapabilities(account as never)).toMatchObject({ active: true, scopes: expect.arrayContaining(['assets.submit']) });
  expect(m.write).toHaveBeenCalledOnce();
});
