import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ access: vi.fn(), reconcile: vi.fn() }));
vi.mock('@/features/owner/server', () => ({ getCurrentOwnerAccess: mocks.access }));
vi.mock('@/features/studio-documents/server', async () => ({
  ...(await import('@/features/studio-documents/server/StudioDocumentStoreError')),
  reconcileOwnerStudioDocumentDependencies: mocks.reconcile,
}));
import { POST } from '@/app/api/owner/studio-dependencies/route';
import { StudioDocumentStoreError } from '@/features/studio-documents/server/StudioDocumentStoreError';
const documentId = '8856f600-6c95-4835-8733-3ecb0ceb951d';
const post = (body: unknown) => POST(new Request('http://localhost/api/owner/studio-dependencies', {method:'POST',body:JSON.stringify(body)}));
beforeEach(() => { vi.resetAllMocks(); mocks.access.mockResolvedValue({isOwner:true,userId:'owner'}); });
describe('Owner Studio dependency reconciliation', () => {
  it.each([{isOwner:false,userId:'contributor'}, {isOwner:false,userId:null}, {isOwner:true,userId:null}])('rejects without session Owner authority', async access => {
    mocks.access.mockResolvedValue(access);
    expect((await post({documentId,expectedRevision:2})).status).toBe(403);
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });
  it.each([{documentId,expectedRevision:2,interpretation:{complete:true}}, {documentId,expectedRevision:2,ownerUserId:'other'}, {documentId,expectedRevision:0}, {documentId:'unknown',expectedRevision:2}])('rejects supplied proof or invalid exact identity', async input => {
    expect((await post(input)).status).toBe(400);
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });
  it('reports an unavailable authority read without performing reconciliation', async () => {
    mocks.access.mockRejectedValue(new Error('authority unavailable'));
    expect((await post({documentId,expectedRevision:2})).status).toBe(503);
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });
  it('returns the trusted receipt with no-store policy', async () => {
    const receipt={documentId,revision:2,contractVersion:1,complete:false,opaqueReasons:['external_or_unbound_source']};
    mocks.reconcile.mockResolvedValue(receipt);
    const response=await post({documentId,expectedRevision:2});
    expect(response.status).toBe(200); expect(await response.json()).toEqual(receipt);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(mocks.reconcile).toHaveBeenCalledWith(documentId,2);
  });
  it.each([404,409,503] as const)('preserves source boundary status %s', async status => {
    mocks.reconcile.mockRejectedValue(new StudioDocumentStoreError('Source boundary failure',status));
    expect((await post({documentId,expectedRevision:2})).status).toBe(status);
    expect(mocks.reconcile).toHaveBeenCalledTimes(1);
  });
});
