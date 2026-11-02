import { beforeEach, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ access: vi.fn(), scope: vi.fn(), save: vi.fn(), finalize: vi.fn() }));
vi.mock('@/features/pipeline/server', async () => ({
  ...await import('@/features/pipeline/lib/pipelineStoreError'),
  getCurrentPipelineRequestAccess: f.access, requirePipelineRequestScope: f.scope,
  saveContributorPipelineMetadata: f.save, finalizeContributorTemplateSubmission: f.finalize,
}));
vi.mock('@/features/owner/server', () => ({}));
import { PATCH, POST } from '@/app/api/pipeline/[submissionId]/route';
import { PipelineStoreError } from '@/features/pipeline/lib/pipelineStoreError';
const id = '10000000-0000-4000-8000-000000000001';
const params = { params: Promise.resolve({ submissionId: id }) };
const request = (method: string) => new Request('https://cardforge.test/api/pipeline/' + id, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Exact authored metadata' }) });
const receipt = { submissionId: id, outcome: 'committed', metadataCommitted: true, submitted: false, committedMetadataFields: ['name'], warnings: ['Readback unavailable'], retryable: false, nextAction: 'read' };
beforeEach(() => { vi.resetAllMocks(); f.access.mockResolvedValue({ user: { id: 'author' }, isOwner: false }); });
it('browser metadata Save uses the shared actor-derived command and retains committed warnings', async () => {
  f.save.mockResolvedValue({ snapshot: null, receipt });
  const response = await PATCH(request('PATCH'), params);
  expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ updated: true, receipt: { outcome: 'committed', metadataCommitted: true } });
  expect(f.scope).toHaveBeenCalledWith(expect.anything(), 'assets.submit');
  expect(f.save).toHaveBeenCalledExactlyOnceWith('author', { submissionId: id, metadata: { name: 'Exact authored metadata' } });
});
it('browser finalization returns retained metadata without a false submitted Boolean', async () => {
  f.finalize.mockResolvedValue({ snapshot: null, receipt: { ...receipt, outcome: 'metadata_committed_not_submitted', committedMetadataFields: ['semanticRole'] } });
  const response = await POST(request('POST'), params);
  expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ submitted: false, receipt: { outcome: 'metadata_committed_not_submitted', metadataCommitted: true } });
  expect(f.scope).toHaveBeenCalledWith(expect.anything(), 'library.submit'); expect(f.finalize).toHaveBeenCalledOnce();
});
it('browser uncertain finalization is nonretryable and preserves its partial receipt', async () => {
  f.finalize.mockResolvedValue({ snapshot: null, receipt: { ...receipt, outcome: 'uncertain', submitted: null } });
  const response = await POST(request('POST'), params);
  expect(response.status).toBe(503); expect(await response.json()).toMatchObject({ error: { retryable: false, nextAction: expect.stringContaining('do not replay automatically') }, receipt: { outcome: 'uncertain', submitted: null } });
  expect(f.finalize).toHaveBeenCalledOnce();
});
it('denies browser scope before any metadata/finalization command', async () => {
  f.scope.mockImplementation(() => { throw new PipelineStoreError('Not permitted', 403); });
  expect((await PATCH(request('PATCH'), params)).status).toBe(403);
  expect((await POST(request('POST'), params)).status).toBe(403);
  expect(f.save).not.toHaveBeenCalled(); expect(f.finalize).not.toHaveBeenCalled();
});
