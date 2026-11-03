import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const f = vi.hoisted(() => ({ account: vi.fn(), contribution: vi.fn(), cache: vi.fn(), rpc: vi.fn(), row: {} as Record<string, unknown>, writes: [] as Array<{ payload: Record<string, unknown>; filters: Array<[string, unknown]> }>, zero: false, writeError: false, readErrorAfterWrite: false }));
vi.mock('@/features/account/server', async importOriginal => ({ ...await importOriginal<object>(), getAccountToolAccessForUserId: f.account }));
vi.mock('@/features/studio-documents/server/mcpStudioAccess', () => ({ getMcpStudioReadAccess: async () => ({ user: { id: 'oauth-author' } }), getMcpStudioAccess: async () => ({ user: { id: 'oauth-author' } }) }));
vi.mock('@/features/mcp-usage/server', async importOriginal => ({ ...await importOriginal<object>(), observeMcpToolExecution: ({ execute }: { execute: () => unknown }) => execute() }));
vi.mock('@/features/contributor-access/server', async importOriginal => ({ ...await importOriginal<object>(), readContributorCapabilities: f.contribution }));
vi.mock('@/features/pipeline/server/catalogCache', () => ({ revalidateCardForgeCatalog: f.cache }));
vi.mock('@/infrastructure/database/supabaseServer', () => ({ getSupabaseServerConfigStatus: () => ({ configured: true }), getSupabaseServerClient: () => ({ rpc: f.rpc, from: () => {
  const filters: Array<[string, unknown]> = []; let payload: Record<string, unknown> | null = null;
  const matches = () => filters.every(([key, value]) => f.row[key] === value);
  const result = () => {
    if (payload) {
      f.writes.push({ payload, filters: [...filters] });
      if (f.writeError) return { data: null, error: { message: 'response lost' } };
      if (f.zero || !matches()) return { data: null, error: null };
      Object.assign(f.row, payload); return { data: { id: f.row.id }, error: null };
    }
    if (f.readErrorAfterWrite && f.writes.length) return { data: null, error: { message: 'read unavailable' } };
    return { data: matches() ? { ...f.row } : null, error: null };
  };
  const q = { select: () => q, eq: (key: string, value: unknown) => { filters.push([key, value]); return q; }, not: () => q, is: (key: string, value: unknown) => { filters.push([key, value]); return q; },
    limit: async () => { const r = result(); return { ...r, data: r.data ? [r.data] : [] }; }, maybeSingle: async () => result(), update: (value: Record<string, unknown>) => { payload = value; return q; } };
  return q;
} }) }));
import { getContributorPipelineDraft, saveContributorPipelineMetadata, finalizeContributorTemplateSubmission } from '@/features/pipeline/server/contributorDraftCommands';
import { finalizeContributorTemplatePipelineDraft } from '@/features/pipeline/lib/pipelineStore';
import { cardForgeMcpHandler } from '@/features/studio-documents/server/mcpServer';

const id = '10000000-0000-4000-8000-000000000001';
const metadata = { name: 'Saved Template', description: 'Creates editable cards', sourceNotes: 'Original source and rights observed', specialtyTags: ['games'], useCaseTags: ['tcg'], semanticRole: 'template-front', visualFamily: 'Test family', variantKind: 'base', compatibilityTags: [], requestedStudioDestination: 'template.front' };
beforeEach(() => {
  vi.resetAllMocks(); f.writes = []; f.zero = false; f.writeError = false; f.readErrorAfterWrite = false;
  f.account.mockResolvedValue({ user: { id: 'author' }, isOwner: false, entitlement: { accessMode: 'contributor' } });
  f.contribution.mockResolvedValue({ active: true, scopes: ['assets.submit', 'library.submit'] }); f.cache.mockReturnValue(true);
  f.row = { id, contributor_id: 'author', lineage_id: null, revision_number: 1, asset_type: 'templates', status: 'draft', name: 'Existing Template', description: '', source_notes: 'Private authored note', source_payload: { secret: 'Private document' }, specialty_tags: ['games'], use_case_tags: ['tcg'], semantic_role: 'template-front', variant_kind: 'base', media_presentation: null };
  f.rpc.mockImplementation(async () => { f.row.status = 'submitted'; f.row.name = metadata.name; return { data: id, error: null }; });
});
it('reads exact editable metadata without source payloads, enrollment or sibling substitution', async () => {
  const result = await getContributorPipelineDraft('oauth-author', { submissionId: id });
  expect(result).toMatchObject({ submissionId: id, canSaveMetadata: true, canFinalize: true, metadata: { sourceNotes: 'Private authored note' } });
  expect(JSON.stringify(result)).not.toContain('Private document'); expect(f.writes).toEqual([]); expect(f.rpc).not.toHaveBeenCalled();
  expect(f.account).toHaveBeenCalledExactlyOnceWith('oauth-author');
});
it('confirms exact metadata affected-row acknowledgement and preserves commit after read/cache failures', async () => {
  f.cache.mockReturnValue(false); f.readErrorAfterWrite = true;
  const result = await saveContributorPipelineMetadata('author', { submissionId: id, metadata });
  expect(result.receipt).toMatchObject({ outcome: 'committed', metadataCommitted: true, submitted: false, nextAction: 'read' });
  expect(result.snapshot).toBeNull(); expect(result.receipt.warnings).toHaveLength(2);
  expect(f.writes[0].filters).toContainEqual(['contributor_id', 'author']); expect(f.writes[0].filters).toContainEqual(['id', id]);
});
it('never infers an affected-row commit from error-null with zero selected rows', async () => {
  f.zero = true;
  await expect(saveContributorPipelineMetadata('author', { submissionId: id, metadata })).rejects.toMatchObject({ status: 409 });
  expect(f.row.name).toBe('Existing Template'); expect(f.rpc).not.toHaveBeenCalled();
});
it('confirms native submission once and retains submitted after unavailable readback', async () => {
  f.readErrorAfterWrite = true;
  const result = await finalizeContributorTemplateSubmission('author', { submissionId: id, metadata });
  expect(result.receipt).toMatchObject({ outcome: 'submitted', metadataCommitted: true, submitted: true, nextAction: 'read' });
  expect(result.snapshot).toBeNull(); expect(f.rpc).toHaveBeenCalledExactlyOnceWith('cardforge_submit_template_pipeline_draft', expect.objectContaining({ p_submission_id: id, p_contributor_id: 'author' }));
  expect(f.writes).toHaveLength(1); expect(f.writes[0].filters).toContainEqual(['status', 'draft']);
});
it('reports only retained classification when the subsequent submission is definitively rejected', async () => {
  f.rpc.mockResolvedValue({ data: null, error: { message: 'template_draft_not_editable' } });
  const result = await finalizeContributorTemplateSubmission('author', { submissionId: id, metadata });
  expect(result.receipt).toMatchObject({ outcome: 'metadata_committed_not_submitted', metadataCommitted: true, submitted: false, nextAction: 'read' });
  expect(result.receipt.committedMetadataFields).toContain('semanticRole'); expect(result.receipt.committedMetadataFields).not.toContain('name');
  expect(result.snapshot?.metadata).toMatchObject({ name: 'Existing Template', visualFamily: 'Test family' }); expect(f.rpc).toHaveBeenCalledOnce();
});
it('keeps a lost submission acknowledgement uncertain even if readback observes submitted', async () => {
  f.rpc.mockImplementation(async () => { f.row.status = 'submitted'; throw new Error('lost response'); });
  const result = await finalizeContributorTemplateSubmission('author', { submissionId: id, metadata });
  expect(result.receipt).toMatchObject({ outcome: 'uncertain', metadataCommitted: true, submitted: null, retryable: false, nextAction: 'read' });
  expect(result.snapshot?.status).toBe('submitted'); expect(f.rpc).toHaveBeenCalledOnce();
});
it('does not infer metadata commit after an unconfirmed update', async () => {
  f.writeError = true;
  const result = await saveContributorPipelineMetadata('author', { submissionId: id, metadata });
  expect(result.receipt).toMatchObject({ outcome: 'uncertain', metadataCommitted: null, submitted: null }); expect(f.writes).toHaveLength(1);
});
for (const condition of ['inactive', 'scope', 'other', 'published', 'presentation', 'forged'] as const) it(`denies ${condition} metadata access before any write`, async () => {
  if (condition === 'inactive') f.contribution.mockResolvedValue({ active: false, scopes: ['assets.submit'] });
  if (condition === 'scope') f.contribution.mockResolvedValue({ active: true, scopes: ['library.submit'] });
  if (condition === 'other') f.row.contributor_id = 'someone-else';
  if (condition === 'published') f.row.status = 'published';
  if (condition === 'presentation') f.row.media_presentation = { inherited: true };
  await expect(saveContributorPipelineMetadata('author', { submissionId: id, metadata, ...(condition === 'forged' ? { actorId: 'other' } : {}) })).rejects.toThrow();
  expect(f.writes).toEqual([]); expect(f.rpc).not.toHaveBeenCalled();
});
it('denies another Contributor private draft read', async () => {
  f.row.contributor_id = 'other'; await expect(getContributorPipelineDraft('author', { submissionId: id })).rejects.toMatchObject({ status: 404 });
});
it('preserves Owner metadata policy but never lets Owner finalize another author draft', async () => {
  f.account.mockResolvedValue({ user: { id: 'owner' }, isOwner: true, entitlement: { accessMode: 'paid' } });
  expect((await saveContributorPipelineMetadata('owner', { submissionId: id, metadata })).receipt.outcome).toBe('committed');
  f.writes = [];
  await expect(finalizeContributorTemplateSubmission('owner', { submissionId: id, metadata })).rejects.toMatchObject({ status: 403 });
  expect(f.writes).toEqual([]); expect(f.rpc).not.toHaveBeenCalled();
});
it('native finalization denies non-owner, non-draft and non-Template before classification', async () => {
  await expect(finalizeContributorTemplatePipelineDraft({ submissionId: id, contributorId: 'other', input: metadata })).rejects.toMatchObject({ status: 403 });
  f.row.status = 'submitted'; await expect(finalizeContributorTemplatePipelineDraft({ submissionId: id, contributorId: 'author', input: metadata })).rejects.toMatchObject({ status: 409 });
  f.row.status = 'draft'; f.row.asset_type = 'icons'; await expect(finalizeContributorTemplatePipelineDraft({ submissionId: id, contributorId: 'author', input: metadata })).rejects.toMatchObject({ status: 409 });
  expect(f.writes).toEqual([]); expect(f.rpc).not.toHaveBeenCalled();
});

const readHttp = async (response: Response) => {
  const text = await response.text(); return JSON.parse(response.headers.get('content-type')?.includes('text/event-stream') ? text.split('\n').find(line => line.startsWith('data: '))!.slice(6) : text);
};
const http = async (id: number, method: string, params: object) => {
  return readHttp(await cardForgeMcpHandler(new Request('https://cardforge.test/mcp', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id, method, params }) })));
};
it('lists all three explicit schemas and calls read/save/finalize through real HTTP and canonical native commands', async () => {
  await http(1, 'initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'contributor-proof', version: '1' } });
  const listed = await http(2, 'tools/list', {});
  expect(listed.result.tools).toHaveLength(55);
  for (const name of ['get_contributor_pipeline_draft', 'save_contributor_pipeline_metadata', 'finalize_contributor_template_submission']) {
    expect(listed.result.tools.find((tool: { name: string }) => tool.name === name)).toMatchObject({ inputSchema: { type: 'object' }, outputSchema: { type: 'object' }, annotations: { readOnlyHint: false } });
  }
  const exact = await http(3, 'tools/call', { name: 'get_contributor_pipeline_draft', arguments: { submissionId: id } });
  expect(exact.result.structuredContent).toMatchObject({ submissionId: id, contributorId: 'author' });
  const saved = await http(4, 'tools/call', { name: 'save_contributor_pipeline_metadata', arguments: { submissionId: id, metadata } });
  expect(saved.result.structuredContent.receipt.outcome).toBe('committed');
  const submitted = await http(5, 'tools/call', { name: 'finalize_contributor_template_submission', arguments: { submissionId: id, metadata } });
  expect(submitted.result.structuredContent.receipt).toMatchObject({ outcome: 'submitted', submitted: true });
  expect(f.account).toHaveBeenCalledWith('oauth-author'); expect(f.rpc).toHaveBeenCalledOnce();
});
it('preserves a partial receipt through real HTTP without a second native submission', async () => {
  f.rpc.mockResolvedValue({ data: null, error: { message: 'template_draft_not_editable' } });
  const partial = await http(1, 'tools/call', { name: 'finalize_contributor_template_submission', arguments: { submissionId: id, metadata } });
  expect(partial.result).toMatchObject({ isError: true, structuredContent: { receipt: { outcome: 'metadata_committed_not_submitted', metadataCommitted: true, submitted: false } } });
  expect(f.rpc).toHaveBeenCalledOnce();
});
it('denies native calls at the real protocol boundary when scope is revoked or caller invents identity/CAS', async () => {
  f.contribution.mockResolvedValue({ active: false, scopes: ['library.submit'] });
  const denied = await http(1, 'tools/call', { name: 'finalize_contributor_template_submission', arguments: { submissionId: id, metadata } });
  expect(denied.result.isError).toBe(true); expect(f.rpc).not.toHaveBeenCalled(); expect(f.writes).toEqual([]);
  f.account.mockClear();
  const invalid = await http(2, 'tools/call', { name: 'save_contributor_pipeline_metadata', arguments: { submissionId: id, metadata, actorUserId: 'forged', expectedUpdatedAt: 'fake' } });
  expect(invalid.error ?? invalid.result?.isError).toBeTruthy(); expect(f.account).not.toHaveBeenCalled();
});

it('preserves uncertain native submission through HTTP without retry or false success', async () => {
  f.rpc.mockImplementation(async () => { f.row.status = 'submitted'; throw new Error('acknowledgement lost'); });
  const result = await http(1, 'tools/call', { name: 'finalize_contributor_template_submission', arguments: { submissionId: id, metadata } });
  expect(result.result).toMatchObject({ isError: true, structuredContent: { receipt: { outcome: 'uncertain', submitted: null, metadataCommitted: true, retryable: false } } });
  expect(f.rpc).toHaveBeenCalledOnce();
});
it('requires library.submit separately from metadata submission scope', async () => {
  f.contribution.mockResolvedValue({ active: true, scopes: ['assets.submit'] });
  await expect(finalizeContributorTemplateSubmission('author', { submissionId: id, metadata })).rejects.toMatchObject({ status: 403 });
  expect(f.writes).toEqual([]); expect(f.rpc).not.toHaveBeenCalled();
});

it('does not submit after a zero-row classification update', async () => {
  f.zero = true;
  await expect(finalizeContributorTemplateSubmission('author', { submissionId: id, metadata })).rejects.toMatchObject({ status: 409 });
  expect(f.rpc).not.toHaveBeenCalled();
});
it('never accepts a sibling native acknowledgement as exact submission proof', async () => {
  f.rpc.mockResolvedValue({ data: '10000000-0000-4000-8000-000000000002', error: null });
  const result = await finalizeContributorTemplateSubmission('author', { submissionId: id, metadata });
  expect(result.receipt).toMatchObject({ submissionId: id, outcome: 'uncertain', submitted: null, metadataCommitted: true });
  expect(f.rpc).toHaveBeenCalledOnce();
});
