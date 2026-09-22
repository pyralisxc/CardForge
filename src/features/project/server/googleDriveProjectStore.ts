import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { getPublicAppUrl } from '@/infrastructure/http/publicUrl';
import type { BoundaryFailureKind } from '@/shared/boundaryFailure';
import {
  decodeCardForgeProjectPackage,
  hydrateCardForgeProjectSnapshot,
  ProjectPackageError,
} from '../lib/projectPackageCodec';
import {
  GOOGLE_DRIVE_FILE_SCOPE,
  GOOGLE_DRIVE_IDENTITY_SCOPES,
  GOOGLE_DRIVE_PROJECT_MIME_TYPE,
  GOOGLE_DRIVE_PROJECT_PROVIDER,
  isGoogleDriveFileId,
  getUnexpectedGoogleDriveScopes,
  createGoogleDriveProviderRevision,
  isGoogleDriveWorkId,
  hasGoogleDriveProjectRevisionConflict,
  type GoogleDriveProjectConnectionSummary,
  type GoogleDriveProjectDownload,
  type GoogleDriveProjectListResult,
  type GoogleDriveProjectSummary,
  type GoogleDriveUploadCompletion,
  type GoogleDriveUploadPrepareResult,
} from '../model/googleDriveProject';
import {
  CARDFORGE_PROJECT_FILE_EXTENSION,
  MAX_PROJECT_PACKAGE_BYTES,
  MAX_PROJECT_PACKAGE_METADATA_BYTES,
  isProjectPackageAssetId,
  normalizeProjectFileName,
  type ProjectDocumentV1,
} from '../model/projectPackage';
import { decryptProjectStorageToken, encryptProjectStorageToken } from './projectStorageTokenCrypto';
import {
  resolveGoogleDriveConnectionAccess,
  validateGoogleDriveStoredScopes,
} from './googleDriveConnectionAuthority';
import {
  GOOGLE_PROVIDER_CONTENT_TIMEOUT_MS,
  GOOGLE_PROVIDER_REQUEST_TIMEOUT_MS,
  readGoogleProviderFailure,
} from './googleDriveBoundary';

const GOOGLE_AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';
const GOOGLE_USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';
const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3';
const GOOGLE_DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const GOOGLE_DRIVE_FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
const GOOGLE_DRIVE_PROJECT_FIELDS = 'id,name,mimeType,version,headRevisionId,modifiedTime,size,parents,driveId,resourceKey,webViewLink,thumbnailLink,trashed,capabilities(canDownload,canEdit,canModifyContent,canTrash,canDelete),appProperties';
const GOOGLE_DRIVE_FOLDER_FIELDS = 'id,name,mimeType,driveId,resourceKey,trashed,capabilities(canAddChildren,canEdit)';
const GOOGLE_DRIVE_PROJECT_APP_PROPERTY = 'cardforgeProject';
const GOOGLE_DRIVE_PROJECT_REVISION_PROPERTY = 'cardforgeProjectRevision';
const GOOGLE_DRIVE_WORK_ID_PROPERTY = 'cardforgeWorkId';
const GOOGLE_DRIVE_PROJECT_VALUE = '1';
const GOOGLE_DRIVE_LIST_PAGE_SIZE = 100;

export class ProjectStorageProviderError extends Error {
  status: number;
  kind?: BoundaryFailureKind;
  nextAction?: string;
  retryable?: boolean;

  constructor(message: string, status = 500, options: { kind?: BoundaryFailureKind; nextAction?: string; retryable?: boolean } = {}) {
    super(message);
    this.name = 'ProjectStorageProviderError';
    this.status = status;
    this.kind = options.kind;
    this.nextAction = options.nextAction;
    this.retryable = options.retryable;
  }
}

type GoogleDriveConnectionRow = {
  id: string;
  owner_user_id: string;
  provider: typeof GOOGLE_DRIVE_PROJECT_PROVIDER;
  external_account_id: string;
  display_name: string;
  refresh_token_ciphertext: string;
  refresh_token_iv: string;
  refresh_token_auth_tag: string;
  granted_scopes: string[] | null;
  root_folder_id: string | null;
  root_folder_resource_key: string | null;
  status: 'active' | 'error';
  status_note: string;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
};

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleUserInfo = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
};

type GoogleDriveFile = {
  id?: string;
  name?: string;
  mimeType?: string;
  version?: string;
  headRevisionId?: string;
  modifiedTime?: string;
  size?: string;
  parents?: string[];
  driveId?: string;
  resourceKey?: string;
  webViewLink?: string;
  thumbnailLink?: string;
  trashed?: boolean;
  capabilities?: {
    canDownload?: boolean;
    canEdit?: boolean;
    canModifyContent?: boolean;
    canTrash?: boolean;
    canDelete?: boolean;
    canAddChildren?: boolean;
  };
  appProperties?: Record<string, string>;
};

const CONNECTION_COLUMNS = 'id,owner_user_id,provider,external_account_id,display_name,refresh_token_ciphertext,refresh_token_iv,refresh_token_auth_tag,granted_scopes,root_folder_id,root_folder_resource_key,status,status_note,last_verified_at,created_at,updated_at';
const MAX_ENCODED_PROJECT_BYTES = MAX_PROJECT_PACKAGE_BYTES + MAX_PROJECT_PACKAGE_METADATA_BYTES;

export const getGoogleDriveProjectStorageConfiguration = () => {
  const clientId = process.env.CARDFORGE_GOOGLE_STORAGE_CLIENT_ID?.trim() ?? '';
  const clientSecret = process.env.CARDFORGE_GOOGLE_STORAGE_CLIENT_SECRET?.trim() ?? '';
  const encryptionKey = process.env.CARDFORGE_STORAGE_TOKEN_ENCRYPTION_KEY?.trim() ?? '';
  const redirectUri = `${getPublicAppUrl()}/api/project-sources/google-drive/callback`;
  const missing = [
    !clientId ? 'CARDFORGE_GOOGLE_STORAGE_CLIENT_ID' : null,
    !clientSecret ? 'CARDFORGE_GOOGLE_STORAGE_CLIENT_SECRET' : null,
    !encryptionKey ? 'CARDFORGE_STORAGE_TOKEN_ENCRYPTION_KEY' : null,
  ].filter((value): value is string => Boolean(value));
  return {
    configured: missing.length === 0,
    missing,
    clientId,
    clientSecret,
    redirectUri,
  };
};

const requireConfiguration = () => {
  const config = getGoogleDriveProjectStorageConfiguration();
  if (!config.configured) {
    throw new ProjectStorageProviderError(
      `Google Drive project storage is not configured yet${config.missing.length ? `: ${config.missing.join(', ')}` : ''}.`,
      503,
      { kind: 'unavailable' },
    );
  }
  return config;
};

const requireStore = () => {
  const database = getSupabaseServerClient();
  if (!database) throw new ProjectStorageProviderError('Project storage connections are not configured yet.', 503, { kind: 'unavailable' });
  return database;
};

export const parseGoogleError = async (response: Response, fallback: string): Promise<ProjectStorageProviderError> => {
  const failure = await readGoogleProviderFailure(response);
  return new ProjectStorageProviderError(failure.providerMessage ? `${fallback} ${failure.providerMessage}` : fallback, failure.status, {
    kind: failure.kind,
    nextAction: failure.nextAction,
  });
};

const getConnectionRow = async (ownerUserId: string): Promise<GoogleDriveConnectionRow | null> => {
  const { data, error } = await requireStore()
    .from('cardforge_project_storage_connections')
    .select(CONNECTION_COLUMNS)
    .eq('owner_user_id', ownerUserId)
    .eq('provider', GOOGLE_DRIVE_PROJECT_PROVIDER)
    .maybeSingle();
  if (error) {
    console.error('Unable to read Google Drive project connection:', error);
    throw new ProjectStorageProviderError('Unable to read the Google Drive project connection.', 503, { kind: 'unavailable' });
  }
  return data ? data as unknown as GoogleDriveConnectionRow : null;
};

const toConnectionSummary = (
  row: GoogleDriveConnectionRow | null,
  configured = getGoogleDriveProjectStorageConfiguration().configured,
): GoogleDriveProjectConnectionSummary => {
  if (!configured) {
    return {
      provider: GOOGLE_DRIVE_PROJECT_PROVIDER,
      configured: false,
      connected: false,
      displayName: null,
      rootFolderId: null,
      status: 'unconfigured',
      statusNote: 'Google Drive project storage needs server configuration.',
      lastVerifiedAt: null,
    };
  }
  if (!row) {
    return {
      provider: GOOGLE_DRIVE_PROJECT_PROVIDER,
      configured: true,
      connected: false,
      displayName: null,
      rootFolderId: null,
      status: 'disconnected',
      statusNote: null,
      lastVerifiedAt: null,
    };
  }
  return {
    provider: GOOGLE_DRIVE_PROJECT_PROVIDER,
    configured: true,
    connected: true,
    displayName: row.display_name,
    rootFolderId: row.root_folder_id,
    status: row.status,
    statusNote: row.status_note || null,
    lastVerifiedAt: row.last_verified_at,
  };
};

export const getGoogleDriveProjectConnection = async (ownerUserId: string): Promise<GoogleDriveProjectConnectionSummary> => {
  const config = getGoogleDriveProjectStorageConfiguration();
  if (!config.configured) return toConnectionSummary(null, false);
  return toConnectionSummary(await getConnectionRow(ownerUserId), true);
};

export const buildGoogleDriveProjectAuthorizationUrl = (state: string): string => {
  const config = requireConfiguration();
  const url = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', [...GOOGLE_DRIVE_IDENTITY_SCOPES, GOOGLE_DRIVE_FILE_SCOPE].join(' '));
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('state', state);
  return url.toString();
};

const exchangeAuthorizationCode = async (code: string): Promise<GoogleTokenResponse> => {
  const config = requireConfiguration();
  let response: Response;
  try {
    response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code',
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(GOOGLE_PROVIDER_REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new ProjectStorageProviderError('Google authorization is temporarily unavailable.', 503, {
      kind: 'unavailable',
      nextAction: 'Retry connecting Google Drive later.',
    });
  }
  const payload = await response.json().catch(() => ({})) as GoogleTokenResponse;
  if (!response.ok || !payload.access_token) {
    throw new ProjectStorageProviderError(
      payload.error_description ? `Google authorization failed. ${payload.error_description}` : 'Google authorization failed.',
      401,
      { kind: 'authentication' },
    );
  }
  return payload;
};

const fetchGoogleUserInfo = async (accessToken: string): Promise<GoogleUserInfo> => {
  const response = await fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(GOOGLE_PROVIDER_REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw await parseGoogleError(response, 'Google did not return the connected account identity.');
  return await response.json() as GoogleUserInfo;
};

const resolveGoogleDriveRootOnConnect = async ({
  ownerUserId,
  externalAccountId,
  accessToken,
}: {
  ownerUserId: string;
  externalAccountId: string;
  accessToken: string;
}): Promise<{ rootFolderId: string | null; rootFolderResourceKey: string | null; status: 'active' | 'error'; statusNote: string }> => {
  const existing = await getConnectionRow(ownerUserId);
  if (!existing || existing.external_account_id !== externalAccountId) {
    return {
      rootFolderId: null,
      rootFolderResourceKey: null,
      status: 'active',
      statusNote: 'Choose or create a project folder before saving to Google Drive.',
    };
  }

  const rootFolderId = existing.root_folder_id?.trim() || null;
  const rootFolderResourceKey = existing.root_folder_resource_key?.trim() || null;
  if (!rootFolderId) {
    return {
      rootFolderId: null,
      rootFolderResourceKey: null,
      status: 'active',
      statusNote: 'Choose or create a project folder before saving to Google Drive.',
    };
  }
  if (!isGoogleDriveFileId(rootFolderId)) {
    return {
      rootFolderId,
      rootFolderResourceKey,
      status: 'error',
      statusNote: 'The previously selected Drive project folder has invalid saved metadata. Choose a project folder before saving.',
    };
  }

  try {
    const folder = await getDriveFolderMetadata({ accessToken, folderId: rootFolderId, resourceKey: rootFolderResourceKey });
    return {
      rootFolderId,
      rootFolderResourceKey: folder.resourceKey?.trim() || rootFolderResourceKey,
      status: 'active',
      statusNote: folder.capabilities?.canAddChildren === false
        ? 'This Drive folder is read-only for the connected account.'
        : '',
    };
  } catch (error) {
    console.warn('Google Drive reconnected, but the previous project folder could not be verified:', error);
    return {
      rootFolderId,
      rootFolderResourceKey,
      status: 'error',
      statusNote: 'Google Drive reconnected, but CardForge could not verify the previously selected project folder. Choose a project folder before saving.',
    };
  }
};

const assertGoogleDriveLeastPrivilege = (grantedScopes: readonly string[] | null | undefined): void => {
  const failure = validateGoogleDriveStoredScopes(grantedScopes);
  if (!failure) return;
  throw new ProjectStorageProviderError(
    failure.message.replace('The connection cannot be used.', 'The connection was not saved.'),
    failure.status,
    { kind: failure.kind, nextAction: failure.nextAction },
  );
};

export const connectGoogleDriveProjectStorage = async ({
  ownerUserId,
  code,
}: {
  ownerUserId: string;
  code: string;
}): Promise<GoogleDriveProjectConnectionSummary> => {
  if (!code.trim()) throw new ProjectStorageProviderError('Google authorization code is missing.', 400, { kind: 'invalid' });
  const tokens = await exchangeAuthorizationCode(code.trim());
  const grantedScopes = tokens.scope?.split(/\s+/gu).filter(Boolean)
    ?? [...GOOGLE_DRIVE_IDENTITY_SCOPES, GOOGLE_DRIVE_FILE_SCOPE];
  assertGoogleDriveLeastPrivilege(grantedScopes);
  const userInfo = await fetchGoogleUserInfo(tokens.access_token!);
  const externalAccountId = userInfo.sub?.trim() ?? '';
  const displayName = userInfo.email?.trim() || userInfo.name?.trim() || 'Google Drive';
  if (!externalAccountId) {
    throw new ProjectStorageProviderError('Google did not return a stable account identifier.', 401, { kind: 'authentication' });
  }
  const refreshToken = tokens.refresh_token?.trim();
  if (!refreshToken) {
    throw new ProjectStorageProviderError(
      'Google did not return offline access for this connection. Reconnect Google Drive and approve access again.',
      409,
      { kind: 'conflict' },
    );
  }
  const root = await resolveGoogleDriveRootOnConnect({
    ownerUserId,
    externalAccountId,
    accessToken: tokens.access_token!,
  });
  const encrypted = encryptProjectStorageToken(refreshToken);
  const now = new Date().toISOString();
  const { data, error } = await requireStore()
    .from('cardforge_project_storage_connections')
    .upsert({
      owner_user_id: ownerUserId,
      provider: GOOGLE_DRIVE_PROJECT_PROVIDER,
      external_account_id: externalAccountId,
      display_name: displayName.slice(0, 320),
      refresh_token_ciphertext: encrypted.ciphertext,
      refresh_token_iv: encrypted.iv,
      refresh_token_auth_tag: encrypted.authTag,
      granted_scopes: grantedScopes,
      root_folder_id: root.rootFolderId,
      root_folder_resource_key: root.rootFolderResourceKey,
      status: root.status,
      status_note: root.statusNote,
      last_verified_at: now,
    }, { onConflict: 'owner_user_id,provider' })
    .select(CONNECTION_COLUMNS)
    .single();
  if (error || !data) {
    console.error('Unable to persist Google Drive project connection:', error);
    throw new ProjectStorageProviderError('CardForge could not save the Google Drive connection.', 503, { kind: 'unavailable' });
  }
  return toConnectionSummary(data as unknown as GoogleDriveConnectionRow, true);
};

const refreshGoogleAccessToken = async (row: GoogleDriveConnectionRow): Promise<string> => {
  const config = requireConfiguration();
  const access = await resolveGoogleDriveConnectionAccess({
    row,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    tokenEndpoint: GOOGLE_TOKEN_ENDPOINT,
  });
  if (!access.ok) {
    if (access.failure.reconnectRequired) {
      await requireStore()
        .from('cardforge_project_storage_connections')
        .update({ status: 'error', status_note: 'Google authorization expired, was revoked, or is missing the required Drive permission.' })
        .eq('id', row.id);
    }
    throw new ProjectStorageProviderError(access.failure.message, access.failure.status, {
      kind: access.failure.kind,
      nextAction: access.failure.nextAction,
    });
  }
  return access.accessToken;
};

const requireConnection = async (ownerUserId: string): Promise<{ row: GoogleDriveConnectionRow; accessToken: string }> => {
  requireConfiguration();
  const row = await getConnectionRow(ownerUserId);
  if (!row) {
    throw new ProjectStorageProviderError('Connect Google Drive before using it for CardForge projects.', 404, {
      kind: 'not_found',
      nextAction: 'Connect Google Drive in Library → Locations.',
    });
  }
  assertGoogleDriveLeastPrivilege(row.granted_scopes);
  return { row, accessToken: await refreshGoogleAccessToken(row) };
};

const requireSelectedRootFolderId = (row: GoogleDriveConnectionRow): string => {
  const folderId = row.root_folder_id?.trim() ?? '';
  if (!isGoogleDriveFileId(folderId)) {
    throw new ProjectStorageProviderError('Choose or create a Google Drive project folder before using Drive project files.', 409, {
      kind: 'conflict',
      nextAction: 'Choose an existing project folder or create a new one in Library → Locations.',
    });
  }
  return folderId;
};

const normalizeDriveProjectName = (value: string): string => {
  const withoutExtension = value.replace(/\.cardforge$/iu, '');
  return `${normalizeProjectFileName(withoutExtension)}${CARDFORGE_PROJECT_FILE_EXTENSION}`;
};

const toProjectSummary = async (file: GoogleDriveFile): Promise<GoogleDriveProjectSummary | null> => {
  const fileId = file.id ?? '';
  const headRevisionId = file.headRevisionId;
  if (typeof headRevisionId !== 'string' || !headRevisionId.trim()) throw new ProjectStorageProviderError('Drive did not provide a binary content revision. Reload this file before saving; no write was attempted.', 503, { kind: 'unavailable' });
  const modifiedAt = file.modifiedTime ?? '';
  if (!isGoogleDriveFileId(fileId) || Number.isNaN(Date.parse(modifiedAt))) return null;
  const projectRevision = file.appProperties?.[GOOGLE_DRIVE_PROJECT_REVISION_PROPERTY] ?? null;
  const rawWorkId = file.appProperties?.[GOOGLE_DRIVE_WORK_ID_PROPERTY]?.trim() ?? '';
  const workId = isGoogleDriveWorkId(rawWorkId) ? rawWorkId : null;
  return {
    provider: GOOGLE_DRIVE_PROJECT_PROVIDER,
    fileId,
    name: normalizeDriveProjectName(file.name ?? 'CardForge Project'),
    providerRevision: await createGoogleDriveProviderRevision(headRevisionId),
    projectRevision: projectRevision && isProjectPackageAssetId(projectRevision) ? projectRevision : null,
    modifiedAt,
    size: Math.max(0, Number(file.size) || 0),
    webViewLink: file.webViewLink ?? null,
    thumbnailLink: file.thumbnailLink ?? null,
    workId,
    driveId: file.driveId ?? null,
    resourceKey: file.resourceKey ?? null,
    capabilities: {
      canDownload: file.capabilities?.canDownload === true,
      canEdit: file.capabilities?.canEdit === true,
      canModifyContent: file.capabilities?.canModifyContent === true,
      canTrash: file.capabilities?.canTrash === true,
      canDelete: file.capabilities?.canDelete === true,
    },
  };
};

const getDriveFileMetadata = async ({
  accessToken,
  fileId,
}: {
  accessToken: string;
  fileId: string;
}): Promise<GoogleDriveFile> => {
  if (!isGoogleDriveFileId(fileId)) throw new ProjectStorageProviderError('Google Drive project id is invalid.', 400, { kind: 'invalid' });
  const url = new URL(`${GOOGLE_DRIVE_API}/files/${encodeURIComponent(fileId)}`);
  url.searchParams.set('fields', GOOGLE_DRIVE_PROJECT_FIELDS);
  url.searchParams.set('supportsAllDrives', 'true');
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(GOOGLE_PROVIDER_REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw await parseGoogleError(response, 'CardForge could not read that Google Drive project.');
  return await response.json() as GoogleDriveFile;
};

const folderHeaders = (accessToken: string, folderId: string, resourceKey?: string | null): Record<string, string> => ({
  Authorization: `Bearer ${accessToken}`,
  ...(resourceKey ? { 'X-Goog-Drive-Resource-Keys': `${folderId}/${resourceKey}` } : {}),
});

const getDriveFolderMetadata = async ({
  accessToken,
  folderId,
  resourceKey = null,
}: {
  accessToken: string;
  folderId: string;
  resourceKey?: string | null;
}): Promise<GoogleDriveFile> => {
  const url = new URL(`${GOOGLE_DRIVE_API}/files/${encodeURIComponent(folderId)}`);
  url.searchParams.set('fields', GOOGLE_DRIVE_FOLDER_FIELDS);
  url.searchParams.set('supportsAllDrives', 'true');
  const response = await fetch(url, {
    headers: folderHeaders(accessToken, folderId, resourceKey),
    cache: 'no-store',
    signal: AbortSignal.timeout(GOOGLE_PROVIDER_REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw await parseGoogleError(response, 'CardForge could not read the selected Google Drive folder.');
  const folder = await response.json() as GoogleDriveFile;
  if (!folder.resourceKey && resourceKey) folder.resourceKey = resourceKey;
  if (folder.trashed === true) throw new ProjectStorageProviderError('The selected Google Drive project folder is in Trash.', 404, {
    kind: 'not_found',
    nextAction: 'Restore the folder in Google Drive or choose another project folder in Library → Locations.',
  });
  if (folder.mimeType !== GOOGLE_DRIVE_FOLDER_MIME_TYPE) throw new ProjectStorageProviderError('The configured Drive location is no longer a folder.', 409, { kind: 'conflict' });
  return folder;
};

/**
 * The exact CardForge MIME type and selected-folder parent establish the provider
 * boundary for an explicitly authorized Drive file. `cardforgeProject=1` is
 * metadata written by modern CardForge saves, but older valid packages predate
 * that marker. Requiring it here made Picker-authorized legacy projects vanish
 * from a shared folder even though Drive had already granted per-file access.
 * The package decoder remains authoritative before editable content is opened.
 */
export const isGoogleDriveProjectFileInFolder = (
  file: Pick<GoogleDriveFile, 'mimeType' | 'parents'>,
  rootFolderId: string,
): boolean => file.mimeType === GOOGLE_DRIVE_PROJECT_MIME_TYPE && file.parents?.includes(rootFolderId) === true;

const assertOwnedCardForgeProject = async (file: GoogleDriveFile, rootFolderId: string): Promise<GoogleDriveProjectSummary> => {
  if (file.trashed === true) {
    throw new ProjectStorageProviderError('That Google Drive project is in Trash.', 404, {
      kind: 'not_found',
      nextAction: 'Restore the project in Google Drive or open another copy.',
    });
  }
  const summary = await toProjectSummary(file);
  if (!summary || !isGoogleDriveProjectFileInFolder(file, rootFolderId)) {
    throw new ProjectStorageProviderError('That Google Drive file is not a CardForge project in this connected folder.', 404, { kind: 'not_found' });
  }
  return summary;
};

const getAuthorizedGoogleDriveProjectMetadata = async ({
  ownerUserId,
  fileId,
}: {
  ownerUserId: string;
  fileId: string;
}) => {
  const { row, accessToken } = await requireConnection(ownerUserId);
  const rootFolderId = requireSelectedRootFolderId(row);
  const file = await getDriveFileMetadata({ accessToken, fileId });
  const summary = await assertOwnedCardForgeProject(file, rootFolderId);
  return { row, accessToken, summary };
};

/**
 * Lightweight exact-file probe for an already open Drive-backed Set. This
 * reads provider metadata only; package bytes are downloaded only after the
 * client proves a newer clean revision should replace the browser projection.
 */
export const getGoogleDriveProjectSummary = async ({
  ownerUserId,
  fileId,
}: {
  ownerUserId: string;
  fileId: string;
}): Promise<GoogleDriveProjectSummary> => {
  const { row, summary } = await getAuthorizedGoogleDriveProjectMetadata({ ownerUserId, fileId });
  return { ...summary, accountId: row.external_account_id };
};

export const listGoogleDriveProjectsPage = async ({
  ownerUserId,
  pageToken = null,
}: {
  ownerUserId: string;
  pageToken?: string | null;
}): Promise<GoogleDriveProjectListResult> => {
  const config = getGoogleDriveProjectStorageConfiguration();
  if (!config.configured) {
    return { connection: toConnectionSummary(null, false), projects: [] };
  }
  const row = await getConnectionRow(ownerUserId);
  if (!row) return { connection: toConnectionSummary(null, true), projects: [] };
  assertGoogleDriveLeastPrivilege(row.granted_scopes);
  if (!row.root_folder_id) {
    return {
      connection: toConnectionSummary(row, true),
      projects: [],
      nextPageToken: null,
    };
  }
  const rootFolderId = requireSelectedRootFolderId(row);
  const accessToken = await refreshGoogleAccessToken(row);
  const folder = await getDriveFolderMetadata({ accessToken, folderId: rootFolderId, resourceKey: row.root_folder_resource_key });
  const url = new URL(`${GOOGLE_DRIVE_API}/files`);
  url.searchParams.set('q', `'${rootFolderId}' in parents and trashed = false and mimeType = '${GOOGLE_DRIVE_PROJECT_MIME_TYPE}'`);
  url.searchParams.set('spaces', 'drive');
  url.searchParams.set('supportsAllDrives', 'true');
  url.searchParams.set('includeItemsFromAllDrives', 'true');
  if (folder.driveId) {
    url.searchParams.set('corpora', 'drive');
    url.searchParams.set('driveId', folder.driveId);
  }
  url.searchParams.set('pageSize', String(GOOGLE_DRIVE_LIST_PAGE_SIZE));
  url.searchParams.set('orderBy', 'modifiedTime desc');
  if (pageToken?.trim()) url.searchParams.set('pageToken', pageToken.trim());
  url.searchParams.set('fields', `nextPageToken,files(${GOOGLE_DRIVE_PROJECT_FIELDS})`);
  const response = await fetch(url, {
    headers: folderHeaders(accessToken, rootFolderId, row.root_folder_resource_key),
    cache: 'no-store',
    signal: AbortSignal.timeout(GOOGLE_PROVIDER_REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw await parseGoogleError(response, 'CardForge could not list Google Drive projects.');
  const payload = await response.json() as { files?: GoogleDriveFile[]; nextPageToken?: unknown };
  const projects = (await Promise.all((payload.files ?? [])
    .filter((file) => isGoogleDriveProjectFileInFolder(file, rootFolderId))
    .map(toProjectSummary)))
    .filter((summary): summary is GoogleDriveProjectSummary => Boolean(summary))
    .map((summary) => ({ ...summary, accountId: row.external_account_id }));
  return {
    connection: toConnectionSummary(row, true),
    projects,
    nextPageToken: typeof payload.nextPageToken === 'string' && payload.nextPageToken.trim()
      ? payload.nextPageToken
      : null,
  };
};

/** The provider-facing MCP path needs the complete authorized list, not only Drive's first page. */
export const listGoogleDriveProjects = async (ownerUserId: string): Promise<GoogleDriveProjectListResult> => {
  let cursor: string | null = null;
  let connection: GoogleDriveProjectListResult['connection'] | null = null;
  const projects: GoogleDriveProjectListResult['projects'] = [];
  const seenCursors = new Set<string>();
  do {
    const page = await listGoogleDriveProjectsPage({ ownerUserId, pageToken: cursor });
    connection = page.connection;
    projects.push(...page.projects);
    const next = page.nextPageToken ?? null;
    if (!next || seenCursors.has(next)) cursor = null;
    else {
      seenCursors.add(next);
      cursor = next;
    }
  } while (cursor);
  if (!connection) throw new ProjectStorageProviderError('Google Drive did not return a project-library connection state.', 503, { kind: 'unavailable' });
  return { connection, projects, nextPageToken: null };
};

export const getGoogleDriveProject = async ({
  ownerUserId,
  fileId,
}: {
  ownerUserId: string;
  fileId: string;
}): Promise<GoogleDriveProjectDownload & { document: ProjectDocumentV1 }> => {
  const { row, accessToken, summary } = await getAuthorizedGoogleDriveProjectMetadata({ ownerUserId, fileId });
  if (summary.capabilities && !summary.capabilities.canDownload) {
    throw new ProjectStorageProviderError('Your current Drive role cannot download this project.', 403, { kind: 'authorization', nextAction: 'Ask the Drive owner for file access or choose another project.' });
  }
  if (summary.size > MAX_ENCODED_PROJECT_BYTES) {
    throw new ProjectStorageProviderError('That Google Drive project exceeds CardForge’s safe portable-project size limit.', 413, { kind: 'limit' });
  }
  const mediaUrl = new URL(`${GOOGLE_DRIVE_API}/files/${encodeURIComponent(fileId)}`);
  mediaUrl.searchParams.set('alt', 'media');
  mediaUrl.searchParams.set('supportsAllDrives', 'true');
  const response = await fetch(mediaUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(GOOGLE_PROVIDER_CONTENT_TIMEOUT_MS),
  });
  if (!response.ok) throw await parseGoogleError(response, 'CardForge could not download that Google Drive project.');
  const contentLength = Number(response.headers.get('content-length')) || 0;
  if (contentLength > MAX_ENCODED_PROJECT_BYTES) {
    throw new ProjectStorageProviderError('That Google Drive project exceeds CardForge’s safe portable-project size limit.', 413, { kind: 'limit' });
  }
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength <= 0 || buffer.byteLength > MAX_ENCODED_PROJECT_BYTES) {
    throw new ProjectStorageProviderError('The Google Drive project is empty or too large to open safely.', 413, { kind: 'limit' });
  }
  const bytes = new Uint8Array(buffer);
  let snapshot;
  try {
    snapshot = await decodeCardForgeProjectPackage(bytes);
  } catch (error) {
    throw new ProjectStorageProviderError(
      error instanceof ProjectPackageError ? error.message : 'The Google Drive file is not a readable CardForge project.',
      409,
      { kind: 'conflict' },
    );
  }
  if (summary.projectRevision && summary.projectRevision !== snapshot.manifest.projectRevision) {
    throw new ProjectStorageProviderError('The Google Drive project metadata does not match the project package revision.', 409, { kind: 'conflict' });
  }
  return {
    summary: { ...summary, accountId: row.external_account_id, projectRevision: snapshot.manifest.projectRevision },
    bytes,
    document: hydrateCardForgeProjectSnapshot(snapshot),
  };
};

/** Private disposable preview; never downloads/imports the editable package. */
export const getGoogleDriveProjectThumbnail = async ({ ownerUserId, fileId }: { ownerUserId: string; fileId: string }) => {
  const { row, accessToken } = await requireConnection(ownerUserId);
  const rootFolderId = requireSelectedRootFolderId(row);
  const file = await getDriveFileMetadata({ accessToken, fileId });
  await assertOwnedCardForgeProject(file, rootFolderId);
  if (!file.thumbnailLink) throw new ProjectStorageProviderError('This Drive document has no preview yet.', 404, { kind: 'not_found' });
  const url = new URL(file.thumbnailLink);
  if (url.protocol !== 'https:' || url.username || url.password || url.port
    || !(url.hostname === 'drive.google.com' || url.hostname.endsWith('.googleusercontent.com'))) {
    throw new ProjectStorageProviderError('Drive returned an unsupported preview location.', 503, { kind: 'unavailable' });
  }
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw await parseGoogleError(response, 'The Drive preview is unavailable. The document can still be opened.');
  const mimeType = response.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(mimeType) || !response.body) {
    throw new ProjectStorageProviderError('Drive returned an unreadable preview image.', 503, { kind: 'unavailable' });
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2 * 1024 * 1024) {
        await reader.cancel();
        throw new ProjectStorageProviderError('The Drive preview exceeds the safe image limit.', 413, { kind: 'limit' });
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return { bytes: Buffer.concat(chunks), mimeType };
};

export const prepareGoogleDriveProjectUpload = async ({
  ownerUserId,
  name,
  size,
  projectRevision,
  fileId = null,
  expectedProviderRevision = null,
  expectedProjectRevision = null,
  expectedAccountId = null,
  workId = null,
  thumbnail = null,
}: {
  ownerUserId: string;
  name: string;
  size: number;
  projectRevision: string;
  fileId?: string | null;
  expectedProviderRevision?: string | null;
  expectedProjectRevision?: string | null;
  expectedAccountId?: string | null;
  workId?: string | null;
  thumbnail?: string | null;
}): Promise<GoogleDriveUploadPrepareResult> => {
  if (!Number.isInteger(size) || size <= 0 || size > MAX_ENCODED_PROJECT_BYTES) {
    throw new ProjectStorageProviderError('The CardForge project is empty or exceeds the safe portable-project size limit.', 413, { kind: 'limit' });
  }
  if (!isProjectPackageAssetId(projectRevision)) {
    throw new ProjectStorageProviderError('The CardForge project revision is invalid.', 400, { kind: 'invalid' });
  }
  if (thumbnail && (!/^[A-Za-z0-9_-]+$/.test(thumbnail) || thumbnail.length > 2_796_203
    || !Buffer.from(thumbnail, 'base64url').subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')))) {
    throw new ProjectStorageProviderError('The Drive preview must be a PNG no larger than 2 MB.', 400, { kind: 'invalid' });
  }
  const { row, accessToken } = await requireConnection(ownerUserId);
  const rootFolderId = requireSelectedRootFolderId(row);
  if (expectedAccountId && row.external_account_id !== expectedAccountId) {
    throw new ProjectStorageProviderError('The connected Google account changed. Reconnect the document’s account before saving; the Drive file was left unchanged.', 409, { kind: 'conflict' });
  }
  const normalizedName = normalizeDriveProjectName(name);
  const requestedWorkId = workId?.trim() ?? '';
  if (requestedWorkId && !isGoogleDriveWorkId(requestedWorkId)) {
    throw new ProjectStorageProviderError('The CardForge work id is invalid.', 400, { kind: 'invalid' });
  }
  let effectiveWorkId = requestedWorkId || null;
  let requestUrl: URL;
  let method: 'POST' | 'PATCH';
  let metadata: Record<string, unknown>;
  let rootFolderResourceKey: string | null = null;

  if (fileId) {
    const current = await getDriveFileMetadata({ accessToken, fileId });
    const currentSummary = await assertOwnedCardForgeProject(current, rootFolderId);
    if (currentSummary.capabilities && (!currentSummary.capabilities.canEdit || !currentSummary.capabilities.canModifyContent)) {
      throw new ProjectStorageProviderError('Your current Drive role is read-only for this project.', 403, { kind: 'authorization', nextAction: 'Ask the Drive owner for edit access or use Save as new in a writable folder.' });
    }
    effectiveWorkId = effectiveWorkId ?? currentSummary.workId;
    if (hasGoogleDriveProjectRevisionConflict({
      currentProviderRevision: currentSummary.providerRevision,
      currentProjectRevision: currentSummary.projectRevision,
      expectedProviderRevision,
      expectedProjectRevision,
    })) {
      throw new ProjectStorageProviderError(
        expectedProviderRevision && expectedProjectRevision
          ? 'The Drive content revision differs from this saved binding. Refresh a clean working copy before saving, or use Save as new to preserve local changes.'
          : 'Updating a Google Drive project requires the exact provider and CardForge revisions previously read.',
        409,
        { kind: 'conflict' },
      );
    }
    requestUrl = new URL(`${GOOGLE_DRIVE_UPLOAD_API}/files/${encodeURIComponent(fileId)}`);
    method = 'PATCH';
    metadata = {
      mimeType: GOOGLE_DRIVE_PROJECT_MIME_TYPE,
      appProperties: {
        [GOOGLE_DRIVE_PROJECT_APP_PROPERTY]: GOOGLE_DRIVE_PROJECT_VALUE,
        [GOOGLE_DRIVE_PROJECT_REVISION_PROPERTY]: projectRevision,
        ...(effectiveWorkId ? { [GOOGLE_DRIVE_WORK_ID_PROPERTY]: effectiveWorkId } : {}),
      },
    };
  } else {
    rootFolderResourceKey = row.root_folder_resource_key?.trim() || null;
    const folder = await getDriveFolderMetadata({
      accessToken,
      folderId: rootFolderId,
      resourceKey: rootFolderResourceKey,
    });
    if (folder.capabilities?.canAddChildren !== true) {
      throw new ProjectStorageProviderError('Your current Drive role cannot add files to this folder.', 403, { kind: 'authorization', nextAction: 'Choose a writable Drive folder or ask its owner for content-manager/editor access.' });
    }
    requestUrl = new URL(`${GOOGLE_DRIVE_UPLOAD_API}/files`);
    method = 'POST';
    metadata = {
      name: normalizedName,
      mimeType: GOOGLE_DRIVE_PROJECT_MIME_TYPE,
      parents: [rootFolderId],
      appProperties: {
        [GOOGLE_DRIVE_PROJECT_APP_PROPERTY]: GOOGLE_DRIVE_PROJECT_VALUE,
        [GOOGLE_DRIVE_PROJECT_REVISION_PROPERTY]: projectRevision,
        ...(effectiveWorkId ? { [GOOGLE_DRIVE_WORK_ID_PROPERTY]: effectiveWorkId } : {}),
      },
    };
  }
  requestUrl.searchParams.set('uploadType', 'resumable');
  requestUrl.searchParams.set('supportsAllDrives', 'true');
  if (thumbnail) metadata.contentHints = { thumbnail: { mimeType: 'image/png', image: thumbnail } };
  requestUrl.searchParams.set('fields', GOOGLE_DRIVE_PROJECT_FIELDS);
  const response = await fetch(requestUrl, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Origin: getPublicAppUrl(),
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': GOOGLE_DRIVE_PROJECT_MIME_TYPE,
      'X-Upload-Content-Length': String(size),
      ...(rootFolderResourceKey ? { 'X-Goog-Drive-Resource-Keys': `${rootFolderId}/${rootFolderResourceKey}` } : {}),
    },
    body: JSON.stringify(metadata),
    cache: 'no-store',
    signal: AbortSignal.timeout(GOOGLE_PROVIDER_REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw await parseGoogleError(response, 'CardForge could not prepare the Google Drive project upload.');
  const uploadSessionUrl = response.headers.get('location') ?? '';
  if (!uploadSessionUrl.startsWith('https://www.googleapis.com/')) {
    throw new ProjectStorageProviderError('Google Drive did not return a valid resumable upload session.', 503, { kind: 'unavailable' });
  }
  return {
    uploadSessionUrl,
    accountId: row.external_account_id,
    provider: GOOGLE_DRIVE_PROJECT_PROVIDER,
    fileId,
    name: normalizedName,
    projectRevision,
    workId: effectiveWorkId,
  };
};

const unknownDriveCommit = () => new ProjectStorageProviderError(
  'Google Drive may have saved this revision, but CardForge did not receive a usable commit receipt.',
  503,
  { kind: 'unavailable', retryable: false, nextAction: 'Do not repeat commit_project. Read the connected file’s current revision and compare it with this working document before another reviewed commit.' },
);

const parseServerUploadCompletion = async (response: Response): Promise<GoogleDriveUploadCompletion> => {
  let result: GoogleDriveUploadCompletion;
  try { result = await response.json() as GoogleDriveUploadCompletion; } catch { throw unknownDriveCommit(); }
  if (!result || typeof result !== 'object' || !isGoogleDriveFileId(result.id) || typeof result.headRevisionId !== 'string' || !result.headRevisionId.trim()) {
    throw unknownDriveCommit();
  }
  return result;
};

const nextServerResumableOffset = (rangeHeader: string | null, totalBytes: number): number => {
  if (!rangeHeader) return 0;
  const match = /^bytes=0-(\d+)$/u.exec(rangeHeader.trim());
  if (!match) throw unknownDriveCommit();
  const lastByte = Number(match[1]);
  if (!Number.isSafeInteger(lastByte) || lastByte < 0 || lastByte >= totalBytes) throw unknownDriveCommit();
  return lastByte + 1;
};

const serverUploadRequest = async ({
  uploadSessionUrl,
  body,
  contentRange,
}: {
  uploadSessionUrl: string;
  body: Blob | null;
  contentRange: string;
}): Promise<Response> => await fetch(uploadSessionUrl, {
  method: 'PUT',
  headers: {
    ...(body ? {
      'Content-Type': GOOGLE_DRIVE_PROJECT_MIME_TYPE,
      'Content-Length': String(body.size),
    } : { 'Content-Length': '0' }),
    'Content-Range': contentRange,
  },
  ...(body ? { body } : {}),
  cache: 'no-store',
  signal: AbortSignal.timeout(GOOGLE_PROVIDER_CONTENT_TIMEOUT_MS),
});

const completeServerUpload = async ({
  uploadSessionUrl,
  blob,
}: {
  uploadSessionUrl: string;
  blob: Blob;
}): Promise<GoogleDriveUploadCompletion> => {
  let response: Response;
  try {
    response = await serverUploadRequest({
      uploadSessionUrl,
      body: blob,
      contentRange: `bytes 0-${blob.size - 1}/${blob.size}`,
    });
  } catch {
    response = new Response(null, { status: 503 });
  }
  if (response.ok) return await parseServerUploadCompletion(response);
  if (response.status !== 308 && response.status < 500) {
    throw await parseGoogleError(response, 'CardForge could not finish the Google Drive project upload.');
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    let statusResponse: Response;
    try {
      statusResponse = await serverUploadRequest({
        uploadSessionUrl,
        body: null,
        contentRange: `bytes */${blob.size}`,
      });
    } catch {
      continue;
    }
    if (statusResponse.ok) return await parseServerUploadCompletion(statusResponse);
    if (statusResponse.status === 404) {
      throw new ProjectStorageProviderError('The Google Drive upload session expired before a completed receipt was returned.', 503, {
        kind: 'unavailable',
        retryable: true,
        nextAction: 'Retry the reviewed commit from the current source revision to start a fresh upload session.',
      });
    }
    if (statusResponse.status !== 308) {
      if (statusResponse.status >= 500) continue;
      throw await parseGoogleError(statusResponse, 'CardForge could not recover the interrupted Google Drive upload.');
    }

    const offset = nextServerResumableOffset(statusResponse.headers.get('Range'), blob.size);
    if (offset >= blob.size) continue;
    const remaining = blob.slice(offset);
    let resumeResponse: Response;
    try {
      resumeResponse = await serverUploadRequest({
        uploadSessionUrl,
        body: remaining,
        contentRange: `bytes ${offset}-${blob.size - 1}/${blob.size}`,
      });
    } catch {
      continue;
    }
    if (resumeResponse.ok) return await parseServerUploadCompletion(resumeResponse);
    if (resumeResponse.status === 308 || resumeResponse.status >= 500) continue;
    throw await parseGoogleError(resumeResponse, 'CardForge could not resume the interrupted Google Drive upload.');
  }
  throw unknownDriveCommit();
};

export const updateGoogleDriveProjectFromServer = async ({
  ownerUserId,
  fileId,
  name,
  blob,
  projectRevision,
  expectedProviderRevision,
  expectedProjectRevision,
}: {
  ownerUserId: string;
  fileId: string;
  name: string;
  blob: Blob;
  projectRevision: string;
  expectedProviderRevision: string;
  expectedProjectRevision: string;
}): Promise<GoogleDriveProjectSummary> => {
  const plan = await prepareGoogleDriveProjectUpload({
    ownerUserId,
    name,
    size: blob.size,
    projectRevision,
    fileId,
    expectedProviderRevision,
    expectedProjectRevision,
  });
  const completed = await completeServerUpload({ uploadSessionUrl: plan.uploadSessionUrl, blob });
  const summary = await toProjectSummary({
    id: completed.id,
    name: completed.name,
    mimeType: GOOGLE_DRIVE_PROJECT_MIME_TYPE,
    version: completed.version,
    headRevisionId: completed.headRevisionId,
    modifiedTime: completed.modifiedTime ?? new Date().toISOString(),
    size: completed.size ?? String(blob.size),
    webViewLink: completed.webViewLink,
    capabilities: { canDownload: true, canEdit: true, canModifyContent: true, canTrash: true, canDelete: true },
    appProperties: completed.appProperties ?? {
      [GOOGLE_DRIVE_PROJECT_APP_PROPERTY]: GOOGLE_DRIVE_PROJECT_VALUE,
      [GOOGLE_DRIVE_PROJECT_REVISION_PROPERTY]: projectRevision,
      ...(plan.workId ? { [GOOGLE_DRIVE_WORK_ID_PROPERTY]: plan.workId } : {}),
    },
  });
  if (!summary) throw unknownDriveCommit();
  return { ...summary, projectRevision };
};

export const deleteGoogleDriveProject = async ({
  ownerUserId,
  fileId,
  expectedProviderRevision,
  expectedProjectRevision,
}: {
  ownerUserId: string;
  fileId: string;
  expectedProviderRevision: string;
  expectedProjectRevision: string;
}): Promise<GoogleDriveProjectSummary> => {
  const { row, accessToken } = await requireConnection(ownerUserId);
  const rootFolderId = requireSelectedRootFolderId(row);
  const current = await getDriveFileMetadata({ accessToken, fileId });
  const summary = await assertOwnedCardForgeProject(current, rootFolderId);
  if (summary.capabilities && !summary.capabilities.canTrash) {
    throw new ProjectStorageProviderError('Your current Drive role cannot move this project to Trash.', 403, {
      kind: 'authorization',
      nextAction: 'Ask the Drive owner or organizer to remove it, or keep the source file and remove only the CardForge browser copy.',
    });
  }
  if (summary.providerRevision !== expectedProviderRevision || summary.projectRevision !== expectedProjectRevision) {
    throw new ProjectStorageProviderError('The Google Drive project changed after it was loaded. Reload it before moving it to Trash.', 409, { kind: 'conflict' });
  }
  const trashUrl = new URL(`${GOOGLE_DRIVE_API}/files/${encodeURIComponent(fileId)}`);
  trashUrl.searchParams.set('supportsAllDrives', 'true');
  trashUrl.searchParams.set('fields', GOOGLE_DRIVE_PROJECT_FIELDS);
  const response = await fetch(trashUrl, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ trashed: true }),
    cache: 'no-store',
    signal: AbortSignal.timeout(GOOGLE_PROVIDER_REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw await parseGoogleError(response, 'CardForge could not move that Google Drive project to Trash.');
  return summary;
};

export const disconnectGoogleDriveProjectStorage = async (ownerUserId: string): Promise<void> => {
  const row = await getConnectionRow(ownerUserId);
  if (!row) return;
  let refreshToken: string;
  try {
    refreshToken = decryptProjectStorageToken({
      ciphertext: row.refresh_token_ciphertext,
      iv: row.refresh_token_iv,
      authTag: row.refresh_token_auth_tag,
    });
  } catch (error) {
    console.error('Unable to decrypt Google Drive project token for revocation:', error);
    throw new ProjectStorageProviderError('CardForge could not safely revoke Google Drive access. The connection was kept so you can retry.', 503, {
      kind: 'unavailable',
      nextAction: 'Retry disconnecting Google Drive. If this continues, contact CardForge support.',
    });
  }
  let response: Response;
  try {
    response = await fetch(GOOGLE_REVOKE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: refreshToken }),
      cache: 'no-store',
      signal: AbortSignal.timeout(GOOGLE_PROVIDER_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    console.error('Unable to revoke Google Drive project token before disconnecting:', error);
    throw new ProjectStorageProviderError('Google Drive could not be reached to revoke access. The connection was kept so you can retry.', 503, {
      kind: 'unavailable',
      nextAction: 'Retry disconnecting Google Drive later.',
    });
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (payload.error !== 'invalid_token') {
      throw new ProjectStorageProviderError('Google Drive did not confirm access revocation. The connection was kept so you can retry.', 503, {
        kind: 'unavailable',
        nextAction: 'Retry disconnecting Google Drive later.',
      });
    }
  }
  const { error } = await requireStore()
    .from('cardforge_project_storage_connections')
    .delete()
    .eq('id', row.id)
    .eq('owner_user_id', ownerUserId);
  if (error) {
    console.error('Unable to delete Google Drive project connection:', error);
    throw new ProjectStorageProviderError('CardForge could not disconnect Google Drive.', 503, { kind: 'unavailable' });
  }
};