import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { connectGoogleDriveProjectStorage } from '@/features/project/server/googleDriveProjectStore';

vi.mock('@/infrastructure/database/supabaseServer', () => ({
  getSupabaseServerClient: vi.fn(),
}));

const mockedGetSupabaseServerClient = vi.mocked(getSupabaseServerClient);
const encryptionKey = Buffer.alloc(32, 7).toString('base64');

const existingConnection = (overrides: Record<string, unknown> = {}) => ({
  id: 'connection-1',
  owner_user_id: 'user-1',
  provider: 'google-drive',
  external_account_id: 'google-user-1',
  display_name: 'creator@example.com',
  refresh_token_ciphertext: 'old-ciphertext',
  refresh_token_iv: 'old-iv',
  refresh_token_auth_tag: 'old-tag',
  granted_scopes: ['openid', 'email', 'https://www.googleapis.com/auth/drive.file'],
  root_folder_id: 'shared_folder_123',
  status: 'error',
  status_note: 'Reconnect Google Drive.',
  last_verified_at: '2026-09-09T00:00:00.000Z',
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-09T00:00:00.000Z',
  ...overrides,
});

const installConnectionStore = (existing = existingConnection()) => {
  let upsertPayload: Record<string, unknown> | null = null;
  const query = {} as Record<string, ReturnType<typeof vi.fn>>;
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.maybeSingle = vi.fn(async () => ({ data: existing, error: null }));
  query.upsert = vi.fn((payload: Record<string, unknown>) => {
    upsertPayload = payload;
    return query;
  });
  query.single = vi.fn(async () => ({
    data: {
      ...existing,
      ...(upsertPayload ?? {}),
      updated_at: '2026-09-10T00:00:00.000Z',
    },
    error: null,
  }));
  mockedGetSupabaseServerClient.mockReturnValue({ from: vi.fn(() => query) } as never);
  return { query, getUpsertPayload: () => upsertPayload };
};

const tokenResponse = () => Response.json({
  access_token: 'new-access-token',
  refresh_token: 'new-refresh-token',
  scope: 'openid email https://www.googleapis.com/auth/drive.file',
});

const userInfoResponse = (sub = 'google-user-1') => Response.json({
  sub,
  email: 'creator@example.com',
});

describe('Google Drive reconnect destination safety', () => {
  beforeEach(() => {
    mockedGetSupabaseServerClient.mockReset();
    vi.stubEnv('CARDFORGE_GOOGLE_STORAGE_CLIENT_ID', 'google-client');
    vi.stubEnv('CARDFORGE_GOOGLE_STORAGE_CLIENT_SECRET', 'google-secret');
    vi.stubEnv('CARDFORGE_STORAGE_TOKEN_ENCRYPTION_KEY', encryptionKey);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('preserves and verifies the selected folder when the same Google account reconnects', async () => {
    const store = installConnectionStore();
    const fetch = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(userInfoResponse())
      .mockResolvedValueOnce(Response.json({
        id: 'shared_folder_123',
        name: 'Shared CardForge Work',
        mimeType: 'application/vnd.google-apps.folder',
        driveId: 'shared-drive-123',
        capabilities: { canAddChildren: true, canEdit: true },
      }));
    vi.stubGlobal('fetch', fetch);

    const result = await connectGoogleDriveProjectStorage({ ownerUserId: 'user-1', code: 'fresh-code' });

    expect(result).toMatchObject({
      connected: true,
      rootFolderId: 'shared_folder_123',
      status: 'active',
      statusNote: null,
    });
    expect(store.getUpsertPayload()).toMatchObject({
      external_account_id: 'google-user-1',
      root_folder_id: 'shared_folder_123',
      status: 'active',
      status_note: '',
    });
    expect(fetch).toHaveBeenCalledTimes(3);
    const verificationUrl = new URL(String(fetch.mock.calls[2]![0]));
    expect(verificationUrl.pathname).toBe('/drive/v3/files/shared_folder_123');
    expect(verificationUrl.searchParams.get('supportsAllDrives')).toBe('true');
    expect(fetch.mock.calls.some(([url, init]) => String(url).includes('/drive/v3/files?fields=id,name') && (init as RequestInit | undefined)?.method === 'POST')).toBe(false);
  });

  it('keeps the prior destination and marks it for attention when reconnect cannot verify it', async () => {
    const store = installConnectionStore();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fetch = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(userInfoResponse())
      .mockResolvedValueOnce(Response.json({ error: { message: 'File not found.' } }, { status: 404 }));
    vi.stubGlobal('fetch', fetch);

    const result = await connectGoogleDriveProjectStorage({ ownerUserId: 'user-1', code: 'fresh-code' });

    expect(result).toMatchObject({
      connected: true,
      rootFolderId: 'shared_folder_123',
      status: 'error',
    });
    expect(result.statusNote).toContain('previously selected project folder');
    expect(store.getUpsertPayload()).toMatchObject({
      root_folder_id: 'shared_folder_123',
      status: 'error',
    });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('creates a fresh default destination only when a different Google account is connected', async () => {
    const store = installConnectionStore();
    const fetch = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(userInfoResponse('google-user-2'))
      .mockResolvedValueOnce(Response.json({ id: 'new_folder_456', name: 'CardForge' }));
    vi.stubGlobal('fetch', fetch);

    const result = await connectGoogleDriveProjectStorage({ ownerUserId: 'user-1', code: 'fresh-code' });

    expect(result).toMatchObject({
      connected: true,
      rootFolderId: 'new_folder_456',
      status: 'active',
    });
    expect(store.getUpsertPayload()).toMatchObject({
      external_account_id: 'google-user-2',
      root_folder_id: 'new_folder_456',
      status: 'active',
    });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(String(fetch.mock.calls[2]![0])).toContain('/drive/v3/files?fields=id,name');
    expect(fetch.mock.calls[2]![1]).toMatchObject({ method: 'POST' });
  });
});
