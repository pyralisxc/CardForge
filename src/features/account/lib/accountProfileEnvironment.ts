export type AccountProfileUtilityTarget = 'clerk' | 'billing' | 'storage' | 'contributor' | 'owner';
export type AccountProfileUtilityTone = 'neutral' | 'success' | 'warning' | 'danger';

export interface AccountProfileUtility {
  id: string;
  kind: string;
  eyebrow: string;
  title: string;
  summary: string;
  value: string;
  status: string;
  tone: AccountProfileUtilityTone;
  target: AccountProfileUtilityTarget;
  meta: ReadonlyArray<readonly [string, string]>;
}

export interface AccountProfileUtilityGroup {
  id: string;
  title: string;
  items: readonly AccountProfileUtility[];
}

interface BuildAccountProfileUtilitiesInput {
  accountEmail: string;
  authConfigured: boolean;
  entitlementLoading: boolean;
  entitlementUnavailable: boolean;
  isContributor: boolean;
  isOwner: boolean;
  isSignedIn: boolean;
  planLabel: string;
}

export function buildAccountProfileSnapshot({
  accountEmail, authConfigured, entitlementLoading, entitlementUnavailable,
  isContributor, isOwner, isSignedIn, planLabel,
}: BuildAccountProfileUtilitiesInput) {
  const unresolvedIdentity = !isSignedIn && (entitlementLoading || entitlementUnavailable);
  const accountLabel = !authConfigured ? 'Setup required'
    : isSignedIn ? accountEmail
      : entitlementUnavailable ? 'Account unavailable'
        : entitlementLoading ? 'Checking account' : 'Guest creator';
  const identityLabel = !authConfigured ? 'Authentication setup required'
    : isSignedIn ? 'Clerk identity connected'
      : entitlementUnavailable ? 'Identity verification unavailable'
        : entitlementLoading ? 'Checking Clerk account' : 'Guest workspace';
  const identityTone: AccountProfileUtilityTone = !authConfigured ? 'warning'
    : isSignedIn ? 'success'
      : entitlementUnavailable ? 'danger' : entitlementLoading ? 'neutral' : 'warning';
  const accessLabel = !authConfigured ? 'Setup required'
    : entitlementUnavailable ? 'Access unavailable'
      : entitlementLoading ? 'Checking access' : planLabel;
  const accessTone: AccountProfileUtilityTone = !authConfigured ? 'warning'
    : entitlementUnavailable ? 'danger' : 'neutral';
  const authorityLabel = !authConfigured ? 'Setup required'
    : entitlementUnavailable ? 'Authority unavailable'
      : entitlementLoading ? 'Checking authority'
        : isOwner ? 'Owner' : isContributor ? 'Contributor' : isSignedIn ? 'Creator' : 'Guest';

  return { accountLabel, identityLabel, identityTone, planLabel: accessLabel, accessTone, authorityLabel, unresolvedIdentity };
}

export function buildAccountProfileUtilityGroups({
  accountEmail,
  authConfigured,
  entitlementLoading,
  entitlementUnavailable,
  isContributor,
  isOwner,
  isSignedIn,
  planLabel,
}: BuildAccountProfileUtilitiesInput): readonly AccountProfileUtilityGroup[] {
  const snapshot = buildAccountProfileSnapshot({
    accountEmail, authConfigured, entitlementLoading, entitlementUnavailable,
    isContributor, isOwner, isSignedIn, planLabel,
  });
  const confirmedGuest = authConfigured && !isSignedIn && !snapshot.unresolvedIdentity;
  const identityValue = confirmedGuest ? 'Sign in required' : snapshot.accountLabel;
  const identityStatus = confirmedGuest ? 'Authentication required' : snapshot.identityLabel;
  const identityTone = snapshot.identityTone;
  const accessValue = snapshot.planLabel;
  const accessStatus = !authConfigured
    ? 'Authentication setup required'
    : entitlementUnavailable
      ? 'Verification unavailable'
      : entitlementLoading
        ? 'Verifying account access'
        : 'Current account access';
  const accessTone = snapshot.accessTone;
  const securityValue = authConfigured && isSignedIn ? 'Managed by Clerk' : identityValue;
  const storageValue = !authConfigured
    ? 'Local workspace only'
    : entitlementUnavailable
      ? 'Account locations unavailable'
      : entitlementLoading
        ? 'Checking locations'
        : 'Device and provider locations';

  const groups: AccountProfileUtilityGroup[] = [{
    id: 'identity-security',
    title: 'Identity & security',
    items: [{
      id: 'profile-identity',
      kind: 'profile-identity',
      eyebrow: 'Identity',
      title: 'Email & identity',
      summary: 'Name, avatar, verified addresses, and account details',
      value: identityValue,
      status: identityStatus,
      tone: identityTone,
      target: 'clerk',
      meta: [
        ['Provider', 'Clerk'],
        ['Account', identityValue],
        ['State', identityStatus],
        ['Management', 'Provider-native profile controls'],
      ],
    }, {
      id: 'profile-security',
      kind: 'profile-security',
      eyebrow: 'Security',
      title: 'Sign-in & security',
      summary: 'Sign-in methods, devices, sessions, and security controls',
      value: securityValue,
      status: identityStatus,
      tone: identityTone,
      target: 'clerk',
      meta: [
        ['Provider', 'Clerk'],
        ['Sign-in methods', 'Managed by Clerk'],
        ['Devices and sessions', 'Managed by Clerk'],
        ['Management', 'Provider-native security controls'],
      ],
    }],
  }, {
    id: 'account-utilities',
    title: 'Account utilities',
    items: [{
      id: 'profile-plan-billing',
      kind: 'profile-plan-billing',
      eyebrow: 'Access',
      title: 'Plan, billing & usage',
      summary: 'Product access, Stripe billing, and assisted-work usage',
      value: accessValue,
      status: accessStatus,
      tone: accessTone,
      target: 'billing',
      meta: [
        ['Current access', !authConfigured ? 'Authentication setup required' : entitlementUnavailable ? 'Unavailable — not relabeled as Free' : entitlementLoading ? 'Checking account access' : planLabel],
        ['Checkout and invoices', 'Stripe'],
        ['Assisted-work usage', 'CardForge account usage'],
        ['Management', 'Open focused plan and billing ledger'],
      ],
    }, {
      id: 'profile-storage-connections',
      kind: 'profile-storage-connections',
      eyebrow: 'Connections',
      title: 'Storage & connections',
      summary: 'Provider permissions, durable locations, and temporary AI work',
      value: storageValue,
      status: 'Managed by source',
      tone: 'neutral',
      target: 'storage',
      meta: [
        ['Durable locations', 'This device, project files, local folders, and Google Drive'],
        ['Temporary AI work', 'Retention-managed CardForge workspace'],
        ['Provider permissions', 'Managed at the source'],
        ['Management', 'Open location controls'],
      ],
    }],
  }];

  const protectedItems: AccountProfileUtility[] = [];
  if (isContributor || isOwner) {
    protectedItems.push({
      id: 'profile-contributor-access',
      kind: 'profile-contributor-access',
      eyebrow: 'Contributor access',
      title: 'Contributor profile',
      summary: 'Granted scopes, personal progress, and shared-work access',
      value: isOwner ? 'Owner-grade access' : 'Contributor access',
      status: 'Access granted',
      tone: 'success',
      target: 'contributor',
      meta: [
        ['Authority', isOwner ? 'Owner and contributor' : 'Contributor'],
        ['Shared work', 'Desk and Library'],
        ['Publication', 'Owner-governed'],
        ['Management', 'Open contributor profile'],
      ],
    });
  }
  if (isOwner) {
    protectedItems.push({
      id: 'profile-owner-access',
      kind: 'profile-owner-access',
      eyebrow: 'Owner access',
      title: 'Owner operations',
      summary: 'Protected CardForge controls, governed records, and provider readiness',
      value: 'Owner access',
      status: 'Access granted',
      tone: 'success',
      target: 'owner',
      meta: [
        ['Authority', 'Owner'],
        ['Surface', 'Profile'],
        ['Operations', 'Protected CardForge controls'],
        ['Management', 'Open protected operations'],
      ],
    });
  }
  if (protectedItems.length > 0) groups.push({ id: 'protected-access', title: 'Protected access', items: protectedItems });

  return groups;
}
