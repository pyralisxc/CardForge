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

const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3';

type PickerConnectionRow = {
  id: string;
  refresh_token_ciphertext: string;
  refresh_token_iv: string;
  refresh_token_auth_tag: string;
  root_folder_id: string;
};

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleDriveFolderMetadata = {
  id?: string;
  name?: string;
  mimeType?: string;
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
      nextAction: 'Connect Google Drive in Account → Storage & Library.',
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
      nextAction: 'Reconnect Google Drive in Account → Storage & Library.',
    });
  }

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'refresh_token',
    }),
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({})) as GoogleTokenResponse;
  if (!response.ok || !payload.access_token) {
    await requireStore()
      .from('cardforge_project_storage_connections')
      .update({ status: 'error', status_note: 'Google authorization expired or was revoked.' })
      .eq('id', row.id);
    throw new ProjectStorageProviderError(
      payload.error_description || 'Google Drive authorization expired or was revoked.',
      401,
      {
        kind: 'authentication',
        nextAction: 'Reconnect Google Drive in Account → Storage & Library.',
      },
    );
  }
  return payload.access_token;
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
}: {
  ownerUserId: string;
  folderId: string;
}): Promise<GoogleDriveFolderSelection> => {
  if (!isGoogleDriveFileId(folderId)) {
    throw new ProjectStorageProviderError('The selected Google Drive folder id is invalid.', 400, { kind: 'invalid' });
  }
  const row = await getPickerConnection(ownerUserId);
  const accessToken = await refreshPickerAccessToken(row);
  const url = new URL(`${GOOGLE_DRIVE_API}/files/${encodeURIComponent(folderId)}`);
  url.searchParams.set('fields', 'id,name,mimeType');
  url.searchParams.set('supportsAllDrives', 'true');
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ProjectStorageProviderError('CardForge is not authorized to use that Google Drive folder.', 401, {
        kind: 'authentication',
        nextAction: 'Choose the folder again in the Google Drive Picker.',
      });
    }
    if (response.status === 404) {
      throw new ProjectStorageProviderError('The selected Google Drive folder is no longer available.', 404, { kind: 'not_found' });
    }
    throw new ProjectStorageProviderError('Google Drive could not verify the selected project folder.', 503, { kind: 'unavailable' });
  }
  const folder = await response.json() as GoogleDriveFolderMetadata;
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
      status_note: '',
      last_verified_at: new Date().toISOString(),
    })
    .eq('id', row.id)
    .eq('owner_user_id', ownerUserId)
    .eq('provider', GOOGLE_DRIVE_PROJECT_PROVIDER);
  if (error) {
    console.error('Unable to save selected Google Drive project folder:', error);
    throw new ProjectStorageProviderError('CardForge could not remember the selected Google Drive folder.', 503, { kind: 'unavailable' });
  }
  return { id: verifiedId, name: name.slice(0, 320) };
};
