import { describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ owner: vi.fn(), read: vi.fn() }));
vi.mock('@/features/owner/server', () => ({ getCurrentOwnerAccess: mocks.owner }));
vi.mock('@/features/pipeline/server', async () => ({ readExactCandidateReview: mocks.read, exactCandidateIdentitySchema: (await import('@/features/pipeline/lib/exactCandidateReview')).exactCandidateIdentitySchema }));
import { POST } from '@/app/api/pipeline/candidate-review/route';
describe('exact candidate Owner boundary', () => {
  it('denies before source access and rejects incomplete pins', async () => {
    mocks.owner.mockResolvedValue({ isOwner: false, userId: 'contributor' });
    expect((await POST(new Request('http://local', { method: 'POST', body: '{}' }))).status).toBe(403);
    expect(mocks.read).not.toHaveBeenCalled();
    mocks.owner.mockResolvedValue({ isOwner: true, userId: 'owner' });
    expect((await POST(new Request('http://local', { method: 'POST', body: '{}' }))).status).toBe(400);
    expect(mocks.read).not.toHaveBeenCalled();
  });
});
