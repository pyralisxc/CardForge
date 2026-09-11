import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import {
  createGoogleDriveProjectFolder,
  getGoogleDrivePickerConfiguration,
  getGoogleDriveSelectedProjectFolder,
  selectGoogleDriveProjectFolder,
} from '@/features/project/server/googleDriveFolderPickerStore';
import { classifyGoogleProviderFailure } from '@/features/project/server/googleDriveBoundary';
import { encryptProjectStorageToken } from '@/features/project/server/projectStorageTokenCrypto';

vi.mock('@/infrastructure/database/supabaseServer', () => ({
  getSupabaseServerClient: vi.fn(),
}));

const mockedGetSupabaseServerClient = vi.mocked(getSupabaseServerClient);
const encryptionKey = Buffer.alloc(32, 7).toString('base64');

const connectionRow = () => {
  const encrypted = encryptProjectStorageToken('refresh-token-example', encryptionKey);
  return {
    id: 'connection-1',
    refresh_token_ciphertext: encrypted.ciphertext,
    refresh_token_iv: encrypted.iv,
    refresh_token_auth_tag: encrypted.authTag,
    root_folder_id: 'drive_folder_123',
  };
};

const connectionQuery = () => {
  const query = {
    select: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data: connectionRow(), error: null }),
  };
  query.select.mockReturnValue(query);
  query.update.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
};

describe('Google Drive folder actions', () => {
  beforeEach(() => {
    mockedGetSupabaseServerClient.mockReset();
    vi.stubEnv('CARDFORGE_GOOGLE_STORAGE_CLIENT_ID', '123456789012-cardforgepreview.apps.googleusercontent.com');
    vi.stubEnv('CARDFORGE_GOOGLE_STORAGE_CLIENT_SECRET', 'google-secret');
    vi.stubEnv('CARDFORGE_STORAGE_TOKEN_ENCRYPTION_KEY', encryptionKey);
    vi.stubEnv('CARDFORGE_GOOGLE_PICKER_API_KEY', 'picker-key');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('forwards a Picker resource key when verifying a shared folder', async () => {
    const query = connectionQuery();
    mockedGetSupabaseServerClient.mockReturnValue({ from: vi.fn().mockReturnValue(query) } as never);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ access_token: 'private-access' }))
      .mockResolvedValueOnce(Response.json({
        id: 'shared_folder_123',
        name: 'Shared project folder',
        mimeType: 'application/vnd.google-apps.folder',
        resourceKey: 'resource-key-123',
        capabilities: { canAddChildren: true },
      }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(selectGoogleDriveProjectFolder({
      ownerUserId: 'user-1',
      folderId: 'shared_folder_123',
      resourceKey: 'resource-key-123',
    })).resolves.toMatchObject({ id: 'shared_folder_123', resourceKey: 'resource-key-123' });

    expect(fetchMock.mock.calls[1]![1]).toMatchObject({
      headers: {
        Authorization: 'Bearer private-access',
        'X-Goog-Drive-Resource-Keys': 'shared_folder_123/resource-key-123',
      },
    });
  });

  it('derives Picker App ID from the active OAuth client instead of a stale project-number variable', async () => {
    vi.stubEnv('CARDFORGE_GOOGLE_CLOUD_PROJECT_NUMBER', '999999999999');
    const query = connectionQuery();
    mockedGetSupabaseServerClient.mockReturnValue({ from: vi.fn().mockReturnValue(query) } as never);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ access_token: 'private-access' })));

    await expect(getGoogleDrivePickerConfiguration('user-1')).resolves.toMatchObject({
      appId: '123456789012',
      contributorKey: 'picker-key',
      initialFolderId: 'drive_folder_123',
    });
  });

  it('returns the selected folder name and capability for Locations', async () => {
    const query = connectionQuery();
    mockedGetSupabaseServerClient.mockReturnValue({ from: vi.fn().mockReturnValue(query) } as never);
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(Response.json({ access_token: 'private-access' }))
      .mockResolvedValueOnce(Response.json({
        id: 'drive_folder_123',
        name: 'CardForge Preview',
        mimeType: 'application/vnd.google-apps.folder',
        capabilities: { canAddChildren: true },
      })));

    await expect(getGoogleDriveSelectedProjectFolder('user-1')).resolves.toMatchObject({
      id: 'drive_folder_123',
      name: 'CardForge Preview',
      canAddChildren: true,
    });
  });

  it('creates a new My Drive project folder and selects it without broader Drive access', async () => {
    const query = connectionQuery();
    mockedGetSupabaseServerClient.mockReturnValue({ from: vi.fn().mockReturnValue(query) } as never);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ access_token: 'private-access' }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 'created_folder_123',
        name: 'CardForge QA',
        mimeType: 'application/vnd.google-apps.folder',
        capabilities: { canAddChildren: true },
      }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(createGoogleDriveProjectFolder({ ownerUserId: 'user-1', name: 'CardForge QA' }))
      .resolves.toMatchObject({ id: 'created_folder_123', name: 'CardForge QA', canAddChildren: true });

    const createUrl = new URL(String(fetchMock.mock.calls[1]![0]));
    expect(createUrl.pathname).toBe('/drive/v3/files');
    expect(fetchMock.mock.calls[1]![1]).toMatchObject({
      method: 'POST',
      headers: { Authorization: 'Bearer private-access', 'Content-Type': 'application/json' },
    });
    expect(JSON.parse(fetchMock.mock.calls[1]![1]!.body as string)).toEqual({
      name: 'CardForge QA',
      mimeType: 'application/vnd.google-apps.folder',
    });
  });

  it('rejects invalid project-folder names before any provider request', async () => {
    vi.stubGlobal('fetch', vi.fn());
    await expect(createGoogleDriveProjectFolder({ ownerUserId: 'user-1', name: '   ' }))
      .rejects.toMatchObject({ status: 400, kind: 'invalid' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps a provider permission failure distinct while creating a folder', async () => {
    const query = connectionQuery();
    mockedGetSupabaseServerClient.mockReturnValue({ from: vi.fn().mockReturnValue(query) } as never);
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(Response.json({ access_token: 'private-access' }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: { message: 'Insufficient permissions.' },
      }), { status: 403, headers: { 'content-type': 'application/json' } })));

    await expect(createGoogleDriveProjectFolder({ ownerUserId: 'user-1', name: 'CardForge QA' }))
      .rejects.toMatchObject({ status: 403, kind: 'authorization' });
  });

  it('reports OAuth client mismatch as owner configuration work rather than reconnect advice', () => {
    expect(classifyGoogleProviderFailure(401, {
      error: 'invalid_client',
      error_description: 'Unauthorized',
    }, 'token')).toMatchObject({
      status: 503,
      kind: 'unavailable',
      reconnectRequired: false,
      nextAction: expect.stringContaining('matching Google OAuth client ID and client secret'),
    });
  });
});