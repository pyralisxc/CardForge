import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ access: vi.fn(), read: vi.fn(), change: vi.fn(), invalidate: vi.fn() }));
vi.mock('@/features/owner/server', () => ({ getCurrentOwnerAccess: mocks.access }));
vi.mock('@/features/pipeline/server', async () => ({
  ...(await import('@/features/pipeline/lib/pipelineRegistryCommandsError')),
  readCatalogTrash: mocks.read, changeCatalogTrash: mocks.change, revalidateCardForgeCatalog: mocks.invalidate,
}));
import { GET, POST } from '@/app/api/pipeline/[submissionId]/catalog-trash/route';
import { PipelineRegistryCommandError } from '@/features/pipeline/lib/pipelineRegistryCommandsError';
const context = { params: Promise.resolve({ submissionId: 'native-revision' }) };
const post = (body: unknown) => POST(new Request('http://localhost/api/pipeline/native-revision/catalog-trash', { method: 'POST', body: JSON.stringify(body) }), context);
beforeEach(() => { vi.resetAllMocks(); mocks.access.mockResolvedValue({ isOwner: true, userId: 'session-owner' }); });
describe('Owner catalog recovery HTTP boundary', () => {
  it('does not read or mutate for a non-Owner', async () => {
    mocks.access.mockResolvedValue({ isOwner: false, userId: 'viewer' });
    expect((await GET(new Request('http://localhost'), context)).status).toBe(403);
    expect((await post({})).status).toBe(403);
    expect(mocks.read).not.toHaveBeenCalled(); expect(mocks.change).not.toHaveBeenCalled();
  });
  it('rejects a different route identity before the canonical command', async () => {
    expect((await post({ expected: { identity: { submissionId: 'other' } } })).status).toBe(400);
    expect(mocks.change).not.toHaveBeenCalled();
  });
  it('uses session identity and returns the exact canonical receipt', async () => {
    const input = { action: 'hold', expected: { identity: { submissionId: 'native-revision' } }, held: true };
    const receipt = { state: { held: true } }; mocks.change.mockResolvedValue(receipt);
    const response = await post(input);
    expect(response.status).toBe(200); expect(await response.json()).toEqual(receipt);
    expect(mocks.change).toHaveBeenCalledWith('session-owner', input);
    expect(mocks.invalidate).toHaveBeenCalledOnce();
  });
  it('preserves stale-state conflicts and does not retry or invalidate on failure', async () => {
    mocks.change.mockRejectedValue(new PipelineRegistryCommandError('catalog_trash_state_changed', 409));
    const response = await post({ expected: { identity: { submissionId: 'native-revision' } } });
    expect(response.status).toBe(409); expect(mocks.change).toHaveBeenCalledOnce();
    expect(mocks.invalidate).not.toHaveBeenCalled();
  });
});
