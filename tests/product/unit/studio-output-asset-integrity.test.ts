import { createHash, webcrypto } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { hydrateStudioDocumentAssetValue } from '@/features/studio-documents/client/studioDocumentAssetHydration';
const bytes = new Uint8Array([1, 2, 3]);
const id = createHash('sha256').update(bytes).digest('hex');
const value = { image: `cardforge-studio-asset://${id}` };
const item = { id, kind: 'image' as const, mimeType: 'image/webp' as const, size: 3, signedUrl: 'https://example.invalid/private' };
afterEach(() => vi.unstubAllGlobals());
it('verifies exact closure, byte length and SHA before replacing a private reference', async () => {
  class SyntheticFileReader { result: string | null = null; onload: (() => void) | null = null; onerror: (() => void) | null = null; error: Error | null = null; readAsDataURL(blob: Blob) { void blob.arrayBuffer().then((value) => { this.result = `data:${blob.type};base64,${Buffer.from(value).toString('base64')}`; this.onload?.(); }); } }
  vi.stubGlobal('FileReader', SyntheticFileReader); vi.stubGlobal('crypto', webcrypto); vi.stubGlobal('fetch', vi.fn(async () => new Response(new Blob([bytes], { type: 'image/webp' }))));
  expect((await hydrateStudioDocumentAssetValue(value, [item], undefined, true)).image).toMatch(/^data:image\/webp;base64,/);
  await expect(hydrateStudioDocumentAssetValue(value, [], undefined, true)).rejects.toThrow('incomplete');
  await expect(hydrateStudioDocumentAssetValue({ image: 'cardforge-studio-asset://invalid' }, [], undefined, true)).rejects.toThrow('reference is invalid');
  await expect(hydrateStudioDocumentAssetValue(value, [item, item], undefined, true)).rejects.toThrow('ambiguous');
  await expect(hydrateStudioDocumentAssetValue(value, [{ ...item, size: 4 }], undefined, true)).rejects.toThrow('byte length');
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new Blob([new Uint8Array([1, 2, 4])], { type: 'image/webp' }))));
  await expect(hydrateStudioDocumentAssetValue(value, [item], undefined, true)).rejects.toThrow('digest');
});
