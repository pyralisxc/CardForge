import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const f = vi.hoisted(() => ({ oauth: vi.fn(), account: vi.fn(), activity: vi.fn(), rpc: vi.fn(), cache: vi.fn(), row: {} as Record<string, unknown>, network: vi.fn(() => { throw new Error('No external providers in local MCP protocol proof'); }) }));
vi.mock('@/features/studio-documents/server/mcpStudioAccess', () => ({ getMcpStudioAccess: f.oauth, getMcpStudioReadAccess: f.oauth }));
vi.mock('@/features/account/server', () => ({ getAccountToolAccessForUserId: f.account }));
vi.mock('@/features/owner/server/ownerActivityStore', () => ({ recordOwnerActivity: f.activity }));
vi.mock('@/features/pipeline/server/catalogCache', () => ({ revalidateCardForgeCatalog: f.cache }));
vi.mock('@/features/mcp-usage/server', () => ({ observeMcpToolExecution: ({ execute }: { execute: () => unknown }) => execute() }));
vi.mock('@/infrastructure/database/supabaseServer', () => ({ getSupabaseServerConfigStatus: () => ({ configured: true }), getSupabaseServerClient: () => ({ rpc: f.rpc, from: () => { const q = { select: () => q, eq: () => q, maybeSingle: () => Promise.resolve({ data: f.row, error: null }) }; return q; } }) }));
import { cardForgeMcpHandler } from '@/features/studio-documents/server/mcpServer';
const id = '10000000-0000-4000-8000-000000000001';
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal('fetch', f.network);
  f.oauth.mockResolvedValue({ user: { id: 'oauth-owner' } }); f.account.mockResolvedValue({ user: { id: 'resolved-owner' }, isOwner: true, email: 'owner@example.invalid' }); f.activity.mockResolvedValue(true); f.cache.mockReturnValue(true); f.rpc.mockResolvedValue({ data: 1, error: null });
  f.row = { id, lineage_id: '20000000-0000-4000-8000-000000000001', name: 'Exact revision', asset_type: 'icons', semantic_role: 'symbol', requested_studio_destination: 'element.icon', revision_number: 2, status: 'voting', updated_at: '2026-11-02T00:00:00Z', editorial_review_status: 'pending', editorial_review_note: '', editorial_reviewed_by: null, editorial_reviewed_at: null, source_review_evidence: null, catalog_submission_id: null, published_at: null, owner_status_override: null, owner_access_tier_override: null, owner_note: null, calculated_access_tier: 'hidden' };
});
const read = async (response: Response) => { const text = await response.text(); return JSON.parse(response.headers.get('content-type')?.includes('text/event-stream') ? text.split('\n').find(line => line.startsWith('data: '))!.slice(6) : text); };
const request = (id: number, method: string, params: object) => cardForgeMcpHandler(new Request('https://cardforge.test/mcp', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id, method, params }) }));
const initialize = () => request(1, 'initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'owner-pipeline-protocol', version: '1' } });
it('serializes six explicit Owner tool contracts and calls the exact canonical read through real HTTP handler', async () => {
  await initialize(); const listed = await read(await request(2, 'tools/list', {}));
  const names = ['get_pipeline_source_review_evidence','record_pipeline_source_review_evidence','get_pipeline_editorial_review','save_pipeline_editorial_review','get_pipeline_publication_decision','save_pipeline_publication_override'];
  for (const name of names) { const tool = listed.result.tools.find((tool: { name: string }) => tool.name === name); expect(tool.inputSchema.type).toBe('object'); expect(tool.outputSchema.type).toBe('object'); expect(tool.annotations.readOnlyHint).toBe(false); }
  const result = await read(await request(3, 'tools/call', { name: 'get_pipeline_editorial_review', arguments: { submissionId: id } }));
  expect(result.result.isError).not.toBe(true); expect(result.result.structuredContent).toMatchObject({ submissionId: id, revisionNumber: 2, evidenceVersion: 0, qualityStandard: { version: 'CF-CQS-1' } });
  expect(f.account).toHaveBeenCalledExactlyOnceWith('oauth-owner'); expect(f.rpc).not.toHaveBeenCalled(); expect(f.network).not.toHaveBeenCalled();
});
it('executes the existing native decision RPC once, retaining committed receipt after activity failure', async () => {
  f.activity.mockRejectedValue(new Error('activity unavailable')); await initialize();
  const result = await read(await request(2, 'tools/call', { name: 'save_pipeline_editorial_review', arguments: { submissionId: id, reviewStatus: 'revise', reviewNote: 'Observed clipped source output', expectedEvidenceVersion: 0 } }));
  expect(result.result.isError).not.toBe(true); expect(result.result.structuredContent.receipt).toMatchObject({ committed: true, outcome: 'committed', activityRecorded: false, retryable: false });
  expect(result.result.structuredContent).not.toHaveProperty('program');
  expect(f.rpc).toHaveBeenCalledExactlyOnceWith('cardforge_set_contributor_asset_editorial_review', expect.objectContaining({ p_submission_id: id, p_review_status: 'revise', p_expected_evidence_version: 0, p_reviewer_contributor_id: 'resolved-owner' }));
  expect(f.network).not.toHaveBeenCalled();
});
it('denies revoked Owner authority and rejects fabricated CAS/actor fields at the real protocol boundary', async () => {
  await initialize(); f.account.mockResolvedValue({ user: { id: 'ordinary' }, isOwner: false });
  const denied = await read(await request(2, 'tools/call', { name: 'get_pipeline_publication_decision', arguments: { submissionId: id } }));
  expect(denied.result.isError).toBe(true); expect(f.rpc).not.toHaveBeenCalled();
  f.account.mockClear();
  const invalid = await read(await request(3, 'tools/call', { name: 'save_pipeline_publication_override', arguments: { submissionId: id, ownerNote: 'Explicit', expectedUpdatedAt: 'invented', actorUserId: 'forged' } }));
  expect(invalid.error ?? invalid.result?.isError).toBeTruthy(); expect(f.account).not.toHaveBeenCalled();
});

it('returns an uncertain structured receipt after unconfirmed native write without a second RPC', async () => {
  await initialize(); f.rpc.mockResolvedValue({ data: null, error: { message: 'transport lost' } });
  const result = await read(await request(2, 'tools/call', { name: 'save_pipeline_editorial_review', arguments: { submissionId: id, reviewStatus: 'revise', reviewNote: 'Observed clipping', expectedEvidenceVersion: 0 } }));
  expect(result.result.isError).toBe(true); expect(result.result.structuredContent.receipt).toMatchObject({ outcome: 'uncertain', committed: null, retryable: false, nextAction: 'read' });
  expect(f.rpc).toHaveBeenCalledOnce(); expect(f.activity).not.toHaveBeenCalled();
});
