import { describe, expect, it } from 'vitest';

import { buildAccountProfileSnapshot, buildAccountProfileUtilityGroups } from '@/features/account/lib/accountProfileEnvironment';

const guest = {
  accountEmail: 'No signed-in account', authConfigured: true,
  entitlementLoading: false, entitlementUnavailable: false,
  isContributor: false, isOwner: false, isSignedIn: false, planLabel: 'Free',
};

describe('account profile environment', () => {
  it('presents unresolved identity, access, and authority without inventing a guest account', () => {
    expect(buildAccountProfileSnapshot({ ...guest, entitlementLoading: true })).toMatchObject({
      accountLabel: 'Checking account', identityLabel: 'Checking Clerk account',
      planLabel: 'Checking access', authorityLabel: 'Checking authority',
    });
    expect(buildAccountProfileSnapshot({ ...guest, entitlementUnavailable: true })).toMatchObject({
      accountLabel: 'Account unavailable', identityLabel: 'Identity verification unavailable',
      planLabel: 'Access unavailable', authorityLabel: 'Authority unavailable',
    });
    const groups = buildAccountProfileUtilityGroups({ ...guest, entitlementUnavailable: true });
    expect(groups[0].items.every((item) => item.tone === 'danger')).toBe(true);
    expect(groups[0].items.map((item) => item.value)).toEqual(['Account unavailable', 'Account unavailable']);
  });

  it('only presents Guest and Free after a successful signed-out result', () => {
    expect(buildAccountProfileSnapshot(guest)).toMatchObject({
      accountLabel: 'Guest creator', identityLabel: 'Guest workspace', planLabel: 'Free', authorityLabel: 'Guest',
    });
    expect(buildAccountProfileSnapshot({ ...guest, authConfigured: false })).toMatchObject({
      accountLabel: 'Setup required', identityLabel: 'Authentication setup required',
      planLabel: 'Setup required', authorityLabel: 'Setup required',
    });
  });

  it.each([
    { isOwner: false, isContributor: false, planLabel: 'Free', authorityLabel: 'Creator' },
    { isOwner: false, isContributor: true, planLabel: 'Contributor access', authorityLabel: 'Contributor' },
    { isOwner: true, isContributor: true, planLabel: 'Owner access', authorityLabel: 'Owner' },
  ])('preserves verified $authorityLabel identity and access', ({ authorityLabel, ...access }) => {
    const signedIn = { ...guest, ...access, isSignedIn: true, accountEmail: 'maker@example.com' };
    expect(buildAccountProfileSnapshot(signedIn)).toMatchObject({
      accountLabel: 'maker@example.com', identityLabel: 'Clerk identity connected',
      planLabel: access.planLabel, authorityLabel,
    });
    expect(buildAccountProfileSnapshot({ ...signedIn, entitlementLoading: true })).toMatchObject({
      accountLabel: 'maker@example.com', planLabel: 'Checking access', authorityLabel: 'Checking authority',
    });
    expect(buildAccountProfileSnapshot({ ...signedIn, entitlementUnavailable: true })).toMatchObject({
      accountLabel: 'maker@example.com', planLabel: 'Access unavailable', authorityLabel: 'Authority unavailable',
    });
  });

  it('keeps identity, security, billing, storage, and protected entries in compact groups', () => {
    const groups = buildAccountProfileUtilityGroups({
      accountEmail: 'owner@example.com',
      authConfigured: true,
      entitlementLoading: false,
      entitlementUnavailable: false,
      isContributor: true,
      isOwner: true,
      isSignedIn: true,
      planLabel: 'Owner access',
    });

    expect(groups.map((group) => group.id)).toEqual(['identity-security', 'account-utilities', 'protected-access']);
    expect(groups.flatMap((group) => group.items).map((item) => item.target)).toEqual([
      'clerk', 'clerk', 'billing', 'storage', 'contributor', 'owner',
    ]);
  });

  it('does not relabel an unavailable entitlement as Free', () => {
    const groups = buildAccountProfileUtilityGroups({
      accountEmail: 'maker@example.com',
      authConfigured: true,
      entitlementLoading: false,
      entitlementUnavailable: true,
      isContributor: false,
      isOwner: false,
      isSignedIn: true,
      planLabel: 'Free',
    });
    const billing = groups.flatMap((group) => group.items).find((item) => item.target === 'billing');

    expect(billing).toMatchObject({ value: 'Access unavailable', status: 'Verification unavailable', tone: 'danger' });
    expect(billing?.meta).toContainEqual(['Current access', 'Unavailable — not relabeled as Free']);
  });

  it('keeps loading and unconfigured identity distinct from signed-out and Free', () => {
    const loading = buildAccountProfileUtilityGroups({
      accountEmail: 'No signed-in account', authConfigured: true,
      entitlementLoading: true, entitlementUnavailable: false, isContributor: false, isOwner: false, isSignedIn: false, planLabel: 'Free',
    }).flatMap((group) => group.items);
    const unconfigured = buildAccountProfileUtilityGroups({
      accountEmail: 'No signed-in account', authConfigured: false,
      entitlementLoading: false, entitlementUnavailable: false, isContributor: false, isOwner: false, isSignedIn: false, planLabel: 'Creator Pass',
    }).flatMap((group) => group.items);

    expect(loading.find((item) => item.target === 'clerk')?.value).toBe('Checking account');
    expect(loading.find((item) => item.target === 'billing')?.value).toBe('Checking access');
    expect(unconfigured.find((item) => item.target === 'billing')?.value).toBe('Setup required');
  });
});
