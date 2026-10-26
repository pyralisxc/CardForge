import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyExactCandidateSnapshot, verifyExactCandidatePublishedBase } from '@/features/pipeline/lib/exactCandidateReview';

const id = {
  submissionId: '00000000-0000-4000-8000-000000000002',
  lineageId: '00000000-0000-4000-8000-000000000001',
  assetId: 'bridge-back', revisionNumber: 2, baseRevisionNumber: 1,
};
const template = { id: id.assetId, name: 'Bridge review specimen', aspectRatio: '570:890' };
const expectedBase = { assetId:id.assetId, parentSubmissionId:'00000000-0000-4000-8000-000000000003',
  lineageId:id.lineageId, baseRevisionNumber:1, revisionHighWater:1,
  parentContentVersion:'a'.repeat(32), registryContentVersion:'b'.repeat(32) };
const expected = { ...id, publishedBase: expectedBase, sourceSha256:createHash('sha256').update(JSON.stringify(template)).digest('hex') };
const submission = { id:id.submissionId,lineage_id:id.lineageId,target_registry_asset_id:id.assetId,
  revision_number:2,base_revision_number:1,asset_type:'templates',status:'submitted',
  published_at:null,purge_state:null,trashed_at:null,source_payload:template,
  template_review_context:{expectedBase} };
const read = (s: Parameters<typeof verifyExactCandidateSnapshot>[0]['submission'], pin=expected) => verifyExactCandidateSnapshot({submission:s,expected:pin});

describe('exact Pipeline candidate reviewer source', () => {
  it('returns only the pinned pending candidate and its original base', () => {
    expect(read(submission).template).toEqual(template);
    expect(read(submission).expectedBase).toEqual(expectedBase);
  });
  it('rejects live publication, different lineage, replaced revisions and stale payload bytes', () => {
    for (const changed of [
      {...submission,status:'published'},
      {...submission,lineage_id:'00000000-0000-4000-8000-000000000004'},
      {...submission,revision_number:3},
      {...submission,source_payload:{...template,name:'Different artwork'}},
      {...submission,template_review_context:null},
    ]) expect(() => read(changed)).toThrow();
  });
  it('never accepts a mutable published registry payload or guessed hash', () => {
    expect(() => read(submission,{...expected,sourceSha256:'0'.repeat(64)})).toThrow('candidate_payload_changed');
  });
});

it('rejects replaced base content, publication and newer candidate high-water', () => {
  const live = { ...expectedBase, revisionHighWater: 2 };
  expect(() => verifyExactCandidatePublishedBase(expected, live)).not.toThrow();
  for (const delta of [{ parentContentVersion: 'c'.repeat(32) }, { registryContentVersion: 'c'.repeat(32) }, { revisionHighWater: 3 }, { baseRevisionNumber: 2 }]) {
    expect(() => verifyExactCandidatePublishedBase(expected, { ...live, ...delta })).toThrow('candidate_base_changed');
  }
});
