import { beforeEach, describe, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/infrastructure/database/supabaseServer', () => ({ getSupabaseServerClient: () => ({ rpc: f.rpc }) }));
import { fetchPipelineSubmissionPage } from '@/features/pipeline/lib/pipelineProjections';
import { isPipelineRevisionVisibleToContributor, isSharedPipelineTrash } from '@/features/pipeline/lib/pipelineVisibility';
const request = (trash?: string) => fetchPipelineSubmissionPage({ currentUserId: 'viewer', profiles: [], includeRegistryRecipePayloads: false, allowSelfVoting: true, query: { scope: 'review', trash, page: 2, pageSize: 12 } });
beforeEach(() => f.rpc.mockReset().mockResolvedValue({ data: [], error: null }));
describe('server-owned Trash paging', () => {
  it.each([undefined, 'active', 'trashed', 'all'])('passes %s to the canonical RPC before reading a page', async trash => {
    await request(trash);
    expect(f.rpc).toHaveBeenCalledWith('cardforge_list_contributor_asset_submission_ids', expect.objectContaining({ p_trash_state: trash ?? 'active', p_scope: 'review', p_page: 2, p_page_size: 12 }));
  });
  it('rejects an unsupported dimension without reading a page', async () => {
    await expect(request('private-everything')).rejects.toMatchObject({ status: 400 }); expect(f.rpc).not.toHaveBeenCalled();
  });
  it('keeps an archived private draft or unknown Trash private while retaining author and Owner recovery access', () => {
    const row = { contributorId: 'author', status: 'archived' as const, purgeState: null, viewerId: 'peer', contributor: true, owner: false, trashedAt: '2026-11-01T00:00:00Z' };
    expect(isPipelineRevisionVisibleToContributor({ ...row, trashPreviousStatus: 'draft' })).toBe(false);
    expect(isPipelineRevisionVisibleToContributor(row)).toBe(false);
    expect(isPipelineRevisionVisibleToContributor({ ...row, viewerId: 'author' })).toBe(true);
    expect(isPipelineRevisionVisibleToContributor({ ...row, owner: true })).toBe(true);
    expect(isPipelineRevisionVisibleToContributor({ ...row, trashPreviousStatus: 'voting' })).toBe(true);
    expect(isSharedPipelineTrash({ ...row, publicationRetained: true })).toBe(true);
    expect(isPipelineRevisionVisibleToContributor({ ...row, status: 'submitted', trashedAt: null, trashPreviousStatus: 'draft' })).toBe(true);
  });
});
