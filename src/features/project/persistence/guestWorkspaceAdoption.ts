import {
  CUSTOM_DIVIDER_ASSETS_STORAGE_KEY,
  CUSTOM_FONT_ASSETS_STORAGE_KEY,
  CUSTOM_ICON_ASSETS_STORAGE_KEY,
  CUSTOM_IMAGE_ASSETS_STORAGE_KEY,
  CUSTOM_TEXTURE_ASSETS_STORAGE_KEY,
} from '../model/projectDocument';
import { copyBrowserProjectAssets } from './contentAddressedBrowserAssets';
import {
  compareAndSetBrowserWorkspaceValue,
  createIndexedDbStorage,
} from './indexedDbStorage';
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
  accountValue: string | null;
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
    if (merged.has(id) && JSON.stringify(merged.get(id)) !== JSON.stringify(asset)) {
      throw new Error('Guest artwork conflicts with an existing account asset. Both copies were left unchanged; use an explicit backup import.');
    }
    merged.set(id, asset);
  });
  return JSON.stringify(Array.from(merged.values()));
};

/**
 * First sign-in can adopt guest work into an account with no saved workspace.
 * Returning accounts always resume their own saved work; the guest lane stays
 * separate for explicit recovery/import. Sign-in never replaces account work.
 */
export const adoptGuestWorkspaceForAccount = async (accountScope: string, signal?: AbortSignal): Promise<boolean> => {
  signal?.throwIfAborted();
  if (!isAccountScope(accountScope)) return false;

  const guestWorkspaceStorage = createIndexedDbStorage(getNamespace('project-workspace', GUEST_SCOPE));
  const accountWorkspaceStorage = createIndexedDbStorage(getNamespace('project-workspace', accountScope));
  // Guest startup may persist an empty/default-only state after sign-out. Even
  // authored guest work is not permission to replace a returning account.
  if (await accountWorkspaceStorage.getItem(WORKSPACE_KEY) !== null) return false;
  const guestRaw = await guestWorkspaceStorage.getItem(WORKSPACE_KEY);
  if (!guestRaw) return false;
  const guest = parseBrowserWorkspaceRecord(guestRaw);
  const payload = JSON.parse(guest.value) as { state?: unknown } | null;
  if (!payload || typeof payload.state !== 'object' || payload.state === null || Array.isArray(payload.state)) {
    throw new Error('The guest workspace is unreadable. Original browser data was left unchanged.');
  }

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
      accountValue,
      mergedValue: mergeAssetCatalog({ accountValue, guestValue, key }),
    };
  }));
  const catalogs = catalogEntries.filter((entry): entry is ProjectAssetCatalog => entry !== null);

  signal?.throwIfAborted();
  await copyBrowserProjectAssets({ value: guest.value, sourceScope: GUEST_SCOPE, destinationScope: accountScope });
  for (const catalog of catalogs) {
    signal?.throwIfAborted();
    await copyBrowserProjectAssets({ value: catalog.guestValue, sourceScope: GUEST_SCOPE, destinationScope: accountScope });
  }

  // Publish the first account workspace, transfer its catalogs, and consume the
  // exact guest source in one native transaction. A concurrent guest/account
  // writer rejects the handoff instead of losing either side's latest work.
  await compareAndSetBrowserWorkspaceValue({
    namespace: getNamespace('project-workspace', accountScope),
    key: WORKSPACE_KEY,
    value: guest.value,
    expectedRevision: 0,
    requireAbsent: true,
    signal,
    beforeCommit: () => signal?.throwIfAborted(),
    writerId: `guest-sign-in-${accountScope}`,
    relatedWrites: [
      { key: `${getNamespace('project-workspace', GUEST_SCOPE)}:${WORKSPACE_KEY}`, value: null, expectedValue: guestRaw },
      ...catalogs.flatMap((catalog) => [
        { key: `${getNamespace('project-assets', accountScope)}:${catalog.key}`, value: catalog.mergedValue, expectedValue: catalog.accountValue },
        { key: `${getNamespace('project-assets', GUEST_SCOPE)}:${catalog.key}`, value: null, expectedValue: catalog.guestValue },
      ]),
    ],
  });
  return true;
};
