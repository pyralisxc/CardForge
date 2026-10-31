import { beforeEach, describe, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ access: vi.fn(), entitlement: vi.fn(), capabilities: vi.fn(), policy: vi.fn(), heartVisible: vi.fn(), hearts: vi.fn(), database: vi.fn(), row: {} as Record<string, unknown>, publication: [] as unknown[], votes: [] as unknown[], databaseError: null as unknown, selections: [] as string[], activeScopes: ['assets.review'] as string[] }));
vi.mock('@/features/account/server', () => ({ getCurrentCardforgeUserAccess: f.access, resolveCardforgeEntitlementForAccess: f.entitlement }));
vi.mock('@/features/contributor-access/server', () => ({ getContributorProfileCapabilities: async () => ({ status: (await f.capabilities()).active ? 'active' : 'inactive' }), resolveContributorScopes: () => f.activeScopes, hasContributionScope: (scopes: string[], scope: string) => scopes.includes(scope) }));
vi.mock('@/features/pipeline/lib/pipelineStore', () => ({ getPipelineVotePolicy: f.policy }));
vi.mock('@/features/pipeline/lib/pipelineHearts', () => ({ isPipelineLineageId: (value: unknown) => typeof value === 'string' && /^[0-9a-f-]{36}$/.test(value), getViewerVisiblePipelineLineageIds: f.heartVisible, getPipelineHeartMetrics: f.hearts }));
vi.mock('@/infrastructure/database/supabaseServer', () => ({ getSupabaseServerClient: f.database }));
import { readPipelineEngagement } from '@/features/pipeline/server/pipelineEngagement';
const submissionId = '10000000-0000-4000-8000-000000000001';
const lineageId = '20000000-0000-4000-8000-000000000001';
beforeEach(() => {
  vi.clearAllMocks();
  f.row = { id: submissionId, lineage_id: lineageId, contributor_id: 'author', name: 'Exact original', revision_number: 2, status: 'published', trashed_at: null, purge_state: null, positive_votes: 3, negative_votes: 1 };
  f.publication = [{ asset_id: 'original' }]; f.votes = [{ vote_value: 'negative' }]; f.databaseError = null; f.selections = [];
  f.access.mockResolvedValue({ user: { id: 'viewer' }, ownerAccess: { isOwner: false } });
  f.entitlement.mockResolvedValue({ accessMode: 'free', authorities: { contributor: true } }); f.activeScopes = ['assets.review']; f.capabilities.mockResolvedValue({ active: true, scopes: ['assets.review'] });
  f.policy.mockResolvedValue({ visibleToViewer: true, allowContributorSelfVoting: true, submissionContributorId: 'author' });
  f.heartVisible.mockResolvedValue([lineageId]); f.hearts.mockResolvedValue([{ lineageId, count: 8, hearted: false }]);
  f.database.mockReturnValue({ from: (table: string) => {
    const query = { select: (columns: string) => { f.selections.push(columns); return query; }, eq: vi.fn(() => query), in: vi.fn(() => query), limit: () => Promise.resolve({ data: table === 'cardforge_contributor_asset_submissions' ? [f.row] : table === 'cardforge_discoverable_asset_registry' ? f.publication : f.votes, error: f.databaseError }) };
    return query;
  } });
});
describe('exact source reaction projection', () => {
  it('returns exact revision signal and separate lineage heart without private source material', async () => {
    expect(await readPipelineEngagement(submissionId)).toEqual({ submissionId, lineageId, name: 'Exact original', revisionNumber: 2, status: 'published', trashedAt: null, purgeState: null, positiveVotes: 3, negativeVotes: 1, currentUserVote: 'negative', voteIssue: null, heart: { count: 8, hearted: false }, heartIssue: null });
    expect(f.selections.join(',')).not.toMatch(/source_payload|source_storage|source_review|contributor_email/);
  });
  it.each(['archived', 'rejected', 'published'])('retains canonical vote eligibility for visible %s revisions', async status => {
    f.row.status = status; expect((await readPipelineEngagement(submissionId)).voteIssue).toBeNull();
  });
  it.each([{ status: 'draft' }, { trashed_at: '2026-10-31' }])('closes voting for lifecycle ineligibility %j', async patch => {
    Object.assign(f.row, patch); expect((await readPipelineEngagement(submissionId)).voteIssue).toContain('cannot receive votes');
  });
  it('never reinterprets purge-pending history as available publication', async () => {
    f.row.purge_state = 'pending'; await expect(readPipelineEngagement(submissionId)).rejects.toMatchObject({ status: 403 });
  });
  it('allows ordinary members to heart only an exact visible publication, without reviewer votes', async () => {
    f.capabilities.mockResolvedValue({ active: false, scopes: [] }); f.activeScopes = [];
    const result = await readPipelineEngagement(submissionId); expect(result.heartIssue).toBeNull(); expect(result.voteIssue).toContain('Contributor'); expect(result.currentUserVote).toBeNull(); expect(f.policy).not.toHaveBeenCalled();
    // Raw published rows may remain during catalog Trash. Only discoverable pointers authorize public reads.
    f.publication = []; await expect(readPipelineEngagement(submissionId)).rejects.toMatchObject({ status: 403 });
  });
  it('does not grant review votes from active contributor identity without assets.review scope', async () => {
    f.capabilities.mockResolvedValue({ active: true, scopes: ['assets.submit'] }); f.activeScopes = ['assets.submit']; expect((await readPipelineEngagement(submissionId)).voteIssue).toContain('Contributor review access');
  });
  it('preserves self vote policy and signed-out heart state', async () => {
    f.policy.mockResolvedValue({ visibleToViewer: true, allowContributorSelfVoting: false, submissionContributorId: 'viewer' });
    expect((await readPipelineEngagement(submissionId)).voteIssue).toContain('self-voting');
    f.access.mockResolvedValue({ user: null, ownerAccess: { isOwner: false } }); expect((await readPipelineEngagement(submissionId)).heartIssue).toContain('Sign in');
  });
  it('fails unavailable rather than inventing an empty reaction state', async () => {
    f.databaseError = { message: 'offline' }; await expect(readPipelineEngagement(submissionId)).rejects.toMatchObject({ status: 503 });
  });
});
