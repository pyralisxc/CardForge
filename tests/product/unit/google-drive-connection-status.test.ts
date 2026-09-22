import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { listGoogleDriveProjectsPage } from '@/features/project/server/googleDriveProjectStore';
import { encryptProjectStorageToken } from '@/features/project/server/projectStorageTokenCrypto';

vi.mock('@/infrastructure/database/supabaseServer', () => ({
  getSupabaseServerClient: vi.fn(),
}));

const mockedGetSupabaseServerClient = vi.mocked(getSupabaseServerClient);
const encryptionKey = Buffer.alloc(32, 4).toString('base64');

const connectionRow = (overrides: Record<string, unknown> = {}) => {
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
    granted_scopes: ['openid', 'email', 'https://www.googleapis.com/auth/drive.file'],
    root_folder_id: 'shared_folder_123',
    status: 'active' as const,
    status_note: 'This Drive folder is read-only for the connected account.',
    last_verified_at: '2026-09-09T00:00:00.000Z',
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-09T00:00:00.000Z',
    ...overrides,
  };
};

describe('Google Drive connection status ownership', () => {
  beforeEach(() => {
    mockedGetSupabaseServerClient.mockReset();
    vi.stubEnv('CARDFORGE_GOOGLE_STORAGE_CLIENT_ID', 'google-client');
    vi.stubEnv('CARDFORGE_GOOGLE_STORAGE_CLIENT_SECRET', 'google-secret');
    vi.stubEnv('CARDFORGE_STORAGE_TOKEN_ENCRYPTION_KEY', encryptionKey);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('refuses a stored broad Drive grant before refreshing or reading provider data', async () => {
    const query = {} as Record<string, ReturnType<typeof vi.fn>>;
    query.select = vi.fn(() => query);
    query.eq = vi.fn(() => query);
    query.maybeSingle = vi.fn(async () => ({
      data: connectionRow({
        granted_scopes: [
          'openid',
          'https://www.googleapis.com/auth/drive.file',
          'https://www.googleapis.com/auth/drive',
        ],
      }),
      error: null,
    }));
    mockedGetSupabaseServerClient.mockReturnValue({ from: vi.fn(() => query) } as never);
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);

    await expect(listGoogleDriveProjectsPage({ ownerUserId: 'user-1' })).rejects.toMatchObject({
      status: 409,
      kind: 'conflict',
      nextAction: 'CardForge owner must remove broad Drive scopes from the Google Auth Platform client before retrying.',
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps a connected account usable before any project folder is selected', async () => {
    const query = {} as Record<string, ReturnType<typeof vi.fn>>;
    query.select = vi.fn(() => query);
    query.eq = vi.fn(() => query);
    query.maybeSingle = vi.fn(async () => ({
      data: connectionRow({
        root_folder_id: null,
        root_folder_resource_key: null,
        status_note: 'Choose or create a project folder before saving to Google Drive.',
      }),
      error: null,
    }));
    mockedGetSupabaseServerClient.mockReturnValue({ from: vi.fn(() => query) } as never);
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);

    await expect(listGoogleDriveProjectsPage({ ownerUserId: 'user-1' })).resolves.toMatchObject({
      connection: {
        connected: true,
        rootFolderId: null,
        status: 'active',
        statusNote: 'Choose or create a project folder before saving to Google Drive.',
      },
      projects: [],
      nextPageToken: null,
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not erase folder capability status when refreshing a healthy OAuth credential', async () => {
    const updates: Array<Record<string, unknown>> = [];
    const query = {} as Record<string, ReturnType<typeof vi.fn>>;
    query.select = vi.fn(() => query);
    query.eq = vi.fn(() => query);
    query.maybeSingle = vi.fn(async () => ({ data: connectionRow(), error: null }));
    query.update = vi.fn((payload: Record<string, unknown>) => {
      updates.push(payload);
      return query;
    });
    mockedGetSupabaseServerClient.mockReturnValue({ from: vi.fn(() => query) } as never);

    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ access_token: 'fresh-access' }))
      .mockResolvedValueOnce(Response.json({
        id: 'shared_folder_123',
        name: 'Shared CardForge Work',
        mimeType: 'application/vnd.google-apps.folder',
        driveId: 'shared-drive-123',
        capabilities: { canAddChildren: false, canEdit: false },
      }))
      .mockResolvedValueOnce(Response.json({ files: [] }));
    vi.stubGlobal('fetch', fetch);

    const result = await listGoogleDriveProjectsPage({ ownerUserId: 'user-1' });

    expect(result.connection).toMatchObject({
      status: 'active',
      statusNote: 'This Drive folder is read-only for the connected account.',
    });
    expect(updates).toHaveLength(0);
  });
});