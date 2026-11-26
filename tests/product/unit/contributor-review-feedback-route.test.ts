import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const f = vi.hoisted(() => ({ actor: 'author', row: {} as Record<string, unknown>, error: null as unknown, active: true, accessStatus: 0, versionError: false }));
vi.mock('@/features/pipeline/server/pipelineAgentActions', () => ({
  resolvePipelineAgentViewer: async () => ({ userId: f.actor, isOwner: false, contribution: { active: f.active, scopes: ['library.submit'] } }),
}));
vi.mock('@/infrastructure/database/supabaseServer', () => ({ getSupabaseServerClient: () => ({ rpc: async () => ({ data: f.versionError ? null : 'a'.repeat(32), error: f.versionError ? { message: 'unavailable' } : null }), from: () => {
  const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: f.row, error: f.error }) }; return q;
} }) }));
vi.mock('@/features/pipeline/server', async () => ({
  ...(await import('@/features/pipeline/server/contributorDraftCommands')),
  PipelineStoreError: (await import('@/features/pipeline/lib/pipelineStoreError')).PipelineStoreError,
  getCurrentPipelineRequestAccess: async () => {
    if (f.accessStatus) throw new (await import('@/features/pipeline/lib/pipelineStoreError')).PipelineStoreError('Account access could not be resolved.', f.accessStatus);
    return { user: { id: f.actor } };
  },
}));
import { GET } from '@/app/api/pipeline/[submissionId]/feedback/route';
const id = '10000000-0000-4000-8000-000000000001';
const params = { params: Promise.resolve({ submissionId: id }) };
beforeEach(() => { f.actor = 'author'; f.active = true; f.error = null; f.accessStatus = 0; f.versionError = false; f.row = { id,
  lineage_id: null, revision_number: 1, contributor_id: 'author', editorial_review_status: 'revise',
  author_review_note: 'Please improve contrast.', editorial_reviewed_at: '2026-11-26T12:00:00Z', purge_state: null,
  editorial_review_note: 'private reviewer observation', source_review_evidence: { private: 'never expose' } }; });
it('returns only the exact author-facing note through the browser entry point', async () => {
  const response = await GET(new Request('https://example.test/api/pipeline/feedback'), params);
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body).toMatchObject({ submissionId: id, reviewStatus: 'revise', authorNote: 'Please improve contrast.' });
  expect(JSON.stringify(body)).not.toContain('private');
});
it('returns a revision base only for the exact author Template and fails closed when its content version is unavailable', async () => {
  f.row.asset_type='templates'; f.row.status='voting'; f.row.target_registry_asset_id='shared-template';
  let response=await GET(new Request('https://example.test/api/pipeline/feedback'),params);
  expect(await response.json()).toMatchObject({ revisionBase: {parentSubmissionId:id,assetId:'shared-template',reviewedAt:'2026-11-26T12:00:00Z',parentContentVersion:'a'.repeat(32)} });
  f.versionError=true;response=await GET(new Request('https://example.test/api/pipeline/feedback'),params);expect(response.status).toBe(503);
});
it('distinguishes signed-out, unavailable and invalid revision requests', async () => {
  f.accessStatus = 401;
  let response = await GET(new Request('https://example.test/api/pipeline/feedback'), params);
  expect(response.status).toBe(401); expect((await response.json()).error.code).toBe('sign_in_required');
  f.accessStatus = 503;
  response = await GET(new Request('https://example.test/api/pipeline/feedback'), params);
  expect(response.status).toBe(503); expect((await response.json()).error.code).toBe('pipeline_unavailable');
  f.accessStatus = 0;
  response = await GET(new Request('https://example.test/api/pipeline/feedback'), { params: Promise.resolve({ submissionId: 'invalid' }) });
  expect(response.status).toBe(400); expect((await response.json()).error.code).toBe('pipeline_request_invalid');
});
it('does not expose a peer revision or treat an unavailable read as empty feedback', async () => {
  f.actor = 'peer';
  expect((await GET(new Request('https://example.test/api/pipeline/feedback'), params)).status).toBe(404);
  f.actor = 'author'; f.error = { message: 'database unavailable' };
  expect((await GET(new Request('https://example.test/api/pipeline/feedback'), params)).status).toBe(503);
  f.error = null; f.active = false;
  expect((await GET(new Request('https://example.test/api/pipeline/feedback'), params)).status).toBe(403);
});
it('does not present a retained message as feedback for a pending decision', async () => {
  f.row.editorial_review_status = 'pending';
  const response = await GET(new Request('https://example.test/api/pipeline/feedback'), params);
  expect(await response.json()).toMatchObject({ reviewStatus: 'pending', authorNote: null });
});
