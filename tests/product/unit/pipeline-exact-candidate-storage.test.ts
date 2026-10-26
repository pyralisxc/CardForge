import { createHash } from 'node:crypto';
import { beforeEach, expect, it, vi } from 'vitest';
import { getFreshDefaultTemplateObject } from '@/domain/templates';
const mocks = vi.hoisted(() => ({ client: vi.fn(), download: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/infrastructure/database/supabaseServer', () => ({ getSupabaseServerClient: mocks.client }));
import { readExactCandidateReview } from '@/features/pipeline/server/exactCandidateReview';
const bytes = Buffer.from('synthetic managed bytes');
const hash = createHash('sha256').update(bytes).digest('hex');
const template = getFreshDefaultTemplateObject('candidate');
template.cardBackgroundImageUrl = `cardforge-pipeline-asset://${hash}`;
const publishedBase = { assetId:template.id!, lineageId:'00000000-0000-4000-8000-000000000001', parentSubmissionId:'00000000-0000-4000-8000-000000000003', baseRevisionNumber:1, revisionHighWater:1, parentContentVersion:'a'.repeat(32), registryContentVersion:'b'.repeat(32) };
const expected = { submissionId:'00000000-0000-4000-8000-000000000002', lineageId:publishedBase.lineageId, assetId:template.id!, revisionNumber:2, baseRevisionNumber:1, publishedBase, sourceSha256:createHash('sha256').update(JSON.stringify(template)).digest('hex') };
beforeEach(() => {
  mocks.download.mockReset();
  const query = { select:vi.fn(), eq:vi.fn(), maybeSingle:vi.fn().mockResolvedValue({ data:{ id:expected.submissionId, lineage_id:expected.lineageId, target_registry_asset_id:expected.assetId, revision_number:2, base_revision_number:1, asset_type:'templates', status:'submitted', published_at:null, purge_state:null, trashed_at:null, source_payload:template, template_review_context:{ expectedBase:publishedBase } }, error:null }) };
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query);
  mocks.client.mockReturnValue({ from:()=>query, rpc:vi.fn().mockResolvedValue({ data:{ expectedBase:{ ...publishedBase, revisionHighWater:2 } }, error:null }), storage:{ from:()=>({ download:mocks.download }) } });
});
it.each(['returned-error','missing-data','rejected-download','unreadable-body'])('reports unavailable for %s without claiming changed identity', async failure => {
  if (failure === 'returned-error') mocks.download.mockResolvedValue({ error:{ message:'transient failure' }, data:null });
  if (failure === 'missing-data') mocks.download.mockResolvedValue({ error:null, data:null });
  if (failure === 'rejected-download') mocks.download.mockRejectedValue(new Error('network failure'));
  if (failure === 'unreadable-body') mocks.download.mockResolvedValue({ error:null, data:{ arrayBuffer:async()=>{ throw new Error('body failure'); } } });
  await expect(readExactCandidateReview(expected)).rejects.toMatchObject({ status:503 });
});
it('reports conflict only after readable bytes prove a digest mismatch', async () => {
  mocks.download.mockResolvedValue({ error:null, data:new Blob(['changed']) });
  await expect(readExactCandidateReview(expected)).rejects.toMatchObject({ status:409 });
});
