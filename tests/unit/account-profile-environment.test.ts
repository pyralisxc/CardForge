import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildAccountProfileUtilityGroups } from '@/features/account/lib/accountProfileEnvironment';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

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

  it('uses the Environment shell while keeping the native Clerk surface intact', () => {
    const accountPage = readSource('src/app/account/page.tsx');
    const homeBoundary = readSource('src/features/account/components/AccountHomeBoundary.tsx');
    const environment = readSource('src/app/account/_components/AccountProfileEnvironment.tsx');
    const providerSurface = readSource('src/features/account/components/ProfileManagementPage.tsx');
    const actionOwner = readSource('src/features/account/lib/accountProfileActions.ts');

    expect(accountPage).toContain("activeSection === 'profile'");
    expect(accountPage).toContain('<AccountProfileEnvironment');
    expect(homeBoundary).not.toContain('<AccountProfileEnvironment');
    expect(environment).toContain('<EnvironmentShell');
    expect(environment).toContain('createActionRuntime(actionDefinitions)');
    expect(environment).not.toContain("if (action.id === 'profile.");
    expect(actionOwner).toContain('descriptor: closeUtilityAction');
    expect(actionOwner).toContain('descriptor: manageAccountAction');
    expect(environment).toContain('activeZone="profile"');
    expect(environment).toContain('<CompactSettingRow');
    expect(environment).toContain("activeUtility === 'billing'");
    expect(environment).toContain("activeUtility === 'identity'");
    expect(environment).toContain("router.push('/account?section=profile&utility=identity')");
    expect(environment).toContain('detail={null}');
    expect(environment).toContain('onOpen={() => openUtility(item.target)}');
    expect(environment).toContain('<AccountPlanBillingUtility');
    expect(environment).toContain('<ProfileManagementPage authConfigured={entitlement.authConfigured} />');
    expect(environment).not.toContain('<AccountWorkspaceHeader');
    expect(environment).not.toContain('<AccountUtilityPanel');
    expect(providerSurface).toContain('<UserProfile');
    expect(providerSurface).not.toContain('elements:');
  });
});
