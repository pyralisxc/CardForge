import { beforeEach, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ access: vi.fn(), entitlement: vi.fn(), database: vi.fn(), writes: [] as string[], calls: [] as string[], profile: 'active' as string }));
vi.mock('@/features/account/server', () => ({ getCurrentCardforgeUserAccess: f.access, resolveCardforgeEntitlementForAccess: f.entitlement }));
vi.mock('@/infrastructure/database/supabaseServer', () => ({ getSupabaseServerClient: f.database, getSupabaseServerConfigStatus: () => ({ configured: true }) }));
import { readPipelineEngagement } from '@/features/pipeline/server/pipelineEngagement';
const submissionId = '10000000-0000-4000-8000-000000000001';
const lineageId = '20000000-0000-4000-8000-000000000001';
beforeEach(() => {
  f.writes = []; f.calls = []; f.profile = 'active';
  f.access.mockResolvedValue({ user: { id: 'viewer', email: 'test@example.invalid' }, ownerAccess: { isOwner: false } });
  f.entitlement.mockResolvedValue({ accessMode: 'contributor', authorities: { contributor: true } });
  const row = { id: submissionId, lineage_id: lineageId, contributor_id: 'author', name: 'Original', revision_number: 1, status: 'published', trashed_at: null, purge_state: null, positive_votes: 1, negative_votes: 0 };
  f.database.mockReturnValue({ from: (table: string) => {
    f.calls.push(table);
    const rows = table === 'cardforge_contributor_profiles' ? [{ status: f.profile, can_draft_campaigns: false }]
      : table === 'cardforge_contributor_program_settings' ? [{ allow_contributor_self_voting: true }]
        : table === 'cardforge_contributor_asset_submissions' ? [row]
          : table === 'cardforge_pipeline_asset_lineages' ? [{ id: lineageId, registry_asset_id: 'raw-asset' }]
            : table === 'cardforge_asset_registry' || table === 'cardforge_discoverable_asset_registry' ? [{ asset_id: 'raw-asset' }] : [];
    const result = () => ({ data: rows, error: null });
    const query = { select: () => query, eq: () => query, in: () => query, is: () => query, limit: () => query,
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve),
      upsert: () => { f.writes.push(`upsert:${table}`); return Promise.resolve({ error: null }); },
      update: () => { f.writes.push(`update:${table}`); return query; },
      insert: () => { f.writes.push(`insert:${table}`); return query; },
      delete: () => { f.writes.push(`delete:${table}`); return query; },
    }; return query;
  }, rpc: (name: string) => {
    f.calls.push(name); if (name !== 'cardforge_get_pipeline_heart_metrics') f.writes.push(`rpc:${name}`);
    return Promise.resolve({ data: [{ lineage_id: lineageId, heart_count: 2, viewer_hearted: false }], error: null });
  } });
});
it('reads native capabilities, vote policy and heart helpers without application persistence writes', async () => {
  const result = await readPipelineEngagement(submissionId);
  expect(result.voteIssue).toBeNull(); expect(result.heart?.count).toBe(2);
  expect(f.calls).toContain('cardforge_contributor_profiles'); expect(f.calls).toContain('cardforge_contributor_program_settings'); expect(f.calls).toContain('cardforge_get_pipeline_heart_metrics');
  expect(f.writes).toEqual([]);
});
it.each(['inactive', 'suspended'])('keeps %s contributor authority closed without enrollment', async status => {
  f.profile = status; const result = await readPipelineEngagement(submissionId);
  expect(result.voteIssue).toContain('Contributor review access'); expect(f.writes).toEqual([]);
});
