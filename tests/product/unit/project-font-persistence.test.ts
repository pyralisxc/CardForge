import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { BROWSER_STORAGE_DATABASE, createIndexedDbStorage } from '@/features/project/persistence/indexedDbStorage';
import { setProjectPersistenceScope } from '@/features/project/persistence/projectPersistenceScope';
import { readProjectFonts, removeProjectFont, upsertProjectFont, writeProjectFonts } from '@/features/project/persistence/projectFonts';
import { CUSTOM_FONT_ASSETS_STORAGE_KEY } from '@/features/project/model/projectDocument';
import { getProjectFontValue, type ProjectFontAsset } from '@/features/project/model/projectFont';

const font = (id: string): ProjectFontAsset => ({ id, name: id, value: getProjectFontValue(id),
  mimeType: 'font/woff2', fileSizeBytes: 1, dataUrl: `cardforge-browser-asset://${'a'.repeat(64)}` });
const storage = (id: string) => createIndexedDbStorage(`project-assets:account:${id}`);
const read = async (id: string) => JSON.parse((await storage(id).getItem(CUSTOM_FONT_ASSETS_STORAGE_KEY))!);
beforeEach(async () => {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(BROWSER_STORAGE_DATABASE);
    request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
  });
  setProjectPersistenceScope('account:font-a');
});

describe('font catalog transaction ownership', () => {
  it.each(['upsert', 'remove', 'replace'] as const)('rejects a queued %s after switching accounts and preserves both catalogs', async (operation) => {
    const a = [font('existing-font-a')]; const b = [font('existing-font-b')];
    await storage('font-a').setItem(CUSTOM_FONT_ASSETS_STORAGE_KEY, JSON.stringify(a));
    await storage('font-b').setItem(CUSTOM_FONT_ASSETS_STORAGE_KEY, JSON.stringify(b));
    const pending = operation === 'upsert' ? upsertProjectFont(font('incoming-font'))
      : operation === 'remove' ? removeProjectFont(a[0].id) : writeProjectFonts([font('replacement-font')]);
    setProjectPersistenceScope('account:font-b');
    await expect(pending).rejects.toThrow('account changed');
    expect(await read('font-a')).toEqual(a);
    expect(await read('font-b')).toEqual(b);
  });

  it('preserves both concurrent additions to the same account', async () => {
    await Promise.all([upsertProjectFont(font('concurrent-font-a')), upsertProjectFont(font('concurrent-font-b'))]);
    expect((await read('font-a')).map((item: ProjectFontAsset) => item.id).sort()).toEqual(['concurrent-font-a', 'concurrent-font-b']);
  });

  it('preserves unreadable authored font entries on mutation', async () => {
    const raw = JSON.stringify([{ id: 'unreadable-font', name: 'Keep original data' }]);
    await storage('font-a').setItem(CUSTOM_FONT_ASSETS_STORAGE_KEY, raw);
    await expect(upsertProjectFont(font('incoming-font'))).rejects.toThrow('unreadable');
    expect(await storage('font-a').getItem(CUSTOM_FONT_ASSETS_STORAGE_KEY)).toBe(raw);
  });

  it('reports unreadable persisted entries on read without hiding or changing them', async () => {
    const raw = JSON.stringify([font('readable-font'), { id: 'unreadable-font', name: 'Keep original data' }]);
    await storage('font-a').setItem(CUSTOM_FONT_ASSETS_STORAGE_KEY, raw);
    await expect(readProjectFonts()).rejects.toThrow('unreadable');
    expect(await storage('font-a').getItem(CUSTOM_FONT_ASSETS_STORAGE_KEY)).toBe(raw);
  });

  it('rejects a 65th font without truncating the authored catalog', async () => {
    const raw = JSON.stringify(Array.from({ length: 64 }, (_, index) => font(`existing-font-${index}`)));
    await storage('font-a').setItem(CUSTOM_FONT_ASSETS_STORAGE_KEY, raw);
    await expect(upsertProjectFont(font('overflow-font'))).rejects.toThrow('at most 64');
    expect(await storage('font-a').getItem(CUSTOM_FONT_ASSETS_STORAGE_KEY)).toBe(raw);
  });
});
