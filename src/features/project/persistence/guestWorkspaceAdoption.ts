import {
  CUSTOM_DIVIDER_ASSETS_STORAGE_KEY,
  CUSTOM_FONT_ASSETS_STORAGE_KEY,
  CUSTOM_ICON_ASSETS_STORAGE_KEY,
  CUSTOM_IMAGE_ASSETS_STORAGE_KEY,
  CUSTOM_TEXTURE_ASSETS_STORAGE_KEY,
} from '../model/projectDocument';
import { copyBrowserProjectAssets } from './contentAddressedBrowserAssets';
import { compareAndSetBrowserWorkspaceValue, createIndexedDbStorage } from './indexedDbStorage';
import { readStructuredBrowserValue, writeStructuredBrowserValue } from './structuredBrowserStorage';
import {
  parseBrowserWorkspaceRecord,
  type GuestWorkspaceAdoptionChoice,
} from './workspaceRevision';

const WORKSPACE_KEY = 'workspace';
const GUEST_SCOPE = 'guest';
const PROJECT_ASSET_KEYS = [
  CUSTOM_TEXTURE_ASSETS_STORAGE_KEY,
  CUSTOM_DIVIDER_ASSETS_STORAGE_KEY,
  CUSTOM_ICON_ASSETS_STORAGE_KEY,
  CUSTOM_IMAGE_ASSETS_STORAGE_KEY,
  CUSTOM_FONT_ASSETS_STORAGE_KEY,
] as const;

const getNamespace = (base: 'project-workspace' | 'project-assets', scope: string) => `${base}:${scope}`;
const getDecisionKey = (accountScope: string) => `guest-workspace-adoption:${accountScope}`;

interface GuestAdoptionDecision {
  guestRevision: number;
  choice: GuestWorkspaceAdoptionChoice;
}

export interface GuestWorkspaceAdoptionOffer {
  guestRevision: number;
  hasAccountWorkspace: boolean;
}

const isAccountScope = (scope: string): scope is `account:${string}` => scope.startsWith('account:');

export const inspectGuestWorkspaceAdoption = async (
  accountScope: string,
): Promise<GuestWorkspaceAdoptionOffer | null> => {
  if (!isAccountScope(accountScope)) return null;
  const guestRaw = await createIndexedDbStorage(getNamespace('project-workspace', GUEST_SCOPE)).getItem(WORKSPACE_KEY);
  if (!guestRaw) return null;
  const guest = parseBrowserWorkspaceRecord(guestRaw);
  const decision = await readStructuredBrowserValue<GuestAdoptionDecision>(getDecisionKey(accountScope));
  if (decision?.guestRevision === guest.revision) return null;
  const accountRaw = await createIndexedDbStorage(getNamespace('project-workspace', accountScope)).getItem(WORKSPACE_KEY);
  return { guestRevision: guest.revision, hasAccountWorkspace: Boolean(accountRaw) };
};

export const applyGuestWorkspaceAdoption = async ({
  accountScope,
  choice,
}: {
  accountScope: string;
  choice: GuestWorkspaceAdoptionChoice;
}): Promise<void> => {
  if (!isAccountScope(accountScope)) throw new Error('Guest work can only be adopted into a signed-in account workspace.');
  const guestWorkspaceStorage = createIndexedDbStorage(getNamespace('project-workspace', GUEST_SCOPE));
  const accountWorkspaceStorage = createIndexedDbStorage(getNamespace('project-workspace', accountScope));
  const guestRaw = await guestWorkspaceStorage.getItem(WORKSPACE_KEY);
  if (!guestRaw) return;
  const guest = parseBrowserWorkspaceRecord(guestRaw);

  if (choice === 'replace-with-guest-workspace') {
    const pendingAssetCatalogCopies: Array<{ key: string; value: string }> = [];
    await copyBrowserProjectAssets({ value: guest.value, sourceScope: GUEST_SCOPE, destinationScope: accountScope });
    const guestAssets = createIndexedDbStorage(getNamespace('project-assets', GUEST_SCOPE));
    for (const key of PROJECT_ASSET_KEYS) {
      const value = await guestAssets.getItem(key);
      if (value === null) continue;
      await copyBrowserProjectAssets({ value, sourceScope: GUEST_SCOPE, destinationScope: accountScope });
      pendingAssetCatalogCopies.push({ key, value });
    }

    const accountRaw = await accountWorkspaceStorage.getItem(WORKSPACE_KEY);
    const accountRevision = accountRaw ? parseBrowserWorkspaceRecord(accountRaw).revision : 0;
    await compareAndSetBrowserWorkspaceValue({
      namespace: getNamespace('project-workspace', accountScope),
      key: WORKSPACE_KEY,
      value: guest.value,
      expectedRevision: accountRevision,
      writerId: `guest-adoption-${accountScope}`,
      keepRecoverySnapshot: true,
    });
    const accountAssets = createIndexedDbStorage(getNamespace('project-assets', accountScope));
    for (const copy of pendingAssetCatalogCopies) await accountAssets.setItem(copy.key, copy.value);
  }

  await writeStructuredBrowserValue(getDecisionKey(accountScope), {
    guestRevision: guest.revision,
    choice,
  } satisfies GuestAdoptionDecision);
};
