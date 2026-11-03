import { beforeEach, expect, it, vi } from 'vitest';
const deletion = vi.hoisted(() => vi.fn());
vi.mock('@/features/owner/server', () => ({ deleteOwnerPerson: deletion, ownerPeopleErrorFromUnknown: () => null }));
import { DELETE } from '@/app/api/owner/people/route';

const request = () => new Request('https://cardforge.test/api/owner/people', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId: 'exact-person', confirmation: 'person@example.invalid' }) });
beforeEach(() => vi.resetAllMocks());
it('returns acknowledged deletion with reconciliation warnings as committed, not a failed delete', async () => {
  deletion.mockResolvedValue({ userId: 'exact-person', outcome: 'committed', committed: true, warnings: ['Retained profile unavailable'], activityRecorded: true, profileReconciled: false, reconciliationComplete: false, retryable: false, nextAction: 'read' });
  const response = await DELETE(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ userId: 'exact-person', committed: true, reconciliationComplete: false });
  expect(deletion).toHaveBeenCalledExactlyOnceWith({ userId: 'exact-person', confirmation: 'person@example.invalid' });
});
it('returns uncertain provider outcome with nonretryable exact-read guidance and no false commit', async () => {
  deletion.mockResolvedValue({ userId: 'exact-person', outcome: 'uncertain', committed: null, warnings: ['Clerk acknowledgement is unconfirmed.'], activityRecorded: null, profileReconciled: null, reconciliationComplete: false, retryable: false, nextAction: 'read' });
  const response = await DELETE(request());
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({ error: { retryable: false, nextAction: expect.stringContaining('do not replay automatically') }, receipt: { userId: 'exact-person', outcome: 'uncertain', committed: null } });
  expect(deletion).toHaveBeenCalledOnce();
});
