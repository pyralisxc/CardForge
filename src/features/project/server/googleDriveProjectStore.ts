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
import { readGoogleProviderFailure, requestGoogleAccessToken } from './googleDriveBoundary';

const GOOGLE_AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';
const GOOGLE_USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';
const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3';
const GOOGLE_DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const GOOGLE_DRIVE_FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
const GOOGLE_DRIVE_PROJECT_FIELDS = 'id,name,mimeType,version,headRevisionId,modifiedTime,size,parents,driveId,resourceKey,webViewLink,thumbnailLink,capabilities(canDownload,canEdit,canModifyContent,canDelete),appProperties';
const GOOGLE_DRIVE_FOLDER_FIELDS = 'id,name,mimeType,driveId,resourceKey,capabilities(canAddChildren,canEdit)';
const GOOGLE_DRIVE_PROJECT_APP_PROPERTY = 'cardforgeProject';
const GOOGLE_DRIVE_PROJECT_REVISION_PROPERTY = 'cardforgeProjectRevision';
const GOOGLE_DRIVE_WORK_ID_PROPERTY = 'cardforgeWorkId';
const GOOGLE_DRIVE_ROOT_PROPERTY = 'cardforgeRoot';
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
  headRevisionId?: string;
  modifiedTime?: string;
  size?: string;
  parents?: string[];
  driveId?: string;
  resourceKey?: string;
  webViewLink?: string;
  thumbnailLink?: string;
  capabilities?: {
    canDownload?: boolean;
    canEdit?: boolean;
    canModifyContent?: boolean;
    canDelete?: boolean;
    canAddChildren?: boolean;
  };
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

const resolveGoogleDriveRootOnConnect = async ({
  ownerUserId,
  externalAccountId,
  accessToken,
}: {
  ownerUserId: string;
  externalAccountId: string;
  accessToken: string;
}): Promise<{ rootFolderId: string; status: 'active' | 'error'; statusNote: string }> => {
  const existing = await getConnectionRow(ownerUserId);
  if (!existing || existing.external_account_id !== externalAccountId) {
    return {
      rootFolderId: await createCardForgeRootFolder(accessToken),
      status: 'active',
      statusNote: '',
    };
  }

  const rootFolderId = existing.root_folder_id;
  if (!isGoogleDriveFileId(rootFolderId)) {
    return {
      rootFolderId,
      status: 'error',
      statusNote: 'The previously selected Drive project folder has invalid saved metadata. Choose a project folder before saving.',
    };
  }

  try {
    const folder = await getDriveFolderMetadata({ accessToken, folderId: rootFolderId });
    return {
      rootFolderId,
      status: 'active',
      statusNote: folder.capabilities?.canAddChildren === false
        ? 'This Drive folder is read-only for the connected account.'
        : '',
    };
  } catch (error) {
    console.warn('Google Drive reconnected, but the previous project folder could not be verified:', error);
    return {
      rootFolderId,
      status: 'error',
      statusNote: 'Google Drive reconnected, but CardForge could not verify the previously selected project folder. Choose a project folder before saving.',
    };
  }
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
  const root = await resolveGoogleDriveRootOnConnect({
    ownerUserId,
    externalAccountId,
    accessToken: tokens.access_token!,
  });
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
      root_folder_id: root.rootFolderId,
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
      nextAction: 'Reconnect Google Drive in Library → Locations.',
    });
  }
  const token = await requestGoogleAccessToken({
    endpoint: GOOGLE_TOKEN_ENDPOINT,
    refreshToken,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
  });
  if (!token.ok && token.failure.reconnectRequired) {
    await requireStore()
      .from('cardforge_project_storage_connections')
      .update({ status: 'error', status_note: 'Google authorization expired or was revoked.' })
      .eq('id', row.id);
    throw new ProjectStorageProviderError('Google Drive authorization expired or was revoked.', 401, {
      kind: 'authentication',
      nextAction: 'Reconnect Google Drive in Library → Locations.',
    });
  }
  if (!token.ok) {
    const message = token.failure.providerMessage
      ? `Google Drive could not refresh this connection. ${token.failure.providerMessage}`
      : 'Google Drive could not refresh this connection.';
    throw new ProjectStorageProviderError(message, token.failure.status, {
      kind: token.failure.kind,
      nextAction: token.failure.nextAction,
    });
  }
  // Credential refresh proves OAuth health only. The selected folder's status and
  // capability note are owned by folder verification/selection and must survive.
  await requireStore()
    .from('cardforge_project_storage_connections')
    .update({ last_verified_at: new Date().toISOString() })
    .eq('id', row.id);
  return token.accessToken;
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
  return { row, accessToken: await refreshGoogleAccessToken(row) };
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
  });
  if (!response.ok) throw await parseGoogleError(response, 'CardForge could not read that Google Drive project.');
  return await response.json() as GoogleDriveFile;
};

const getDriveFolderMetadata = async ({ accessToken, folderId }: { accessToken: string; folderId: string }): Promise<GoogleDriveFile> => {
  const url = new URL(`${GOOGLE_DRIVE_API}/files/${encodeURIComponent(folderId)}`);
  url.searchParams.set('fields', GOOGLE_DRIVE_FOLDER_FIELDS);
  url.searchParams.set('supportsAllDrives', 'true');
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' });
  if (!response.ok) throw await parseGoogleError(response, 'CardForge could not read the selected Google Drive folder.');
  const folder = await response.json() as GoogleDriveFile;
  if (folder.mimeType !== GOOGLE_DRIVE_FOLDER_MIME_TYPE) throw new ProjectStorageProviderError('The configured Drive location is no longer a folder.', 409, { kind: 'conflict' });
  return folder;
};

const assertOwnedCardForgeProject = async (file: GoogleDriveFile, rootFolderId: string): Promise<GoogleDriveProjectSummary> => {
  const summary = await toProjectSummary(file);
  if (!summary
    || file.mimeType !== GOOGLE_DRIVE_PROJECT_MIME_TYPE
    || file.appProperties?.[GOOGLE_DRIVE_PROJECT_APP_PROPERTY] !== GOOGLE_DRIVE_PROJECT_VALUE
    || !file.parents?.includes(rootFolderId)) {
    throw new ProjectStorageProviderError('That Google Drive file is not a CardForge project in this connected folder.', 404, { kind: 'not_found' });
  }
  return summary;
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
  const accessToken = await refreshGoogleAccessToken(row);
  const folder = await getDriveFolderMetadata({ accessToken, folderId: row.root_folder_id });
  const url = new URL(`${GOOGLE_DRIVE_API}/files`);
  url.searchParams.set('q', `'${row.root_folder_id}' in parents and trashed = false`);
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
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!response.ok) throw await parseGoogleError(response, 'CardForge could not list Google Drive projects.');
  const payload = await response.json() as { files?: GoogleDriveFile[]; nextPageToken?: unknown };
  const projects = (await Promise.all((payload.files ?? [])
    .filter((file) => file.mimeType === GOOGLE_DRIVE_PROJECT_MIME_TYPE && file.appProperties?.[GOOGLE_DRIVE_PROJECT_APP_PROPERTY] === GOOGLE_DRIVE_PROJECT_VALUE)
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
  const { row, accessToken } = await requireConnection(ownerUserId);
  const file = await getDriveFileMetadata({ accessToken, fileId });
  const summary = await assertOwnedCardForgeProject(file, row.root_folder_id);
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
  const file = await getDriveFileMetadata({ accessToken, fileId });
  await assertOwnedCardForgeProject(file, row.root_folder_id);
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

  if (fileId) {
    const current = await getDriveFileMetadata({ accessToken, fileId });
    const currentSummary = await assertOwnedCardForgeProject(current, row.root_folder_id);
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
      name: normalizedName,
      mimeType: GOOGLE_DRIVE_PROJECT_MIME_TYPE,
      appProperties: {
        [GOOGLE_DRIVE_PROJECT_APP_PROPERTY]: GOOGLE_DRIVE_PROJECT_VALUE,
        [GOOGLE_DRIVE_PROJECT_REVISION_PROPERTY]: projectRevision,
        ...(effectiveWorkId ? { [GOOGLE_DRIVE_WORK_ID_PROPERTY]: effectiveWorkId } : {}),
      },
    };
  } else {
    const folder = await getDriveFolderMetadata({ accessToken, folderId: row.root_folder_id });
    if (folder.capabilities?.canAddChildren !== true) {
      throw new ProjectStorageProviderError('Your current Drive role cannot add files to this folder.', 403, { kind: 'authorization', nextAction: 'Choose a writable Drive folder or ask its owner for content-manager/editor access.' });
    }
    requestUrl = new URL(`${GOOGLE_DRIVE_UPLOAD_API}/files`);
    method = 'POST';
    metadata = {
      name: normalizedName,
      mimeType: GOOGLE_DRIVE_PROJECT_MIME_TYPE,
      parents: [row.root_folder_id],
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

const completeServerUpload = async ({
  uploadSessionUrl,
  blob,
}: {
  uploadSessionUrl: string;
  blob: Blob;
}): Promise<GoogleDriveUploadCompletion> => {
  let response: Response;
  try { response = await fetch(uploadSessionUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': GOOGLE_DRIVE_PROJECT_MIME_TYPE,
      'Content-Length': String(blob.size),
    },
    body: blob,
    cache: 'no-store',
  }); } catch { throw unknownDriveCommit(); }
  if (response.status >= 500) throw unknownDriveCommit();
  if (!response.ok) throw await parseGoogleError(response, 'CardForge could not finish the Google Drive project upload.');
  let result: GoogleDriveUploadCompletion;
  try { result = await response.json() as GoogleDriveUploadCompletion; } catch { throw unknownDriveCommit(); }
  if (!result || typeof result !== 'object' || !isGoogleDriveFileId(result.id) || typeof result.headRevisionId !== 'string' || !result.headRevisionId.trim()) {
    throw unknownDriveCommit();
  }
  return result;
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
    capabilities: { canDownload: true, canEdit: true, canModifyContent: true, canDelete: true },
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
  const current = await getDriveFileMetadata({ accessToken, fileId });
  const summary = await assertOwnedCardForgeProject(current, row.root_folder_id);
  if (summary.capabilities && !summary.capabilities.canDelete) {
    throw new ProjectStorageProviderError('Your current Drive role cannot delete this project.', 403, { kind: 'authorization' });
  }
  if (summary.providerRevision !== expectedProviderRevision || summary.projectRevision !== expectedProjectRevision) {
    throw new ProjectStorageProviderError('The Google Drive project changed after it was loaded. Reload it before deleting.', 409, { kind: 'conflict' });
  }
  const deleteUrl = new URL(`${GOOGLE_DRIVE_API}/files/${encodeURIComponent(fileId)}`);
  deleteUrl.searchParams.set('supportsAllDrives', 'true');
  const response = await fetch(deleteUrl, {
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