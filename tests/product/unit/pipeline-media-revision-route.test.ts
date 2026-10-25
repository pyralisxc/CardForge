import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PipelineRegistryCommandError } from '@/features/pipeline/lib/pipelineRegistryCommandsError';
const boundary = vi.hoisted(() => ({ owner: vi.fn(), activity: vi.fn(), create: vi.fn(), read: vi.fn() }));
vi.mock('@/features/owner/server', () => ({ getCurrentOwnerAccess: boundary.owner, recordOwnerActivity: boundary.activity }));
vi.mock('@/features/pipeline/server', () => ({ createMediaPresentationRevision: boundary.create, readMediaPresentationRevision: boundary.read, PipelineRegistryCommandError }));
import { GET, POST } from '@/app/api/owner/pipeline/media-revisions/route';
beforeEach(() => { vi.clearAllMocks(); boundary.owner.mockResolvedValue({ isOwner: true, userId: 'acting-owner', email: 'owner@example.invalid' }); boundary.activity.mockResolvedValue(true); boundary.create.mockResolvedValue({ id: 'candidate', status: 'submitted', revisionNumber: 2 }); });
describe('Owner media presentation action', () => {
  it.each([{ isOwner: false, userId: null }, { isOwner: false, userId: 'contributor' }])('denies non-Owner reads and writes before source access', async (access) => {
    boundary.owner.mockResolvedValue(access);
    expect((await GET(new Request('https://example.invalid?assetId=texture'))).status).toBe(access.userId ? 403 : 401);
    expect((await POST(new Request('https://example.invalid', { method: 'POST', body: '{}' }))).status).toBe(access.userId ? 403 : 401);
    expect(boundary.create).not.toHaveBeenCalled(); expect(boundary.read).not.toHaveBeenCalled();
  });
  it('records the acting Owner separately from inherited creator identity', async () => {
    const response = await POST(new Request('https://example.invalid', { method: 'POST', body: JSON.stringify({ assetId: 'texture' }) }));
    expect(response.status).toBe(200);
    expect(boundary.create).toHaveBeenCalledWith({ assetId: 'texture' });
    expect(boundary.activity).toHaveBeenCalledWith(expect.objectContaining({ actorUserId: 'acting-owner', targetId: 'candidate', action: 'library.asset.presentation_revision' }));
  });
  it('preserves conflict and unavailable failure meanings and reports no approval', async () => {
    boundary.create.mockRejectedValueOnce(new PipelineRegistryCommandError('Reload base', 409));
    const conflict = await POST(new Request('https://example.invalid', { method: 'POST', body: '{}' }));
    expect(conflict.status).toBe(409); expect(await conflict.text()).toContain('pipeline_media_conflict');
    boundary.create.mockRejectedValueOnce(new Error('transport'));
    expect((await POST(new Request('https://example.invalid', { method: 'POST', body: '{}' }))).status).toBe(503);
    expect(boundary.activity).not.toHaveBeenCalled();
  });
});
