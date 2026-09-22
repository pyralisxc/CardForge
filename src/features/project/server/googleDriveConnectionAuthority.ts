import type { BoundaryFailureKind } from '@/shared/boundaryFailure';

import { GOOGLE_DRIVE_FILE_SCOPE, getUnexpectedGoogleDriveScopes } from '../model/googleDriveProject';
import { decryptProjectStorageToken } from './projectStorageTokenCrypto';
import { requestGoogleAccessToken } from './googleDriveBoundary';

export interface GoogleDriveCredentialRow {
  id: string;
  refresh_token_ciphertext: string;
  refresh_token_iv: string;
  refresh_token_auth_tag: string;
  granted_scopes: string[] | null;
}

export interface GoogleDriveConnectionAccessFailure {
  status: number;
  kind: BoundaryFailureKind;
  message: string;
  nextAction?: string;
  reconnectRequired: boolean;
}

export type GoogleDriveConnectionAccessResult =
  | { ok: true; accessToken: string; fromCache: boolean }
  | { ok: false; failure: GoogleDriveConnectionAccessFailure };

type CachedAccessToken = {
  connectionId: string;
  cacheKey: string;
  accessToken: string;
  expiresAt: number;
};

const ACCESS_TOKEN_EXPIRY_SKEW_MS = 60_000;
const DEFAULT_ACCESS_TOKEN_TTL_MS = 45 * 60_000;
const MAX_CACHED_ACCESS_TOKENS = 128;
const accessTokenCache = new Map<string, CachedAccessToken>();

const credentialCacheKey = (row: GoogleDriveCredentialRow) => (
  `${row.id}:${row.refresh_token_ciphertext}:${row.refresh_token_iv}:${row.refresh_token_auth_tag}`
);

const pruneTokenCache = () => {
  const now = Date.now();
  for (const [key, value] of accessTokenCache) {
    if (value.expiresAt <= now + ACCESS_TOKEN_EXPIRY_SKEW_MS) accessTokenCache.delete(key);
  }
  while (accessTokenCache.size > MAX_CACHED_ACCESS_TOKENS) {
    const oldest = accessTokenCache.keys().next().value;
    if (typeof oldest !== 'string') break;
    accessTokenCache.delete(oldest);
  }
};

export const invalidateGoogleDriveAccessTokenCache = (connectionId: string): void => {
  for (const [key, value] of accessTokenCache) {
    if (value.connectionId === connectionId) accessTokenCache.delete(key);
  }
};

export const validateGoogleDriveStoredScopes = (
  grantedScopes: readonly string[] | null | undefined,
): GoogleDriveConnectionAccessFailure | null => {
  const scopes = grantedScopes ?? [];
  const unexpectedDriveScopes = getUnexpectedGoogleDriveScopes(scopes);
  if (unexpectedDriveScopes.length > 0) {
    return {
      status: 409,
      kind: 'conflict',
      message: 'Google granted Drive permissions broader than CardForge permits. The connection cannot be used.',
      nextAction: 'CardForge owner must remove broad Drive scopes from the Google Auth Platform client before retrying.',
      reconnectRequired: false,
    };
  }
  if (!scopes.includes(GOOGLE_DRIVE_FILE_SCOPE)) {
    return {
      status: 409,
      kind: 'conflict',
      message: 'The saved Google Drive connection is missing CardForge’s required per-file permission.',
      nextAction: 'Reconnect Google Drive in Library → Locations.',
      reconnectRequired: true,
    };
  }
  return null;
};

export const resolveGoogleDriveConnectionAccess = async ({
  row,
  clientId,
  clientSecret,
  tokenEndpoint = 'https://oauth2.googleapis.com/token',
}: {
  row: GoogleDriveCredentialRow;
  clientId: string;
  clientSecret: string;
  tokenEndpoint?: string;
}): Promise<GoogleDriveConnectionAccessResult> => {
  const scopeFailure = validateGoogleDriveStoredScopes(row.granted_scopes);
  if (scopeFailure) return { ok: false, failure: scopeFailure };

  const cacheKey = credentialCacheKey(row);
  pruneTokenCache();
  const cached = accessTokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + ACCESS_TOKEN_EXPIRY_SKEW_MS) {
    accessTokenCache.delete(cacheKey);
    accessTokenCache.set(cacheKey, cached);
    return { ok: true, accessToken: cached.accessToken, fromCache: true };
  }

  let refreshToken: string;
  try {
    refreshToken = decryptProjectStorageToken({
      ciphertext: row.refresh_token_ciphertext,
      iv: row.refresh_token_iv,
      authTag: row.refresh_token_auth_tag,
    });
  } catch {
    invalidateGoogleDriveAccessTokenCache(row.id);
    return {
      ok: false,
      failure: {
        status: 401,
        kind: 'authentication',
        message: 'The Google Drive connection needs to be reconnected.',
        nextAction: 'Reconnect Google Drive in Library → Locations.',
        reconnectRequired: true,
      },
    };
  }

  const token = await requestGoogleAccessToken({
    endpoint: tokenEndpoint,
    refreshToken,
    clientId,
    clientSecret,
  });
  if (!token.ok) {
    if (token.failure.reconnectRequired) invalidateGoogleDriveAccessTokenCache(row.id);
    return {
      ok: false,
      failure: {
        status: token.failure.status,
        kind: token.failure.kind,
        message: token.failure.providerMessage
          || (token.failure.reconnectRequired
            ? 'Google Drive authorization expired or was revoked.'
            : 'Google Drive could not refresh this connection.'),
        nextAction: token.failure.nextAction,
        reconnectRequired: token.failure.reconnectRequired,
      },
    };
  }

  const ttlMs = token.expiresInSeconds
    ? Math.max(60_000, token.expiresInSeconds * 1000)
    : DEFAULT_ACCESS_TOKEN_TTL_MS;
  accessTokenCache.set(cacheKey, {
    connectionId: row.id,
    cacheKey,
    accessToken: token.accessToken,
    expiresAt: Date.now() + ttlMs,
  });
  pruneTokenCache();
  return { ok: true, accessToken: token.accessToken, fromCache: false };
};
