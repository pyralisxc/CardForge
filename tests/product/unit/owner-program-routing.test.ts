import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const f = vi.hoisted(() => ({ account: vi.fn(), oauth: vi.fn(), rpc: vi.fn(), activity: vi.fn(), cache: vi.fn(), path: vi.fn(), program: vi.fn(), configured: true, settingsReadFail: false, assetReadFail: false, programAck: 0 as unknown, routingAck: true as unknown, lost: false, settings: {} as Record<string, unknown>, rows: [] as Record<string, unknown>[], queries: [] as unknown[][] }));
vi.mock('@clerk/nextjs/server', () => ({ auth: f.oauth }));
vi.mock('next/cache', async original => ({ ...await original<object>(), revalidatePath: f.path }));
vi.mock('@/features/account/server', async original => ({ ...await original<object>(), getAccountToolAccessForUserId: f.account }));
vi.mock('@/features/owner/server/ownerActivityStore', () => ({ recordOwnerActivity: f.activity }));
vi.mock('@/features/owner/server', async original => ({ ...await original<object>(), getCurrentOwnerAccess: async () => ({ userId: 'owner', isOwner: true, email: 'owner@example.invalid' }) }));
vi.mock('@/features/pipeline/server', async original => ({ ...await original<object>(), getPipelineProgramView: f.program, getPipelineContributorIds: (id: string) => [id] }));
vi.mock('@/features/pipeline/server/catalogCache', () => ({ revalidateCardForgeCatalog: f.cache }));
vi.mock('@/features/mcp-usage/server', async original => ({ ...await original<object>(), observeMcpToolExecution: ({ execute }: { execute: () => unknown }) => execute() }));
vi.mock('@/infrastructure/database/supabaseServer', () => ({ getSupabaseServerConfigStatus: () => ({ configured: f.configured }), getSupabaseServerClient: () => ({ rpc: f.rpc, from: (table: string) => {
  const calls: unknown[][] = [['from', table]]; f.queries.push(calls); let ids: unknown, destination: string | undefined, query = '';
  const selected = () => f.rows.filter(row => (ids === undefined || row.asset_id === ids) && (!destination || (row.studio_destinations as string[]).includes(destination)) && String(row.name).toLowerCase().includes(query));
  const q = { select: (...args: unknown[]) => { calls.push(['select', ...args]); return q; }, eq: (key: string, value: unknown) => { calls.push(['eq', key, value]); if (key === 'asset_id') ids = value; return q; },
    contains: (_key: string, values: string[]) => { destination = values[0]; calls.push(['contains', ...values]); return q; }, ilike: (_key: string, value: string) => { query = value.replaceAll('%','').toLowerCase(); calls.push(['ilike', value]); return q; }, order: (...args: unknown[]) => { calls.push(['order', ...args]); return q; },
    range: async (start: number, end: number) => { calls.push(['range',start,end]); return { data: selected().slice(start,end+1), count: selected().length, error: null }; },
    maybeSingle: async () => ({ data: selected()[0] ?? null, error: f.assetReadFail ? { message: 'asset read failed' } : null }),
    limit: async () => ({ data: [f.settings], error: f.settingsReadFail ? { message: 'settings read failed' } : null }),
  }; return q;
} }) }));
import { getOwnerPipelineProgramSettings, saveOwnerPipelineProgramSettings, getOwnerPipelineStudioRouting, saveOwnerPipelineStudioRouting } from '@/features/owner/server/ownerProgramRoutingCommands';
import { DEFAULT_PIPELINE_PROGRAM_SETTINGS } from '@/features/pipeline/lib/pipelineItems';
import { resolveStudioAssetDestinations, getCompatibleStudioAssetDestinations } from '@/domain/templates';
import { cardForgeOwnerMcpHandler } from '@/features/owner/server/mcpOwnerServer';
import { PUT as saveProgramRoute } from '@/app/api/pipeline/route';
import { GET as routingGet, PUT as routingPut } from '@/app/api/owner/studio-routing/route';
const editable = () => {
  const { allowContributorSelfVoting: _self, ownerVoteWeight: _weight, publishCapsByType: _caps, ...settings } = structuredClone(DEFAULT_PIPELINE_PROGRAM_SETTINGS); return settings;
};
const settingsRow = (settings = DEFAULT_PIPELINE_PROGRAM_SETTINGS) => ({ max_active_contributors: settings.maxActiveContributors, monthly_submission_limit: settings.monthlySubmissionLimit, max_submission_file_size_mb: settings.maxSubmissionFileSizeMb, monthly_published_requirement: settings.monthlyPublishedRequirement, minimum_votes_for_grading: settings.minimumVotesForGrading, free_asset_minimum_positive_vote_percent: settings.freeAssetMinimumPositiveVotePercent, paid_asset_minimum_positive_vote_percent: settings.paidAssetMinimumPositiveVotePercent, allow_contributor_self_voting: true, review_minimum_age_days: settings.reviewMinimumAgeDays, review_inactivity_days: settings.reviewInactivityDays, trash_retention_days: settings.trashRetentionDays, tier_caps_by_type: settings.tierCapsByType });
const row = (id = 'exact-icon') => ({ asset_id: id, name: `Synthetic icon ${id}`, asset_type: 'icon', url: '/icon.svg', status: 'published', access_tier: 'free', library_source: 'contributor', contributor_submission_id: '63300e01-8d07-4f22-8221-a56de17221e5', metadata: {}, studio_destinations: ['element.icon'], studio_sort_order: 100, studio_featured: false, studio_routing_mode: 'automatic' });
const placement = () => ({ assetId: 'exact-icon', mode: 'owner', destinations: [] as string[], sortOrder: 2, featured: true });
beforeEach(() => {
  vi.resetAllMocks(); f.configured = true; f.settingsReadFail = false; f.assetReadFail = false; f.programAck = 0; f.routingAck = true; f.lost = false; f.settings = settingsRow(); f.rows = [row()]; f.queries = [];
  f.oauth.mockResolvedValue({ userId: 'oauth-owner' }); f.account.mockResolvedValue({ user: { id: 'owner' }, isOwner: true, email: 'owner@example.invalid' }); f.activity.mockResolvedValue(true); f.cache.mockReturnValue(true); f.program.mockResolvedValue({ settings: DEFAULT_PIPELINE_PROGRAM_SETTINGS });
  f.rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
    if (name === 'cardforge_get_studio_routing_counts') return { data: [{ destination: 'element.icon', total_count: f.rows.length, live_count: f.rows.length }], error: null };
    if (name === 'cardforge_update_contributor_program_settings') { f.settings = settingsRow(args.p_settings as typeof DEFAULT_PIPELINE_PROGRAM_SETTINGS); if (f.lost) throw new Error('lost native ACK'); return { data: f.programAck, error: null }; }
    if (name === 'cardforge_update_asset_studio_routing') {
      const found = f.rows.find(item => item.asset_id === args.p_asset_id); if (!found) return { data: null, error: { message: 'pipeline_asset_not_found' } };
      if (args.p_mode === 'owner' && (args.p_destinations as string[]).some(value => !getCompatibleStudioAssetDestinations({ kind: 'icon', metadata: {} }).includes(value as never))) return { data: null, error: { message: 'incompatible_studio_asset_destination' } };
      Object.assign(found, { studio_destinations: args.p_mode === 'automatic' ? resolveStudioAssetDestinations({ kind: 'icon', metadata: {}, mode: 'automatic', destinations: [] }) : args.p_destinations, studio_routing_mode: args.p_mode, studio_sort_order: args.p_sort_order, studio_featured: args.p_featured });
      if (f.lost) throw new Error('lost native ACK'); return { data: f.routingAck, error: null };
    }
    throw new Error(name);
  });
});
it('reads only settings and labels unconfigured fallback defaults distinctly', async () => {
  expect(await getOwnerPipelineProgramSettings('owner', {})).toMatchObject({ configured: true, settings: DEFAULT_PIPELINE_PROGRAM_SETTINGS }); expect(f.queries).toHaveLength(1); expect(f.queries[0][0]).toEqual(['from','cardforge_contributor_program_settings']); expect(f.rpc).not.toHaveBeenCalled(); f.configured = false;
  expect(await getOwnerPipelineProgramSettings('owner', {})).toEqual({ configured: false, settings: DEFAULT_PIPELINE_PROGRAM_SETTINGS }); expect(f.queries).toHaveLength(1);
});
it('integer zero ACK confirms program save without inventing publication counts or editable policy facts', async () => {
  const settings = editable(); settings.tierCapsByType.icons = { free: 3, paid: 2 };
  const result = await saveOwnerPipelineProgramSettings('owner', { settings }); expect(result.receipt).toMatchObject({ outcome: 'committed', committed: true, refreshComplete: true }); expect(result.snapshot?.settings).toMatchObject({ allowContributorSelfVoting: true, ownerVoteWeight: 1, publishCapsByType: { icons: 5 } });
  expect(f.rpc).toHaveBeenCalledExactlyOnceWith('cardforge_update_contributor_program_settings', expect.objectContaining({ p_owner_contributor_id: 'owner', p_settings: expect.objectContaining({ ownerVoteWeight: 1, allowContributorSelfVoting: true, publishCapsByType: expect.objectContaining({ icons: 5 }) }) })); expect(result).not.toHaveProperty('publicationCount');
});
for (const ack of [null, true, '0', -1, 0.5]) it(`program malformed ACK ${String(ack)} remains uncertain even when readback matches`, async () => { f.programAck = ack; const result = await saveOwnerPipelineProgramSettings('owner', { settings: editable() }); expect(result.receipt).toMatchObject({ outcome: 'uncertain', committed: null, retryable: false }); expect((await getOwnerPipelineProgramSettings('owner', {})).settings).toEqual(DEFAULT_PIPELINE_PROGRAM_SETTINGS); expect(result.receipt.committed).toBeNull(); expect(f.activity).not.toHaveBeenCalled(); expect(f.cache).not.toHaveBeenCalled(); });
for (const ack of [null, false, 1, 'true']) it(`routing malformed ACK ${String(ack)} remains uncertain with exact later observation`, async () => { f.routingAck = ack; const result = await saveOwnerPipelineStudioRouting('owner', placement()); expect(result.receipt).toMatchObject({ outcome: 'uncertain', committed: null, nextAction: 'read' }); expect((await getOwnerPipelineStudioRouting('owner', { assetId: 'exact-icon' })).asset?.studioDestinations).toEqual([]); expect(result.receipt.committed).toBeNull(); expect(f.activity).not.toHaveBeenCalled(); });
for (const kind of ['settings','routing'] as const) it(`${kind}: lost ACK never becomes commit from matching observed state`, async () => { f.lost = true; const result = kind === 'settings' ? await saveOwnerPipelineProgramSettings('owner', { settings: editable() }) : await saveOwnerPipelineStudioRouting('owner', placement()); expect(result.receipt).toMatchObject({ outcome: 'uncertain', committed: null, retryable: false, nextAction: 'read' }); expect(f.cache).not.toHaveBeenCalled(); expect(f.activity).not.toHaveBeenCalled(); });
for (const failure of ['cache_false','cache_throw','settings_read','program_read','activity_false','activity_throw'] as const) it(`program confirmed commit survives ${failure}`, async () => {
  if (failure === 'cache_false') f.cache.mockReturnValue(false); if (failure === 'cache_throw') f.cache.mockImplementation(() => { throw new Error('cache failed'); }); if (failure === 'settings_read') f.settingsReadFail = true; if (failure === 'program_read') f.program.mockRejectedValue(new Error('reload failed')); if (failure === 'activity_false') f.activity.mockResolvedValue(false); if (failure === 'activity_throw') f.activity.mockRejectedValue(new Error('activity failed'));
  const response = await saveProgramRoute(new Request('https://cardforge.test', { method: 'PUT', body: JSON.stringify({ settings: DEFAULT_PIPELINE_PROGRAM_SETTINGS }) })); expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ receipt: { committed: true, outcome: 'committed', nextAction: 'read', warnings: [expect.any(String)] } }); expect(f.rpc).toHaveBeenCalledOnce(); expect(f.activity).toHaveBeenCalledOnce();
});
for (const failure of ['cache_false','path_throw','asset_read','activity_false','activity_throw'] as const) it(`routing confirmed commit survives ${failure}`, async () => {
  if (failure === 'cache_false') f.cache.mockReturnValue(false); if (failure === 'path_throw') f.path.mockImplementation(() => { throw new Error('path failed'); }); if (failure === 'asset_read') f.assetReadFail = true; if (failure === 'activity_false') f.activity.mockResolvedValue(false); if (failure === 'activity_throw') f.activity.mockRejectedValue(new Error('activity failed'));
  const response = await routingPut(new Request('https://cardforge.test', { method: 'PUT', body: JSON.stringify(placement()) })); expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ receipt: { committed: true, outcome: 'committed', nextAction: 'read' } }); expect(f.rpc).toHaveBeenCalledOnce(); expect(f.activity).toHaveBeenCalledOnce(); expect(f.path).toHaveBeenCalledExactlyOnceWith('/studio');
});
it('post-commit unconfigured fallback is not presented as observed persisted readback', async () => {
  f.rpc.mockImplementationOnce(async () => { f.configured = false; return { data: 0, error: null }; });
  const result = await saveOwnerPipelineProgramSettings('owner', { settings: editable() });
  expect(result.snapshot?.configured).toBe(false); expect(result.receipt).toMatchObject({ committed: true, refreshComplete: false, refreshFailures: ['settings_not_observed'], nextAction: 'read' });
});
it('routing exact read and paginated filtered count use the same projection and exact query scope', async () => {
  f.rows = Array.from({ length: 15 }, (_, index) => row(`icon-${index}`));
  const listed = await getOwnerPipelineStudioRouting('owner', { destination: 'element.icon', query: 'Synthetic', page: 2, pageSize: 12 }); expect(listed.page).toMatchObject({ total: 15, totalPages: 2, page: 2 }); expect(listed.page?.items).toHaveLength(3); expect(f.queries[0]).toContainEqual(['range',12,23]); expect(f.queries[0]).toContainEqual(['contains','element.icon']);
  expect((await getOwnerPipelineStudioRouting('owner', { assetId: 'icon-12' })).asset).toEqual(listed.page?.items[0]); await expect(getOwnerPipelineStudioRouting('owner', { assetId: 'absent' })).rejects.toMatchObject({ status: 404 });
  expect((await routingGet(new Request('https://cardforge.test?assetId=icon-12'))).status).toBe(200);
});
it('routing preserves empty Owner hide, restores automatic contract routes, rejects incompatible destinations', async () => {
  expect((await saveOwnerPipelineStudioRouting('owner', placement())).snapshot?.studioDestinations).toEqual([]);
  expect((await saveOwnerPipelineStudioRouting('owner', { ...placement(), mode: 'automatic' })).snapshot?.studioDestinations).toEqual(resolveStudioAssetDestinations({ kind: 'icon', metadata: {}, mode: 'automatic', destinations: [] }));
  await expect(saveOwnerPipelineStudioRouting('owner', { ...placement(), destinations: ['element.text'] })).rejects.toMatchObject({ status: 400 });
});
for (const extra of [{ expectedUpdatedAt: 'invented' }, { operationId: 'invented' }, { grants: ['Owner'] }]) it(`rejects invented authority/version ${Object.keys(extra)[0]}`, async () => {
  await expect(saveOwnerPipelineProgramSettings('owner', { settings: editable(), ...extra })).rejects.toMatchObject({ status: 400 }); await expect(saveOwnerPipelineStudioRouting('owner', { ...placement(), ...extra })).rejects.toMatchObject({ status: 400 }); expect(f.rpc).not.toHaveBeenCalled();
});
it('denies non-Owner every adapter before reads or writes', async () => {
  f.account.mockResolvedValue({ user: { id: 'other' }, isOwner: false }); for (const operation of [() => getOwnerPipelineProgramSettings('other', {}), () => saveOwnerPipelineProgramSettings('other', { settings: editable() }), () => getOwnerPipelineStudioRouting('other', {}), () => saveOwnerPipelineStudioRouting('other', placement())]) await expect(operation()).rejects.toMatchObject({ status: 403 }); expect(f.queries).toEqual([]); expect(f.rpc).not.toHaveBeenCalled();
});
const http = async (id: number, method: string, params: object) => {
  const response = await cardForgeOwnerMcpHandler(new Request('https://cardforge.test/mcp/owner', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id, method, params }) })); const text = await response.text(); return { status: response.status, body: JSON.parse(text.startsWith('event:') ? text.split('data: ')[1].split('\n')[0] : text) };
};
it('initialized actual HTTP discovers 53 tools and calls all four with consequential scope and exact schemas', async () => {
  expect((await http(1,'initialize',{ protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'test', version: '1' } })).body.result.serverInfo.version).toBe('1.15.0');
  const tools = (await http(2,'tools/list',{})).body.result.tools; expect(tools).toHaveLength(53); const tool = tools.find((item: { name: string }) => item.name === 'save_pipeline_program_settings'); expect(tool.description).toContain('CONSEQUENTIAL GLOBAL REBALANCE'); expect(tool.inputSchema.properties.settings.properties).not.toHaveProperty('ownerVoteWeight'); expect(tool.inputSchema.properties).not.toHaveProperty('expectedUpdatedAt');
  expect((await http(3,'tools/call',{ name: 'get_pipeline_program_settings', arguments: {} })).body.result.structuredContent.configured).toBe(true);
  expect((await http(4,'tools/call',{ name: 'save_pipeline_program_settings', arguments: { settings: editable() } })).body.result.structuredContent.receipt.committed).toBe(true);
  expect((await http(5,'tools/call',{ name: 'get_pipeline_studio_routing', arguments: { assetId: 'exact-icon' } })).body.result.structuredContent.asset.assetId).toBe('exact-icon');
  expect((await http(6,'tools/call',{ name: 'save_pipeline_studio_routing', arguments: placement() })).body.result.structuredContent.receipt.committed).toBe(true);
});
it('actual HTTP denies non-Owner discovery/call and role revocation with no native write', async () => {
  f.account.mockResolvedValue({ user: { id: 'other' }, isOwner: false }); expect((await http(1,'tools/list',{})).status).toBe(403); expect((await http(2,'tools/call',{ name: 'save_pipeline_program_settings', arguments: { settings: editable() } })).status).toBe(403);
  f.account.mockResolvedValueOnce({ user: { id: 'owner' }, isOwner: true }).mockResolvedValueOnce({ user: { id: 'owner' }, isOwner: true }).mockResolvedValueOnce({ user: { id: 'other' }, isOwner: false }); expect((await http(3,'tools/call',{ name: 'save_pipeline_studio_routing', arguments: placement() })).body.result.isError).toBe(true); expect(f.rpc).not.toHaveBeenCalled();
});
