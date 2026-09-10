import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import {
  GOOGLE_DRIVE_FOLDER_MIME_TYPE,
  GOOGLE_DRIVE_PROJECT_PROVIDER,
  isGoogleDriveFileId,
  type GoogleDriveFolderSelection,
  type GoogleDrivePickerConfiguration,
} from '../model/googleDriveProject';
import { decryptProjectStorageToken } from './projectStorageTokenCrypto';
import {
  getGoogleDriveProjectStorageConfiguration,
  ProjectStorageProviderError,
} from './googleDriveProjectStore';
import { readGoogleProviderFailure, requestGoogleAccessToken } from './googleDriveBoundary';

const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3';
const MAX_PROJECT_FOLDER_NAME_LENGTH = 120;

type PickerConnectionRow = {
  id: string;
  refresh_token_ciphertext: string;
  refresh_token_iv: string;
  refresh_token_auth_tag: string;
  root_folder_id: string;
};

type GoogleDriveFolderMetadata = {
  id?: string;
  name?: string;
  mimeType?: string;
  driveId?: string;
  resourceKey?: string;
  capabilities?: { canAddChildren?: boolean };
};

const PICKER_CONNECTION_COLUMNS = 'id,refresh_token_ciphertext,refresh_token_iv,refresh_token_auth_tag,root_folder_id';

const requireStore = () => {
  const database = getSupabaseServerClient();
  if (!database) {
    throw new ProjectStorageProviderError('Project storage connections are not configured yet.', 503, { kind: 'unavailable' });
  }
  return database;
};

const getPickerConnection = async (ownerUserId: string): Promise<PickerConnectionRow> => {
  const { data, error } = await requireStore()
    .from('cardforge_project_storage_connections')
    .select(PICKER_CONNECTION_COLUMNS)
    .eq('owner_user_id', ownerUserId)
    .eq('provider', GOOGLE_DRIVE_PROJECT_PROVIDER)
    .maybeSingle();
  if (error) {
    console.error('Unable to load Google Drive connection for Picker:', error);
    throw new ProjectStorageProviderError('Unable to load the Google Drive connection.', 503, { kind: 'unavailable' });
  }
  if (!data) {
    throw new ProjectStorageProviderError('Connect Google Drive before choosing a project folder.', 404, {
      kind: 'not_found',
      nextAction: 'Connect Google Drive in Library → Locations.',
    });
  }
  return data as unknown as PickerConnectionRow;
};

const refreshPickerAccessToken = async (row: PickerConnectionRow): Promise<string> => {
  const config = getGoogleDriveProjectStorageConfiguration();
  if (!config.configured) {
    throw new ProjectStorageProviderError('Google Drive project storage is not configured yet.', 503, { kind: 'unavailable' });
  }

  let refreshToken: string;
  try {
    refreshToken = decryptProjectStorageToken({
      ciphertext: row.refresh_token_ciphertext,
      iv: row.refresh_token_iv,
      authTag: row.refresh_token_auth_tag,
    });
  } catch (error) {
    console.error('Unable to decrypt Google Drive refresh token for Picker:', error);
    throw new ProjectStorageProviderError('The Google Drive connection needs to be reconnected.', 401, {
      kind: 'authentication',
      nextAction: 'Reconnect Google Drive in Library → Locations.',
    });
  }

  const token = await requestGoogleAccessToken({
    endpoint: GOOGLE_TOKEN_ENDPOINT,
    refreshToken,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
  });
  if (!token.ok) {
    if (token.failure.reconnectRequired) {
      await requireStore()
        .from('cardforge_project_storage_connections')
        .update({ status: 'error', status_note: 'Google authorization expired or was revoked.' })
        .eq('id', row.id);
    }
    throw new ProjectStorageProviderError(
      token.failure.providerMessage || (token.failure.reconnectRequired ? 'Google Drive authorization expired or was revoked.' : 'Google Drive could not refresh this connection.'),
      token.failure.status,
      {
        kind: token.failure.kind,
        nextAction: token.failure.nextAction,
        retryable: token.failure.status === 429 || token.failure.status >= 500,
      },
    );
  }
  return token.accessToken;
};

const requirePickerEnvironment = () => {
  const contributorKey = process.env.CARDFORGE_GOOGLE_PICKER_API_KEY?.trim() ?? '';
  const appId = process.env.CARDFORGE_GOOGLE_CLOUD_PROJECT_NUMBER?.trim() ?? '';
  const missing = [
    !contributorKey ? 'CARDFORGE_GOOGLE_PICKER_API_KEY' : null,
    !appId ? 'CARDFORGE_GOOGLE_CLOUD_PROJECT_NUMBER' : null,
  ].filter((value): value is string => Boolean(value));
  if (missing.length > 0) {
    throw new ProjectStorageProviderError(
      `Google Drive folder picking is not configured yet: ${missing.join(', ')}.`,
      503,
      { kind: 'unavailable' },
    );
  }
  if (!/^\d{4,32}$/u.test(appId)) {
    throw new ProjectStorageProviderError('Google Drive Picker project number is invalid.', 503, { kind: 'unavailable' });
  }
  return { contributorKey, appId };
};

const normalizeResourceKey = (value: string | null | undefined): string | null => {
  const normalized = value?.trim() ?? '';
  if (!normalized) return null;
  if (normalized.length > 255 || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw new ProjectStorageProviderError('Google Drive returned an invalid resource key for that folder.', 400, { kind: 'invalid' });
  }
  return normalized;
};

const folderHeaders = (accessToken: string, folderId: string, resourceKey?: string | null): Record<string, string> => ({
  Authorization: `Bearer ${accessToken}`,
  ...(resourceKey ? { 'X-Goog-Drive-Resource-Keys': `${folderId}/${resourceKey}` } : {}),
});

const persistFolder = async ({
  ownerUserId,
  row,
  folder,
}: {
  ownerUserId: string;
  row: PickerConnectionRow;
  folder: GoogleDriveFolderMetadata;
}): Promise<GoogleDriveFolderSelection> => {
  const verifiedId = folder.id ?? '';
  const name = folder.name?.trim() ?? '';
  if (!isGoogleDriveFileId(verifiedId) || folder.mimeType !== GOOGLE_DRIVE_FOLDER_MIME_TYPE || !name) {
    throw new ProjectStorageProviderError('Choose a Google Drive folder rather than an individual file.', 400, { kind: 'invalid' });
  }
  const { error } = await requireStore()
    .from('cardforge_project_storage_connections')
    .update({
      root_folder_id: verifiedId,
      status: 'active',
      status_note: folder.capabilities?.canAddChildren === false ? 'This Drive folder is read-only for the connected account.' : '',
      last_verified_at: new Date().toISOString(),
    })
    .eq('id', row.id)
    .eq('owner_user_id', ownerUserId)
    .eq('provider', GOOGLE_DRIVE_PROJECT_PROVIDER);
  if (error) {
    console.error('Unable to save selected Google Drive project folder:', error);
    throw new ProjectStorageProviderError('CardForge could not remember the selected Google Drive folder.', 503, { kind: 'unavailable' });
  }
  return {
    id: verifiedId,
    name: name.slice(0, 320),
    driveId: folder.driveId ?? null,
    resourceKey: folder.resourceKey?.trim() || null,
    canAddChildren: folder.capabilities?.canAddChildren !== false,
  };
};

export const getGoogleDrivePickerConfiguration = async (
  ownerUserId: string,
): Promise<GoogleDrivePickerConfiguration> => {
  const row = await getPickerConnection(ownerUserId);
  const picker = requirePickerEnvironment();
  const accessToken = await refreshPickerAccessToken(row);
  return {
    accessToken,
    contributorKey: picker.contributorKey,
    appId: picker.appId,
    initialFolderId: isGoogleDriveFileId(row.root_folder_id) ? row.root_folder_id : null,
  };
};

export const selectGoogleDriveProjectFolder = async ({
  ownerUserId,
  folderId,
  resourceKey = null,
}: {
  ownerUserId: string;
  folderId: string;
  resourceKey?: string | null;
}): Promise<GoogleDriveFolderSelection> => {
  if (!isGoogleDriveFileId(folderId)) {
    throw new ProjectStorageProviderError('The selected Google Drive folder id is invalid.', 400, { kind: 'invalid' });
  }
  const normalizedResourceKey = normalizeResourceKey(resourceKey);
  const row = await getPickerConnection(ownerUserId);
  const accessToken = await refreshPickerAccessToken(row);
  const url = new URL(`${GOOGLE_DRIVE_API}/files/${encodeURIComponent(folderId)}`);
  url.searchParams.set('fields', 'id,name,mimeType,driveId,resourceKey,capabilities(canAddChildren)');
  url.searchParams.set('supportsAllDrives', 'true');
  const response = await fetch(url, {
    headers: folderHeaders(accessToken, folderId, normalizedResourceKey),
    cache: 'no-store',
  });
  if (!response.ok) {
    const failure = await readGoogleProviderFailure(response);
    throw new ProjectStorageProviderError(
      failure.providerMessage ? `Google Drive could not verify the selected project folder. ${failure.providerMessage}` : 'Google Drive could not verify the selected project folder.',
      failure.status,
      { kind: failure.kind, nextAction: failure.nextAction },
    );
  }
  const folder = await response.json() as GoogleDriveFolderMetadata;
  if (!folder.resourceKey && normalizedResourceKey) folder.resourceKey = normalizedResourceKey;
  return await persistFolder({ ownerUserId, row, folder });
};

export const createGoogleDriveProjectFolder = async ({
  ownerUserId,
  name,
}: {
  ownerUserId: string;
  name: string;
}): Promise<GoogleDriveFolderSelection> => {
  const normalizedName = name.trim();
  if (!normalizedName || normalizedName.length > MAX_PROJECT_FOLDER_NAME_LENGTH || /[\u0000-\u001f\u007f]/u.test(normalizedName)) {
    throw new ProjectStorageProviderError(`Folder name must be between 1 and ${MAX_PROJECT_FOLDER_NAME_LENGTH} visible characters.`, 400, { kind: 'invalid' });
  }
  const row = await getPickerConnection(ownerUserId);
  const accessToken = await refreshPickerAccessToken(row);
  const url = new URL(`${GOOGLE_DRIVE_API}/files`);
  url.searchParams.set('fields', 'id,name,mimeType,driveId,resourceKey,capabilities(canAddChildren)');
  url.searchParams.set('supportsAllDrives', 'true');
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: normalizedName,
      mimeType: GOOGLE_DRIVE_FOLDER_MIME_TYPE,
    }),
    cache: 'no-store',
  });
  if (!response.ok) {
    const failure = await readGoogleProviderFailure(response);
    throw new ProjectStorageProviderError(
      failure.providerMessage ? `Google Drive could not create the project folder. ${failure.providerMessage}` : 'Google Drive could not create the project folder.',
      failure.status,
      { kind: failure.kind, nextAction: failure.nextAction },
    );
  }
  const folder = await response.json() as GoogleDriveFolderMetadata;
  return await persistFolder({ ownerUserId, row, folder });
};
