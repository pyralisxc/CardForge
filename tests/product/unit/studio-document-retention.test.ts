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

import { updateStudioDocument } from '@/features/studio-documents/server/studioDocumentStore';

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
    const document = createProjectScaleFixture(1);
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
    expect(mocks.cleanupUploadedStudioDocumentAssets).not.toHaveBeenCalled();
    expect(mocks.removeStudioDocumentAssets).not.toHaveBeenCalled();
  });
});
