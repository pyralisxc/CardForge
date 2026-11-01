import { beforeEach, describe, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ page: vi.fn(), access: vi.fn(), reviewAccess: vi.fn() }));
vi.mock('@/infrastructure/database/supabaseServer', () => ({ getSupabaseServerClient: () => ({}) }));
vi.mock('@/features/pipeline/lib/pipelineProjections', () => ({ fetchPipelineSubmissionPage: f.page }));
vi.mock('@/features/pipeline/lib/pipelineStore', () => ({ getPipelineProgramContext: vi.fn() }));
import { getSharedPipelineTrashPage } from '@/features/pipeline/lib/pipelineLibraryStore';
beforeEach(() => f.page.mockReset().mockResolvedValue({ total: 1, page: 2, pageSize: 12, submissions: [{ id: 'exact', lineageId: 'lineage', assetType: 'icons', name: 'Shared Trash', description: 'Shared description', status: 'archived', revisionNumber: 1, trashedAt: '2026-11-01', purgeAfter: '2026-12-01', trashActorRole: 'owner', trashActorId: 'private-owner-id', trashPreviousStatus: 'published', publicationRetained: true, positiveVotes: 1, negativeVotes: 2, contributorEmail: 'private@example.invalid', sourcePayload: { private: true }, sourceStoragePath: 'private/path', sourceUrl: 'https://private.invalid', sourceNotes: 'private creator notes', editorialReviewNote: 'private review' }] }));
describe('shared Trash metadata projection', () => {
 it('uses native shared scope and exact paging without granting reviewer or source access', async () => {
  const result = await getSharedPipelineTrashPage('free-viewer', { page: 2, pageSize: 12 });
  expect(f.page).toHaveBeenCalledWith(expect.objectContaining({ currentUserId: 'free-viewer', profiles: [], query: { scope: 'shared', trash: 'trashed', page: 2, pageSize: 12 } }));
  expect(result.items[0]).toMatchObject({ id: 'exact', revisionNumber: 1, trashActorRole: 'owner' });
  expect(JSON.stringify(result)).not.toMatch(/private|sourcePayload|sourceUrl|trashActorId|contributorEmail|sourceStorage|editorialReview|submissions/);
  expect(result).toMatchObject({ total: 1, page: 2, pageSize: 12 });
 });
});
