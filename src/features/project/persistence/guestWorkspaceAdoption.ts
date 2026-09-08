import {
  CUSTOM_DIVIDER_ASSETS_STORAGE_KEY,
  CUSTOM_FONT_ASSETS_STORAGE_KEY,
  CUSTOM_ICON_ASSETS_STORAGE_KEY,
  CUSTOM_IMAGE_ASSETS_STORAGE_KEY,
  CUSTOM_TEXTURE_ASSETS_STORAGE_KEY,
} from '../model/projectDocument';
import { copyBrowserProjectAssets } from './contentAddressedBrowserAssets';
import { compareAndSetBrowserWorkspaceValue, createIndexedDbStorage } from './indexedDbStorage';
import { parseBrowserWorkspaceRecord } from './workspaceRevision';

const WORKSPACE_KEY = 'workspace';
const GUEST_SCOPE = 'guest';
const PROJECT_ASSET_KEYS = [
  CUSTOM_TEXTURE_ASSETS_STORAGE_KEY,
  CUSTOM_DIVIDER_ASSETS_STORAGE_KEY,
  CUSTOM_ICON_ASSETS_STORAGE_KEY,
  CUSTOM_IMAGE_ASSETS_STORAGE_KEY,
  CUSTOM_FONT_ASSETS_STORAGE_KEY,
] as const;

type ProjectAssetCatalog = {
  key: typeof PROJECT_ASSET_KEYS[number];
  guestValue: string;
  mergedValue: string;
};

const getNamespace = (base: 'project-workspace' | 'project-assets', scope: string) => `${base}:${scope}`;

const isAccountScope = (scope: string): scope is `account:${string}` => scope.startsWith('account:');

const parseAssetCatalog = (value: string | null, key: string): unknown[] => {
  if (value === null) return [];
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed)) throw new Error(`Local asset storage “${key}” is invalid.`);
  return parsed;
};

const mergeAssetCatalog = ({
  accountValue,
  guestValue,
  key,
}: {
  accountValue: string | null;
  guestValue: string;
  key: string;
}): string => {
  const merged = new Map<string, unknown>();
  parseAssetCatalog(accountValue, key).forEach((asset, index) => {
    const id = typeof asset === 'object' && asset !== null && 'id' in asset && typeof asset.id === 'string'
      ? asset.id : `account-${index}`;
    merged.set(id, asset);
  });
  parseAssetCatalog(guestValue, key).forEach((asset, index) => {
    const id = typeof asset === 'object' && asset !== null && 'id' in asset && typeof asset.id === 'string'
      ? asset.id : `guest-${index}`;
    merged.set(id, asset);
  });
  return JSON.stringify(Array.from(merged.values()));
};

/**
 * A normal sign-in continues the work currently open in this browser. The
 * account's previous browser workspace remains a recovery snapshot. The guest
 * workspace entry is cleared only after the account workspace and its
 * referenced assets commit, so a later account can never receive it.
 */
export const adoptGuestWorkspaceForAccount = async (accountScope: string): Promise<boolean> => {
  if (!isAccountScope(accountScope)) return false;

  const guestWorkspaceStorage = createIndexedDbStorage(getNamespace('project-workspace', GUEST_SCOPE));
  const accountWorkspaceStorage = createIndexedDbStorage(getNamespace('project-workspace', accountScope));
  const guestRaw = await guestWorkspaceStorage.getItem(WORKSPACE_KEY);
  if (!guestRaw) return false;
  const guest = parseBrowserWorkspaceRecord(guestRaw);

  const guestAssets = createIndexedDbStorage(getNamespace('project-assets', GUEST_SCOPE));
  const accountAssets = createIndexedDbStorage(getNamespace('project-assets', accountScope));
  const catalogEntries = await Promise.all(PROJECT_ASSET_KEYS.map(async (key) => {
    const [guestValue, accountValue] = await Promise.all([
      guestAssets.getItem(key),
      accountAssets.getItem(key),
    ]);
    if (guestValue === null) return null;
    return {
      key,
      guestValue,
      mergedValue: mergeAssetCatalog({ accountValue, guestValue, key }),
    };
  }));
  const catalogs = catalogEntries.filter((entry): entry is ProjectAssetCatalog => entry !== null);

  await copyBrowserProjectAssets({ value: guest.value, sourceScope: GUEST_SCOPE, destinationScope: accountScope });
  for (const catalog of catalogs) {
    await copyBrowserProjectAssets({ value: catalog.guestValue, sourceScope: GUEST_SCOPE, destinationScope: accountScope });
  }

  for (const catalog of catalogs) await accountAssets.setItem(catalog.key, catalog.mergedValue);

  const accountRaw = await accountWorkspaceStorage.getItem(WORKSPACE_KEY);
  const account = accountRaw ? parseBrowserWorkspaceRecord(accountRaw) : null;
  const writerId = `guest-sign-in-${accountScope}`;
  const alreadyAdopted = account?.writerId === writerId && account.value === guest.value;
  if (!alreadyAdopted) {
    await compareAndSetBrowserWorkspaceValue({
      namespace: getNamespace('project-workspace', accountScope),
      key: WORKSPACE_KEY,
      value: guest.value,
      expectedRevision: account?.revision ?? 0,
      writerId,
      keepRecoverySnapshot: true,
    });
  }

  await guestWorkspaceStorage.removeItem(WORKSPACE_KEY);
  for (const key of PROJECT_ASSET_KEYS) await guestAssets.removeItem(key);
  return true;
};
