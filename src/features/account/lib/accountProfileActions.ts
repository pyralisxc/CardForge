const manageAccountAction = {
  id: 'profile.manage-account', label: 'Manage identity', ownerFeature: 'account',
  supportedObjectKinds: [], supportedSources: [], revisionPolicy: 'none', requiredPermission: 'guest',
  scope: 'zone', hierarchy: 'primary', availability: { kind: 'available' }, commitment: 'none',
  automation: { kind: 'human-only', owner: 'provider' }, result: 'provider-handoff',
} as const;

const closeUtilityAction = {
  id: 'profile.close-utility', label: 'Profile overview', ownerFeature: 'account',
  supportedObjectKinds: [], supportedSources: [], revisionPolicy: 'none', requiredPermission: 'guest',
  scope: 'zone', hierarchy: 'primary', availability: { kind: 'available' }, commitment: 'none',
  automation: { kind: 'human-only', owner: 'cardforge' }, result: 'navigation',
} as const;

export const createAccountProfileOperations = ({
  utilityOpen,
  closeUtility,
  openIdentity,
}: {
  utilityOpen: boolean;
  closeUtility: () => void;
  openIdentity: () => void;
}) => utilityOpen
  ? [{ descriptor: closeUtilityAction, execute: async () => {
      closeUtility();
      return { kind: 'navigation' as const, href: '/account?section=profile' };
    } }]
  : [{ descriptor: manageAccountAction, execute: async () => {
      openIdentity();
      return { kind: 'provider-handoff' as const, href: '/account?section=profile&utility=identity' };
    } }];
