import { createHash } from 'node:crypto';

import { isGoogleDriveFileId } from '@/features/project/server';
import { decryptProjectStorageToken } from '@/features/project/server/projectStorageTokenCrypto';
import { readGoogleProviderFailure, requestGoogleAccessToken } from '@/features/project/server/googleDriveBoundary';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import type { BoundaryFailureKind } from '@/shared/boundaryFailure';
import {
  MAX_PERSONAL_LIBRARY_ITEM_BYTES,
  MAX_PERSONAL_LIBRARY_ITEMS_PER_ACCOUNT,
  MAX_PERSONAL_LIBRARY_REGISTER_BATCH,
  isPersonalLibraryMimeTypeAllowedForRole,
  isPersonalLibraryRole,
  type PersonalLibraryItem,
  type PersonalLibraryListResult,
  type PersonalLibraryMaterializedAsset,
  type PersonalLibraryRegisterResult,
  type PersonalLibraryRole,
} from '../model';

const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3';
const GOOGLE_DRIVE_FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
const GOOGLE_DRIVE_FIELDS = 'id,name,mimeType,version,modifiedTime,size,webViewLink';

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
};

type DriveFile = {
  id?: string;
  name?: string;
  mimeType?: string;
  version?: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
};

const LIBRARY_COLUMNS = 'id,owner_user_id,provider,provider_file_id,provider_revision,display_name,mime_type,asset_role,byte_size,provider_modified_at,provider_web_view_link,content_hash,last_verified_at,created_at,updated_at';

const requireStore = () => {
  const database = getSupabaseServerClient();
  if (!database) throw new PersonalLibraryStoreError('Personal library storage is not configured yet.', 503, { kind: 'unavailable' });
  return database;
};

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
    .select('id,refresh_token_ciphertext,refresh_token_iv,refresh_token_auth_tag')
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
      nextAction: 'Connect Google Drive in Account → Storage & Library.',
    });
  }
  const row = data as unknown as DriveConnectionRow;
  let refreshToken: string;
  try {
    refreshToken = decryptProjectStorageToken({
      ciphertext: row.refresh_token_ciphertext,
      iv: row.refresh_token_iv,
      authTag: row.refresh_token_auth_tag,
    });
  } catch (error) {
    console.error('Unable to decrypt Google Drive token for personal library:', error);
    throw new PersonalLibraryStoreError('The Google Drive connection needs to be reconnected.', 401, {
      kind: 'authentication',
      nextAction: 'Reconnect Google Drive in Account → Storage & Library.',
    });
  }
  const token = await requestGoogleAccessToken({
    endpoint: GOOGLE_TOKEN_ENDPOINT,
    refreshToken,
    clientId,
    clientSecret,
  });
  if (!token.ok) {
    throw new PersonalLibraryStoreError(token.failure.providerMessage || (token.failure.reconnectRequired ? 'Google Drive authorization expired or was revoked.' : 'Google Drive could not refresh this connection.'), token.failure.status, {
      kind: token.failure.kind,
      nextAction: token.failure.nextAction,
    });
  }
  return token.accessToken;
};

const getDriveFile = async (accessToken: string, fileId: string): Promise<DriveFile> => {
  if (!isGoogleDriveFileId(fileId)) throw new PersonalLibraryStoreError('Google Drive file id is invalid.', 400, { kind: 'invalid' });
  const url = new URL(`${GOOGLE_DRIVE_API}/files/${encodeURIComponent(fileId)}`);
  url.searchParams.set('fields', GOOGLE_DRIVE_FIELDS);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!response.ok) throw await parsePersonalLibraryGoogleError(response, 'CardForge could not read that Google Drive file.');
  return await response.json() as DriveFile;
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
    modifiedAt,
    byteSize,
    webViewLink: file.webViewLink?.trim() || null,
  };
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
  fileIds,
  role,
}: {
  ownerUserId: string;
  fileIds: string[];
  role: PersonalLibraryRole;
}): Promise<PersonalLibraryRegisterResult> => {
  if (!isPersonalLibraryRole(role)) throw new PersonalLibraryStoreError('Choose a valid personal-library role.', 400, { kind: 'invalid' });
  const uniqueIds = [...new Set(fileIds.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length < 1 || uniqueIds.length > MAX_PERSONAL_LIBRARY_REGISTER_BATCH) {
    throw new PersonalLibraryStoreError(`Choose between 1 and ${MAX_PERSONAL_LIBRARY_REGISTER_BATCH} files at a time.`, 413, { kind: 'limit' });
  }
  if (uniqueIds.some((id) => !isGoogleDriveFileId(id))) {
    throw new PersonalLibraryStoreError('One selected Google Drive file id is invalid.', 400, { kind: 'invalid' });
  }
  const { count, error: countError } = await requireStore()
    .from('cardforge_personal_library_items')
    .select('id', { count: 'exact', head: true })
    .eq('owner_user_id', ownerUserId);
  if (countError) throw new PersonalLibraryStoreError('Unable to verify personal-library capacity.', 503, { kind: 'unavailable' });
  if ((count ?? 0) + uniqueIds.length > MAX_PERSONAL_LIBRARY_ITEMS_PER_ACCOUNT) {
    throw new PersonalLibraryStoreError(`The personal library can currently index up to ${MAX_PERSONAL_LIBRARY_ITEMS_PER_ACCOUNT} items per account.`, 413, { kind: 'limit' });
  }

  const accessToken = await getGoogleDriveAccessToken(ownerUserId);
  const now = new Date().toISOString();
  const registered: PersonalLibraryItem[] = [];
  for (const fileId of uniqueIds) {
    const normalized = normalizeDriveFile(await getDriveFile(accessToken, fileId), role);
    const { data, error } = await requireStore()
      .from('cardforge_personal_library_items')
      .upsert({
        owner_user_id: ownerUserId,
        provider: 'google-drive',
        provider_file_id: normalized.id,
        provider_revision: normalized.providerRevision,
        display_name: normalized.displayName.slice(0, 320),
        mime_type: normalized.mimeType,
        asset_role: role,
        byte_size: normalized.byteSize,
        provider_modified_at: normalized.modifiedAt,
        provider_web_view_link: normalized.webViewLink,
        content_hash: null,
        last_verified_at: now,
        updated_at: now,
      }, { onConflict: 'owner_user_id,provider,provider_file_id' })
      .select(LIBRARY_COLUMNS)
      .single();
    if (error || !data) {
      console.error('Unable to index personal-library file:', error);
      throw new PersonalLibraryStoreError(`CardForge could not index “${normalized.displayName}”.`, 503, { kind: 'unavailable' });
    }
    registered.push(toItem(data as unknown as LibraryRow));
  }
  return { items: registered, registeredCount: registered.length };
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
  const normalized = normalizeDriveFile(await getDriveFile(accessToken, row.provider_file_id), row.asset_role);
  const response = await fetch(`${GOOGLE_DRIVE_API}/files/${encodeURIComponent(row.provider_file_id)}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
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
  const bytes = new Uint8Array(buffer);
  const contentHash = createHash('sha256').update(bytes).digest('hex');
  const verifiedAt = new Date().toISOString();
  const { data, error } = await requireStore()
    .from('cardforge_personal_library_items')
    .update({
      provider_revision: normalized.providerRevision,
      display_name: normalized.displayName.slice(0, 320),
      mime_type: normalized.mimeType,
      byte_size: normalized.byteSize,
      provider_modified_at: normalized.modifiedAt,
      provider_web_view_link: normalized.webViewLink,
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
    mimeType: normalized.mimeType,
  };
};
