import { createHash } from 'node:crypto';
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const f = vi.hoisted(() => ({ row: null as Record<string, unknown> | null, filters: [] as Array<[string, unknown]>, error: null as unknown, rpc: vi.fn() }));
vi.mock('@/infrastructure/database/supabaseServer', () => ({ getSupabaseServerClient: () => ({ rpc: f.rpc, from: () => { const q = { select: () => q, eq: (key: string, value: unknown) => { f.filters.push([key, value]); return q; }, gt: (key: string, value: unknown) => { f.filters.push([key, value]); return q; }, maybeSingle: async () => ({ data: f.row, error: f.error }) }; return q; } }) }));
import { createStudioOutputIntent, readStudioOutputIntent } from '@/features/studio-documents/server/studioDocumentStore';
import { outputIntentSchema } from '@/features/studio-documents/outputIntent';
const documentId = 'a2393740-a748-42cc-a942-1aa7c16641db';
const reference = '10000000-0000-4000-8000-000000000001';
const intent = outputIntentSchema.parse({ documentId, revision: 2, setId: 'set', cardIds: ['b','a'], paper: 'A4 (210×297 mm)', marginMm: 5, spacingMm: 0, cutLines: false, duplex: 'same-page', mode: 'virtual', quality: 150 });
beforeEach(() => { vi.clearAllMocks(); f.filters = []; f.error = null; f.row = { document_id: documentId, document_revision: 2, intent, fingerprint: createHash('sha256').update(JSON.stringify(intent)).digest('hex') }; f.rpc.mockResolvedValue({ data: reference, error: null }); });
it('creates metadata through the exact actor and revision RPC and resolves only through owner, document and expiry filters', async () => {
 expect(await createStudioOutputIntent('owner', intent)).toBe(reference);
 expect(f.rpc).toHaveBeenCalledExactlyOnceWith('cardforge_prepare_studio_output_intent', expect.objectContaining({ p_owner_user_id: 'owner', p_document_id: documentId, p_revision: 2, p_intent: intent }));
 expect(await readStudioOutputIntent('owner', documentId, reference)).toEqual(intent);
 expect(f.filters).toEqual(expect.arrayContaining([['id', reference], ['owner_user_id', 'owner'], ['document_id', documentId], ['expires_at', expect.any(String)]]));
});
it('distinguishes absence, unavailable storage, changed metadata and uncertain creation', async () => {
 f.row = null; await expect(readStudioOutputIntent('owner', documentId, reference)).rejects.toMatchObject({ status: 404 });
 f.error = new Error('unavailable'); await expect(readStudioOutputIntent('owner', documentId, reference)).rejects.toMatchObject({ status: 503 });
 f.error = null; f.row = { document_id: documentId, document_revision: 2, intent, fingerprint: 'f'.repeat(64) }; await expect(readStudioOutputIntent('owner', documentId, reference)).rejects.toMatchObject({ status: 503 });
 f.rpc.mockResolvedValueOnce({ data: null, error: null }); await expect(createStudioOutputIntent('owner', intent)).rejects.toMatchObject({ status: 409 });
 f.rpc.mockResolvedValueOnce({ data: null, error: new Error('transport') }); await expect(createStudioOutputIntent('owner', intent)).rejects.toMatchObject({ status: 503, message: expect.stringContaining('do not automatically retry') });
});
