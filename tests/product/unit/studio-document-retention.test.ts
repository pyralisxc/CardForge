import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createProjectScaleFixture } from '../../fixtures/projectScale';

const mocks = vi.hoisted(() => {
  const cleanupUploadedStudioDocumentAssets = vi.fn();
  const externalizeStudioDocumentAssets = vi.fn();
  const removeStudioDocumentAssets = vi.fn();
  const chain = {
    update: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    select: vi.fn(),
    maybeSingle: vi.fn(),
  };
  const store = {
    rpc: vi.fn(),
    from: vi.fn(),
  };
  return {
    cleanupUploadedStudioDocumentAssets,
    externalizeStudioDocumentAssets,
    removeStudioDocumentAssets,
    chain,
    store,
  };
});

vi.mock('@/features/studio-documents/server/studioDocumentAssetStore', () => ({
  cleanupUploadedStudioDocumentAssets: mocks.cleanupUploadedStudioDocumentAssets,
  externalizeStudioDocumentAssets: mocks.externalizeStudioDocumentAssets,
  removeStudioDocumentAssets: mocks.removeStudioDocumentAssets,
}));

vi.mock('@/infrastructure/database/supabaseServer', () => ({
  getSupabaseServerClient: () => mocks.store,
}));

import { updateStudioDocument, reconcileStudioDocumentDependencies, reconcileOwnerStudioDocumentDependencies } from '@/features/studio-documents/server/studioDocumentStore';

describe('Studio document revision asset retention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.store.rpc.mockResolvedValue({ data: true, error: null });
    mocks.chain.update.mockReturnValue(mocks.chain);
    mocks.chain.eq.mockReturnValue(mocks.chain);
    mocks.chain.is.mockReturnValue(mocks.chain);
    mocks.chain.select.mockReturnValue(mocks.chain);
    mocks.chain.maybeSingle.mockResolvedValue({ data: null, error: null });
    mocks.store.from.mockReturnValue(mocks.chain);
  });

  it('keeps new content-addressed uploads when a revision loses its compare-and-swap', async () => {
    const document = createProjectScaleFixture(100);
    mocks.externalizeStudioDocumentAssets.mockResolvedValue({
      document,
      uploadedAssetIds: ['shared-artwork'],
      uploadedFontIds: ['shared-font'],
    });

    await expect(updateStudioDocument({
      ownerUserId: 'account-1',
      documentId: 'document-1',
      title: 'Stale revision',
      document,
      expectedRevision: 7,
      retentionHours: 12,
    })).rejects.toMatchObject({ status: 409 });

    expect(mocks.externalizeStudioDocumentAssets).toHaveBeenCalledWith(expect.objectContaining({
      ownerUserId: 'account-1',
      documentId: 'document-1',
      cleanupOnFailure: false,
    }));
    expect(mocks.chain.update).toHaveBeenCalledWith(expect.objectContaining({
      document_payload: document, revision: 8,
      catalog_dependencies: expect.objectContaining({ contractVersion: 1, sourcePayload: document }),
    }));
    expect(mocks.cleanupUploadedStudioDocumentAssets).not.toHaveBeenCalled();
    expect(mocks.removeStudioDocumentAssets).not.toHaveBeenCalled();
  });
  it('reconciles the exact raw snapshot without normalizing unknown fields away', async () => {
    const payload={version:1,userTemplates:[],futureDependency:'unknown'};
    mocks.chain.maybeSingle.mockResolvedValue({data:{document_payload:payload,revision:7},error:null});
    await reconcileStudioDocumentDependencies('account-1','document-1');
    expect(mocks.store.rpc).toHaveBeenCalledWith('cardforge_reconcile_studio_catalog_dependencies', {
      p_owner_user_id:'account-1',p_document_id:'document-1',p_expected_revision:7,p_expected_payload:payload,
      p_interpretation:expect.objectContaining({sourcePayload:payload,complete:false}),
    });
    expect(mocks.chain.update).not.toHaveBeenCalled();
  });
  it('reports reconciliation CAS loss without retrying newer content', async () => {
    mocks.chain.maybeSingle.mockResolvedValue({data:{document_payload:{version:1,userTemplates:[]},revision:7},error:null});
    mocks.store.rpc.mockResolvedValue({data:false,error:null});
    await expect(reconcileStudioDocumentDependencies('account-1','document-1')).rejects.toMatchObject({status:409});
    expect(mocks.store.rpc).toHaveBeenCalledTimes(1);
  });

  it('uses stored ownership and exact expected revision for Owner reconciliation', async () => {
    const payload = {version:1,userTemplates:[],futureDependency:'unknown'};
    mocks.chain.maybeSingle.mockResolvedValue({data:{owner_user_id:'actual-author',document_payload:payload,revision:7},error:null});
    const receipt = await reconcileOwnerStudioDocumentDependencies('document-1',7);
    expect(mocks.store.rpc).toHaveBeenCalledWith('cardforge_reconcile_studio_catalog_dependencies', expect.objectContaining({
      p_owner_user_id:'actual-author',p_expected_payload:payload,p_expected_revision:7,
    }));
    expect(receipt).toEqual(expect.objectContaining({documentId:'document-1',revision:7,complete:false}));
    expect(receipt).not.toHaveProperty('document_payload');
    expect(receipt).not.toHaveProperty('owner_user_id');
  });
  it('does not reconcile a revision different from the one selected', async () => {
    mocks.chain.maybeSingle.mockResolvedValue({data:{owner_user_id:'author',document_payload:{},revision:8},error:null});
    await expect(reconcileOwnerStudioDocumentDependencies('document-1',7)).rejects.toMatchObject({status:409});
    expect(mocks.store.rpc).not.toHaveBeenCalled();
  });
  it('reports unreadable sources as unavailable, not changed', async () => {
    mocks.chain.maybeSingle.mockResolvedValue({data:null,error:{message:'fetch failed'}});
    await expect(reconcileOwnerStudioDocumentDependencies('document-1',7)).rejects.toMatchObject({status:503});
    expect(mocks.store.rpc).not.toHaveBeenCalled();
  });
  it('preserves uncertainty after an RPC error and does not retry', async () => {
    mocks.chain.maybeSingle.mockResolvedValue({data:{owner_user_id:'author',document_payload:{version:1},revision:7},error:null});
    mocks.store.rpc.mockResolvedValue({data:null,error:{message:'response lost'}});
    await expect(reconcileOwnerStudioDocumentDependencies('document-1',7)).rejects.toMatchObject({status:503});
    expect(mocks.store.rpc).toHaveBeenCalledTimes(1);
  });

});
