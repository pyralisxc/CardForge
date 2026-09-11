import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import {
  listGoogleDriveProjects,
  prepareGoogleDriveProjectUpload,
} from '@/features/project/server/googleDriveProjectStore';
import { encryptProjectStorageToken } from '@/features/project/server/projectStorageTokenCrypto';

vi.mock('@/infrastructure/database/supabaseServer', () => ({
  getSupabaseServerClient: vi.fn(),
}));

const mockedGetSupabaseServerClient = vi.mocked(getSupabaseServerClient);
const encryptionKey = Buffer.alloc(32, 11).toString('base64');

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
    root_folder_id: 'shared_folder_123',
    root_folder_resource_key: 'persisted-resource-key',
    status: 'active' as const,
    status_note: '',
    last_verified_at: '2026-09-01T00:00:00.000Z',
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
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

const resourceHeader = {
  Authorization: 'Bearer private-access',
  'X-Goog-Drive-Resource-Keys': 'shared_folder_123/persisted-resource-key',
};

const folder = {
  id: 'shared_folder_123',
  name: 'CardForge Preview',
  mimeType: 'application/vnd.google-apps.folder',
  resourceKey: 'persisted-resource-key',
  capabilities: { canAddChildren: true },
};

describe('Google Drive shared-folder resource-key lifecycle', () => {
  beforeEach(() => {
    mockedGetSupabaseServerClient.mockReset();
    mockedGetSupabaseServerClient.mockReturnValue({ from: vi.fn().mockReturnValue(connectionQuery()) } as never);
    vi.stubEnv('CARDFORGE_GOOGLE_STORAGE_CLIENT_ID', 'google-client');
    vi.stubEnv('CARDFORGE_GOOGLE_STORAGE_CLIENT_SECRET', 'google-secret');
    vi.stubEnv('CARDFORGE_STORAGE_TOKEN_ENCRYPTION_KEY', encryptionKey);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('uses the persisted resource key to verify and list the selected folder after a later reload', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ access_token: 'private-access' }))
      .mockResolvedValueOnce(Response.json(folder))
      .mockResolvedValueOnce(Response.json({ files: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(listGoogleDriveProjects('user-1')).resolves.toMatchObject({ projects: [] });
    expect(fetchMock.mock.calls[1]![1]).toMatchObject({ headers: resourceHeader });
    expect(fetchMock.mock.calls[2]![1]).toMatchObject({ headers: resourceHeader });
  });

  it('uses the persisted resource key when creating the next project in that folder', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ access_token: 'private-access' }))
      .mockResolvedValueOnce(Response.json(folder))
      .mockResolvedValueOnce(new Response(null, {
        status: 200,
        headers: { location: 'https://www.googleapis.com/upload/session' },
      }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(prepareGoogleDriveProjectUpload({
      ownerUserId: 'user-1',
      name: 'Shared Set',
      size: 3,
      projectRevision: 'a'.repeat(64),
    })).resolves.toMatchObject({ name: 'Shared Set.cardforge' });

    expect(fetchMock.mock.calls[1]![1]).toMatchObject({ headers: resourceHeader });
    expect(fetchMock.mock.calls[2]![1]).toMatchObject({
      headers: expect.objectContaining({
        ...resourceHeader,
        'Content-Type': 'application/json; charset=UTF-8',
      }),
    });
  });
});
