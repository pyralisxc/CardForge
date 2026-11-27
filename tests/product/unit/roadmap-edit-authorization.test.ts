import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ owner: false, active: true, scopes: [] as string[], publish: vi.fn() }));
vi.mock('@clerk/nextjs/server', () => ({ currentUser: vi.fn() }));
vi.mock('@/features/account/server', () => ({
  AccountIdentityUnavailableError: class extends Error { status = 503; },
  AccountToolAccessError: class extends Error { status = 401; },
  getCurrentAccountToolAccess: async () => ({ user: { id: 'editor' }, email: null, isOwner: state.owner }),
}));
vi.mock('@/features/contributor-access/server', () => ({
  ContributorAccessStoreError: class extends Error { status = 503; },
  hasContributionScope: (scopes: string[], scope: string) => scopes.includes(scope),
  readContributorCapabilities: async () => ({ active: state.active, scopes: state.scopes }),
}));
vi.mock('@/features/roadmap/server', () => ({ RoadmapStoreError: class extends Error { status = 400; } }));
vi.mock('@/features/owner/server/ownerSiteCommands', () => ({ publishOwnerRoadmapDetails: state.publish }));
import { PATCH } from '@/app/api/roadmap/items/[itemId]/route';
const request = (body: object) => new Request('http://localhost/api/roadmap/items/real', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const context = { params: Promise.resolve({ itemId: 'real' }) };
beforeEach(() => { state.owner = false; state.active = true; state.scopes = []; state.publish.mockReset(); state.publish.mockResolvedValue({ value: {}, receipt: { committed: true } }); });
it('requires the specific active Contributor grant and takes item identity from the route', async () => {
  expect((await PATCH(request({ itemType: 'feature' }), context)).status).toBe(403);
  state.scopes = ['roadmap.edit'];
  state.active = false;
  expect((await PATCH(request({ itemType: 'feature' }), context)).status).toBe(403);
  state.active = true;
  expect((await PATCH(request({ itemType: 'feature', itemId: 'forged' }), context)).status).toBe(200);
  expect(state.publish).toHaveBeenCalledWith(expect.objectContaining({ actor: { userId: 'editor', email: null }, input: expect.objectContaining({ itemId: 'real' }) }));
});
it('prevents scoped Contributors from editing expense records or injecting cost fields', async () => {
  state.scopes = ['roadmap.edit'];
  expect((await PATCH(request({ itemType: 'roi_checkpoint' }), context)).status).toBe(403);
  expect((await PATCH(request({ itemType: 'feature', monthlyCostCents: 1 }), context)).status).toBe(403);
  expect(state.publish).not.toHaveBeenCalled();
  state.owner = true;
  expect((await PATCH(request({ itemType: 'roi_checkpoint' }), context)).status).toBe(200);
});
