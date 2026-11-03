import { beforeEach, expect, it, vi } from 'vitest';

const f = vi.hoisted(() => ({ owner: vi.fn(), getUser: vi.fn(), deleteUser: vi.fn(), profiles: vi.fn(), update: vi.fn(), activity: vi.fn() }));
vi.mock('@clerk/nextjs/server', () => ({ clerkClient: async () => ({ users: { getUser: f.getUser, deleteUser: f.deleteUser } }) }));
vi.mock('@/features/account/server', () => import('@/features/account/server/accountAdministration'));
vi.mock('@/features/contributor-access/server', async () => ({
  ...await import('@/features/contributor-access/server/profileStore'),
  CONTRIBUTOR_PROFILE_STATUSES: ['active', 'inactive', 'suspended', 'invited'],
  fetchContributorProfileRows: f.profiles, updateContributorProfileControl: f.update,
}));
vi.mock('@/features/owner/lib/serverOwnerAccess', () => ({ getCurrentOwnerAccess: f.owner }));
vi.mock('@/features/owner/server/ownerActivityStore', () => ({ recordOwnerActivity: f.activity }));
import { deleteOwnerPerson, updateOwnerPerson } from '@/features/owner/server/ownerPeopleOperations';

const input = { userId: 'user_target', confirmation: 'target@example.invalid' };
beforeEach(() => {
  vi.resetAllMocks();
  f.owner.mockResolvedValue({ isOwner: true, userId: 'owner_one', email: 'owner@example.invalid' });
  f.getUser.mockResolvedValue({ id: input.userId, firstName: 'Target', emailAddresses: [{ emailAddress: input.confirmation }], privateMetadata: {}, publicMetadata: {} });
  f.deleteUser.mockResolvedValue({ id: input.userId });
  f.profiles.mockResolvedValue([{ clerk_user_id: input.userId, monthly_submission_limit_override: 7, monthly_published_requirement_override: 2, owner_note: 'Preserved' }]);
  f.update.mockResolvedValue(undefined); f.activity.mockResolvedValue(true);
});

for (const failure of ['none', 'profile_read', 'profile_update', 'activity_false', 'activity_reject'] as const) it(`keeps acknowledged deletion committed after ${failure}, with one provider deletion and history attempt`, async () => {
  if (failure === 'profile_read') f.profiles.mockRejectedValue(new Error('profile storage unavailable'));
  if (failure === 'profile_update') f.update.mockRejectedValue(new Error('profile update unavailable'));
  if (failure === 'activity_false') f.activity.mockResolvedValue(false);
  if (failure === 'activity_reject') f.activity.mockRejectedValue(new Error('history unavailable'));
  const result = await deleteOwnerPerson(input);
  expect(result).toMatchObject({ userId: input.userId, outcome: 'committed', committed: true, retryable: false,
    profileReconciled: !failure.startsWith('profile'), activityRecorded: !failure.startsWith('activity'), reconciliationComplete: failure === 'none' });
  expect(f.deleteUser).toHaveBeenCalledExactlyOnceWith(input.userId);
  expect(f.activity).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ action: 'people.account.delete', targetId: input.userId }));
  if (failure === 'none') {
    expect(result.warnings).toEqual([]);
    expect(f.update).toHaveBeenCalledExactlyOnceWith({ contributorId: input.userId, status: 'inactive', canDraftCampaigns: false, monthlySubmissionLimitOverride: 7, monthlyPublishedRequirementOverride: 2, ownerNote: 'Preserved' });
  } else expect(result.warnings.length).toBeGreaterThan(0);
});
it('attempts history independently when both profile and history fail', async () => {
  f.profiles.mockRejectedValue(new Error('profile unavailable')); f.activity.mockRejectedValue(new Error('history unavailable'));
  const result = await deleteOwnerPerson(input);
  expect(result).toMatchObject({ committed: true, profileReconciled: false, activityRecorded: false });
  expect(result.warnings).toHaveLength(2); expect(f.deleteUser).toHaveBeenCalledOnce(); expect(f.activity).toHaveBeenCalledOnce();
});
it('treats an authoritative absent retained profile as reconciled without creating one', async () => {
  f.profiles.mockResolvedValue([]);
  expect(await deleteOwnerPerson(input)).toMatchObject({ committed: true, profileReconciled: true });
  expect(f.update).not.toHaveBeenCalled(); expect(f.activity).toHaveBeenCalledOnce();
});
it('reports unknown provider outcome without profile/history follow-ups or replay', async () => {
  f.deleteUser.mockRejectedValue(new Error('provider acknowledgement lost'));
  expect(await deleteOwnerPerson(input)).toMatchObject({ outcome: 'uncertain', committed: null, activityRecorded: null, profileReconciled: null, retryable: false, nextAction: 'read' });
  expect(f.deleteUser).toHaveBeenCalledOnce(); expect(f.profiles).not.toHaveBeenCalled(); expect(f.activity).not.toHaveBeenCalled();
});
for (const protection of ['nonowner', 'self', 'target_owner', 'confirmation', 'target_read'] as const) it(`preserves ${protection} protection before provider deletion`, async () => {
  if (protection === 'nonowner') f.owner.mockResolvedValue({ isOwner: false, userId: 'ordinary' });
  if (protection === 'target_owner') f.getUser.mockResolvedValue({ id: input.userId, emailAddresses: [{ emailAddress: input.confirmation }], privateMetadata: { cardforgeRole: 'owner' }, publicMetadata: {} });
  if (protection === 'target_read') f.getUser.mockRejectedValue(new Error('target unavailable'));
  await expect(deleteOwnerPerson({ ...input, ...(protection === 'self' ? { userId: 'owner_one' } : protection === 'confirmation' ? { confirmation: 'wrong' } : {}) })).rejects.toThrow();
  expect(f.deleteUser).not.toHaveBeenCalled(); expect(f.profiles).not.toHaveBeenCalled(); expect(f.activity).not.toHaveBeenCalled();
});
it('reuses retained-history deactivation without another Clerk delete', async () => {
  await updateOwnerPerson({ userId: input.userId, action: 'deactivate_history' });
  expect(f.update).toHaveBeenCalledOnce(); expect(f.deleteUser).not.toHaveBeenCalled(); expect(f.getUser).not.toHaveBeenCalled();
});
