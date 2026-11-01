import { beforeEach, describe, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ access: vi.fn(), read: vi.fn(), review: vi.fn() }));
vi.mock('@/features/account/server', () => ({ getCurrentCardforgeUserAccess: f.access }));
vi.mock('@/features/pipeline/server', async () => ({
 ...(await vi.importActual('@/features/pipeline/lib/pipelineStoreError')),
 getSharedPipelineTrashPage: f.read, getCurrentPipelineRequestAccess: f.review,
 getPipelineLibraryProgramView: vi.fn(), getPipelineContributorIds: vi.fn(), projectPipelineProgramForViewer: vi.fn(), requirePipelineRequestScope: vi.fn(),
}));
import { GET } from '@/app/api/pipeline/library/route';
beforeEach(() => { vi.resetAllMocks(); f.access.mockResolvedValue({ user: { id: 'free-viewer' }, ownerAccess: { isOwner: false } }); f.read.mockResolvedValue({ items: [{ id: 'exact-shared' }], total: 1, page: 2, pageSize: 12 }); });
describe('ordinary signed-in shared Trash discovery', () => {
 it('serves sanitized metadata without Contributor enrollment, review scope or Owner authority', async () => {
  const result = await GET(new Request('https://example.invalid/api/pipeline/library?scope=shared&trash=trashed&page=2'));
  expect(result.status).toBe(200); expect(await result.json()).toMatchObject({ sharedTrash: { items: [{ id: 'exact-shared' }], page: 2 } });
  expect(f.review).not.toHaveBeenCalled(); expect(f.read).toHaveBeenCalledWith('free-viewer', expect.objectContaining({ page: 2 }));
 });
 it('does not turn signed-out into a grant', async () => {
  f.access.mockResolvedValue({ user: null }); const result = await GET(new Request('https://example.invalid/api/pipeline/library?scope=shared&trash=trashed'));
  expect(result.status).toBe(401); expect(f.read).not.toHaveBeenCalled();
 });
 it('cannot select a privileged or active scope through the shared adapter', async () => {
  const result = await GET(new Request('https://example.invalid/api/pipeline/library?scope=shared&trash=all'));
  expect(result.status).toBe(400); expect(f.read).not.toHaveBeenCalled(); expect(f.review).not.toHaveBeenCalled();
 });
});
