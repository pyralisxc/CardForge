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
  const identityValue = !authConfigured
    ? 'Setup required'
    : entitlementLoading && !isSignedIn
      ? 'Checking account'
    : isSignedIn
      ? accountEmail
      : 'Sign in required';
  const identityStatus = !authConfigured
    ? 'Authentication unavailable'
    : entitlementLoading && !isSignedIn
      ? 'Checking Clerk account'
    : isSignedIn
      ? 'Clerk account connected'
      : 'Authentication required';
  const identityTone: AccountProfileUtilityTone = isSignedIn ? 'success' : entitlementLoading ? 'neutral' : 'warning';
  const accessValue = !authConfigured
    ? 'Setup required'
    : entitlementUnavailable
      ? 'Access unavailable'
      : entitlementLoading
        ? 'Checking access'
        : planLabel;
  const accessStatus = !authConfigured
    ? 'Authentication setup required'
    : entitlementUnavailable
      ? 'Verification unavailable'
      : entitlementLoading
        ? 'Verifying account access'
        : 'Current account access';
  const accessTone: AccountProfileUtilityTone = entitlementUnavailable
    ? 'danger'
    : !authConfigured
      ? 'warning'
      : 'neutral';
  const securityValue = !authConfigured
    ? 'Setup required'
    : entitlementLoading && !isSignedIn
      ? 'Checking account'
      : isSignedIn
        ? 'Managed by Clerk'
        : 'Sign in required';
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
      summary: 'Granted scopes, personal progress, and site proposals',
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
      title: 'Owner workspace',
      summary: 'Operate CardForge, governed records, and provider readiness',
      value: 'Owner access',
      status: 'Access granted',
      tone: 'success',
      target: 'owner',
      meta: [
        ['Authority', 'Owner'],
        ['Workspace', 'Owner'],
        ['Operations', 'Protected CardForge controls'],
        ['Management', 'Open Owner workspace'],
      ],
    });
  }
  if (protectedItems.length > 0) groups.push({ id: 'protected-access', title: 'Protected access', items: protectedItems });

  return groups;
}
