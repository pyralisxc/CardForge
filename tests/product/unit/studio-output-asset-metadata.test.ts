import { createHash } from 'node:crypto';
import { expect, it, vi } from 'vitest';
import { createProjectScaleFixture } from '../../fixtures/projectScale';
const mocks = vi.hoisted(() => ({ list: vi.fn(), signed: vi.fn(), upload: vi.fn() }));
vi.mock('@/infrastructure/database/supabaseServer', () => ({ getSupabaseServerClient: () => ({ storage: { from: () => ({ list: mocks.list, createSignedUrls: mocks.signed, upload: mocks.upload }) } }) }));
import { externalizeStudioDocumentAssets, getStudioDocumentAssetDownloads } from '@/features/studio-documents/server/studioDocumentAssetStore';
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
it.each(['image/png', 'image/gif', 'image/svg+xml'])('stores original %s bytes and advertises their original format', async (mimeType) => {
  const bytes = Buffer.from(`original artwork ${mimeType}`);
  const digest = createHash('sha256').update(bytes).digest('hex');
  const document = createProjectScaleFixture(100);
  document.customAssets['cardforge-maker-custom-images'].push({ id: 'fixture', name: 'fixture', kind: 'image', url: `data:${mimeType};base64,${bytes.toString('base64')}`, tileMode: 'contain', seamless: false, allowedTargets: ['image'] });
  mocks.list.mockReset(); mocks.signed.mockReset(); mocks.upload.mockReset();
  mocks.list.mockResolvedValue({ data: [], error: null });
  mocks.upload.mockResolvedValue({ error: null });
  const result = await externalizeStudioDocumentAssets({ ownerUserId: 'owner', documentId: 'doc', document });
  expect(result.document.customAssets['cardforge-maker-custom-images'].at(-1)?.url).toBe(`cardforge-studio-asset://${digest}`);
  expect(mocks.upload).toHaveBeenCalledWith(`owner/doc/${digest}.webp`, bytes, expect.objectContaining({ contentType: mimeType }));
  mocks.list.mockResolvedValue({ data: [{ name: `${digest}.webp`, metadata: { size: bytes.length, mimetype: mimeType } }], error: null });
  mocks.signed.mockResolvedValue({ data: [{ path: `owner/doc/${digest}.webp`, signedUrl: 'https://example.invalid' }], error: null });
  expect(await getStudioDocumentAssetDownloads({ ownerUserId: 'owner', documentId: 'doc', value: result.document, requireVerifiedSize: true })).toMatchObject([{ id: digest, size: bytes.length, mimeType }]);
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
