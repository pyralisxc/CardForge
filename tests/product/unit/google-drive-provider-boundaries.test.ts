import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import {
  disconnectGoogleDriveProjectStorage,
  listGoogleDriveProjects,
  parseGoogleError,
} from '@/features/project/server/googleDriveProjectStore';
import { getGoogleDrivePickerConfiguration } from '@/features/project/server/googleDriveFolderPickerStore';
import { classifyGoogleProviderFailure } from '@/features/project/server/googleDriveBoundary';
import { parsePersonalLibraryGoogleError } from '@/features/personal-library/server/personalLibraryStore';
import { encryptProjectStorageToken } from '@/features/project/server/projectStorageTokenCrypto';
import {
  retainLastKnownLibrarySource,
  retainScopedLastKnownLibrarySource,
} from '@/features/storage-management/hooks/useAccountLibraryProjection';
import { describeLibraryBoundaryFailure } from '@/features/storage-management/components/LibraryCollection';

vi.mock('@/infrastructure/database/supabaseServer', () => ({
  getSupabaseServerClient: vi.fn(),
}));

const mockedGetSupabaseServerClient = vi.mocked(getSupabaseServerClient);
const encryptionKey = Buffer.alloc(32, 9).toString('base64');

const connectionRow = () => {
  const encrypted = encryptProjectStorageToken('refresh-token-example', encryptionKey);
  return {
    id: 'connection-1',
    owner_user_id: 'user-1',
    provider: 'google-drive' as const,
    external_account_id: 'google-user-1',
    display_name: 'Creator@example.com',
    refresh_token_ciphertext: encrypted.ciphertext,
    refresh_token_iv: encrypted.iv,
    refresh_token_auth_tag: encrypted.authTag,
    granted_scopes: ['https://www.googleapis.com/auth/drive.file'],
    root_folder_id: 'drive_folder_123',
    status: 'active' as const,
    status_note: '',
    last_verified_at: '2026-09-01T00:00:00.000Z',
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
  };
};

const selectConnectionQuery = () => {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data: connectionRow(), error: null }),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
};

describe('Google Drive provider boundaries', () => {
  beforeEach(() => {
    mockedGetSupabaseServerClient.mockReset();
    vi.stubEnv('CARDFORGE_GOOGLE_STORAGE_CLIENT_ID', 'google-client');
    vi.stubEnv('CARDFORGE_GOOGLE_STORAGE_CLIENT_SECRET', 'google-secret');
    vi.stubEnv('CARDFORGE_STORAGE_TOKEN_ENCRYPTION_KEY', encryptionKey);
    vi.stubEnv('CARDFORGE_GOOGLE_PICKER_API_KEY', 'picker-key');
    vi.stubEnv('CARDFORGE_GOOGLE_CLOUD_PROJECT_NUMBER', '1234567890');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('keeps Google authentication and permission failures distinct', async () => {
    const authentication = await parseGoogleError(new Response(JSON.stringify({
      error: { message: 'Invalid credentials.' },
    }), { status: 401 }), 'Drive request failed.');
    const authorization = await parseGoogleError(new Response(JSON.stringify({
      error: { message: 'Insufficient permissions.' },
    }), { status: 403 }), 'Drive request failed.');

    expect(authentication).toMatchObject({ status: 401, kind: 'authentication' });
    expect(authorization).toMatchObject({ status: 403, kind: 'authorization' });
    expect(authorization.nextAction).toContain('can access');
  });

  it('recognizes Google 403 rate-limit reasons as a retryable limit boundary', async () => {
    const error = await parseGoogleError(new Response(JSON.stringify({
      error: { message: 'Rate limit exceeded.', errors: [{ reason: 'userRateLimitExceeded' }] },
    }), { status: 403 }), 'Drive request failed.');

    expect(error).toMatchObject({ status: 429, kind: 'limit' });
  });

  it('does not misreport a permanent Google storage quota as a transient rate limit', async () => {
    const error = await parseGoogleError(new Response(JSON.stringify({
      error: { message: 'Storage quota exceeded.', errors: [{ reason: 'storageQuotaExceeded' }] },
    }), { status: 403 }), 'Drive request failed.');

    expect(error).toMatchObject({ status: 403, kind: 'limit' });
    expect(error.nextAction).toContain('account storage');
  });

  it('shares permission and transient token semantics with the Picker and personal Library', async () => {
    const personalPermission = await parsePersonalLibraryGoogleError(new Response(JSON.stringify({
      error: { message: 'The file is outside the granted scope.' },
    }), { status: 403 }), 'Drive request failed.');
    expect(personalPermission).toMatchObject({ status: 403, kind: 'authorization' });

    expect(classifyGoogleProviderFailure(503, {
      error: 'temporarily_unavailable',
      error_description: 'Retry later.',
    }, 'token')).toMatchObject({ status: 503, kind: 'unavailable', reconnectRequired: false });

    const from = vi.fn().mockReturnValue(selectConnectionQuery());
    mockedGetSupabaseServerClient.mockReturnValue({ from } as never);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: 'temporarily_unavailable',
      error_description: 'Retry later.',
    }), { status: 503 })));

    await expect(getGoogleDrivePickerConfiguration('user-1')).rejects.toMatchObject({
      status: 503,
      kind: 'unavailable',
    });
    expect(from).toHaveBeenCalledTimes(1);
  });

  it('does not persist a fake expired connection after a transient token failure', async () => {
    const from = vi.fn().mockReturnValue(selectConnectionQuery());
    mockedGetSupabaseServerClient.mockReturnValue({ from } as never);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: 'temporarily_unavailable',
      error_description: 'The token service is temporarily unavailable.',
    }), { status: 503 })));

    await expect(listGoogleDriveProjects('user-1')).rejects.toMatchObject({
      status: 503,
      kind: 'unavailable',
    });
    expect(from).toHaveBeenCalledTimes(1);
  });

  it('classifies a token-endpoint network failure as unavailable without changing the connection', async () => {
    const from = vi.fn().mockReturnValue(selectConnectionQuery());
    mockedGetSupabaseServerClient.mockReturnValue({ from } as never);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network unreachable')));

    await expect(listGoogleDriveProjects('user-1')).rejects.toMatchObject({
      status: 503,
      kind: 'unavailable',
      nextAction: expect.stringContaining('saved connection remains unchanged'),
    });
    expect(from).toHaveBeenCalledTimes(1);
  });

  it('persists reconnect-required state only when Google returns invalid_grant', async () => {
    const selectQuery = selectConnectionQuery();
    const updateQuery = { update: vi.fn(), eq: vi.fn().mockResolvedValue({ error: null }) };
    updateQuery.update.mockReturnValue(updateQuery);
    const from = vi.fn()
      .mockReturnValueOnce(selectQuery)
      .mockReturnValueOnce(updateQuery);
    mockedGetSupabaseServerClient.mockReturnValue({ from } as never);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: 'invalid_grant',
      error_description: 'Token expired or revoked.',
    }), { status: 400 })));

    await expect(listGoogleDriveProjects('user-1')).rejects.toMatchObject({
      status: 401,
      kind: 'authentication',
    });
    expect(updateQuery.update).toHaveBeenCalledWith({
      status: 'error',
      status_note: 'Google authorization expired or was revoked.',
    });
  });

  it('keeps the local connection when Google does not confirm revocation', async () => {
    const from = vi.fn().mockReturnValue(selectConnectionQuery());
    mockedGetSupabaseServerClient.mockReturnValue({ from } as never);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 503 })));

    await expect(disconnectGoogleDriveProjectStorage('user-1')).rejects.toMatchObject({
      status: 503,
      kind: 'unavailable',
    });
    expect(from).toHaveBeenCalledTimes(1);
  });

  it('removes an already-revoked connection after Google confirms invalid_token', async () => {
    const selectQuery = selectConnectionQuery();
    const deleteQuery = { delete: vi.fn(), eq: vi.fn() };
    deleteQuery.delete.mockReturnValue(deleteQuery);
    deleteQuery.eq
      .mockReturnValueOnce(deleteQuery)
      .mockResolvedValueOnce({ error: null });
    const from = vi.fn()
      .mockReturnValueOnce(selectQuery)
      .mockReturnValueOnce(deleteQuery);
    mockedGetSupabaseServerClient.mockReturnValue({ from } as never);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: 'invalid_token',
    }), { status: 400 })));

    await expect(disconnectGoogleDriveProjectStorage('user-1')).resolves.toBeUndefined();
    expect(deleteQuery.delete).toHaveBeenCalledOnce();
  });
});

describe('Google Drive Library refresh safety', () => {
  it('retains the last-known projection on failure but accepts an authoritative empty result', () => {
    const lastKnown = { projects: [{ fileId: 'drive-file-1' }] };

    expect(retainLastKnownLibrarySource(lastKnown, undefined)).toBe(lastKnown);
    expect(retainLastKnownLibrarySource(lastKnown, null)).toBeNull();
    expect(retainLastKnownLibrarySource(lastKnown, { projects: [] })).toEqual({ projects: [] });
  });

  it('never carries a last-known Drive projection across account scopes', () => {
    const previousAccount = {
      scope: 'account:user-1' as const,
      value: { projects: [{ fileId: 'private-drive-file' }] },
    };

    expect(retainScopedLastKnownLibrarySource(previousAccount, 'account:user-2', undefined)).toEqual({
      scope: 'account:user-2',
      value: null,
    });
  });

  it('keeps structured source details available in the user-visible boundary message', () => {
    expect(describeLibraryBoundaryFailure({
      id: 'google-drive',
      message: 'Google Drive is temporarily unavailable.',
      nextAction: 'Retry the source.',
      retryable: true,
      kind: 'unavailable',
      code: 'google_drive_unavailable',
      correlationId: 'correlation-123',
    })).toContain('Previously loaded Google Drive items remain visible. Error code: google_drive_unavailable. Reference: correlation-123.');
  });
});
