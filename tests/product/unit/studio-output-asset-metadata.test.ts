import { expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ list: vi.fn(), signed: vi.fn() }));
vi.mock('@/infrastructure/database/supabaseServer', () => ({ getSupabaseServerClient: () => ({ storage: { from: () => ({ list: mocks.list, createSignedUrls: mocks.signed }) } }) }));
import { getStudioDocumentAssetDownloads } from '@/features/studio-documents/server/studioDocumentAssetStore';
const id = 'f'.repeat(64);
it('finds current referenced artwork after historical objects and rejects incomplete listing', async () => {
  mocks.list.mockReset(); mocks.signed.mockReset();
  mocks.signed.mockResolvedValue({ data: [{ path: `owner/doc/${id}.webp`, signedUrl: 'https://example.invalid' }], error: null });
  mocks.list.mockImplementation(async (_prefix: string, options: { offset: number }) => options.offset === 0
    ? { data: Array.from({ length: 256 }, (_, i) => ({ name: `${String(i).padStart(4, '0')}.webp`, metadata: { size: 1 } })), error: null }
    : { data: [{ name: `${id}.webp`, metadata: { size: 9 } }], error: null });
  const input = { ownerUserId: 'owner', documentId: 'doc', value: { image: `cardforge-studio-asset://${id}` }, requireVerifiedSize: true };
  expect(await getStudioDocumentAssetDownloads(input)).toMatchObject([{ id, size: 9 }]);
  expect(mocks.list).toHaveBeenCalledTimes(2);
  mocks.list.mockResolvedValue({ data: null, error: null });
  await expect(getStudioDocumentAssetDownloads(input)).rejects.toThrow('incomplete');
});
it('finds current referenced font beyond retained historical pages', async () => {
  mocks.list.mockReset(); mocks.signed.mockReset();
  mocks.signed.mockResolvedValue({ data: [{ path: `owner/doc/${id}`, signedUrl: 'https://example.invalid' }], error: null });
  mocks.list.mockImplementation(async (_prefix: string, options: { offset: number }) => options.offset === 0
    ? { data: Array.from({ length: 256 }, (_, i) => ({ name: String(i).padStart(4, '0'), metadata: { size: 1, mimetype: 'font/woff2' } })), error: null }
    : { data: [{ name: id, metadata: { size: 17, mimetype: 'font/woff2' } }], error: null });
  expect(await getStudioDocumentAssetDownloads({ ownerUserId: 'owner', documentId: 'doc', value: { dataUrl: `cardforge-studio-font://${id}`, mimeType: 'font/woff2' }, requireVerifiedSize: true })).toMatchObject([{ id, size: 17 }]);
  expect(mocks.list).toHaveBeenCalledTimes(2);
});
