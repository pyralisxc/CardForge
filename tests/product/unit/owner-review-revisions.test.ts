import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const f = vi.hoisted(() => ({ account: vi.fn(), oauth: vi.fn(), rpc: vi.fn(), activity: vi.fn(), rows: {} as Record<string, Record<string, unknown>>, receiptFailure: false, lostAck: false, postReadFailure: false }));
vi.mock('@clerk/nextjs/server', () => ({ auth: f.oauth }));
vi.mock('@/features/account/server', async original => ({ ...await original<object>(), getAccountToolAccessForUserId: f.account }));
vi.mock('@/features/owner/server/ownerActivityStore', () => ({ recordOwnerActivity: f.activity }));
vi.mock('@/features/mcp-usage/server', async original => ({ ...await original<object>(), observeMcpToolExecution: ({ execute }: { execute: () => unknown }) => execute() }));
vi.mock('@/infrastructure/database/supabaseServer', () => ({ getSupabaseServerConfigStatus: () => ({ configured: true }), getSupabaseServerClient: () => ({ rpc: f.rpc }) }));
vi.mock('@/features/owner/server', async original => ({ ...await original<object>(), getCurrentOwnerAccess: async () => ({ userId: 'canonical-owner', isOwner: true, email: 'owner@example.invalid' }) }));
import { createOwnerReviewRevision, getOwnerReviewRevisionBase, getOwnerReviewRevisionReceipt } from '@/features/owner/server/ownerReviewRevisionCommands';
import { cardForgeOwnerMcpHandler } from '@/features/owner/server/mcpOwnerServer';
import { POST as templatePost } from '@/app/api/owner/pipeline/template-revisions/route';
import { POST as stylePost } from '@/app/api/owner/pipeline/style-revisions/route';

const base = { assetId: 'exact-resource', parentSubmissionId: '63300e01-8d07-4f22-8221-a56de17221e5', lineageId: '0ba353d7-5deb-4dbe-8c9a-159ddb509155', baseRevisionNumber: 1, revisionHighWater: 3, parentContentVersion: 'a'.repeat(32), registryContentVersion: 'b'.repeat(32) };
const template = { id: base.assetId, name: 'Original Template', aspectRatio: '63:88', freeformCanvas: { width: 630, height: 880, elements: [] } };
const style = { id: base.assetId, name: 'Original style', kind: 'material', targets: ['shape'], librarySource: 'developer', accessTier: 'free', registryStatus: 'published', contributorName: 'Original author', appearance: { material: { baseColor: '#fff' } } };
const submissionKey = 'saved_review_key_123456789';
const input = (kind: 'template' | 'style') => ({ expectedBase: { ...base }, submissionKey, [kind]: structuredClone(kind === 'template' ? template : style) });
const creates = () => f.rpc.mock.calls.filter(([name]) => String(name).startsWith('cardforge_create_'));
beforeEach(() => {
  vi.resetAllMocks(); f.rows = {}; f.receiptFailure = false; f.lostAck = false; f.postReadFailure = false;
  f.oauth.mockResolvedValue({ userId: 'oauth-owner' }); f.account.mockResolvedValue({ user: { id: 'canonical-owner' }, userId: 'canonical-owner', isOwner: true, email: 'owner@example.invalid' }); f.activity.mockResolvedValue(true);
  f.rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
    const kind = name.includes('template') ? 'template' : 'style';
    if (name.includes('_review_base')) return { data: { expectedBase: base, [kind]: kind === 'template' ? template : style }, error: null };
    const identity = `${kind}:${args.p_actor_id}:${args.p_asset_id}:${args.p_submission_key}`;
    if (name.includes('_review_receipt')) {
      if (f.receiptFailure || f.postReadFailure && f.rows[identity]) return { data: null, error: { message: 'read unavailable' } };
      return { data: f.rows[identity] ?? null, error: null };
    }
    if (name.includes('cardforge_create_')) {
      f.rows[identity] = { id: 'bc615bd7-07b1-460c-9e25-9d3b13b65ed1', assetId: args.p_asset_id, revisionNumber: 4, status: 'submitted', editorialReviewStatus: 'pending', requestFingerprint: args.p_request_fingerprint };
      if (f.lostAck) throw new Error('native acknowledgement lost');
      return { data: f.rows[identity].id, error: null };
    }
    throw new Error(name);
  });
});
for (const kind of ['template', 'style'] as const) {
  it(`${kind}: reads the exact base and actor-bound absent receipt without creating`, async () => {
    expect(await getOwnerReviewRevisionBase('oauth-owner', kind, { assetId: base.assetId })).toMatchObject({ expectedBase: base, [kind]: { id: base.assetId } });
    expect(await getOwnerReviewRevisionReceipt('oauth-owner', kind, { assetId: base.assetId, submissionKey })).toEqual({ receipt: null });
    expect(f.rpc).toHaveBeenLastCalledWith(`cardforge_read_${kind}_review_receipt`, { p_asset_id: base.assetId, p_submission_key: submissionKey, p_actor_id: 'canonical-owner' }); expect(creates()).toHaveLength(0);
  });
  it(`${kind}: preserves native pins/fingerprint/allocation and recovers same key without another creation`, async () => {
    const request = input(kind), first = await createOwnerReviewRevision('oauth-owner', kind, request);
    expect(first).toMatchObject({ outcome: 'committed', committed: true, activityRecorded: true, receipt: { revisionNumber: 4, status: 'submitted', editorialReviewStatus: 'pending' } });
    expect(creates()[0][1]).toMatchObject({ p_expected_base: base, p_asset_id: base.assetId, p_submission_key: submissionKey, p_actor_id: 'canonical-owner', p_request_fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(await createOwnerReviewRevision('oauth-owner', kind, request)).toEqual(first); expect(creates()).toHaveLength(1);
    await expect(createOwnerReviewRevision('oauth-owner', kind, { ...request, [kind]: { ...(kind === 'template' ? template : style), name: 'Changed snapshot' } })).rejects.toMatchObject({ status: 409 }); expect(creates()).toHaveLength(1);
  });
  for (const field of ['parentSubmissionId', 'lineageId', 'baseRevisionNumber', 'revisionHighWater', 'parentContentVersion', 'registryContentVersion'] as const) it(`${kind}: rejects stale ${field} without creation`, async () => {
    const changed = field.endsWith('Id') ? 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' : field.endsWith('Version') ? 'c'.repeat(32) : 9;
    await expect(createOwnerReviewRevision('oauth-owner', kind, { ...input(kind), expectedBase: { ...base, [field]: changed } })).rejects.toMatchObject({ status: 409 }); expect(creates()).toHaveLength(0);
  });
  it(`${kind}: preserves native payload ID and provenance rejection`, async () => {
    await expect(createOwnerReviewRevision('oauth-owner', kind, { ...input(kind), [kind]: { ...(kind === 'template' ? template : style), id: 'another-asset' } })).rejects.toMatchObject({ status: 400 });
    const bad = kind === 'template' ? { ...template, appearance: { assetSource: '/new-source.png' } } : { ...style, contributorName: 'Forged' };
    await expect(createOwnerReviewRevision('oauth-owner', kind, { ...input(kind), [kind]: bad })).rejects.toMatchObject({ status: 400 }); expect(creates()).toHaveLength(0);
  });
  for (const activity of ['false', 'reject'] as const) it(`${kind}: confirmed receipt survives activity ${activity} in command and browser`, async () => {
    if (activity === 'false') f.activity.mockResolvedValue(false); else f.activity.mockRejectedValue(new Error('audit unavailable'));
    const response = await (kind === 'template' ? templatePost : stylePost)(new Request('https://cardforge.test', { method: 'POST', body: JSON.stringify(input(kind)) }));
    expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ id: 'bc615bd7-07b1-460c-9e25-9d3b13b65ed1', outcome: 'committed', committed: true, activityRecorded: false, nextAction: 'read', warnings: [expect.stringContaining('audit activity is incomplete')] });
    expect(creates()).toHaveLength(1); expect(f.activity).toHaveBeenCalledOnce();
  });
  for (const failure of ['lostAck', 'postReadFailure'] as const) it(`${kind}: ${failure} remains uncertain until exact receipt read, without replay/new key`, async () => {
    f[failure] = true; const result = await createOwnerReviewRevision('oauth-owner', kind, input(kind));
    expect(result).toMatchObject({ receipt: null, committed: null, outcome: 'uncertain', submissionKey, activityRecorded: null, retryable: false, nextAction: 'read' }); expect(creates()).toHaveLength(1); expect(f.activity).not.toHaveBeenCalled();
    f[failure] = false;
    expect(await getOwnerReviewRevisionReceipt('oauth-owner', kind, { assetId: base.assetId, submissionKey })).toMatchObject({ receipt: { revisionNumber: 4 } }); expect(creates()).toHaveLength(1);
  });
  for (const [message, status] of [['not_permitted', 400], ['not_found', 404], ['conflict', 409]] as const) it(`${kind}: preserves native ${status} without false receipt or activity`, async () => {
    f.rpc.mockImplementationOnce(async () => ({ data: null, error: null }))
      .mockImplementationOnce(async () => ({ data: { expectedBase: base, [kind]: kind === 'template' ? template : style }, error: null }))
      .mockImplementationOnce(async () => ({ data: null, error: { message } }));
    await expect(createOwnerReviewRevision('oauth-owner', kind, input(kind))).rejects.toMatchObject({ status });
    expect(f.rows).toEqual({}); expect(f.activity).not.toHaveBeenCalled();
  });
  it(`${kind}: failed receipt read is not absence and cannot allocate`, async () => {
    f.receiptFailure = true;
    await expect(getOwnerReviewRevisionReceipt('oauth-owner', kind, { assetId: base.assetId, submissionKey })).rejects.toMatchObject({ status: 503 });
    expect(await createOwnerReviewRevision('oauth-owner', kind, input(kind))).toMatchObject({ outcome: 'uncertain', receipt: null }); expect(creates()).toHaveLength(0);
  });
  it(`${kind}: denies non-Owner before every canonical read/write`, async () => {
    f.account.mockResolvedValue({ user: { id: 'contributor' }, isOwner: false });
    await expect(getOwnerReviewRevisionBase('contributor', kind, { assetId: base.assetId })).rejects.toMatchObject({ status: 403 });
    await expect(getOwnerReviewRevisionReceipt('contributor', kind, { assetId: base.assetId, submissionKey })).rejects.toMatchObject({ status: 403 });
    await expect(createOwnerReviewRevision('contributor', kind, input(kind))).rejects.toMatchObject({ status: 403 }); expect(f.rpc).not.toHaveBeenCalled();
  });
}
const http = async (id: number, method: string, params: object) => {
  const response = await cardForgeOwnerMcpHandler(new Request('https://cardforge.test/mcp/owner', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id, method, params }) }));
  const text = await response.text(); return { status: response.status, body: JSON.parse(text.startsWith('event:') ? text.split('data: ')[1].split('\n')[0] : text) };
};
it('actual initialized HTTP lists 57 Owner tools with explicit schemas and calls all six adapters', async () => {
  expect((await http(1, 'initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'test', version: '1' } })).body.result.serverInfo).toEqual({ name: 'cardforge-owner', version: '1.17.0' });
  const tools = (await http(2, 'tools/list', {})).body.result.tools; expect(tools).toHaveLength(57);
  for (const kind of ['template', 'style'] as const) {
    const name = `create_pipeline_${kind}_review_revision`, tool = tools.find((item: { name: string }) => item.name === name);
    expect(tool.inputSchema.required).toEqual(expect.arrayContaining(['expectedBase', 'submissionKey', kind]));
    expect(tool.inputSchema.properties.expectedBase.required).toHaveLength(7); expect(tool.outputSchema.properties.receipt).toBeDefined(); expect(tool.annotations.readOnlyHint).toBe(false);
    const baseRead = await http(3, 'tools/call', { name: `get_pipeline_${kind}_review_base`, arguments: { assetId: base.assetId } }); expect(baseRead.body.result.structuredContent.expectedBase).toEqual(base);
    expect((await http(4, 'tools/call', { name: `get_pipeline_${kind}_review_receipt`, arguments: { assetId: base.assetId, submissionKey } })).body.result.structuredContent).toEqual({ receipt: null });
    expect((await http(5, 'tools/call', { name, arguments: input(kind) })).body.result.structuredContent).toMatchObject({ outcome: 'committed', receipt: { status: 'submitted' } });
  }
});
it('actual endpoint denies non-Owner discovery/calls and rechecks revoked role without native access', async () => {
  f.account.mockResolvedValue({ user: { id: 'other' }, isOwner: false });
  expect((await http(1, 'tools/list', {})).status).toBe(403);
  expect((await http(2, 'tools/call', { name: 'create_pipeline_template_review_revision', arguments: input('template') })).status).toBe(403);
  f.account.mockResolvedValueOnce({ user: { id: 'owner' }, isOwner: true }).mockResolvedValueOnce({ user: { id: 'owner' }, isOwner: true }).mockResolvedValueOnce({ user: { id: 'other' }, isOwner: false });
  const denied = await http(3, 'tools/call', { name: 'create_pipeline_style_review_revision', arguments: input('style') }); expect(denied.body.result.isError).toBe(true); expect(f.rpc).not.toHaveBeenCalled();
});
it('actual HTTP preserves uncertain receipt output and one native create after lost ACK', async () => {
  f.lostAck = true; const result = await http(1, 'tools/call', { name: 'create_pipeline_template_review_revision', arguments: input('template') });
  expect(result.body.result.isError).toBe(true); expect(result.body.result.structuredContent).toMatchObject({ outcome: 'uncertain', committed: null, nextAction: 'read', submissionKey }); expect(creates()).toHaveLength(1);
});
