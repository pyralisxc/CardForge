import { beforeEach, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ owner: vi.fn(), editorial: vi.fn(), publication: vi.fn(), evidence: vi.fn() }));
vi.mock('@/features/owner/server', () => ({ getCurrentOwnerAccess: f.owner, recordOwnerActivity: vi.fn(), saveOwnerPipelineEditorialReview: f.editorial, saveOwnerPipelinePublicationOverride: f.publication, recordOwnerPipelineSourceReviewEvidence: f.evidence }));
vi.mock('@/features/pipeline/server', async () => ({ PipelineStoreError: (await import('@/features/pipeline/lib/pipelineStoreError')).PipelineStoreError, PipelineRegistryCommandError: (await import('@/features/pipeline/lib/pipelineRegistryCommandsError')).PipelineRegistryCommandError }));
import { PUT } from '@/app/api/pipeline/[submissionId]/route';
const id = '10000000-0000-4000-8000-000000000001';
const params = { params: Promise.resolve({ submissionId: id }) };
const receipt = { submissionId: id, outcome: 'committed', committed: true, refreshComplete: false, refreshFailures: ['program_refresh'], activityRecorded: false, retryable: false, nextAction: 'read', message: 'Decision committed; read state.' };
beforeEach(() => { vi.resetAllMocks(); f.owner.mockResolvedValue({ userId: 'browser-owner', isOwner: true }); f.editorial.mockResolvedValue({ snapshot: null, program: null, receipt }); });
it('returns shared committed receipt even when no follow-up program is available', async () => {
  const response = await PUT(new Request('https://cardforge.test', { method: 'PUT', body: JSON.stringify({ editorialReviewStatus: 'revise', editorialReviewNote: 'Observed clipping', expectedEvidenceVersion: 3 }) }), params);
  expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ receipt: { outcome: 'committed', committed: true }, program: null });
  expect(f.editorial).toHaveBeenCalledExactlyOnceWith('browser-owner', { submissionId: id, reviewStatus: 'revise', reviewNote: 'Observed clipping', expectedEvidenceVersion: 3 }, { includeProgram: true });
});
it('keeps unknown outcome explicitly uncertain and non-retryable in the existing API error contract', async () => {
  f.editorial.mockResolvedValue({ snapshot: null, program: null, receipt: { ...receipt, outcome: 'uncertain', committed: null } });
  const response = await PUT(new Request('https://cardforge.test', { method: 'PUT', body: JSON.stringify({ editorialReviewStatus: 'revise', editorialReviewNote: 'Observed' }) }), params);
  expect(response.status).toBe(503); expect(await response.json()).toMatchObject({ error: { kind: 'unavailable', retryable: false }, receipt: { outcome: 'uncertain', committed: null } });
  expect(f.editorial).toHaveBeenCalledOnce();
});
it('fails closed before commands for an ordinary viewer or mixed evidence decision', async () => {
  f.owner.mockResolvedValue({ userId: 'ordinary', isOwner: false });
  expect((await PUT(new Request('https://cardforge.test', { method: 'PUT', body: '{}' }), params)).status).toBe(403);
  expect(f.editorial).not.toHaveBeenCalled(); f.owner.mockResolvedValue({ userId: 'browser-owner', isOwner: true });
  expect((await PUT(new Request('https://cardforge.test', { method: 'PUT', body: JSON.stringify({ sourceReviewEvidence: {}, editorialReviewStatus: 'approved' }) }), params)).status).toBe(400);
  expect(f.evidence).not.toHaveBeenCalled();
});
