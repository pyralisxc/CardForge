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

export interface RetainedGuestWorkspace {
  accountScope: `account:${string}`;
  guestRaw: string;
  guestRevision: number;
  workspaceValue: string;
  state: Record<string, unknown>;
  catalogs: Partial<Record<typeof PROJECT_ASSET_KEYS[number], { raw: string; values: unknown[] }>>;
  setCount: number;
  cardCount: number;
  templateCount: number;
}

const getNamespace = (base: 'project-workspace' | 'project-assets', scope: string) => `${base}:${scope}`;

const isAccountScope = (scope: string): scope is `account:${string}` => scope.startsWith('account:');

const parseAssetCatalog = (value: string | null, key: string): unknown[] => {
  if (value === null) return [];
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed)) throw new Error(`Local asset storage “${key}” is invalid.`);
  return parsed;
};

const parseGuestState = (workspaceValue: string): Record<string, unknown> => {
  const payload = JSON.parse(workspaceValue) as { state?: unknown } | null;
  if (!payload || typeof payload.state !== 'object' || payload.state === null || Array.isArray(payload.state)) {
    throw new Error('The guest workspace is unreadable. Original browser data was left unchanged.');
  }
  return payload.state as Record<string, unknown>;
};

const getArrayCount = (state: Record<string, unknown>, key: string) => Array.isArray(state[key]) ? state[key].length : 0;

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

/** Read signed-out authored work that was deliberately kept beside a returning account. */
export const readRetainedGuestWorkspaceForAccount = async (accountScope: string): Promise<RetainedGuestWorkspace | null> => {
  if (!isAccountScope(accountScope)) return null;
  const accountWorkspaceStorage = createIndexedDbStorage(getNamespace('project-workspace', accountScope));
  if (await accountWorkspaceStorage.getItem(WORKSPACE_KEY) === null) return null;
  const guestWorkspaceStorage = createIndexedDbStorage(getNamespace('project-workspace', GUEST_SCOPE));
  const guestRaw = await guestWorkspaceStorage.getItem(WORKSPACE_KEY);
  if (!guestRaw) return null;
  const guest = parseBrowserWorkspaceRecord(guestRaw);
  const state = parseGuestState(guest.value);
  const setCount = getArrayCount(state, 'cardSets');
  const cardCount = getArrayCount(state, 'storedCards');
  const templateCount = getArrayCount(state, 'userTemplates');
  if (setCount === 0 && cardCount === 0 && templateCount === 0) return null;
  const guestAssets = createIndexedDbStorage(getNamespace('project-assets', GUEST_SCOPE));
  const catalogEntries = await Promise.all(PROJECT_ASSET_KEYS.map(async (key) => {
    const raw = await guestAssets.getItem(key);
    return raw === null ? null : [key, { raw, values: parseAssetCatalog(raw, key) }] as const;
  }));
  return {
    accountScope,
    guestRaw,
    guestRevision: guest.revision,
    workspaceValue: guest.value,
    state,
    catalogs: Object.fromEntries(catalogEntries.filter((entry): entry is NonNullable<typeof entry> => entry !== null)),
    setCount,
    cardCount,
    templateCount,
  };
};

export const prepareRetainedGuestWorkspaceAssetsForAccount = async (
  retained: RetainedGuestWorkspace,
  signal?: AbortSignal,
): Promise<void> => {
  signal?.throwIfAborted();
  await copyBrowserProjectAssets({ value: retained.workspaceValue, sourceScope: GUEST_SCOPE, destinationScope: retained.accountScope });
  for (const catalog of Object.values(retained.catalogs)) {
    signal?.throwIfAborted();
    if (catalog) await copyBrowserProjectAssets({ value: catalog.raw, sourceScope: GUEST_SCOPE, destinationScope: retained.accountScope });
  }
};

export const consumeRetainedGuestWorkspaceForAccount = async (
  retained: RetainedGuestWorkspace,
  signal?: AbortSignal,
): Promise<boolean> => {
  signal?.throwIfAborted();
  const accountStorage = createIndexedDbStorage(getNamespace('project-workspace', retained.accountScope));
  const accountRaw = await accountStorage.getItem(WORKSPACE_KEY);
  if (!accountRaw) return false;
  const account = parseBrowserWorkspaceRecord(accountRaw);
  const guestWorkspaceStorage = createIndexedDbStorage(getNamespace('project-workspace', GUEST_SCOPE));
  if (await guestWorkspaceStorage.getItem(WORKSPACE_KEY) !== retained.guestRaw) return false;
  const guestAssets = createIndexedDbStorage(getNamespace('project-assets', GUEST_SCOPE));
  const relatedWrites: Array<{ key: string; value: null; expectedValue: string | null }> = [
    { key: `${getNamespace('project-workspace', GUEST_SCOPE)}:${WORKSPACE_KEY}`, value: null, expectedValue: retained.guestRaw },
  ];
  for (const [key, catalog] of Object.entries(retained.catalogs)) {
    if (!catalog) continue;
    if (await guestAssets.getItem(key) !== catalog.raw) return false;
    relatedWrites.push({ key: `${getNamespace('project-assets', GUEST_SCOPE)}:${key}`, value: null, expectedValue: catalog.raw });
  }
  await compareAndSetBrowserWorkspaceValue({
    namespace: getNamespace('project-workspace', retained.accountScope),
    key: WORKSPACE_KEY,
    value: account.value,
    expectedRevision: account.revision,
    writerId: `guest-import-consume-${retained.accountScope}`,
    signal,
    beforeCommit: () => signal?.throwIfAborted(),
    relatedWrites,
  });
  return true;
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
  if (await accountWorkspaceStorage.getItem(WORKSPACE_KEY) !== null) return false;
  const guestRaw = await guestWorkspaceStorage.getItem(WORKSPACE_KEY);
  if (!guestRaw) return false;
  const guest = parseBrowserWorkspaceRecord(guestRaw);
  parseGuestState(guest.value);

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
