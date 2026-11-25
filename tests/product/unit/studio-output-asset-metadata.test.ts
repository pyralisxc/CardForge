import { createHash, randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { expect, it, vi } from 'vitest';
import { createProjectScaleFixture } from '../../fixtures/projectScale';
const mocks = vi.hoisted(() => ({ list: vi.fn(), signed: vi.fn(), upload: vi.fn(), download: vi.fn(), signedUpload: vi.fn() }));
vi.mock('@/infrastructure/database/supabaseServer', () => ({ getSupabaseServerClient: () => ({ storage: { from: () => ({ list: mocks.list, createSignedUrls: mocks.signed, upload: mocks.upload, download: mocks.download, createSignedUploadUrl: mocks.signedUpload }) } }) }));
import { externalizeStudioDocumentAssets, getStudioDocumentAssetDownloads, preparePrivateStudioAssetUpload, verifyPrivateStudioAsset } from '@/features/studio-documents/server/studioDocumentAssetStore';
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
it('keeps an original PNG larger than the former Studio attachment limit', async () => {
  const bytes = await sharp(randomBytes(1024 * 1024 * 3), { raw: { width: 1024, height: 1024, channels: 3 } }).png().toBuffer();
  expect(bytes.length).toBeGreaterThan(2_400_000);
  const document = createProjectScaleFixture(100);
  document.customAssets['cardforge-maker-custom-images'].push({ id: 'large-fixture', name: 'fixture', kind: 'image', url: `data:image/png;base64,${bytes.toString('base64')}`, tileMode: 'contain', seamless: false, allowedTargets: ['image'] });
  mocks.list.mockReset(); mocks.upload.mockReset();
  mocks.list.mockResolvedValue({ data: [], error: null });
  mocks.upload.mockResolvedValue({ error: null });
  const result = await externalizeStudioDocumentAssets({ ownerUserId: 'owner', documentId: 'doc', document });
  expect(result.uploadedAssetIds).toContain(createHash('sha256').update(bytes).digest('hex'));
  expect(mocks.upload).toHaveBeenCalledWith(expect.any(String), bytes, expect.objectContaining({ contentType: 'image/png' }));
});
it('does not save a reference that only the browser can resolve', async () => {
  const document = createProjectScaleFixture(100);
  document.customAssets['cardforge-maker-custom-images'].push({ id: 'browser-fixture', name: 'fixture', kind: 'image', url: `cardforge-browser-asset://${'a'.repeat(64)}`, tileMode: 'contain', seamless: false, allowedTargets: ['image'] });
  mocks.upload.mockReset();
  await expect(externalizeStudioDocumentAssets({ ownerUserId: 'owner', documentId: 'doc', document })).rejects.toThrow('only available in its original workspace');
  expect(mocks.upload).not.toHaveBeenCalled();
});
it('recognizes a previously uploaded object only when its length, format and digest match', async () => {
  const bytes = Buffer.from('private original');
  const digest = createHash('sha256').update(bytes).digest('hex');
  mocks.download.mockResolvedValue({ data: new Blob([bytes], { type: 'image/png' }), error: null });
  expect(await verifyPrivateStudioAsset('owner', 'doc', digest, 'image/png', bytes.length)).toBe(true);
  expect(await verifyPrivateStudioAsset('owner', 'doc', digest, 'image/png', bytes.length + 1)).toBe(false);
  expect(await verifyPrivateStudioAsset('owner', 'doc', 'b'.repeat(64), 'image/png', bytes.length)).toBe(false);
  expect(await verifyPrivateStudioAsset('owner', 'doc', digest, 'image/jpeg', bytes.length)).toBe(false);
  mocks.signedUpload.mockReset();
  expect(await preparePrivateStudioAssetUpload({ ownerUserId: 'owner', documentId: 'doc', id: digest, mimeType: 'image/png', size: bytes.length })).toEqual({ alreadyPresent: true, signedUrl: null });
  expect(mocks.signedUpload).not.toHaveBeenCalled();
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
