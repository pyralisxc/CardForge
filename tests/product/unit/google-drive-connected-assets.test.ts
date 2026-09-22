import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { encryptProjectStorageToken } from '@/features/project/server/projectStorageTokenCrypto';
import { materializePersonalLibraryItem } from '@/features/personal-library/server/personalLibraryStore';

vi.mock('@/infrastructure/database/supabaseServer', () => ({
  getSupabaseServerClient: vi.fn(),
}));

const mockedGetSupabaseServerClient = vi.mocked(getSupabaseServerClient);
const encryptionKey = Buffer.alloc(32, 13).toString('base64');

const libraryRow = {
  id: 'library-item-1',
  owner_user_id: 'user-1',
  provider: 'google-drive',
  provider_file_id: 'drive_asset_12345',
  provider_revision: '1',
  provider_resource_key: 'resource-key-123',
  display_name: 'Frame.png',
  mime_type: 'image/png',
  asset_role: 'frame',
  byte_size: 3,
  provider_modified_at: '2026-09-22T00:00:00.000Z',
  provider_web_view_link: 'https://drive.google.com/file/d/drive_asset_12345/view',
  content_hash: null,
  last_verified_at: '2026-09-22T00:00:00.000Z',
  created_at: '2026-09-22T00:00:00.000Z',
  updated_at: '2026-09-22T00:00:00.000Z',
};

const driveFile = (version = '1') => ({
  id: 'drive_asset_12345',
  name: 'Frame.png',
  mimeType: 'image/png',
  version,
  modifiedTime: version === '1' ? '2026-09-22T00:00:00.000Z' : '2026-09-22T00:01:00.000Z',
  size: '3',
  webViewLink: 'https://drive.google.com/file/d/drive_asset_12345/view',
  resourceKey: 'resource-key-123',
  trashed: false,
});

const connectionRow = () => {
  const encrypted = encryptProjectStorageToken('refresh-token-example', encryptionKey);
  return {
    id: 'drive-connection-1',
    refresh_token_ciphertext: encrypted.ciphertext,
    refresh_token_iv: encrypted.iv,
    refresh_token_auth_tag: encrypted.authTag,
    granted_scopes: ['openid', 'email', 'https://www.googleapis.com/auth/drive.file'],
  };
};

const createReadQuery = (data: unknown) => {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
};

const createUpdateQuery = () => {
  const query = {
    update: vi.fn(),
    eq: vi.fn(),
    select: vi.fn(),
    single: vi.fn().mockResolvedValue({ data: libraryRow, error: null }),
  };
  query.update.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.select.mockReturnValue(query);
  return query;
};

describe('Google Drive connected-asset materialization', () => {
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

  it('reuses resource keys and Shared Drive support, then rechecks metadata before indexing bytes', async () => {
    const itemRead = createReadQuery(libraryRow);
    const connectionRead = createReadQuery(connectionRow());
    const itemUpdate = createUpdateQuery();
    let personalCalls = 0;
    mockedGetSupabaseServerClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'cardforge_project_storage_connections') return connectionRead;
        if (table === 'cardforge_personal_library_items') return personalCalls++ === 0 ? itemRead : itemUpdate;
        throw new Error(`Unexpected table ${table}`);
      }),
    } as never);

    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ access_token: 'private-access', expires_in: 3600 }))
      .mockResolvedValueOnce(Response.json(driveFile('1')))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), {
        headers: { 'content-type': 'image/png', 'content-length': '3' },
      }))
      .mockResolvedValueOnce(Response.json(driveFile('1')));
    vi.stubGlobal('fetch', fetch);

    await expect(materializePersonalLibraryItem('user-1', 'library-item-1')).resolves.toMatchObject({
      mimeType: 'image/png',
      bytes: new Uint8Array([1, 2, 3]),
    });

    const metadataBefore = new URL(String(fetch.mock.calls[1]![0]));
    const media = new URL(String(fetch.mock.calls[2]![0]));
    const metadataAfter = new URL(String(fetch.mock.calls[3]![0]));
    expect(metadataBefore.searchParams.get('supportsAllDrives')).toBe('true');
    expect(media.searchParams.get('supportsAllDrives')).toBe('true');
    expect(metadataAfter.searchParams.get('supportsAllDrives')).toBe('true');
    expect(fetch.mock.calls[1]![1]).toMatchObject({
      headers: expect.objectContaining({ 'X-Goog-Drive-Resource-Keys': 'drive_asset_12345/resource-key-123' }),
    });
    expect(fetch.mock.calls[2]![1]).toMatchObject({
      headers: expect.objectContaining({ 'X-Goog-Drive-Resource-Keys': 'drive_asset_12345/resource-key-123' }),
    });
    expect(itemUpdate.update).toHaveBeenCalledWith(expect.objectContaining({
      provider_revision: '1',
      provider_resource_key: 'resource-key-123',
      byte_size: 3,
      content_hash: expect.stringMatching(/^[a-f0-9]{64}$/u),
    }));
  });

  it('rejects a Drive asset that changes while its bytes are being read', async () => {
    const itemRead = createReadQuery(libraryRow);
    const connectionRead = createReadQuery(connectionRow());
    const itemUpdate = createUpdateQuery();
    let personalCalls = 0;
    mockedGetSupabaseServerClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'cardforge_project_storage_connections') return connectionRead;
        if (table === 'cardforge_personal_library_items') return personalCalls++ === 0 ? itemRead : itemUpdate;
        throw new Error(`Unexpected table ${table}`);
      }),
    } as never);

    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ access_token: 'private-access', expires_in: 3600 }))
      .mockResolvedValueOnce(Response.json(driveFile('1')))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), {
        headers: { 'content-type': 'image/png', 'content-length': '3' },
      }))
      .mockResolvedValueOnce(Response.json(driveFile('2')));
    vi.stubGlobal('fetch', fetch);

    await expect(materializePersonalLibraryItem('user-1', 'library-item-1')).rejects.toMatchObject({
      status: 409,
      kind: 'conflict',
    });
    expect(itemUpdate.update).not.toHaveBeenCalled();
  });
});
