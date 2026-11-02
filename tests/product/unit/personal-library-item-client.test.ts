import { afterEach, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('@/features/analytics/client/tracking', () => ({ observeProviderBoundaryResponse: (_scope: string, _action: string, request: () => unknown) => request(), trackProviderBoundaryOutcome: f.track }));
vi.mock('@/features/project/client/provider-google-drive', () => ({ pickGoogleDriveItems: vi.fn() }));
import { getPersonalLibraryItem, loadPersonalLibrary, removePersonalLibraryItem } from '@/features/personal-library/client/personalLibraryClient';
import { PERSONAL_LIBRARY_REMOVAL_NOTICE } from '@/features/personal-library/itemContract';
const id = '10000000-0000-4000-8000-000000000001';
afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks(); });
it('captures 204 despite analytics failure and submits exact explicit confirmation', async () => {
 const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 })); vi.stubGlobal('fetch', fetcher); f.track.mockImplementation(() => { throw new Error('Analytics failed'); });
 expect(await removePersonalLibraryItem(id)).toMatchObject({ itemId: id, committed: true, outcome: 'removed' });
 expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ confirmation: { itemId: id, notice: PERSONAL_LIBRARY_REMOVAL_NOTICE } }); expect(fetcher).toHaveBeenCalledOnce();
});
it('lost response never replays; exact subsequent absence remains observation only', async () => {
 const fetcher = vi.fn().mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValueOnce(Response.json({ itemId: id, item: null })); vi.stubGlobal('fetch', fetcher);
 expect(await removePersonalLibraryItem(id)).toMatchObject({ outcome: 'uncertain', committed: null, retryable: false });
 expect(await getPersonalLibraryItem(id)).toEqual({ itemId: id, item: null }); expect(fetcher).toHaveBeenCalledTimes(2); expect(fetcher.mock.calls[1][1].method).toBeUndefined();
});
it('malformed/mismatching/inconsistent ACK never means committed', async () => {
 for (const receipt of [{}, { itemId: '20000000-0000-4000-8000-000000000001', outcome: 'removed', committed: true, retryable: false, message: 'Removed' }, { itemId: id, outcome: 'removed', committed: null, retryable: false, message: 'Removed' }]) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ receipt }, { status: 503 })));
  expect(await removePersonalLibraryItem(id)).toMatchObject({ outcome: 'uncertain', committed: null });
 }
});
it('unavailable or malformed readback never becomes absent', async () => {
 for (const response of [Response.json({ error: { message: 'Unavailable' } }, { status: 503 }), Response.json({}), Response.json({ itemId: '20000000-0000-4000-8000-000000000001', item: null })]) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response)); await expect(getPersonalLibraryItem(id)).rejects.toThrow();
 }
});

it('browser shared list accepts only observed empty and rejects unavailable/malformed payloads', async () => {
 vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ items: [], count: 0, limit: 2000 })));
 expect(await loadPersonalLibrary()).toEqual({ items: [], count: 0, limit: 2000 });
 for (const value of [null, {}, { items: null, count: 0, limit: 2000 }, { items: [], count: 1, limit: 2000 }, { items: [{ id }], count: 1, limit: 2000 }]) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(value))); await expect(loadPersonalLibrary()).rejects.toThrow();
 }
 vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline'))); await expect(loadPersonalLibrary()).rejects.toThrow();
});
