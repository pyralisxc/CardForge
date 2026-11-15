import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  invalidateGoogleDriveAccessTokenCache,
  resolveGoogleDriveConnectionAccess,
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

  it('rejects broader or missing authority before reading credentials or refreshing tokens', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    for (const [granted_scopes, reconnectRequired] of [
      [['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive'], false],
      [['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive.readonly'], false],
      [['openid', 'email'], true],
    ] as const) {
      await expect(resolveGoogleDriveConnectionAccess({
        row: { ...connection(), refresh_token_ciphertext: 'must-not-be-decrypted', granted_scopes: [...granted_scopes] },
        clientId: 'google-client',
        clientSecret: 'google-secret',
      })).resolves.toMatchObject({
        ok: false,
        failure: { status: 409, kind: 'conflict', reconnectRequired },
      });
    }
    expect(fetch).not.toHaveBeenCalled();
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

  it('drops a cached access token immediately when the connection is invalidated', async () => {
    vi.stubEnv('CARDFORGE_STORAGE_TOKEN_ENCRYPTION_KEY', encryptionKey);
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ access_token: 'first-access', expires_in: 3600 }))
      .mockResolvedValueOnce(Response.json({ access_token: 'second-access', expires_in: 3600 }));
    vi.stubGlobal('fetch', fetch);
    const row = connection();

    await expect(resolveGoogleDriveConnectionAccess({
      row,
      clientId: 'google-client',
      clientSecret: 'google-secret',
    })).resolves.toMatchObject({ ok: true, accessToken: 'first-access', fromCache: false });

    invalidateGoogleDriveAccessTokenCache(row.id);

    await expect(resolveGoogleDriveConnectionAccess({
      row,
      clientId: 'google-client',
      clientSecret: 'google-secret',
    })).resolves.toMatchObject({ ok: true, accessToken: 'second-access', fromCache: false });

    expect(fetch).toHaveBeenCalledTimes(2);
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
