import { describe, expect, it } from 'vitest';

import { buildAccountProfileUtilityGroups } from '@/features/account/lib/accountProfileEnvironment';

describe('account profile environment', () => {
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
