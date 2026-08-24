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
  GOOGLE_DRIVE_ROOT_FOLDER_NAME,
  isGoogleDriveFileId,
  isGoogleDriveProviderRevision,
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

const GOOGLE_AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';
const GOOGLE_USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';
const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3';
const GOOGLE_DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const GOOGLE_DRIVE_FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
const GOOGLE_DRIVE_PROJECT_FIELDS = 'id,name,mimeType,version,modifiedTime,size,parents,webViewLink,appProperties';
const GOOGLE_DRIVE_PROJECT_APP_PROPERTY = 'cardforgeProject';
const GOOGLE_DRIVE_PROJECT_REVISION_PROPERTY = 'cardforgeProjectRevision';
const GOOGLE_DRIVE_ROOT_PROPERTY = 'cardforgeRoot';
const GOOGLE_DRIVE_PROJECT_VALUE = '1';
const GOOGLE_DRIVE_LIST_PAGE_SIZE = 100;

export class ProjectStorageProviderError extends Error {
  status: number;
  kind?: BoundaryFailureKind;
  nextAction?: string;

  constructor(message: string, status = 500, options: { kind?: BoundaryFailureKind; nextAction?: string } = {}) {
    super(message);
    this.name = 'ProjectStorageProviderError';
    this.status = status;
    this.kind = options.kind;
    this.nextAction = options.nextAction;
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
  root_folder_id: string;
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
  modifiedTime?: string;
  size?: string;
  parents?: string[];
  webViewLink?: string;
  appProperties?: Record<string, string>;
};

const CONNECTION_COLUMNS = 'id,owner_user_id,provider,external_account_id,display_name,refresh_token_ciphertext,refresh_token_iv,refresh_token_auth_tag,granted_scopes,root_folder_id,status,status_note,last_verified_at,created_at,updated_at';
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

const parseGoogleError = async (response: Response, fallback: string): Promise<ProjectStorageProviderError> => {
  const payload = await response.json().catch(() => ({})) as {
    error?: { message?: string; status?: string } | string;
    error_description?: string;
  };
  const providerMessage = typeof payload.error === 'object'
    ? payload.error?.message
    : payload.error_description ?? (typeof payload.error === 'string' ? payload.error : undefined);
  const status = response.status === 401 || response.status === 403 ? 401 : response.status === 404 ? 404 : response.status === 409 ? 409 : 503;
  return new ProjectStorageProviderError(providerMessage ? `${fallback} ${providerMessage}` : fallback, status, {
    kind: status === 401 ? 'authentication' : status === 404 ? 'not_found' : status === 409 ? 'conflict' : 'unavailable',
    nextAction: status === 401 ? 'Reconnect Google Drive in Account → Storage & Library.' : undefined,
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
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
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
  });
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
  });
  if (!response.ok) throw await parseGoogleError(response, 'Google did not return the connected account identity.');
  return await response.json() as GoogleUserInfo;
};

const createCardForgeRootFolder = async (accessToken: string): Promise<string> => {
  const response = await fetch(`${GOOGLE_DRIVE_API}/files?fields=id,name`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: GOOGLE_DRIVE_ROOT_FOLDER_NAME,
      mimeType: GOOGLE_DRIVE_FOLDER_MIME_TYPE,
      appProperties: { [GOOGLE_DRIVE_ROOT_PROPERTY]: GOOGLE_DRIVE_PROJECT_VALUE },
    }),
    cache: 'no-store',
  });
  if (!response.ok) throw await parseGoogleError(response, 'CardForge could not create its Google Drive folder.');
  const file = await response.json() as GoogleDriveFile;
  if (!file.id || !isGoogleDriveFileId(file.id)) {
    throw new ProjectStorageProviderError('Google Drive created a folder without a usable identifier.', 503, { kind: 'unavailable' });
  }
  return file.id;
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
  const rootFolderId = await createCardForgeRootFolder(tokens.access_token!);
  const encrypted = encryptProjectStorageToken(refreshToken);
  const now = new Date().toISOString();
  const grantedScopes = tokens.scope?.split(/\s+/gu).filter(Boolean) ?? [...GOOGLE_DRIVE_IDENTITY_SCOPES, GOOGLE_DRIVE_FILE_SCOPE];
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
      root_folder_id: rootFolderId,
      status: 'active',
      status_note: '',
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
  let refreshToken: string;
  try {
    refreshToken = decryptProjectStorageToken({
      ciphertext: row.refresh_token_ciphertext,
      iv: row.refresh_token_iv,
      authTag: row.refresh_token_auth_tag,
    });
  } catch (error) {
    console.error('Unable to decrypt Google Drive project refresh token:', error);
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
    throw new ProjectStorageProviderError('Google Drive authorization expired or was revoked.', 401, {
      kind: 'authentication',
      nextAction: 'Reconnect Google Drive in Account → Storage & Library.',
    });
  }
  await requireStore()
    .from('cardforge_project_storage_connections')
    .update({ status: 'active', status_note: '', last_verified_at: new Date().toISOString() })
    .eq('id', row.id);
  return payload.access_token;
};

const requireConnection = async (ownerUserId: string): Promise<{ row: GoogleDriveConnectionRow; accessToken: string }> => {
  requireConfiguration();
  const row = await getConnectionRow(ownerUserId);
  if (!row) {
    throw new ProjectStorageProviderError('Connect Google Drive before using it for CardForge projects.', 404, {
      kind: 'not_found',
      nextAction: 'Connect Google Drive in Account → Storage & Library.',
    });
  }
  return { row, accessToken: await refreshGoogleAccessToken(row) };
};

const normalizeDriveProjectName = (value: string): string => {
  const withoutExtension = value.replace(/\.cardforge$/iu, '');
  return `${normalizeProjectFileName(withoutExtension)}${CARDFORGE_PROJECT_FILE_EXTENSION}`;
};

const toProjectSummary = (file: GoogleDriveFile): GoogleDriveProjectSummary | null => {
  const fileId = file.id ?? '';
  const version = file.version ?? '';
  const modifiedAt = file.modifiedTime ?? '';
  if (!isGoogleDriveFileId(fileId) || !isGoogleDriveProviderRevision(version) || Number.isNaN(Date.parse(modifiedAt))) return null;
  const projectRevision = file.appProperties?.[GOOGLE_DRIVE_PROJECT_REVISION_PROPERTY] ?? null;
  return {
    provider: GOOGLE_DRIVE_PROJECT_PROVIDER,
    fileId,
    name: normalizeDriveProjectName(file.name ?? 'CardForge Project'),
    providerRevision: version,
    projectRevision: projectRevision && isProjectPackageAssetId(projectRevision) ? projectRevision : null,
    modifiedAt,
    size: Math.max(0, Number(file.size) || 0),
    webViewLink: file.webViewLink ?? null,
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
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!response.ok) throw await parseGoogleError(response, 'CardForge could not read that Google Drive project.');
  return await response.json() as GoogleDriveFile;
};

const assertOwnedCardForgeProject = (file: GoogleDriveFile, rootFolderId: string): GoogleDriveProjectSummary => {
  const summary = toProjectSummary(file);
  if (!summary
    || file.mimeType !== GOOGLE_DRIVE_PROJECT_MIME_TYPE
    || file.appProperties?.[GOOGLE_DRIVE_PROJECT_APP_PROPERTY] !== GOOGLE_DRIVE_PROJECT_VALUE
    || !file.parents?.includes(rootFolderId)) {
    throw new ProjectStorageProviderError('That Google Drive file is not a CardForge project owned by this connection.', 404, { kind: 'not_found' });
  }
  return summary;
};

export const listGoogleDriveProjects = async (ownerUserId: string): Promise<GoogleDriveProjectListResult> => {
  const config = getGoogleDriveProjectStorageConfiguration();
  if (!config.configured) {
    return { connection: toConnectionSummary(null, false), projects: [] };
  }
  const row = await getConnectionRow(ownerUserId);
  if (!row) return { connection: toConnectionSummary(null, true), projects: [] };
  const accessToken = await refreshGoogleAccessToken(row);
  const url = new URL(`${GOOGLE_DRIVE_API}/files`);
  url.searchParams.set('q', `'${row.root_folder_id}' in parents and trashed = false`);
  url.searchParams.set('spaces', 'drive');
  url.searchParams.set('pageSize', String(GOOGLE_DRIVE_LIST_PAGE_SIZE));
  url.searchParams.set('orderBy', 'modifiedTime desc');
  url.searchParams.set('fields', `files(${GOOGLE_DRIVE_PROJECT_FIELDS})`);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!response.ok) throw await parseGoogleError(response, 'CardForge could not list Google Drive projects.');
  const payload = await response.json() as { files?: GoogleDriveFile[] };
  const projects = (payload.files ?? [])
    .filter((file) => file.mimeType === GOOGLE_DRIVE_PROJECT_MIME_TYPE && file.appProperties?.[GOOGLE_DRIVE_PROJECT_APP_PROPERTY] === GOOGLE_DRIVE_PROJECT_VALUE)
    .map(toProjectSummary)
    .filter((summary): summary is GoogleDriveProjectSummary => Boolean(summary));
  return { connection: toConnectionSummary(row, true), projects };
};

export const getGoogleDriveProject = async ({
  ownerUserId,
  fileId,
}: {
  ownerUserId: string;
  fileId: string;
}): Promise<GoogleDriveProjectDownload & { document: ProjectDocumentV1 }> => {
  const { row, accessToken } = await requireConnection(ownerUserId);
  const file = await getDriveFileMetadata({ accessToken, fileId });
  const summary = assertOwnedCardForgeProject(file, row.root_folder_id);
  if (summary.size > MAX_ENCODED_PROJECT_BYTES) {
    throw new ProjectStorageProviderError('That Google Drive project exceeds CardForge’s safe portable-project size limit.', 413, { kind: 'limit' });
  }
  const response = await fetch(`${GOOGLE_DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
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
    summary: { ...summary, projectRevision: snapshot.manifest.projectRevision },
    bytes,
    document: hydrateCardForgeProjectSnapshot(snapshot),
  };
};

export const prepareGoogleDriveProjectUpload = async ({
  ownerUserId,
  name,
  size,
  projectRevision,
  fileId = null,
  expectedProviderRevision = null,
  expectedProjectRevision = null,
}: {
  ownerUserId: string;
  name: string;
  size: number;
  projectRevision: string;
  fileId?: string | null;
  expectedProviderRevision?: string | null;
  expectedProjectRevision?: string | null;
}): Promise<GoogleDriveUploadPrepareResult> => {
  if (!Number.isInteger(size) || size <= 0 || size > MAX_ENCODED_PROJECT_BYTES) {
    throw new ProjectStorageProviderError('The CardForge project is empty or exceeds the safe portable-project size limit.', 413, { kind: 'limit' });
  }
  if (!isProjectPackageAssetId(projectRevision)) {
    throw new ProjectStorageProviderError('The CardForge project revision is invalid.', 400, { kind: 'invalid' });
  }
  const { row, accessToken } = await requireConnection(ownerUserId);
  const normalizedName = normalizeDriveProjectName(name);
  const appProperties = {
    [GOOGLE_DRIVE_PROJECT_APP_PROPERTY]: GOOGLE_DRIVE_PROJECT_VALUE,
    [GOOGLE_DRIVE_PROJECT_REVISION_PROPERTY]: projectRevision,
  };
  let requestUrl: URL;
  let method: 'POST' | 'PATCH';
  let metadata: Record<string, unknown>;

  if (fileId) {
    const current = await getDriveFileMetadata({ accessToken, fileId });
    const currentSummary = assertOwnedCardForgeProject(current, row.root_folder_id);
    if (!expectedProviderRevision || !expectedProjectRevision) {
      throw new ProjectStorageProviderError('Updating a Google Drive project requires the exact provider and CardForge revisions previously read.', 409, { kind: 'conflict' });
    }
    if (currentSummary.providerRevision !== expectedProviderRevision || currentSummary.projectRevision !== expectedProjectRevision) {
      throw new ProjectStorageProviderError(
        `The Google Drive project changed after revision ${expectedProviderRevision}. Reload it before saving so CardForge does not overwrite newer work.`,
        409,
        { kind: 'conflict' },
      );
    }
    requestUrl = new URL(`${GOOGLE_DRIVE_UPLOAD_API}/files/${encodeURIComponent(fileId)}`);
    method = 'PATCH';
    metadata = { name: normalizedName, mimeType: GOOGLE_DRIVE_PROJECT_MIME_TYPE, appProperties };
  } else {
    requestUrl = new URL(`${GOOGLE_DRIVE_UPLOAD_API}/files`);
    method = 'POST';
    metadata = {
      name: normalizedName,
      mimeType: GOOGLE_DRIVE_PROJECT_MIME_TYPE,
      parents: [row.root_folder_id],
      appProperties,
    };
  }
  requestUrl.searchParams.set('uploadType', 'resumable');
  requestUrl.searchParams.set('fields', GOOGLE_DRIVE_PROJECT_FIELDS);
  const response = await fetch(requestUrl, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Origin: getPublicAppUrl(),
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': GOOGLE_DRIVE_PROJECT_MIME_TYPE,
      'X-Upload-Content-Length': String(size),
    },
    body: JSON.stringify(metadata),
    cache: 'no-store',
  });
  if (!response.ok) throw await parseGoogleError(response, 'CardForge could not prepare the Google Drive project upload.');
  const uploadSessionUrl = response.headers.get('location') ?? '';
  if (!uploadSessionUrl.startsWith('https://www.googleapis.com/')) {
    throw new ProjectStorageProviderError('Google Drive did not return a valid resumable upload session.', 503, { kind: 'unavailable' });
  }
  return {
    uploadSessionUrl,
    provider: GOOGLE_DRIVE_PROJECT_PROVIDER,
    fileId,
    name: normalizedName,
    projectRevision,
  };
};

const completeServerUpload = async ({
  uploadSessionUrl,
  bytes,
}: {
  uploadSessionUrl: string;
  bytes: Uint8Array;
}): Promise<GoogleDriveUploadCompletion> => {
  const bodyBytes = new Uint8Array(bytes.byteLength);
  bodyBytes.set(bytes);
  const response = await fetch(uploadSessionUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': GOOGLE_DRIVE_PROJECT_MIME_TYPE,
      'Content-Length': String(bytes.byteLength),
    },
    body: bodyBytes.buffer,
    cache: 'no-store',
  });
  if (!response.ok) throw await parseGoogleError(response, 'CardForge could not finish the Google Drive project upload.');
  const result = await response.json() as GoogleDriveUploadCompletion;
  if (!isGoogleDriveFileId(result.id) || !isGoogleDriveProviderRevision(result.version)) {
    throw new ProjectStorageProviderError('Google Drive finished the upload without usable revision metadata.', 503, { kind: 'unavailable' });
  }
  return result;
};

export const updateGoogleDriveProjectFromServer = async ({
  ownerUserId,
  fileId,
  name,
  bytes,
  projectRevision,
  expectedProviderRevision,
  expectedProjectRevision,
}: {
  ownerUserId: string;
  fileId: string;
  name: string;
  bytes: Uint8Array;
  projectRevision: string;
  expectedProviderRevision: string;
  expectedProjectRevision: string;
}): Promise<GoogleDriveProjectSummary> => {
  const plan = await prepareGoogleDriveProjectUpload({
    ownerUserId,
    name,
    size: bytes.byteLength,
    projectRevision,
    fileId,
    expectedProviderRevision,
    expectedProjectRevision,
  });
  const completed = await completeServerUpload({ uploadSessionUrl: plan.uploadSessionUrl, bytes });
  const summary = toProjectSummary({
    id: completed.id,
    name: completed.name,
    mimeType: GOOGLE_DRIVE_PROJECT_MIME_TYPE,
    version: completed.version,
    modifiedTime: completed.modifiedTime ?? new Date().toISOString(),
    size: completed.size ?? String(bytes.byteLength),
    webViewLink: completed.webViewLink,
    appProperties: completed.appProperties ?? {
      [GOOGLE_DRIVE_PROJECT_APP_PROPERTY]: GOOGLE_DRIVE_PROJECT_VALUE,
      [GOOGLE_DRIVE_PROJECT_REVISION_PROPERTY]: projectRevision,
    },
  });
  if (!summary) throw new ProjectStorageProviderError('Google Drive returned invalid project metadata after saving.', 503, { kind: 'unavailable' });
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
  const current = await getDriveFileMetadata({ accessToken, fileId });
  const summary = assertOwnedCardForgeProject(current, row.root_folder_id);
  if (summary.providerRevision !== expectedProviderRevision || summary.projectRevision !== expectedProjectRevision) {
    throw new ProjectStorageProviderError('The Google Drive project changed after it was loaded. Reload it before deleting.', 409, { kind: 'conflict' });
  }
  const response = await fetch(`${GOOGLE_DRIVE_API}/files/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!response.ok && response.status !== 204) throw await parseGoogleError(response, 'CardForge could not delete that Google Drive project.');
  return summary;
};

export const disconnectGoogleDriveProjectStorage = async (ownerUserId: string): Promise<void> => {
  const row = await getConnectionRow(ownerUserId);
  if (!row) return;
  try {
    const refreshToken = decryptProjectStorageToken({
      ciphertext: row.refresh_token_ciphertext,
      iv: row.refresh_token_iv,
      authTag: row.refresh_token_auth_tag,
    });
    await fetch(GOOGLE_REVOKE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: refreshToken }),
      cache: 'no-store',
    });
  } catch (error) {
    console.warn('Unable to revoke Google Drive project token before disconnecting:', error);
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
