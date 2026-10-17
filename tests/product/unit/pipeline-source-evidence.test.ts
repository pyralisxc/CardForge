import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { getSourceReviewVersion, sourceReviewFactsSchema } from '@/features/pipeline/lib/sourceReviewEvidence';
import { readSourceReviewEvidence, recordSourceReviewEvidence } from '@/features/pipeline/server/sourceReviewEvidence';
vi.mock('@/infrastructure/database/supabaseServer', () => ({ getSupabaseServerClient: vi.fn() }));
const id = '63300e01-8d07-4f22-8221-a56de17221e5';
const facts = { technicalTrace: 'Exact published parent revision and managed-byte hash; creator/license/AI facts not established.', creatorFacts: null, rightsFacts: null, aiFacts: null };
const snapshot = { submissionId: id, candidateVersion: 'a'.repeat(32), evidence: { schemaVersion: 1, version: 2, facts, recordedBy: 'acting-owner', recordedAt: '2026-10-17T20:00:00Z' }, canRecord: true };
const rpc = vi.fn();
beforeEach(() => { rpc.mockReset().mockResolvedValue({ data: snapshot, error: null }); vi.mocked(getSupabaseServerClient).mockReturnValue({ rpc } as never); });
describe('correction reviewer source evidence', () => {
  it('records explicit unknown facts without inventing a license or overwriting original creator notes', async () => {
    expect(sourceReviewFactsSchema.parse(facts)).toEqual(facts);
    expect(await recordSourceReviewEvidence(id, { facts, expectedCandidateVersion: snapshot.candidateVersion, expectedEvidenceVersion: 1 }, 'acting-owner')).toEqual(snapshot);
    expect(rpc).toHaveBeenCalledWith('cardforge_record_source_review_evidence', { p_submission_id: id, p_facts: facts, p_expected_candidate_version: snapshot.candidateVersion, p_expected_evidence_version: 1, p_actor_id: 'acting-owner' });
  });
  it('does not turn corrupt or unavailable evidence into a missing version', async () => {
    expect(getSourceReviewVersion(null)).toBe(0); expect(getSourceReviewVersion({ version: 2 })).toBeNull();
    rpc.mockResolvedValueOnce({ data: { ...snapshot, evidence: {} }, error: null });
    await expect(readSourceReviewEvidence(id)).rejects.toMatchObject({ status: 503 });
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'provider timeout' } });
    await expect(readSourceReviewEvidence(id)).rejects.toMatchObject({ status: 503 });
  });
  it('preserves stale and missing-revision failures and rejects oversized claims before a write', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'source_evidence_conflict' } });
    await expect(recordSourceReviewEvidence(id, { facts, expectedCandidateVersion: snapshot.candidateVersion, expectedEvidenceVersion: 1 }, 'acting-owner')).rejects.toMatchObject({ status: 409 });
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'source_evidence_not_found' } });
    await expect(readSourceReviewEvidence(id)).rejects.toMatchObject({ status: 404 });
    rpc.mockClear();
    await expect(recordSourceReviewEvidence(id, { facts: { ...facts, rightsFacts: 'x'.repeat(1201) }, expectedCandidateVersion: snapshot.candidateVersion, expectedEvidenceVersion: 1 }, 'acting-owner')).rejects.toMatchObject({ status: 400 });
    expect(rpc).not.toHaveBeenCalled();
  });
});
