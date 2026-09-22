import { createHash } from 'node:crypto';

import { isGoogleDriveFileId } from '@/features/project/server';
import { resolveGoogleDriveConnectionAccess } from '@/features/project/server/googleDriveConnectionAuthority';
import {
  GOOGLE_PROVIDER_CONTENT_TIMEOUT_MS,
  GOOGLE_PROVIDER_REQUEST_TIMEOUT_MS,
  readGoogleProviderFailure,
} from '@/features/project/server/googleDriveBoundary';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import type { BoundaryFailureKind } from '@/shared/boundaryFailure';
import {
  MAX_PERSONAL_LIBRARY_ITEM_BYTES,
  MAX_PERSONAL_LIBRARY_ITEMS_PER_ACCOUNT,
  MAX_PERSONAL_LIBRARY_REGISTER_BATCH,
  isPersonalLibraryMimeTypeAllowedForRole,
  isPersonalLibraryRole,
  type PersonalLibraryDriveSelection,
  type PersonalLibraryItem,
  type PersonalLibraryListResult,
  type PersonalLibraryMaterializedAsset,
  type PersonalLibraryRegisterResult,
  type PersonalLibraryRole,
} from '../model';

const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3';
const GOOGLE_DRIVE_FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
const GOOGLE_DRIVE_FIELDS = 'id,name,mimeType,version,modifiedTime,size,webViewLink,resourceKey,trashed';
const PERSONAL_LIBRARY_PROVIDER_READ_CONCURRENCY = 6;

export class PersonalLibraryStoreError extends Error {
  status: number;
  kind?: BoundaryFailureKind;
  nextAction?: string;

  constructor(message: string, status = 500, options: { kind?: BoundaryFailureKind; nextAction?: string } = {}) {
    super(message);
    this.name = 'PersonalLibraryStoreError';
    this.status = status;
    this.kind = options.kind;
    this.nextAction = options.nextAction;
  }
}

type LibraryRow = {
  id: string;
  owner_user_id: string;
  provider: 'google-drive';
  provider_file_id: string;
  provider_revision: string;
  provider_resource_key: string | null;
  display_name: string;
  mime_type: string;
  asset_role: PersonalLibraryRole;
  byte_size: number | string;
  provider_modified_at: string;
  provider_web_view_link: string | null;
  content_hash: string | null;
  last_verified_at: string;
  created_at: string;
  updated_at: string;
};

type DriveConnectionRow = {
  id: string;
  refresh_token_ciphertext: string;
  refresh_token_iv: string;
  refresh_token_auth_tag: string;
  granted_scopes: string[] | null;
};

type DriveFile = {
  id?: string;
  name?: string;
  mimeType?: string;
  version?: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
  resourceKey?: string;
  trashed?: boolean;
};

const LIBRARY_COLUMNS = 'id,owner_user_id,provider,provider_file_id,provider_revision,provider_resource_key,display_name,mime_type,asset_role,byte_size,provider_modified_at,provider_web_view_link,content_hash,last_verified_at,created_at,updated_at';

const requireStore = () => {
  const database = getSupabaseServerClient();
  if (!database) throw new PersonalLibraryStoreError('Personal library storage is not configured yet.', 503, { kind: 'unavailable' });
  return database;
};

const normalizeResourceKey = (value: string | null | undefined): string | null => {
  const normalized = value?.trim() ?? '';
  if (!normalized) return null;
  if (normalized.length > 255 || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw new PersonalLibraryStoreError('Google Drive returned an invalid resource key for that file.', 400, { kind: 'invalid' });
  }
  return normalized;
};

const driveHeaders = (accessToken: string, fileId: string, resourceKey?: string | null): Record<string, string> => ({
  Authorization: `Bearer ${accessToken}`,
  ...(resourceKey ? { 'X-Goog-Drive-Resource-Keys': `${fileId}/${resourceKey}` } : {}),
});

const toItem = (row: LibraryRow): PersonalLibraryItem => ({
  id: row.id,
  provider: row.provider,
  providerFileId: row.provider_file_id,
  providerRevision: row.provider_revision,
  displayName: row.display_name,
  mimeType: row.mime_type,
  role: row.asset_role,
  byteSize: Number(row.byte_size) || 0,
  providerModifiedAt: row.provider_modified_at,
  providerWebViewLink: row.provider_web_view_link,
  contentHash: row.content_hash,
  lastVerifiedAt: row.last_verified_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const parsePersonalLibraryGoogleError = async (response: Response, fallback: string): Promise<PersonalLibraryStoreError> => {
  const failure = await readGoogleProviderFailure(response);
  return new PersonalLibraryStoreError(failure.providerMessage ? `${fallback} ${failure.providerMessage}` : fallback, failure.status, {
    kind: failure.kind,
    nextAction: failure.nextAction,
  });
};

const getGoogleDriveAccessToken = async (ownerUserId: string): Promise<string> => {
  const clientId = process.env.CARDFORGE_GOOGLE_STORAGE_CLIENT_ID?.trim() ?? '';
  const clientSecret = process.env.CARDFORGE_GOOGLE_STORAGE_CLIENT_SECRET?.trim() ?? '';
  if (!clientId || !clientSecret) {
    throw new PersonalLibraryStoreError('Google Drive connected storage is not configured yet.', 503, { kind: 'unavailable' });
  }
  const { data, error } = await requireStore()
    .from('cardforge_project_storage_connections')
    .select('id,refresh_token_ciphertext,refresh_token_iv,refresh_token_auth_tag,granted_scopes')
    .eq('owner_user_id', ownerUserId)
    .eq('provider', 'google-drive')
    .maybeSingle();
  if (error) {
    console.error('Unable to read Google Drive connection for personal library:', error);
    throw new PersonalLibraryStoreError('Unable to read the Google Drive connection.', 503, { kind: 'unavailable' });
  }
  if (!data) {
    throw new PersonalLibraryStoreError('Connect Google Drive before adding files to your personal library.', 404, {
      kind: 'not_found',
      nextAction: 'Connect Google Drive in Library → Locations.',
    });
  }
  const row = data as unknown as DriveConnectionRow;
  const access = await resolveGoogleDriveConnectionAccess({
    row,
    clientId,
    clientSecret,
    tokenEndpoint: GOOGLE_TOKEN_ENDPOINT,
  });
  if (!access.ok) {
    if (access.failure.reconnectRequired) {
      await requireStore()
        .from('cardforge_project_storage_connections')
        .update({ status: 'error', status_note: 'Google authorization expired, was revoked, or is missing the required Drive permission.' })
        .eq('id', row.id);
    }
    throw new PersonalLibraryStoreError(access.failure.message, access.failure.status, {
      kind: access.failure.kind,
      nextAction: access.failure.nextAction,
    });
  }
  return access.accessToken;
};

const getDriveFile = async (
  accessToken: string,
  fileId: string,
  resourceKey: string | null = null,
): Promise<DriveFile> => {
  if (!isGoogleDriveFileId(fileId)) throw new PersonalLibraryStoreError('Google Drive file id is invalid.', 400, { kind: 'invalid' });
  const url = new URL(`${GOOGLE_DRIVE_API}/files/${encodeURIComponent(fileId)}`);
  url.searchParams.set('fields', GOOGLE_DRIVE_FIELDS);
  url.searchParams.set('supportsAllDrives', 'true');
  const response = await fetch(url, {
    headers: driveHeaders(accessToken, fileId, resourceKey),
    cache: 'no-store',
    signal: AbortSignal.timeout(GOOGLE_PROVIDER_REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw await parsePersonalLibraryGoogleError(response, 'CardForge could not read that Google Drive file.');
  const file = await response.json() as DriveFile;
  if (file.trashed === true) {
    throw new PersonalLibraryStoreError('That Google Drive asset is in Trash.', 404, {
      kind: 'not_found',
      nextAction: 'Restore the file in Google Drive or remove it from the CardForge connected-assets index.',
    });
  }
  if (!file.resourceKey && resourceKey) file.resourceKey = resourceKey;
  return file;
};

const normalizeDriveFile = (file: DriveFile, role: PersonalLibraryRole) => {
  const id = file.id?.trim() ?? '';
  const displayName = file.name?.trim() ?? '';
  const mimeType = file.mimeType?.trim().toLowerCase() ?? '';
  const providerRevision = file.version?.trim() ?? '';
  const modifiedAt = file.modifiedTime?.trim() ?? '';
  const byteSize = Number(file.size) || 0;
  if (!isGoogleDriveFileId(id) || !displayName || !providerRevision || Number.isNaN(Date.parse(modifiedAt))) {
    throw new PersonalLibraryStoreError('Google Drive returned incomplete file metadata.', 409, { kind: 'conflict' });
  }
  if (mimeType === GOOGLE_DRIVE_FOLDER_MIME_TYPE) {
    throw new PersonalLibraryStoreError('Choose files for the personal library, not a folder.', 400, { kind: 'invalid' });
  }
  if (!isPersonalLibraryMimeTypeAllowedForRole(role, mimeType)) {
    throw new PersonalLibraryStoreError(`“${displayName}” is not a supported ${role} file.`, 400, { kind: 'invalid' });
  }
  if (!Number.isInteger(byteSize) || byteSize <= 0 || byteSize > MAX_PERSONAL_LIBRARY_ITEM_BYTES) {
    throw new PersonalLibraryStoreError(`“${displayName}” must be ${Math.round(MAX_PERSONAL_LIBRARY_ITEM_BYTES / 1024 / 1024)} MB or smaller.`, 413, { kind: 'limit' });
  }
  return {
    id,
    displayName,
    mimeType,
    providerRevision,
    resourceKey: normalizeResourceKey(file.resourceKey),
    modifiedAt,
    byteSize,
    webViewLink: file.webViewLink?.trim() || null,
  };
};

const mapWithConcurrency = async <Input, Output>(
  values: readonly Input[],
  concurrency: number,
  operation: (value: Input) => Promise<Output>,
): Promise<Output[]> => {
  const results = new Array<Output>(values.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= values.length) return;
      results[index] = await operation(values[index]!);
    }
  });
  await Promise.all(workers);
  return results;
};

export const listPersonalLibraryItems = async (ownerUserId: string): Promise<PersonalLibraryListResult> => {
  const { data, error, count } = await requireStore()
    .from('cardforge_personal_library_items')
    .select(LIBRARY_COLUMNS, { count: 'exact' })
    .eq('owner_user_id', ownerUserId)
    .order('updated_at', { ascending: false })
    .limit(MAX_PERSONAL_LIBRARY_ITEMS_PER_ACCOUNT);
  if (error) {
    console.error('Unable to list personal library items:', error);
    throw new PersonalLibraryStoreError('Unable to load the personal library.', 503, { kind: 'unavailable' });
  }
  return {
    items: (data ?? []).map((row) => toItem(row as unknown as LibraryRow)),
    count: count ?? data?.length ?? 0,
    limit: MAX_PERSONAL_LIBRARY_ITEMS_PER_ACCOUNT,
  };
};

export const registerGoogleDrivePersonalLibraryFiles = async ({
  ownerUserId,
  files,
  role,
}: {
  ownerUserId: string;
  files: PersonalLibraryDriveSelection[];
  role: PersonalLibraryRole;
}): Promise<PersonalLibraryRegisterResult> => {
  if (!isPersonalLibraryRole(role)) throw new PersonalLibraryStoreError('Choose a valid personal-library role.', 400, { kind: 'invalid' });

  const selectionById = new Map<string, PersonalLibraryDriveSelection>();
  for (const selection of files) {
    const fileId = selection.fileId.trim();
    if (!fileId) continue;
    if (!isGoogleDriveFileId(fileId)) throw new PersonalLibraryStoreError('One selected Google Drive file id is invalid.', 400, { kind: 'invalid' });
    selectionById.set(fileId, { fileId, resourceKey: normalizeResourceKey(selection.resourceKey) });
  }
  const selections = [...selectionById.values()];
  if (selections.length < 1 || selections.length > MAX_PERSONAL_LIBRARY_REGISTER_BATCH) {
    throw new PersonalLibraryStoreError(`Choose between 1 and ${MAX_PERSONAL_LIBRARY_REGISTER_BATCH} files at a time.`, 413, { kind: 'limit' });
  }

  const store = requireStore();
  const ids = selections.map((selection) => selection.fileId);
  const [capacityRead, existingRead] = await Promise.all([
    store.from('cardforge_personal_library_items')
      .select('id', { count: 'exact', head: true })
      .eq('owner_user_id', ownerUserId),
    store.from('cardforge_personal_library_items')
      .select('provider_file_id')
      .eq('owner_user_id', ownerUserId)
      .eq('provider', 'google-drive')
      .in('provider_file_id', ids),
  ]);
  if (capacityRead.error || existingRead.error) {
    throw new PersonalLibraryStoreError('Unable to verify personal-library capacity.', 503, { kind: 'unavailable' });
  }
  const existingIds = new Set((existingRead.data ?? []).map((row) => String(row.provider_file_id)));
  const newCount = selections.filter((selection) => !existingIds.has(selection.fileId)).length;
  if ((capacityRead.count ?? 0) + newCount > MAX_PERSONAL_LIBRARY_ITEMS_PER_ACCOUNT) {
    throw new PersonalLibraryStoreError(`The personal library can currently index up to ${MAX_PERSONAL_LIBRARY_ITEMS_PER_ACCOUNT} items per account.`, 413, { kind: 'limit' });
  }

  const accessToken = await getGoogleDriveAccessToken(ownerUserId);
  const normalizedFiles = await mapWithConcurrency(
    selections,
    PERSONAL_LIBRARY_PROVIDER_READ_CONCURRENCY,
    async (selection) => normalizeDriveFile(
      await getDriveFile(accessToken, selection.fileId, selection.resourceKey ?? null),
      role,
    ),
  );
  const now = new Date().toISOString();
  const rows = normalizedFiles.map((normalized) => ({
    owner_user_id: ownerUserId,
    provider: 'google-drive',
    provider_file_id: normalized.id,
    provider_revision: normalized.providerRevision,
    provider_resource_key: normalized.resourceKey,
    display_name: normalized.displayName.slice(0, 320),
    mime_type: normalized.mimeType,
    asset_role: role,
    byte_size: normalized.byteSize,
    provider_modified_at: normalized.modifiedAt,
    provider_web_view_link: normalized.webViewLink,
    content_hash: null,
    last_verified_at: now,
    updated_at: now,
  }));
  const { data, error } = await store
    .from('cardforge_personal_library_items')
    .upsert(rows, { onConflict: 'owner_user_id,provider,provider_file_id' })
    .select(LIBRARY_COLUMNS);
  if (error || !data || data.length !== rows.length) {
    console.error('Unable to index personal-library files:', error);
    throw new PersonalLibraryStoreError('CardForge could not finish indexing the selected Google Drive files. No partial provider copy was created.', 503, { kind: 'unavailable' });
  }
  const items = data.map((row) => toItem(row as unknown as LibraryRow));
  return { items, registeredCount: items.length };
};

export const removePersonalLibraryItem = async (ownerUserId: string, itemId: string): Promise<void> => {
  const { data, error } = await requireStore()
    .from('cardforge_personal_library_items')
    .delete()
    .eq('id', itemId)
    .eq('owner_user_id', ownerUserId)
    .select('id')
    .maybeSingle();
  if (error) throw new PersonalLibraryStoreError('Unable to remove that personal-library item.', 503, { kind: 'unavailable' });
  if (!data) throw new PersonalLibraryStoreError('Personal-library item not found.', 404, { kind: 'not_found' });
};

const getPersonalLibraryRow = async (ownerUserId: string, itemId: string): Promise<LibraryRow> => {
  const { data, error } = await requireStore()
    .from('cardforge_personal_library_items')
    .select(LIBRARY_COLUMNS)
    .eq('id', itemId)
    .eq('owner_user_id', ownerUserId)
    .maybeSingle();
  if (error) throw new PersonalLibraryStoreError('Unable to read that personal-library item.', 503, { kind: 'unavailable' });
  if (!data) throw new PersonalLibraryStoreError('Personal-library item not found.', 404, { kind: 'not_found' });
  return data as unknown as LibraryRow;
};

export const materializePersonalLibraryItem = async (
  ownerUserId: string,
  itemId: string,
): Promise<PersonalLibraryMaterializedAsset> => {
  const row = await getPersonalLibraryRow(ownerUserId, itemId);
  if (row.provider !== 'google-drive') throw new PersonalLibraryStoreError('That personal-library provider is not supported yet.', 400, { kind: 'invalid' });
  const accessToken = await getGoogleDriveAccessToken(ownerUserId);
  const persistedResourceKey = normalizeResourceKey(row.provider_resource_key);
  const before = normalizeDriveFile(
    await getDriveFile(accessToken, row.provider_file_id, persistedResourceKey),
    row.asset_role,
  );
  const effectiveResourceKey = before.resourceKey ?? persistedResourceKey;
  const mediaUrl = new URL(`${GOOGLE_DRIVE_API}/files/${encodeURIComponent(row.provider_file_id)}`);
  mediaUrl.searchParams.set('alt', 'media');
  mediaUrl.searchParams.set('supportsAllDrives', 'true');
  const response = await fetch(mediaUrl, {
    headers: driveHeaders(accessToken, row.provider_file_id, effectiveResourceKey),
    cache: 'no-store',
    signal: AbortSignal.timeout(GOOGLE_PROVIDER_CONTENT_TIMEOUT_MS),
  });
  if (!response.ok) throw await parsePersonalLibraryGoogleError(response, 'CardForge could not download that personal-library file.');
  const contentLength = Number(response.headers.get('content-length')) || 0;
  if (contentLength > MAX_PERSONAL_LIBRARY_ITEM_BYTES) {
    throw new PersonalLibraryStoreError('That personal-library file is larger than the supported materialization limit.', 413, { kind: 'limit' });
  }
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength <= 0 || buffer.byteLength > MAX_PERSONAL_LIBRARY_ITEM_BYTES) {
    throw new PersonalLibraryStoreError('That personal-library file is empty or too large to use.', 413, { kind: 'limit' });
  }
  const after = normalizeDriveFile(
    await getDriveFile(accessToken, row.provider_file_id, effectiveResourceKey),
    row.asset_role,
  );
  if (before.providerRevision !== after.providerRevision || before.byteSize !== after.byteSize || buffer.byteLength !== after.byteSize) {
    throw new PersonalLibraryStoreError('That Google Drive asset changed while CardForge was reading it. Retry with the current Drive revision; no project asset was created.', 409, { kind: 'conflict' });
  }

  const bytes = new Uint8Array(buffer);
  const contentHash = createHash('sha256').update(bytes).digest('hex');
  const verifiedAt = new Date().toISOString();
  const { data, error } = await requireStore()
    .from('cardforge_personal_library_items')
    .update({
      provider_revision: after.providerRevision,
      provider_resource_key: after.resourceKey ?? effectiveResourceKey,
      display_name: after.displayName.slice(0, 320),
      mime_type: after.mimeType,
      byte_size: after.byteSize,
      provider_modified_at: after.modifiedAt,
      provider_web_view_link: after.webViewLink,
      content_hash: contentHash,
      last_verified_at: verifiedAt,
      updated_at: verifiedAt,
    })
    .eq('id', row.id)
    .eq('owner_user_id', ownerUserId)
    .select(LIBRARY_COLUMNS)
    .single();
  if (error || !data) throw new PersonalLibraryStoreError('Unable to refresh the personal-library index.', 503, { kind: 'unavailable' });
  return {
    item: toItem(data as unknown as LibraryRow),
    bytes,
    mimeType: after.mimeType,
  };
};
