import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const f = vi.hoisted(() => ({ account: vi.fn(), activity: vi.fn(), cache: vi.fn(), sourceRead: vi.fn(), sourceRecord: vi.fn(), editorial: vi.fn(), publication: vi.fn(), program: vi.fn(), from: vi.fn(), row: {} as Record<string, unknown>, error: null as unknown }));
vi.mock('@/features/account/server', () => ({ getAccountToolAccessForUserId: f.account }));
vi.mock('@/features/owner/server/ownerActivityStore', () => ({ recordOwnerActivity: f.activity }));
vi.mock('@/features/pipeline/server/catalogCache', () => ({ revalidateCardForgeCatalog: f.cache }));
vi.mock('@/features/pipeline/server/sourceReviewEvidence', () => ({ readSourceReviewEvidence: f.sourceRead, recordSourceReviewEvidence: f.sourceRecord }));
vi.mock('@/features/pipeline/lib/pipelineStore', async () => ({ PipelineStoreError: (await import('@/features/pipeline/lib/pipelineStoreError')).PipelineStoreError, commitPipelineEditorialReview: f.editorial, commitPipelineSubmissionStatus: f.publication, getPipelineProgramView: f.program }));
vi.mock('@/infrastructure/database/supabaseServer', () => ({ getSupabaseServerClient: () => ({ from: f.from }) }));
import { getOwnerPipelineSourceReviewEvidence, recordOwnerPipelineSourceReviewEvidence, getOwnerPipelineEditorialReview, saveOwnerPipelineEditorialReview, getOwnerPipelinePublicationDecision, saveOwnerPipelinePublicationOverride } from '@/features/owner/server/ownerPipelineDecisionCommands';
import { PipelineRegistryCommandError } from '@/features/pipeline/lib/pipelineRegistryCommandsError';
const id = '10000000-0000-4000-8000-000000000001', lineageId = '20000000-0000-4000-8000-000000000001';
const evidence = { submissionId: id, candidateVersion: 'a'.repeat(32), evidence: null, canRecord: true };
const facts = { technicalTrace: 'Observed exact bytes only', creatorFacts: null, rightsFacts: null, aiFacts: null };
beforeEach(() => {
  vi.resetAllMocks(); f.error = null;
  f.account.mockResolvedValue({ user: { id: 'server-owner' }, email: 'owner@example.invalid', isOwner: true }); f.activity.mockResolvedValue(true); f.cache.mockReturnValue(true); f.program.mockResolvedValue({ submissions: [] });
  f.sourceRead.mockResolvedValue(evidence); f.sourceRecord.mockResolvedValue({ ...evidence, evidence: { schemaVersion: 1, version: 1, facts, recordedBy: 'server-owner', recordedAt: 'now' } });
  f.row = { id, lineage_id: lineageId, name: 'Exact original', asset_type: 'icons', semantic_role: 'symbol', requested_studio_destination: 'element.icon', revision_number: 1, status: 'voting', updated_at: '2026-11-02T00:00:00Z', editorial_review_status: 'pending', editorial_review_note: '', editorial_reviewed_by: null, editorial_reviewed_at: null, source_review_evidence: null, catalog_submission_id: null, published_at: null, owner_status_override: null, owner_access_tier_override: null, owner_note: null, calculated_access_tier: 'hidden' };
  f.from.mockImplementation(() => { const q = { select: vi.fn(() => q), eq: vi.fn(() => q), maybeSingle: () => Promise.resolve({ data: f.row, error: f.error }) }; return q; });
});
it('re-resolves Owner authority for every read/write without trusting request flags', async () => {
  f.account.mockResolvedValue({ user: { id: 'contributor' }, isOwner: false });
  for (const action of [getOwnerPipelineSourceReviewEvidence, getOwnerPipelineEditorialReview, getOwnerPipelinePublicationDecision]) await expect(action('oauth-actor', { submissionId: id })).rejects.toMatchObject({ status: 403 });
  await expect(saveOwnerPipelinePublicationOverride('oauth-actor', { submissionId: id, ownerNote: 'Explicit decision' })).rejects.toMatchObject({ status: 403 });
  expect(f.from).not.toHaveBeenCalled(); expect(f.sourceRead).not.toHaveBeenCalled(); expect(f.publication).not.toHaveBeenCalled();
  await expect(saveOwnerPipelinePublicationOverride('oauth-actor', { submissionId: id, ownerNote: '', isOwner: true })).rejects.toMatchObject({ status: 400 });
});
it('reads exact editorial/version/quality state and publication pointer without fabricated CAS', async () => {
  const review = await getOwnerPipelineEditorialReview('oauth-actor', { submissionId: id });
  expect(review).toMatchObject({ submissionId: id, evidenceVersion: 0, qualityStandard: { version: 'CF-CQS-1' } });
  expect(review.qualityStandard.roleCriteria.proof).toBeTruthy();
  expect(await getOwnerPipelinePublicationDecision('oauth-actor', { submissionId: id })).toMatchObject({ submissionId: id, currentPublicationSubmissionId: null, ownerStatusOverride: null });
  f.row.source_review_evidence = { version: 3 };
  await expect(getOwnerPipelineEditorialReview('oauth-actor', { submissionId: id })).rejects.toMatchObject({ status: 503 });
  f.row.id = lineageId;
  await expect(getOwnerPipelinePublicationDecision('oauth-actor', { submissionId: id })).rejects.toMatchObject({ status: 503 });
});
it('forwards supported evidence versions and explicit unknown facts to the same native owner', async () => {
  const result = await recordOwnerPipelineSourceReviewEvidence('oauth-actor', { submissionId: id, facts, expectedCandidateVersion: evidence.candidateVersion, expectedEvidenceVersion: 0 });
  expect(f.sourceRecord).toHaveBeenCalledExactlyOnceWith(id, { facts, expectedCandidateVersion: evidence.candidateVersion, expectedEvidenceVersion: 0 }, 'server-owner');
  expect(result.receipt).toMatchObject({ outcome: 'committed', committed: true, activityRecorded: true });
  expect(f.editorial).not.toHaveBeenCalled(); expect(f.publication).not.toHaveBeenCalled(); expect(f.cache).not.toHaveBeenCalled();
});
it('preserves native conflict/authorization errors before commit and never invokes post-commit observers', async () => {
  f.editorial.mockRejectedValue(new PipelineRegistryCommandError('stale evidence', 409));
  await expect(saveOwnerPipelineEditorialReview('oauth-actor', { submissionId: id, reviewStatus: 'approved', reviewNote: 'Reviewed actual output', expectedEvidenceVersion: 4 })).rejects.toMatchObject({ status: 409 });
  expect(f.activity).not.toHaveBeenCalled(); expect(f.cache).not.toHaveBeenCalled(); expect(f.from).not.toHaveBeenCalled();
});
it('keeps a confirmed decision committed despite activity, cache, exact readback and program failures', async () => {
  f.activity.mockRejectedValue(new Error('activity offline')); f.cache.mockReturnValue(false); f.error = { message: 'read offline' }; f.program.mockRejectedValue(new Error('refresh offline'));
  const result = await saveOwnerPipelinePublicationOverride('oauth-actor', { submissionId: id, ownerStatusOverride: 'archived', ownerNote: 'Explicit retirement' }, { includeProgram: true });
  expect(f.publication).toHaveBeenCalledExactlyOnceWith({ submissionId: id, ownerStatusOverride: 'archived', ownerNote: 'Explicit retirement', currentUserId: 'server-owner' });
  expect(result).toMatchObject({ snapshot: null, program: null, receipt: { outcome: 'committed', committed: true, activityRecorded: false, refreshComplete: false, retryable: false, refreshFailures: ['catalog_cache', 'exact_readback', 'program_refresh'] } });
});
it('returns explicit uncertain write outcomes without replay or false committed state', async () => {
  f.editorial.mockRejectedValue(new Error('lost native response'));
  const result = await saveOwnerPipelineEditorialReview('oauth-actor', { submissionId: id, reviewStatus: 'revise', reviewNote: 'Repair observed clipping', expectedEvidenceVersion: null });
  expect(result).toMatchObject({ snapshot: null, receipt: { outcome: 'uncertain', committed: null, nextAction: 'read', retryable: false } });
  expect(f.editorial).toHaveBeenCalledOnce(); expect(f.activity).not.toHaveBeenCalled();
  await expect(saveOwnerPipelinePublicationOverride('oauth-actor', { submissionId: id, ownerNote: 'Explicit', expectedUpdatedAt: 'invented' })).rejects.toMatchObject({ status: 400 });
  expect(f.publication).not.toHaveBeenCalled();
});
