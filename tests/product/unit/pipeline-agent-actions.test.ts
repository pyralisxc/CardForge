import { beforeEach, describe, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ account: vi.fn(), capabilities: vi.fn(), rpc: vi.fn(), from: vi.fn(), recordVote: vi.fn(), heart: vi.fn(), read: vi.fn(), exact: vi.fn(), rate: vi.fn(), settings: vi.fn(), health: vi.fn(), catalog: vi.fn(), healthView: vi.fn(), invalidate: vi.fn() }));
vi.mock('@/features/account/server', () => ({ getAccountToolAccessForUserId: f.account }));
vi.mock('@/features/contributor-access/server', () => ({ readContributorCapabilities: f.capabilities, hasContributionScope: (scopes: string[], scope: string) => scopes.includes(scope) }));
vi.mock('@/infrastructure/database/supabaseServer', () => ({ getSupabaseServerClient: () => ({ rpc: f.rpc, from: f.from }) }));
vi.mock('@/features/pipeline/lib/pipelineStore', () => ({ recordPipelineSubmissionVote: f.recordVote, fetchContributorSettings: f.settings, getPipelineProgramContext: f.health }));
vi.mock('@/features/pipeline/lib/pipelineHearts', () => ({ setPipelineHeart: f.heart, PipelineHeartMutationError: class extends Error { constructor(message: string, public status: number) { super(message); } } }));
vi.mock('@/features/pipeline/lib/pipelineLibraryStore', async importOriginal => ({ ...(await importOriginal<typeof import('@/features/pipeline/lib/pipelineLibraryStore')>()), getPipelineLibraryProgramView: f.healthView }));
vi.mock('@/features/pipeline/server/pipelineEngagement', () => ({ readPipelineEngagementForViewer: f.read, readVisiblePipelineRevisionForViewer: f.exact }));
vi.mock('@/features/pipeline/server/catalogCache', () => ({ revalidateCardForgeCatalog: f.invalidate, getCachedCardForgeCatalog: f.catalog }));
vi.mock('@/infrastructure/security/abuseProtection', () => ({ consumeRateLimit: f.rate, RateLimitExceededError: class extends Error {} }));
import { listAgentPipelineSubmissions, inspectAgentPipelineRevision, readAgentPipelineHealth, readAgentPipelineEngagement, voteAgentPipelineRevision, heartAgentPipelineLineage } from '@/features/pipeline/server/pipelineAgentActions';
import { PipelineStoreError } from '@/features/pipeline/lib/pipelineStoreError';
const id = '10000000-0000-4000-8000-000000000001', lineageId = '20000000-0000-4000-8000-000000000001';
const metadata = { catalogTrashedAt: '2026-11-01T00:00:00Z', catalogPurgeAfter: '2026-12-01T00:00:00Z', catalogRetentionHold: false, catalogSubmissionId: id, id, lineageId, assetType: 'icons', name: 'Shared', description: 'Safe metadata', status: 'published', revisionNumber: 1, trashedAt: null, purgeAfter: null, trashActorRole: null, trashPreviousStatus: null, publicationRetained: true, positiveVotes: 1, negativeVotes: 0, ownedByViewer: false };
const engagement = { submissionId: id, lineageId, name: 'Exact', revisionNumber: 1, status: 'published', trashedAt: null, purgeState: null, positiveVotes: 1, negativeVotes: 0, currentUserVote: null, voteIssue: null, heart: { count: 0, hearted: false }, heartIssue: null };
beforeEach(() => {
  vi.resetAllMocks(); f.invalidate.mockReturnValue(true); f.account.mockResolvedValue({ user: { id: 'resolved-viewer' }, entitlement: { accessMode: 'free' }, isOwner: false }); f.capabilities.mockResolvedValue({ active: false, scopes: [] });
  f.rpc.mockResolvedValue({ data: [{ submission_id: id, total_count: 7, shared_metadata: metadata }], error: null });
  f.from.mockImplementation(() => { throw new Error('No authored payload or profile writes permitted'); });
  f.settings.mockResolvedValue({ settings: { allowContributorSelfVoting: false } }); f.read.mockResolvedValue(engagement); f.rate.mockResolvedValue({ allowed: true });
  f.heart.mockResolvedValue({ lineageId, hearted: true, count: 1 });
});
describe('canonical agent Pipeline actions', () => {
  it('uses actual native shared metadata paging/counts for Free without loading payloads or profiles', async () => {
    const result = await listAgentPipelineSubmissions('oauth-actor', { scope: 'shared-trash', query: 'Shared', page: 2, pageSize: 3 });
    expect(f.account).toHaveBeenCalledExactlyOnceWith('oauth-actor');
    expect(f.rpc).toHaveBeenCalledExactlyOnceWith('cardforge_list_contributor_asset_submission_ids', expect.objectContaining({ p_current_user_id: 'resolved-viewer', p_scope: 'shared', p_trash_state: 'trashed', p_query: 'Shared', p_page: 2, p_page_size: 3 }));
    expect(result).toMatchObject({ total: 7, page: 2, pageSize: 3, items: [{ submissionId: id, effectiveTrash: { scope: 'catalog', catalogSubmissionId: id } }] });
    expect(JSON.stringify(result)).not.toMatch(/source|email|actorId|payload/); expect(f.from).not.toHaveBeenCalled();
    f.rpc.mockResolvedValue({ data: [{ submission_id: null, shared_metadata: null, total_count: 7 }], error: null });
    expect(await listAgentPipelineSubmissions('oauth-actor', { scope: 'shared-trash', page: 100 })).toMatchObject({ items: [], total: 7, page: 100 });
  });
  it('does not turn private or unknown Trash into shared data, and rejects caller authority and all-scope escalation', async () => {
    for (const shared_metadata of [{ ...metadata, status: 'draft' }, { ...metadata, secret: 'bad' }, { ...metadata, status: 'archived', catalogTrashedAt: null, trashedAt: '2026-11-01T00:00:00Z', publicationRetained: false }]) {
      f.rpc.mockResolvedValue({ data: [{ submission_id: id, total_count: 1, shared_metadata }], error: null });
      await expect(listAgentPipelineSubmissions('oauth-actor', { scope: 'shared-trash' })).rejects.toMatchObject({ status: 503 });
    }
    await expect(listAgentPipelineSubmissions('oauth-actor', { scope: 'all' })).rejects.toMatchObject({ status: 403 });
    await expect(listAgentPipelineSubmissions('oauth-actor', { isOwner: true })).rejects.toMatchObject({ status: 400 });
    await expect(readAgentPipelineHealth('oauth-actor')).rejects.toMatchObject({ status: 403 });
  });
  it('projects exact authorized metadata with correct recovery owner and never leaks source fields', async () => {
    f.exact.mockResolvedValue({ id, lineage_id: lineageId, asset_type: 'icons', name: 'Exact', description: '', status: 'published', revision_number: 1, contributor_id: 'other', catalog_trashed_at: metadata.catalogTrashedAt, catalog_submission_id: id, source_payload: { private: true }, contributor_email: 'private' });
    const result = await inspectAgentPipelineRevision('oauth-actor', { submissionId: id });
    expect(result).toMatchObject({ submissionId: id, ownedByViewer: false, effectiveTrash: { scope: 'catalog', catalogSubmissionId: id } });
    expect(JSON.stringify(result)).not.toMatch(/source_payload|private|contributor/);
    await readAgentPipelineEngagement('oauth-actor', { submissionId: id });
    expect(f.read).toHaveBeenCalledWith(id, expect.objectContaining({ userId: 'resolved-viewer', isOwner: false }));
  });
  it('preserves review policy and native rate limits before writing with only server actor', async () => {
    await expect(voteAgentPipelineRevision('oauth-actor', { submissionId: id, voteValue: 'positive' })).rejects.toMatchObject({ status: 403 });
    expect(f.recordVote).not.toHaveBeenCalled();
    f.capabilities.mockResolvedValue({ active: true, scopes: ['assets.review'] });
    f.read.mockResolvedValueOnce({ ...engagement, voteIssue: 'Self voting disabled' });
    await expect(voteAgentPipelineRevision('oauth-actor', { submissionId: id, voteValue: 'positive' })).rejects.toMatchObject({ status: 403 });
    expect(f.recordVote).not.toHaveBeenCalled();
    expect(await voteAgentPipelineRevision('oauth-actor', { submissionId: id, voteValue: 'negative' })).toMatchObject({ outcome: 'committed' });
    expect(f.recordVote).toHaveBeenCalledExactlyOnceWith({ submissionId: id, voteValue: 'negative', contributorId: 'resolved-viewer', ownerContributorId: null });
    expect(f.rate).toHaveBeenCalledWith(expect.objectContaining({ action: 'contributor-vote', identity: 'resolved-viewer', limit: 120 }));
  });
  it('preserves committed vote when follow-up read fails and reconciles unknown writes without retry', async () => {
    f.capabilities.mockResolvedValue({ active: true, scopes: ['assets.review'] });
    f.read.mockResolvedValueOnce(engagement).mockRejectedValueOnce(new Error('read offline'));
    expect(await voteAgentPipelineRevision('oauth-actor', { submissionId: id, voteValue: 'positive' })).toMatchObject({ outcome: 'committed', engagement: null, warnings: ['engagement_refresh_unavailable'] });
    f.recordVote.mockRejectedValueOnce(new Error('response lost'));
    expect(await voteAgentPipelineRevision('oauth-actor', { submissionId: id, voteValue: 'positive' })).toMatchObject({ outcome: 'uncertain', engagement: null });
    expect(f.recordVote).toHaveBeenCalledTimes(2);
    f.recordVote.mockRejectedValueOnce(new PipelineStoreError('native denied', 403));
    await expect(voteAgentPipelineRevision('oauth-actor', { submissionId: id, voteValue: 'positive' })).rejects.toMatchObject({ status: 403 });
  });
  it('keeps hearts explicit, matching exact lineage and normal-user native authority', async () => {
    await expect(heartAgentPipelineLineage('oauth-actor', { submissionId: id, lineageId: id, hearted: true })).rejects.toMatchObject({ status: 409 }); expect(f.heart).not.toHaveBeenCalled();
    expect(await heartAgentPipelineLineage('oauth-actor', { submissionId: id, lineageId, hearted: true })).toMatchObject({ outcome: 'committed' });
    expect(f.heart).toHaveBeenCalledExactlyOnceWith({ lineageId, hearted: true, accountId: 'resolved-viewer', viewerAccess: 'free', contributor: false, owner: false });
    f.heart.mockRejectedValueOnce(new Error('lost response'));
    expect(await heartAgentPipelineLineage('oauth-actor', { submissionId: id, lineageId, hearted: false })).toMatchObject({ outcome: 'uncertain' }); expect(f.heart).toHaveBeenCalledTimes(2);
  });
  it('keeps technical Health separate from editorial/private findings through the existing builder', async () => {
    f.capabilities.mockResolvedValue({ active: true, scopes: ['assets.review'] });
    f.catalog.mockResolvedValue({ pipeline: { items: [] }, sets: { items: [] } });
    f.healthView.mockResolvedValue({ submissions: [], votingQueue: [], votingPage: { total: 0 }, totalSubmissionCount: 0, dependencyImpacts: [{ objectId: 'hidden', submissionId: id, objectName: 'Private unseen', sourceAssetId: 'hidden', sourceAssetName: 'private' }] });
    const result = await readAgentPipelineHealth('oauth-actor');
    expect(result).toEqual({ checkedCount: 0, errors: 0, warnings: 0, issues: [] });
    expect(f.healthView).toHaveBeenCalledExactlyOnceWith('resolved-viewer');
    expect(result).not.toHaveProperty('editorial'); expect(result).not.toHaveProperty('review');
  });
  it('preserves native filtered paging for scoped contributors and blocks a revoked actor before querying', async () => {
    f.capabilities.mockResolvedValue({ active: true, scopes: ['assets.review', 'assets.submit'] });
    f.rpc.mockResolvedValue({ data: [{ submission_id: null, total_count: 3 }], error: null });
    expect(await listAgentPipelineSubmissions('oauth-actor', { scope: 'review', trash: 'all', status: 'archived', page: 4, pageSize: 2 })).toMatchObject({ items: [], total: 3, page: 4, pageSize: 2 });
    expect(f.rpc).toHaveBeenCalledWith('cardforge_list_contributor_asset_submission_ids', expect.objectContaining({ p_current_user_id: 'resolved-viewer', p_scope: 'review', p_status: 'archived', p_trash_state: 'all', p_allow_self_voting: false, p_page: 4 }));
    f.rpc.mockClear(); f.capabilities.mockResolvedValue({ active: false, scopes: [] });
    await expect(listAgentPipelineSubmissions('oauth-actor', { scope: 'review' })).rejects.toMatchObject({ status: 403 }); expect(f.rpc).not.toHaveBeenCalled();
  });

});

it('agent retains commit with invalidation false warning',async()=>{f.capabilities.mockResolvedValue({active:true,scopes:['assets.review']});f.invalidate.mockReturnValue(false);expect(await voteAgentPipelineRevision('oauth-actor',{submissionId:id,voteValue:'positive'})).toMatchObject({outcome:'committed',warnings:['catalog_invalidation_unavailable']});expect(f.recordVote).toHaveBeenCalledOnce();});
