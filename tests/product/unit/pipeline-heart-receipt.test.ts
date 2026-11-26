import { beforeEach, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/infrastructure/database/supabaseServer', () => ({ getSupabaseServerClient: () => ({ rpc: f.rpc }) }));
import { getPipelineHeartMetrics, setPipelineHeart } from '@/features/pipeline/lib/pipelineHearts';
const id = '10000000-0000-4000-8000-000000000001';
const input = { lineageId: id, accountId: 'actor', hearted: true, viewerAccess: 'free' as const, contributor: false, owner: false };
const row = { lineage_id: id, heart_count: 1, viewer_hearted: true };
beforeEach(() => { vi.resetAllMocks(); f.rpc.mockResolvedValue({ data: [row], error: null }); });
it('accepts one exact native heart acknowledgement', async () => {
  expect(await setPipelineHeart(input)).toMatchObject({ lineageId: id, outcome: 'committed', metric: { lineageId: id, count: 1, hearted: true } });
  expect(f.rpc).toHaveBeenCalledOnce();
});
for (const data of [[], [row, row], [{...row, lineage_id: '10000000-0000-4000-8000-000000000002'}], [{...row, viewer_hearted: false}], [{...row, heart_count: -1}]]) {
  it('does not assert a commit or replay a malformed or mismatched acknowledgement', async () => {
    f.rpc.mockResolvedValue({ data, error: null });
    expect(await setPipelineHeart(input)).toMatchObject({ outcome: 'uncertain', metric: null });
    expect(f.rpc).toHaveBeenCalledOnce();
  });
}
it('treats an unknown native failure as uncertain without replay', async () => {
  f.rpc.mockRejectedValue(new Error('connection lost'));
  expect(await setPipelineHeart(input)).toMatchObject({ outcome: 'uncertain', metric: null });
  expect(f.rpc).toHaveBeenCalledOnce();
});
for (const [message, status] of [['pipeline_reaction_not_permitted', 403], ['pipeline_lineage_not_found', 404]] as const) {
  it('retains explicit native rejection', async () => {
    f.rpc.mockResolvedValue({ data: null, error: { message } });
    await expect(setPipelineHeart(input)).rejects.toMatchObject({ status });
    expect(f.rpc).toHaveBeenCalledOnce();
  });
}
it('requires an exact well-formed readback and never invents a zero metric', async () => {
  expect(await getPipelineHeartMetrics([id], 'actor')).toEqual([{ lineageId: id, count: 1, hearted: true }]);
  f.rpc.mockResolvedValue({ data: [], error: null });
  await expect(getPipelineHeartMetrics([id], 'actor')).rejects.toThrow();
});

it('matches UUID identity case-insensitively while preserving the requested spelling', async () => {
  const requested = 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA';
  f.rpc.mockResolvedValue({ data: [{ ...row, lineage_id: requested.toLowerCase() }], error: null });
  expect(await getPipelineHeartMetrics([requested], 'actor')).toEqual([{ lineageId: requested, count: 1, hearted: true }]);
});
