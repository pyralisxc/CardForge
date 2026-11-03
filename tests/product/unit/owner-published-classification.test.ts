import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const f = vi.hoisted(() => ({ account: vi.fn(), oauth: vi.fn(), rpc: vi.fn(), cache: vi.fn(), registry: {} as Record<string, unknown>, submission: {} as Record<string, unknown>, readFail: false, reads: [] as string[] }));
vi.mock('@clerk/nextjs/server', () => ({ auth: f.oauth }));
vi.mock('@/features/account/server', async importOriginal => ({ ...await importOriginal<object>(), getAccountToolAccessForUserId: f.account }));
vi.mock('@/features/mcp-usage/server', async importOriginal => ({ ...await importOriginal<object>(), observeMcpToolExecution: ({ execute }: { execute: () => unknown }) => execute() }));
vi.mock('@/features/pipeline/server/catalogCache', () => ({ revalidateCardForgeCatalog: f.cache }));
vi.mock('@/infrastructure/database/supabaseServer', () => ({ getSupabaseServerConfigStatus: () => ({ configured: true }), getSupabaseServerClient: () => ({ rpc: f.rpc, from: (table: string) => {
  f.reads.push(table); const filters: Array<[string, unknown]> = [];
  const q = { select: () => q, eq: (key: string, value: unknown) => { filters.push([key, value]); return q; }, maybeSingle: async () => {
    if (f.readFail) return { data: null, error: { message: 'unavailable' } };
    const row = table === 'cardforge_asset_registry' ? f.registry : f.submission;
    return { data: filters.every(([key, value]) => row[key] === value) ? { ...row } : null, error: null };
  } }; return q;
} }) }));
import { getOwnerPublishedClassification, saveOwnerPublishedClassification } from '@/features/owner/server/ownerPublishedClassificationCommands';
import { cardForgeOwnerMcpHandler } from '@/features/owner/server/mcpOwnerServer';

const submissionId = '63300e01-8d07-4f22-8221-a56de17221e5';
const lineageId = '0ba353d7-5deb-4dbe-8c9a-159ddb509155';
const input = { assetId: 'worn-paper', expectedSubmissionId: submissionId, expectedLineageId: lineageId, expectedRevision: 1,
  expectedSpecialtyTags: ['general'], expectedUseCaseTags: [], expectedSemanticRole: 'texture', expectedVisualFamily: null, expectedVariantKind: 'base', expectedVariantLabel: null, expectedCompatibilityTags: [],
  specialtyTags: ['general'], useCaseTags: [], semanticRole: 'texture', visualFamily: 'Worn Surfaces', variantKind: 'base', variantLabel: null, compatibilityTags: ['print', 'tileable'] };
const applyDesired = () => Object.assign(f.submission, { specialty_tags: input.specialtyTags, use_case_tags: input.useCaseTags, semantic_role: input.semanticRole, visual_family: input.visualFamily, variant_kind: input.variantKind, variant_label: input.variantLabel, compatibility_tags: input.compatibilityTags });
beforeEach(() => {
  vi.resetAllMocks(); f.readFail = false; f.reads = [];
  f.oauth.mockResolvedValue({ userId: 'oauth-owner' });
  f.account.mockResolvedValue({ user: { id: 'owner' }, isOwner: true }); f.cache.mockReturnValue(true);
  f.registry = { asset_id: input.assetId, name: 'Worn Paper', status: 'published', metadata: { revisionNumber: 1 }, contributor_submission_id: submissionId };
  f.submission = { id: submissionId, lineage_id: lineageId, status: 'published', purge_state: null, specialty_tags: ['general'], use_case_tags: [], semantic_role: 'texture', visual_family: null, variant_kind: 'base', variant_label: null, compatibility_tags: [], asset_type: 'textures', source_payload: 'Private authored payload must not cross this boundary' };
  f.rpc.mockImplementation(async () => { applyDesired(); return { data: null, error: null }; });
});
it('reads exact native classification after fresh Owner authority without authored payloads', async () => {
  const result = await getOwnerPublishedClassification('oauth-owner', { assetId: input.assetId });
  expect(result).toMatchObject({ assetId: input.assetId, expectedSubmissionId: submissionId, expectedLineageId: lineageId, expectedRevision: 1 });
  expect(JSON.stringify(result)).not.toContain('Private authored payload');
  expect(f.account).toHaveBeenCalledExactlyOnceWith('oauth-owner'); expect(f.rpc).not.toHaveBeenCalled();
});
it('passes every existing expected and desired field to the same locked native command', async () => {
  const result = await saveOwnerPublishedClassification('owner', input);
  expect(result.receipt).toMatchObject({ outcome: 'committed', committed: true, expectedSubmissionId: submissionId, refreshComplete: true });
  expect(f.rpc).toHaveBeenCalledExactlyOnceWith('cardforge_classify_published_pipeline_asset', {
    p_asset_id: input.assetId, p_expected_submission_id: submissionId, p_expected_lineage_id: lineageId, p_expected_revision: 1,
    p_expected_specialty_tags: input.expectedSpecialtyTags, p_expected_use_case_tags: input.expectedUseCaseTags, p_expected_semantic_role: input.expectedSemanticRole, p_expected_visual_family: input.expectedVisualFamily, p_expected_variant_kind: input.expectedVariantKind, p_expected_variant_label: input.expectedVariantLabel, p_expected_compatibility_tags: input.expectedCompatibilityTags,
    p_specialty_tags: input.specialtyTags, p_use_case_tags: input.useCaseTags, p_semantic_role: input.semanticRole, p_visual_family: input.visualFamily, p_variant_kind: input.variantKind, p_variant_label: input.variantLabel, p_compatibility_tags: input.compatibilityTags,
  });
  expect(new Set(f.reads)).toEqual(new Set(['cardforge_asset_registry', 'cardforge_contributor_asset_submissions']));
});
for (const failure of ['cache_false', 'cache_reject', 'read'] as const) it(`preserves native commit after ${failure} follow-up failure`, async () => {
  if (failure === 'cache_false') f.cache.mockReturnValue(false);
  if (failure === 'cache_reject') f.cache.mockImplementation(() => { throw new Error('cache unavailable'); });
  if (failure === 'read') f.readFail = true;
  const result = await saveOwnerPublishedClassification('owner', input);
  expect(result.receipt).toMatchObject({ committed: true, outcome: 'committed', refreshComplete: false, nextAction: 'read', retryable: false });
  expect(f.rpc).toHaveBeenCalledOnce(); expect(result.receipt.warnings.length).toBeGreaterThan(0);
});
for (const [message, status] of [['pipeline_classification_invalid', 400], ['pipeline_classification_not_found', 404], ['pipeline_classification_conflict', 409]] as const) it(`preserves native ${status} rejection`, async () => {
  f.rpc.mockResolvedValue({ error: { message } });
  await expect(saveOwnerPublishedClassification('owner', input)).rejects.toMatchObject({ status });
  expect(f.rpc).toHaveBeenCalledOnce(); expect(f.cache).not.toHaveBeenCalled(); expect(f.reads).toEqual([]);
});
it('never turns matching current values into proof of a lost native acknowledgement', async () => {
  f.rpc.mockImplementation(async () => { applyDesired(); throw new Error('acknowledgement lost'); });
  const result = await saveOwnerPublishedClassification('owner', input);
  expect(result.receipt).toMatchObject({ outcome: 'uncertain', committed: null, retryable: false, nextAction: 'read' });
  expect(result.snapshot?.expectedVisualFamily).toBe(input.visualFamily); expect(f.cache).not.toHaveBeenCalled(); expect(f.rpc).toHaveBeenCalledOnce();
});
it('does not substitute a newer publication during post-commit readback', async () => {
  f.rpc.mockImplementation(async () => { applyDesired(); f.registry.contributor_submission_id = '63300e01-8d07-4f22-8221-a56de17221e6'; f.submission.id = f.registry.contributor_submission_id; return { error: null }; });
  const result = await saveOwnerPublishedClassification('owner', input);
  expect(result.receipt).toMatchObject({ committed: true, expectedSubmissionId: submissionId, nextAction: 'read' });
  expect(result.snapshot).toBeNull(); expect(result.receipt.warnings.join(' ')).toContain('no sibling was substituted');
});
for (const change of [{ useCaseTags: ['invented'] }, { semanticRole: 'invented' }, { compatibilityTags: ['unknown'] }, { expectedUpdatedAt: 'fake' }, { operationId: 'fake' }] as const) it(`rejects unsupported request ${JSON.stringify(change)}`, async () => {
  await expect(saveOwnerPublishedClassification('owner', { ...input, ...change })).rejects.toMatchObject({ status: 400 });
  expect(f.rpc).not.toHaveBeenCalled();
});
it('denies non-Owner read and save before native reads or writes', async () => {
  f.account.mockResolvedValue({ user: { id: 'contributor' }, isOwner: false });
  await expect(getOwnerPublishedClassification('contributor', { assetId: input.assetId })).rejects.toMatchObject({ status: 403 });
  await expect(saveOwnerPublishedClassification('contributor', input)).rejects.toMatchObject({ status: 403 });
  expect(f.rpc).not.toHaveBeenCalled(); expect(f.reads).toEqual([]);
});
const http = async (id: number, method: string, params: object) => {
  const response = await cardForgeOwnerMcpHandler(new Request('https://cardforge.test/mcp/owner', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id, method, params }) }));
  const text = await response.text(); return { status: response.status, body: JSON.parse(response.headers.get('content-type')?.includes('text/event-stream') ? text.split('\n').find(line => line.startsWith('data: '))!.slice(6) : text) };
};
it('discovers 55 Owner tools and executes the exact pair through real local HTTP', async () => {
  const initialized = await http(1, 'initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'classification-proof', version: '1' } });
  expect(initialized.body.result.serverInfo).toEqual({ name: 'cardforge-owner', version: '1.16.0' });
  const listed = await http(2, 'tools/list', {});
  expect(listed.body.result.tools).toHaveLength(55);
  for (const name of ['get_pipeline_published_classification', 'save_pipeline_published_classification']) expect(listed.body.result.tools.find((tool: { name: string }) => tool.name === name)).toMatchObject({ inputSchema: { type: 'object' }, outputSchema: { type: 'object' }, annotations: { readOnlyHint: false } });
  const read = await http(3, 'tools/call', { name: 'get_pipeline_published_classification', arguments: { assetId: input.assetId } });
  expect(read.body.result.structuredContent.expectedSubmissionId).toBe(submissionId);
  const saved = await http(4, 'tools/call', { name: 'save_pipeline_published_classification', arguments: input });
  expect(saved.body.result.structuredContent.receipt).toMatchObject({ committed: true, outcome: 'committed' }); expect(f.rpc).toHaveBeenCalledOnce();
});
it('denies Owner discovery/call and independently rechecks authority at the canonical command', async () => {
  f.account.mockResolvedValue({ user: { id: 'ordinary' }, isOwner: false });
  expect((await http(1, 'tools/list', {})).status).toBe(403);
  expect((await http(2, 'tools/call', { name: 'save_pipeline_published_classification', arguments: input })).status).toBe(403);
  expect(f.rpc).not.toHaveBeenCalled();
  f.account.mockResolvedValue({ user: { id: 'ordinary' }, isOwner: false }).mockResolvedValueOnce({ user: { id: 'owner' }, isOwner: true }).mockResolvedValueOnce({ user: { id: 'owner' }, isOwner: true });
  const revoked = await http(3, 'tools/call', { name: 'save_pipeline_published_classification', arguments: input });
  expect(revoked.body.result.isError).toBe(true); expect(f.rpc).not.toHaveBeenCalled();
});
it('carries an uncertain acknowledgement through real HTTP without replay', async () => {
  f.rpc.mockRejectedValue(new Error('response lost'));
  const result = await http(1, 'tools/call', { name: 'save_pipeline_published_classification', arguments: input });
  expect(result.body.result).toMatchObject({ isError: true, structuredContent: { receipt: { outcome: 'uncertain', committed: null, retryable: false } } });
  expect(f.rpc).toHaveBeenCalledOnce();
});
