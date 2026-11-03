import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const f = vi.hoisted(() => ({ get: vi.fn(), account: vi.fn(), assets: vi.fn() }));
vi.mock('@/features/studio-documents/server', async (original) => ({ ...await original<object>(), getStudioDocument: f.get, getCurrentStudioDocumentAccount: f.account, getStudioDocumentAssetDownloads: f.assets }));
import { GET } from '@/app/api/studio-documents/[documentId]/route';
const id = 'a2393740-a748-42cc-a942-1aa7c16641db';
const intent = { documentId: id, revision: 2, setId: 'set', cardIds: ['b','a'], paper: 'A4 (210×297 mm)', marginMm: 5, spacingMm: 0, cutLines: false, duplex: 'same-page', mode: 'virtual', quality: 150 };
const raw = { cardSets: [{ id: 'set' }], storedCards: [{ uniqueId: 'a', setId: 'set', templateId: 'front', data: {} }, { uniqueId: 'b', setId: 'set', templateId: 'front', data: {}, backingTemplateId: 'back', backingData: {} }], userTemplates: [{ id: 'front' }, { id: 'back', templateUsage: 'back-preset' }] };
const context = { params: Promise.resolve({ documentId: id }) };
const req = (value: unknown, revision = '2') => new Request(`https://cardforge.test/api/studio-documents/${id}?${new URLSearchParams({ revision, outputIntent: JSON.stringify(value) })}`);
beforeEach(() => { vi.clearAllMocks(); f.account.mockResolvedValue({ ownerUserId: 'account', retentionHours: 24 }); f.assets.mockResolvedValue([]); f.get.mockImplementation(async (_owner, _id, _retention, check) => { check(raw); return { revision: 2, document: raw }; }); });
it('validates raw exact Set and cards before returning the document', async () => {
 const response = await GET(req(intent), context); expect(response.status).toBe(200); expect(f.get).toHaveBeenCalledOnce(); expect(f.assets).toHaveBeenCalledOnce();
});
it('rejects invalid intent, stale revision and missing back before returning assets', async () => {
 expect((await GET(req({ ...intent, revision: undefined }), context)).status).toBe(400); expect(f.get).not.toHaveBeenCalled();
 f.get.mockImplementationOnce(async (_owner, _id, _retention, check) => { check(raw); return { revision: 3, document: raw }; });
 expect((await GET(req(intent), context)).status).toBe(409);
 f.get.mockImplementationOnce(async (_owner, _id, _retention, check) => { check({ ...raw, userTemplates: [{ id: 'front' }] }); return { revision: 2, document: raw }; });
 expect((await GET(req(intent), context)).status).toBe(409); expect(f.assets).not.toHaveBeenCalled();
});
