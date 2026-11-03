import { createHash } from 'node:crypto';
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const f = vi.hoisted(() => ({ account: vi.fn(), oauth: vi.fn(), rpc: vi.fn(), activity: vi.fn(), download: vi.fn(), copy: vi.fn(), remove: vi.fn(), row: null as Record<string, unknown> | null, readFailure: false, postReadFailure: false, lostAck: false, references: [] as unknown[], filters: [] as Array<[string, unknown]> }));
vi.mock('@clerk/nextjs/server', () => ({ auth: f.oauth }));
vi.mock('@/features/account/server', async original => ({ ...await original<object>(), getAccountToolAccessForUserId: f.account }));
vi.mock('@/features/owner/server/ownerActivityStore', () => ({ recordOwnerActivity: f.activity }));
vi.mock('@/features/owner/server', async original => ({ ...await original<object>(), getCurrentOwnerAccess: async () => ({ userId: 'owner', isOwner: true, email: 'owner@example.invalid' }) }));
vi.mock('@/features/mcp-usage/server', async original => ({ ...await original<object>(), observeMcpToolExecution: ({ execute }: { execute: () => unknown }) => execute() }));
vi.mock('@/infrastructure/database/supabaseServer', () => ({ getSupabaseServerConfigStatus: () => ({ configured: true }), getSupabaseServerClient: () => ({ rpc: f.rpc, from: () => {
  const filters: Array<[string, unknown]> = [];
  const q = { select: () => q, eq: (key: string, value: unknown) => { filters.push([key, value]); return q; }, not: () => q,
    maybeSingle: async () => { f.filters.push(...filters); return f.readFailure || f.postReadFailure && f.row ? { data: null, error: { message: 'receipt unavailable' } } : { data: f.row, error: null }; },
    limit: async () => ({ data: f.references, error: null }),
  }; return q;
}, storage: { from: () => ({ download: f.download, copy: f.copy, remove: f.remove, getPublicUrl: (path: string) => ({ data: { publicUrl: `https://example.invalid/${path}` } }) }) } }) }));
import { getOwnerMediaRevisionBase, getOwnerMediaRevisionReceipt, createOwnerMediaRevision } from '@/features/owner/server/ownerMediaRevisionCommands';
import { cardForgeOwnerMcpHandler } from '@/features/owner/server/mcpOwnerServer';
import { GET, POST } from '@/app/api/owner/pipeline/media-revisions/route';
const source = '<svg viewBox="0 0 20 20"><path d="M0 0h20v20H0z"/></svg>';
const sha = createHash('sha256').update(source).digest('hex');
const base = { assetId: 'native-texture', name: 'Original texture', parentSubmissionId: '63300e01-8d07-4f22-8221-a56de17221e5', lineageId: '0ba353d7-5deb-4dbe-8c9a-159ddb509155', baseRevisionNumber: 1, baseVersion: 'a'.repeat(32), registryVersion: 'b'.repeat(32), intendedAccessTier: 'free', baseline: { tileMode: 'repeat', seamless: true }, sourceBucket: 'pipeline', sourcePath: 'original.svg', sourceUrl: 'https://example.invalid/original.svg', sourceMimeType: 'image/svg+xml', sourceSize: Buffer.byteLength(source) };
const presentation = { schemaVersion: 1, parentSubmissionId: base.parentSubmissionId, lineageId: base.lineageId, baseRevisionNumber: 1, baseVersion: base.baseVersion, registryVersion: base.registryVersion, intendedAccessTier: 'free', sourceSha256: sha, baseline: base.baseline, proposed: { tileMode: 'contain', seamless: false } };
const input = () => structuredClone({ assetId: base.assetId, submissionKey: '95d641b4-8c9d-4bf3-8292-17319118be1e', presentation });
beforeEach(() => {
  vi.resetAllMocks(); f.row = null; f.readFailure = false; f.postReadFailure = false; f.lostAck = false; f.references = []; f.filters = [];
  f.oauth.mockResolvedValue({ userId: 'oauth-owner' }); f.account.mockResolvedValue({ user: { id: 'owner' }, isOwner: true, email: 'owner@example.invalid' }); f.activity.mockResolvedValue(true);
  f.download.mockResolvedValue({ data: new Blob([source], { type: 'image/svg+xml' }), error: null }); f.copy.mockResolvedValue({ error: null }); f.remove.mockResolvedValue({ error: null });
  f.rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
    if (name === 'cardforge_read_media_revision_base') return { data: base, error: null };
    if (name === 'cardforge_create_media_presentation_revision') {
      f.row = { id: args.p_candidate_id, target_registry_asset_id: args.p_asset_id, submission_key: args.p_submission_key, revision_number: 4, status: 'submitted', editorial_review_status: 'pending', media_presentation: args.p_presentation, source_storage_bucket: 'pipeline', source_storage_path: args.p_source_path, trashed_at: null, purge_state: null };
      if (f.lostAck) throw new Error('ack lost'); return { data: args.p_candidate_id, error: null };
    }
    throw new Error(name);
  });
});
it('reads and hashes exact managed source without copying or allocating, with no server-only path metadata', async () => {
  const result = await getOwnerMediaRevisionBase('owner', { assetId: base.assetId });
  expect(result).toMatchObject({ assetId: base.assetId, presentation: { ...presentation, proposed: base.baseline } });
  expect(result).not.toHaveProperty('sourceBucket'); expect(result).not.toHaveProperty('sourcePath'); expect(f.download).toHaveBeenCalledExactlyOnceWith(base.sourcePath); expect(f.copy).not.toHaveBeenCalled();
});
it('successful absent receipt read performs no RPC/download/copy/remove/activity and preserves asset/key binding', async () => {
  expect(await getOwnerMediaRevisionReceipt('owner', input())).toEqual({ assetId: base.assetId, submissionKey: input().submissionKey, receipt: null });
  expect(f.filters).toEqual([['target_registry_asset_id', base.assetId], ['submission_key', input().submissionKey]]);
  expect(f.rpc).not.toHaveBeenCalled(); expect(f.download).not.toHaveBeenCalled(); expect(f.copy).not.toHaveBeenCalled(); expect(f.remove).not.toHaveBeenCalled(); expect(f.activity).not.toHaveBeenCalled();
});
it('reuses the same asset/key/presentation receipt without download/copy even for another authorized Owner identity', async () => {
  const first = await createOwnerMediaRevision('owner', input()); expect(first).toMatchObject({ committed: true, reused: false, cleanupPending: false, receipt: { status: 'submitted', editorialReviewStatus: 'pending' } });
  f.download.mockClear(); f.copy.mockClear(); f.rpc.mockClear(); f.account.mockResolvedValue({ user: { id: 'another-owner' }, isOwner: true });
  expect(await createOwnerMediaRevision('another-owner', input())).toMatchObject({ committed: true, reused: true, receipt: first.receipt });
  expect(f.download).not.toHaveBeenCalled(); expect(f.copy).not.toHaveBeenCalled(); expect(f.rpc).not.toHaveBeenCalled();
  const observed = await getOwnerMediaRevisionReceipt('another-owner', input()); expect(observed.receipt).toEqual(first.receipt); expect(JSON.stringify(observed)).not.toContain('source_storage');
});
for (const field of ['parentSubmissionId','lineageId','baseRevisionNumber','baseVersion','registryVersion','intendedAccessTier','sourceSha256'] as const) it(`rejects changed base ${field} before copying`, async () => {
  const request = input(); Object.assign(request.presentation, { [field]: field.endsWith('Id') ? 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' : field === 'baseRevisionNumber' ? 2 : field === 'intendedAccessTier' ? 'paid' : 'c'.repeat(field === 'sourceSha256' ? 64 : 32) });
  await expect(createOwnerMediaRevision('owner', request)).rejects.toMatchObject({ status: 409 }); expect(f.copy).not.toHaveBeenCalled();
});
for (const extra of [{ candidateId: 'forged' }, { sourceBucket: 'other' }, { sourcePath: 'other' }, { sourceMimeType: 'image/png' }, { sourceSize: 1 }, { revisionHighWater: 9 }, { actorId: 'another' }]) it(`rejects caller-owned server metadata ${Object.keys(extra)[0]}`, async () => {
  await expect(createOwnerMediaRevision('owner', { ...input(), ...extra })).rejects.toMatchObject({ status: 400 }); expect(f.rpc).not.toHaveBeenCalled(); expect(f.copy).not.toHaveBeenCalled();
});
for (const failure of ['unavailable', 'malformed', 'identity', 'presentation', 'trashed'] as const) it(`receipt ${failure} is never fabricated as absence`, async () => {
  await createOwnerMediaRevision('owner', input()); f.rpc.mockClear(); f.copy.mockClear(); f.download.mockClear(); f.remove.mockClear();
  if (failure === 'unavailable') f.readFailure = true;
  if (failure === 'malformed') f.row!.revision_number = 'unknown';
  if (failure === 'identity') f.row!.target_registry_asset_id = 'sibling';
  if (failure === 'presentation') f.row!.media_presentation = { ...presentation, proposed: { tileMode: 'stretch', seamless: false } };
  if (failure === 'trashed') f.row!.trashed_at = '2026-11-02T00:00:00Z';
  await expect(getOwnerMediaRevisionReceipt('owner', input())).rejects.toMatchObject({ status: failure === 'presentation' || failure === 'trashed' ? 409 : 503 });
  expect(f.rpc).not.toHaveBeenCalled(); expect(f.copy).not.toHaveBeenCalled(); expect(f.download).not.toHaveBeenCalled(); expect(f.remove).not.toHaveBeenCalled();
});
for (const activity of ['false','reject'] as const) it(`confirmed receipt remains committed after activity ${activity} in actual browser route`, async () => {
  if (activity === 'false') f.activity.mockResolvedValue(false); else f.activity.mockRejectedValue(new Error('audit failed'));
  const response = await POST(new Request('https://cardforge.test', { method: 'POST', body: JSON.stringify(input()) }));
  expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ committed: true, outcome: 'committed', activityRecorded: false, warnings: [expect.stringContaining('activity recording is incomplete')], receipt: { status: 'submitted' } }); expect(f.copy).toHaveBeenCalledOnce();
});
it('lost native ACK can be confirmed by authoritative receipt without another copy', async () => {
  f.lostAck = true; expect(await createOwnerMediaRevision('owner', input())).toMatchObject({ outcome: 'committed', committed: true }); expect(f.copy).toHaveBeenCalledOnce(); expect(f.remove).not.toHaveBeenCalled();
});
it('unknown commit with unreadable receipt retains bytes and uses receipt-only reconciliation', async () => {
  f.lostAck = true; f.postReadFailure = true;
  const response = await POST(new Request('https://cardforge.test', { method: 'POST', body: JSON.stringify(input()) }));
  expect(response.status).toBe(503); expect(await response.json()).toMatchObject({ outcome: 'uncertain', committed: null, receipt: null, cleanupPending: null, retryable: false, nextAction: 'read', error: { retryable: false } });
  expect(f.remove).not.toHaveBeenCalled(); expect(f.activity).not.toHaveBeenCalled(); const copied = f.copy.mock.calls.length, downloads = f.download.mock.calls.length;
  f.postReadFailure = false; const params = new URLSearchParams({ assetId: base.assetId, submissionKey: input().submissionKey, presentation: JSON.stringify(presentation) });
  const observed = await GET(new Request(`https://cardforge.test?${params}`)); expect(observed.status).toBe(200); expect(await observed.json()).toMatchObject({ receipt: { status: 'submitted' } }); expect(f.copy).toHaveBeenCalledTimes(copied); expect(f.download).toHaveBeenCalledTimes(downloads); expect(f.remove).not.toHaveBeenCalled();
});
it('Owner command denies every read/create before provider access for non-Owners', async () => {
  f.account.mockResolvedValue({ user: { id: 'contributor' }, isOwner: false });
  for (const operation of [() => getOwnerMediaRevisionBase('contributor', { assetId: base.assetId }), () => getOwnerMediaRevisionReceipt('contributor', input()), () => createOwnerMediaRevision('contributor', input())]) await expect(operation()).rejects.toMatchObject({ status: 403 });
  expect(f.rpc).not.toHaveBeenCalled(); expect(f.copy).not.toHaveBeenCalled(); expect(f.filters).toEqual([]);
});
const http = async (id: number, method: string, params: object) => {
  const response = await cardForgeOwnerMcpHandler(new Request('https://cardforge.test/mcp/owner', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id, method, params }) }));
  const text = await response.text(); return { status: response.status, body: JSON.parse(text.startsWith('event:') ? text.split('data: ')[1].split('\n')[0] : text) };
};
it('initialized real HTTP exposes 57 Owner tools and calls the exact three media adapters', async () => {
  expect((await http(1, 'initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'test', version: '1' } })).body.result.serverInfo).toEqual({ name: 'cardforge-owner', version: '1.17.0' });
  const tools = (await http(2, 'tools/list', {})).body.result.tools; expect(tools).toHaveLength(57);
  const tool = tools.find((entry: { name: string }) => entry.name === 'create_pipeline_media_presentation_revision'); expect(tool.inputSchema.required).toEqual(expect.arrayContaining(['assetId','submissionKey','presentation'])); expect(tool.inputSchema.additionalProperties).toBe(false); expect(tool.inputSchema.properties.presentation.properties).not.toHaveProperty('revisionHighWater'); expect(tool.annotations.readOnlyHint).toBe(false);
  expect((await http(3, 'tools/call', { name: 'get_pipeline_media_presentation_base', arguments: { assetId: base.assetId } })).body.result.structuredContent.presentation.sourceSha256).toBe(sha);
  expect((await http(4, 'tools/call', { name: 'get_pipeline_media_presentation_receipt', arguments: input() })).body.result.structuredContent.receipt).toBeNull();
  expect((await http(5, 'tools/call', { name: 'create_pipeline_media_presentation_revision', arguments: input() })).body.result.structuredContent).toMatchObject({ outcome: 'committed', committed: true });
});
it('actual HTTP denies non-Owner discovery/call and revoked role without copy', async () => {
  f.account.mockResolvedValue({ user: { id: 'other' }, isOwner: false }); expect((await http(1, 'tools/list', {})).status).toBe(403); expect((await http(2, 'tools/call', { name: 'create_pipeline_media_presentation_revision', arguments: input() })).status).toBe(403);
  f.account.mockResolvedValueOnce({ user: { id: 'owner' }, isOwner: true }).mockResolvedValueOnce({ user: { id: 'owner' }, isOwner: true }).mockResolvedValueOnce({ user: { id: 'other' }, isOwner: false }); expect((await http(3, 'tools/call', { name: 'create_pipeline_media_presentation_revision', arguments: input() })).body.result.isError).toBe(true); expect(f.copy).not.toHaveBeenCalled();
});
it('actual HTTP carries unknown outcome and no retry authority without deleting bytes', async () => {
  f.lostAck = true; f.postReadFailure = true; const result = (await http(1, 'tools/call', { name: 'create_pipeline_media_presentation_revision', arguments: input() })).body.result;
  expect(result.isError).toBe(true); expect(result.structuredContent).toMatchObject({ committed: null, outcome: 'uncertain', cleanupPending: null, retryable: false }); expect(f.remove).not.toHaveBeenCalled();
});
