import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  invalidateGoogleDriveAccessTokenCache,
  resolveGoogleDriveConnectionAccess,
  validateGoogleDriveStoredScopes,
} from '@/features/project/server/googleDriveConnectionAuthority';
import { encryptProjectStorageToken } from '@/features/project/server/projectStorageTokenCrypto';

const encryptionKey = Buffer.alloc(32, 11).toString('base64');

const connection = (id = 'connection-authority-1') => {
  const encrypted = encryptProjectStorageToken('refresh-token-example', encryptionKey);
  return {
    id,
    refresh_token_ciphertext: encrypted.ciphertext,
    refresh_token_iv: encrypted.iv,
    refresh_token_auth_tag: encrypted.authTag,
    granted_scopes: ['openid', 'email', 'https://www.googleapis.com/auth/drive.file'],
  };
};

describe('Google Drive connection authority', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    invalidateGoogleDriveAccessTokenCache('connection-authority-1');
    invalidateGoogleDriveAccessTokenCache('connection-authority-2');
  });

  it('fails closed for broader or missing Drive authority', () => {
    expect(validateGoogleDriveStoredScopes([
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive.readonly',
    ])).toMatchObject({
      status: 409,
      kind: 'conflict',
      reconnectRequired: false,
    });
    expect(validateGoogleDriveStoredScopes(['openid', 'email'])).toMatchObject({
      status: 409,
      kind: 'conflict',
      reconnectRequired: true,
    });
  });

  it('reuses one short-lived server access token across Drive surfaces', async () => {
    vi.stubEnv('CARDFORGE_STORAGE_TOKEN_ENCRYPTION_KEY', encryptionKey);
    const fetch = vi.fn().mockResolvedValue(Response.json({
      access_token: 'cached-private-access',
      expires_in: 3600,
    }));
    vi.stubGlobal('fetch', fetch);
    const row = connection();

    await expect(resolveGoogleDriveConnectionAccess({
      row,
      clientId: 'google-client',
      clientSecret: 'google-secret',
    })).resolves.toMatchObject({ ok: true, accessToken: 'cached-private-access', fromCache: false });

    await expect(resolveGoogleDriveConnectionAccess({
      row,
      clientId: 'google-client',
      clientSecret: 'google-secret',
    })).resolves.toMatchObject({ ok: true, accessToken: 'cached-private-access', fromCache: true });

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('does not cache invalid_grant and keeps reconnect semantics explicit', async () => {
    vi.stubEnv('CARDFORGE_STORAGE_TOKEN_ENCRYPTION_KEY', encryptionKey);
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: 'invalid_grant',
      error_description: 'Token expired or revoked.',
    }), { status: 400 }));
    vi.stubGlobal('fetch', fetch);

    await expect(resolveGoogleDriveConnectionAccess({
      row: connection('connection-authority-2'),
      clientId: 'google-client',
      clientSecret: 'google-secret',
    })).resolves.toMatchObject({
      ok: false,
      failure: {
        status: 401,
        kind: 'authentication',
        reconnectRequired: true,
      },
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
