import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createProjectScaleFixture } from '../../fixtures/projectScale';
import {
  collectStudioDocumentAssetIds,
  collectStudioDocumentFontIds,
  getStudioDocumentAssetReference,
  getStudioDocumentFontReference,
} from '@/features/studio-documents/assetReferences';

const privateImageId = 'a'.repeat(64);
const privateFontId = 'b'.repeat(64);
const privateImageReference = getStudioDocumentAssetReference(privateImageId);
const privateFontReference = getStudioDocumentFontReference(privateFontId);

const mocks = vi.hoisted(() => {
  const chain = {
    insert: vi.fn(),
    select: vi.fn(),
    single: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };
  const store = { from: vi.fn() };
  return {
    chain,
    store,
    externalizeStudioDocumentAssets: vi.fn(),
    removeStudioDocumentAssets: vi.fn(),
  };
});

vi.mock('@/infrastructure/database/supabaseServer', () => ({
  getSupabaseServerClient: () => mocks.store,
}));
vi.mock('@/features/studio-documents/server/studioDocumentAssetStore', () => ({
  externalizeStudioDocumentAssets: mocks.externalizeStudioDocumentAssets,
  removeStudioDocumentAssets: mocks.removeStudioDocumentAssets,
}));

import { createStudioDocument } from '@/features/studio-documents/server/studioDocumentStore';

const makeDocument = () => {
  const document = createProjectScaleFixture(100);
  document.cardSets = [];
  document.storedCards = [];
  document.userTemplates = [];
  delete document.activeCardSetId;
  document.customAssets['cardforge-maker-custom-images'].push({
    id: 'qa-asset-image',
    name: 'QA private artwork',
    kind: 'image',
    url: 'data:image/webp;base64,AAECAw==',
    tileMode: 'contain',
    seamless: false,
    allowedTargets: ['image'],
  });
  document.customFonts = [{
    id: 'qa-asset-font',
    name: 'QA private font',
    value: 'font-personal-qa-asset-font',
    mimeType: 'font/woff2',
    dataUrl: 'data:font/woff2;base64,AAECAw==',
    fileSizeBytes: 4,
  }];
  return document;
};

const makeCreation = () => ({
  ownerUserId: 'author-1',
  title: 'Private asset draft',
  creationSource: 'gpt' as const,
  document: makeDocument(),
  retentionHours: 12,
});

const persistedRow = () => ({
  ...(mocks.chain.insert.mock.calls[0]?.[0] as Record<string, unknown>),
  revision: 1,
  created_at: '2026-11-19T00:00:00.000Z',
  updated_at: '2026-11-19T00:00:00.000Z',
  deleted_at: null,
  purge_after: null,
  last_installed_revision: null,
  last_installed_at: null,
  last_install_summary: null,
});

describe('Studio document first-create acknowledgement and private assets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.store.from.mockReturnValue(mocks.chain);
    mocks.chain.insert.mockReturnValue(mocks.chain);
    mocks.chain.select.mockReturnValue(mocks.chain);
    mocks.chain.eq.mockReturnValue(mocks.chain);
    mocks.chain.single.mockResolvedValue({ data: null, error: null });
    mocks.chain.maybeSingle.mockResolvedValue({ data: null, error: null });
    // Mock Storage, not bytes: the inserted payload must contain genuine
    // owner-scoped private references, not only claimed uploaded IDs.
    mocks.externalizeStudioDocumentAssets.mockImplementation(async ({ document }: { document: ReturnType<typeof makeDocument> }) => ({
      document: {
        ...document,
        customAssets: {
          ...document.customAssets,
          'cardforge-maker-custom-images': document.customAssets['cardforge-maker-custom-images'].map((asset) => ({
            ...asset,
            url: privateImageReference,
          })),
        },
        customFonts: document.customFonts?.map((font) => ({
          ...font,
          dataUrl: privateFontReference,
        })),
      },
      uploadedAssetIds: [privateImageId],
      uploadedFontIds: [privateFontId],
    }));
  });

  it('returns an acknowledged creation without a second database read or asset cleanup', async () => {
    mocks.chain.single.mockImplementation(async () => ({ data: persistedRow(), error: null }));
    const created = await createStudioDocument(makeCreation());
    expect(created).toMatchObject({ title: 'Private asset draft', revision: 1 });
    expect(mocks.chain.maybeSingle).not.toHaveBeenCalled();
    expect(mocks.removeStudioDocumentAssets).not.toHaveBeenCalled();
  });

  it('recovers a committed row with image/font references after the insert acknowledgement is lost', async () => {
    mocks.chain.single.mockResolvedValue({ data: null, error: { message: 'response lost' } });
    mocks.chain.maybeSingle.mockImplementation(async () => ({ data: persistedRow(), error: null }));
    const created = await createStudioDocument(makeCreation());
    const inserted = mocks.chain.insert.mock.calls[0][0] as {
      id: string;
      document_payload: ReturnType<typeof makeDocument>;
    };
    expect(created.id).toBe(inserted.id);
    expect(collectStudioDocumentAssetIds(inserted.document_payload)).toEqual([privateImageId]);
    expect(collectStudioDocumentFontIds(inserted.document_payload)).toEqual([privateFontId]);
    // Exact persisted row readback must preserve both private references.
    expect(collectStudioDocumentAssetIds(created.document)).toEqual([privateImageId]);
    expect(collectStudioDocumentFontIds(created.document)).toEqual([privateFontId]);
    expect(created.document.customFonts?.[0]?.dataUrl).toBe(privateFontReference);
    expect(mocks.chain.eq).toHaveBeenCalledWith('id', inserted.id);
    expect(mocks.chain.eq).toHaveBeenCalledWith('owner_user_id', 'author-1');
    expect(mocks.chain.insert).toHaveBeenCalledTimes(1);
    expect(mocks.removeStudioDocumentAssets).not.toHaveBeenCalled();
  });

  it('preserves private bytes when acknowledgement and exact readback are both absent', async () => {
    mocks.chain.single.mockResolvedValue({ data: null, error: null });
    await expect(createStudioDocument(makeCreation())).rejects.toMatchObject({
      status: 503,
      message: expect.stringContaining('Check your existing Studio working documents'),
    });
    expect(mocks.chain.insert).toHaveBeenCalledTimes(1);
    expect(mocks.removeStudioDocumentAssets).not.toHaveBeenCalled();
  });

  it('does not delete assets even when the insert reports rejection and a subsequent read is empty', async () => {
    mocks.chain.single.mockResolvedValue({ data: null, error: { code: '23514', message: 'constraint failed' } });
    await expect(createStudioDocument(makeCreation())).rejects.toMatchObject({ status: 503 });
    expect(mocks.removeStudioDocumentAssets).not.toHaveBeenCalled();
  });

  it('preserves assets and reports uncertainty when the exact lookup itself fails', async () => {
    mocks.chain.single.mockResolvedValue({ data: null, error: { message: 'connection dropped' } });
    mocks.chain.maybeSingle.mockResolvedValue({ data: null, error: { message: 'provider unavailable' } });
    await expect(createStudioDocument(makeCreation())).rejects.toMatchObject({ status: 503 });
    expect(mocks.removeStudioDocumentAssets).not.toHaveBeenCalled();
  });

  it('also recovers an exact committed row when the client throws instead of returning an error', async () => {
    mocks.chain.single.mockRejectedValue(new Error('transport failed after commit'));
    mocks.chain.maybeSingle.mockImplementation(async () => ({ data: persistedRow(), error: null }));
    await expect(createStudioDocument(makeCreation())).resolves.toMatchObject({ title: 'Private asset draft' });
    expect(mocks.removeStudioDocumentAssets).not.toHaveBeenCalled();
  });

  it('never substitutes a mismatched row and never deletes its private prefix', async () => {
    mocks.chain.single.mockResolvedValue({ data: null, error: { message: 'unknown' } });
    mocks.chain.maybeSingle.mockImplementation(async () => ({
      data: { ...persistedRow(), id: 'some-other-document' }, error: null,
    }));
    await expect(createStudioDocument(makeCreation())).rejects.toMatchObject({ status: 503 });
    expect(mocks.removeStudioDocumentAssets).not.toHaveBeenCalled();
  });
});
