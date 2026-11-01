import { beforeEach, describe, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ owner: vi.fn(), rpc: vi.fn(), queries: [] as unknown[] }));
vi.mock('@/features/owner/server', () => ({ getCurrentOwnerAccess: f.owner }));
vi.mock('@/infrastructure/database/supabaseServer', () => ({ getSupabaseServerClient: () => ({ rpc: f.rpc }) }));
vi.mock('@/features/pipeline/server/catalogCache', () => ({ revalidateCardForgeCatalog: vi.fn() }));
vi.mock('@/features/pipeline/server', async () => ({
  ...(await vi.importActual('@/features/pipeline/lib/pipelineStoreError')),
  getPipelineContributorIds: (id: string) => [id],
  getPipelineProgramView: async (id: string, _ids: string[], options: { submissionQuery: import('@/features/pipeline/lib/pipelineProjections').PipelineListQuery; votingQuery: import('@/features/pipeline/lib/pipelineProjections').PipelineListQuery }) => {
    f.queries.push(options);
    const { fetchPipelineSubmissionPage } = await import('@/features/pipeline/lib/pipelineProjections');
    const submissions = await fetchPipelineSubmissionPage({ currentUserId: id, profiles: [], includeRegistryRecipePayloads: true, allowSelfVoting: true, query: options.submissionQuery });
    const voting = await fetchPipelineSubmissionPage({ currentUserId: id, profiles: [], includeRegistryRecipePayloads: false, allowSelfVoting: true, query: options.votingQuery });
    return { submissions: submissions.submissions, submissionPage: submissions, votingQueue: voting.submissions, votingPage: voting };
  },
  createUploadedPipelineSubmission: vi.fn(), getCurrentPipelineRequestAccess: vi.fn(), getPipelineContributorSummary: vi.fn(),
  requirePipelineRequestScope: vi.fn(), updateContributorProfileOverrides: vi.fn(), updatePipelineProgramSettings: vi.fn(),
}));
import { GET } from '@/app/api/pipeline/route';
beforeEach(() => {
  vi.clearAllMocks(); f.queries.length = 0;
  f.owner.mockResolvedValue({ isOwner: true, userId: 'owner' });
  f.rpc.mockImplementation(async (_name, args) => ({ data: [{ submission_id: null, total_count: args.p_scope === 'all' && args.p_trash_state !== 'active' ? 1 : 0 }], error: null }));
});
describe('Owner route keeps submission and voting lifecycle queries separate through the native projection', () => {
  it.each(['all', 'trashed'])('passes %s to submission paging independently from the active review queue', async trash => {
    const result = await GET(new Request(`https://example.invalid/api/pipeline?trash=${trash}&query=QA&page=2&pageSize=12`));
    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({ program: { submissionPage: { total: 1, page: 2 }, votingPage: { total: 0 } } });
    expect(f.rpc).toHaveBeenCalledWith('cardforge_list_contributor_asset_submission_ids', expect.objectContaining({ p_scope: 'all', p_trash_state: trash, p_current_user_id: 'owner', p_query: 'QA', p_page: 2 }));
    expect(f.rpc).toHaveBeenCalledWith('cardforge_list_contributor_asset_submission_ids', expect.objectContaining({ p_scope: 'review', p_trash_state: 'active' }));
  });
  it('does not let reviewTrash change the displayed submission scope', async () => {
    const result = await GET(new Request('https://example.invalid/api/pipeline?reviewTrash=all'));
    expect(result.status).toBe(200);
    expect(f.rpc).toHaveBeenCalledWith('cardforge_list_contributor_asset_submission_ids', expect.objectContaining({ p_scope: 'all', p_trash_state: 'active' }));
  });
  it('retains Owner authorization before querying any private inventory', async () => {
    f.owner.mockResolvedValue({ isOwner: false, userId: 'free' });
    expect((await GET(new Request('https://example.invalid/api/pipeline?trash=all'))).status).toBe(403);
    expect(f.rpc).not.toHaveBeenCalled();
  });
});
