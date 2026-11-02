import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const f = vi.hoisted(() => ({ access: vi.fn(), result: undefined as unknown, count: 0 as number | null, error: false, lost: false, reads: 0, deletes: 0, queries: [] as unknown[][], telemetry: vi.fn() }));
vi.mock('@/features/studio-documents/server/mcpStudioAccess', () => ({ getMcpStudioReadAccess: f.access, getMcpStudioAccess: () => { throw new Error('No profile enrollment'); } }));
vi.mock('@/features/account/server', async original => ({ ...await original<object>(), getCurrentCardforgeEntitlement: async () => (await f.access()).entitlement }));
vi.mock('@/features/mcp-usage/server', async original => ({ ...await original<object>(), observeMcpToolExecution: async ({ execute }: { execute: () => Promise<unknown> }) => { const result = await execute(); try { await f.telemetry(); } catch { /* actual wrapper fails open */ } return result; } }));
vi.mock('@/infrastructure/database/supabaseServer', () => ({ getSupabaseServerClient: () => ({ from: (table: string) => {
  f.queries.push(['from', table]); let write = false;
  const q = { select: (columns: string) => { f.queries.push(['select', columns]); return q; }, eq: (key: string, value: unknown) => { f.queries.push(['eq', key, value]); return q; }, order: () => q, limit: () => q, then: (resolve: (value: unknown) => unknown) => { if (f.lost) return Promise.reject(new Error('Lost response')); return Promise.resolve({ data: f.result, error: f.error ? { message: 'private database detail' } : null, count: f.count }).then(resolve); }, delete: () => { write = true; f.deletes++; return q; }, maybeSingle: async () => { if (!write) f.reads++; if (f.lost) throw new Error('Lost response'); return { data: f.result, error: f.error ? { message: 'private database detail' } : null }; } }; return q;
} }) }));
import { getPersonalLibraryItem, listPersonalLibraryItems, removePersonalLibraryItem } from '@/features/personal-library/server/personalLibraryStore';
import { PERSONAL_LIBRARY_REMOVAL_NOTICE } from '@/features/personal-library/itemContract';
import { cardForgeMcpHandler } from '@/features/studio-documents/server/mcpServer';
import { GET as listGet } from '@/app/api/personal-library/route';
import { GET, DELETE } from '@/app/api/personal-library/[itemId]/route';
const id = '10000000-0000-4000-8000-000000000001', other = '20000000-0000-4000-8000-000000000001';
const input = { itemId: id, confirmation: { itemId: id, notice: PERSONAL_LIBRARY_REMOVAL_NOTICE } };
const metadata = () => ({ id, owner_user_id: 'linked-account', provider: 'google-drive', display_name: 'Synthetic artwork', asset_role: 'artwork', mime_type: 'image/png', byte_size: '100', provider_revision: 'v1', content_hash: null, provider_resource_key: 'private-key', provider_file_id: 'private-file', provider_modified_at: '2026-11-02T00:00:00+00:00', provider_web_view_link: null, last_verified_at: '2026-11-02T00:00:00+00:00', created_at: '2026-11-02T00:00:00+00:00', updated_at: '2026-11-02T00:00:00+00:00' });
beforeEach(() => { vi.clearAllMocks(); f.result = metadata(); f.count = 1; f.error = false; f.lost = false; f.reads = 0; f.deletes = 0; f.queries = []; f.access.mockResolvedValue({ user: { id: 'oauth-identity' }, entitlement: { isSignedIn: true, accountUserId: 'linked-account' } }); });
it('reads exact linked-account scoped metadata without provider fields or bytes', async () => {
  const result = await getPersonalLibraryItem('linked-account', id);
  expect(result.item).toMatchObject({ itemId: id, byteSize: 100, providerRevision: 'v1' });
  expect(JSON.stringify(result)).not.toMatch(/private-key|private-file|owner_user_id|linked-account/);
  expect(f.queries).toContainEqual(['eq', 'owner_user_id', 'linked-account']); expect(f.deletes).toBe(0);
});
it('null alone means absent; malformed/wrong-scope/wrong-target/error are unavailable', async () => {
  f.result = null; expect(await getPersonalLibraryItem('linked-account', id)).toEqual({ itemId: id, item: null });
  for (const bad of [undefined, {}, { ...metadata(), id: other }, { ...metadata(), owner_user_id: 'other' }, { ...metadata(), byte_size: 'NaN' }]) { f.result = bad; await expect(getPersonalLibraryItem('linked-account', id)).rejects.toMatchObject({ status: 503 }); }
  f.result = null; f.error = true; await expect(getPersonalLibraryItem('linked-account', id)).rejects.toMatchObject({ status: 503 });
});
it('requires target-bound explicit consequences before any DELETE', async () => {
  for (const value of [{ itemId: id }, { ...input, confirmation: { ...input.confirmation, itemId: other } }, { ...input, confirmation: { itemId: id, notice: 'Delete' } }, { ...input, ownerUserId: 'other' }]) await expect(removePersonalLibraryItem('linked-account', value)).rejects.toMatchObject({ status: 400 });
  expect(f.deletes).toBe(0);
});
it('claims commit only for exact affected UUID and preserves scope', async () => {
  f.result = { id }; expect(await removePersonalLibraryItem('linked-account', input)).toMatchObject({ outcome: 'removed', committed: true });
  expect(f.queries).toContainEqual(['eq', 'owner_user_id', 'linked-account']); expect(f.deletes).toBe(1); expect(f.reads).toBe(0);
});
it('absent is not prior operation causation; malformed/lost/error ACK remains uncertain without replay', async () => {
  f.result = null; expect(await removePersonalLibraryItem('linked-account', input)).toMatchObject({ outcome: 'absent', committed: false });
  for (const ack of [undefined, {}, { id: other }, true]) { f.result = ack; expect(await removePersonalLibraryItem('linked-account', input)).toMatchObject({ outcome: 'uncertain', committed: null, retryable: false }); }
  f.result = { id }; f.error = true; expect(await removePersonalLibraryItem('linked-account', input)).toMatchObject({ outcome: 'uncertain' });
  f.error = false; f.lost = true; const before = f.deletes; expect(await removePersonalLibraryItem('linked-account', input)).toMatchObject({ outcome: 'uncertain' }); expect(f.deletes).toBe(before + 1);
});
const http = async (id: number, method: string, params: object) => {
  const response = await cardForgeMcpHandler(new Request('https://cardforge.test/mcp', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id, method, params }) }));
  const text = await response.text(); return JSON.parse(text.startsWith('event:') ? text.split('\n').find(line => line.startsWith('data: '))!.slice(6) : text);
};
it('initialized actual HTTP exposes strict two-tool schemas and executes account-scoped read/removal', async () => {
  expect((await http(1, 'initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'test', version: '1' } })).result.serverInfo.version).toBe('1.0.14');
  const tools = (await http(2, 'tools/list', {})).result.tools; expect(tools).toHaveLength(57);
  for (const name of ['get_personal_library_item', 'remove_personal_library_item']) { const tool = tools.find((t: { name: string }) => t.name === name); expect(tool.inputSchema.additionalProperties).toBe(false); expect(tool.outputSchema.additionalProperties).toBe(false); }
  expect((await http(3, 'tools/call', { name: 'get_personal_library_item', arguments: { itemId: id } })).result.structuredContent.item.itemId).toBe(id);
  f.result = { id }; f.telemetry.mockRejectedValueOnce(new Error('Usage unavailable'));
  expect((await http(4, 'tools/call', { name: 'remove_personal_library_item', arguments: input })).result.structuredContent).toMatchObject({ committed: true });
  expect(f.deletes).toBe(1); expect(f.queries).toContainEqual(['eq', 'owner_user_id', 'linked-account']);
});
it('actual HTTP rejects missing account and forged authority before product query', async () => {
  f.access.mockResolvedValue({ user: { id: 'oauth' }, entitlement: { isSignedIn: true, accountUserId: null } });
  expect((await http(1, 'tools/call', { name: 'get_personal_library_item', arguments: { itemId: id } })).result.isError).toBe(true); expect(f.queries).toEqual([]);
  f.access.mockResolvedValue({ user: { id: 'oauth' }, entitlement: { isSignedIn: true, accountUserId: 'linked-account' } });
  expect((await http(2, 'tools/call', { name: 'remove_personal_library_item', arguments: { ...input, accountUserId: 'other' } })).result.isError).toBe(true); expect(f.deletes).toBe(0);
});
it('browser API preserves 204 only for exact commit, exact GET and uncertain/absent receipts', async () => {
  const ctx = { params: Promise.resolve({ itemId: id }) };
  expect((await GET(new Request('https://cardforge.test'), ctx)).status).toBe(200);
  const request = () => new Request('https://cardforge.test', { method: 'DELETE', body: JSON.stringify({ confirmation: input.confirmation }) });
  f.result = { id }; expect((await DELETE(request(), ctx)).status).toBe(204);
  f.result = null; expect((await DELETE(request(), ctx)).status).toBe(404);
  f.lost = true; const result = await DELETE(request(), ctx); expect(result.status).toBe(503); expect(await result.json()).toMatchObject({ receipt: { committed: null, retryable: false } });
});

it('shared list and actual HTTP search preserve genuine empty and valid stored zero/Unicode metadata', async () => {
  f.result = []; f.count = 0; expect(await listPersonalLibraryItems('linked-account')).toMatchObject({ items: [], count: 0 });
  expect((await http(1, 'tools/call', { name: 'search_personal_library', arguments: {} })).result.structuredContent).toMatchObject({ items: [], count: 0 });
  f.result = [{ ...metadata(), display_name: '😀'.repeat(320), byte_size: '0', provider_revision: '\t', provider_modified_at: 'infinity' }]; f.count = 1;
  expect((await listPersonalLibraryItems('linked-account')).items[0]).toMatchObject({ byteSize: 0, displayName: '😀'.repeat(320), providerModifiedAt: 'infinity' });
  const result = (await http(2, 'tools/call', { name: 'search_personal_library', arguments: {} })).result;
  expect(result.isError).not.toBe(true); expect(result.structuredContent.items[0].byteSize).toBe(0); expect(JSON.stringify(result)).not.toContain('private-key');
});
it('list/search fail unavailable rather than empty or filtering malformed/wrong-scope rows', async () => {
  for (const bad of [null, undefined, {}, [metadata(), { ...metadata(), id: other, owner_user_id: 'other' }], [{ ...metadata(), byte_size: 'bad' }], [{ ...metadata(), created_at: null }], [{ ...metadata(), display_name: 'a'.repeat(319) + ' \n' }]]) {
    f.result = bad; f.count = Array.isArray(bad) ? bad.length : 0;
    await expect(listPersonalLibraryItems('linked-account')).rejects.toMatchObject({ status: 503 });
    expect((await http(3, 'tools/call', { name: 'search_personal_library', arguments: {} })).result.isError).toBe(true);
  }
  f.result = []; f.count = 0; f.error = true; await expect(listPersonalLibraryItems('linked-account')).rejects.toMatchObject({ status: 503 });
});
it('list rejects unavailable/contradictory counts and duplicate exact identities', async () => {
  f.result = [metadata()];
  for (const count of [null, -1, 0, 2, 1.5]) { f.count = count; await expect(listPersonalLibraryItems('linked-account')).rejects.toMatchObject({ status: 503 }); }
  f.result = [metadata(), metadata()]; f.count = 2; await expect(listPersonalLibraryItems('linked-account')).rejects.toMatchObject({ status: 503 });
});

it('browser list API uses the same strict projection as search without hiding unavailable data', async () => {
  f.result = []; f.count = 0; const empty = await listGet(); expect(empty.status).toBe(200); expect(await empty.json()).toMatchObject({ items: [], count: 0 });
  f.result = null; const unavailable = await listGet(); expect(unavailable.status).toBe(503); expect(await unavailable.json()).toMatchObject({ error: { kind: 'unavailable' } });
  f.result = [{ ...metadata(), owner_user_id: 'other-account' }]; f.count = 1; expect((await listGet()).status).toBe(503);
});
