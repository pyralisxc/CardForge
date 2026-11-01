import { beforeEach, expect, it, vi } from 'vitest';
const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/infrastructure/database/supabaseServer', () => ({ getSupabaseServerClient: () => ({ rpc }) }));
import { readPipelineDependencyHealth } from '@/features/pipeline/lib/pipelineDependencyHealth';
beforeEach(() => vi.resetAllMocks());
it('reads current native findings and preserves exact revision pins', async () => {
 const finding = { objectId: 'lineage', objectName: 'Work', sourceAssetId: 'source', sourceAssetName: 'Source', submissionId: '00000000-0000-4000-8000-000000000001' };
 rpc.mockResolvedValue({ data: [finding], error: null });
 expect(await readPipelineDependencyHealth()).toEqual([finding]);
 expect(rpc).toHaveBeenCalledExactlyOnceWith('cardforge_pipeline_dependency_health');
 rpc.mockResolvedValue({ data: [], error: null });
 expect(await readPipelineDependencyHealth()).toEqual([]);
});
it.each([{ data: null, error: { message: 'unavailable' } }, { data: [{ privatePayload: true }], error: null }])('does not clear findings when the native projection is unavailable or malformed', async result => {
 rpc.mockResolvedValue(result);
 await expect(readPipelineDependencyHealth()).rejects.toMatchObject({ status: 503 });
});
