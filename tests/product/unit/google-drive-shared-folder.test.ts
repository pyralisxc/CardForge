import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { encryptProjectStorageToken } from '@/features/project/server/projectStorageTokenCrypto';
import {
  deleteGoogleDriveProject,
  listGoogleDriveProjects,
  prepareGoogleDriveProjectUpload,
} from '@/features/project/server/googleDriveProjectStore';

vi.mock('@/infrastructure/database/supabaseServer', () => ({ getSupabaseServerClient: vi.fn() }));

const mockedGetSupabaseServerClient = vi.mocked(getSupabaseServerClient);
const encryptionKey = Buffer.alloc(32, 7).toString('base64');
const headToken = (value: string) => 'head:' + createHash('sha256').update(value).digest('hex');

const connectionRow = () => {
  const encrypted = encryptProjectStorageToken('refresh-token-example', encryptionKey);
  return {
    id: 'connection-1', owner_user_id: 'user-1', provider: 'google-drive',
    external_account_id: 'google-user-1', display_name: 'Creator@example.com',
    refresh_token_ciphertext: encrypted.ciphertext, refresh_token_iv: encrypted.iv,
    refresh_token_auth_tag: encrypted.authTag, granted_scopes: ['https://www.googleapis.com/auth/drive.file'],
    root_folder_id: 'shared_folder_123', status: 'active', status_note: '',
    last_verified_at: '2026-09-09T00:00:00.000Z', created_at: '2026-09-09T00:00:00.000Z', updated_at: '2026-09-09T00:00:00.000Z',
  };
};

const connectionQuery = () => {
  const query = { select: vi.fn(), update: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: connectionRow(), error: null }) };
  query.select.mockReturnValue(query);
  query.update.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
};

const projectFile = (capabilities: Record<string, boolean>) => ({
  id: 'drive_file_12345', name: 'Shared Set.cardforge', mimeType: 'application/vnd.cardforge.project+zip',
  headRevisionId: 'native-head-1', version: '1', modifiedTime: '2026-09-09T00:00:00.000Z', size: '128',
  parents: ['shared_folder_123'], driveId: 'shared_drive_456', resourceKey: 'resource-key',
  capabilities,
  appProperties: { cardforgeProject: '1', cardforgeProjectRevision: 'a'.repeat(64), cardforgeWorkId: 'set-1' },
});

describe('Google Drive shared-folder capabilities', () => {
  beforeEach(() => {
    mockedGetSupabaseServerClient.mockReset();
    const from = vi.fn().mockReturnValue(connectionQuery());
    mockedGetSupabaseServerClient.mockReturnValue({ from } as never);
    vi.stubEnv('CARDFORGE_GOOGLE_STORAGE_CLIENT_ID', 'google-client');
    vi.stubEnv('CARDFORGE_GOOGLE_STORAGE_CLIENT_SECRET', 'google-secret');
    vi.stubEnv('CARDFORGE_STORAGE_TOKEN_ENCRYPTION_KEY', encryptionKey);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('lists the configured Workspace shared-drive folder with native all-drives parameters', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ access_token: 'private-access' }))
      .mockResolvedValueOnce(Response.json({ id: 'shared_folder_123', name: 'Studio Team', mimeType: 'application/vnd.google-apps.folder', driveId: 'shared_drive_456', capabilities: { canAddChildren: true } }))
      .mockResolvedValueOnce(Response.json({ files: [projectFile({ canDownload: true, canEdit: true, canModifyContent: true, canDelete: false })] }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await listGoogleDriveProjects('user-1');
    expect(result.projects[0]).toMatchObject({
      fileId: 'drive_file_12345', driveId: 'shared_drive_456', resourceKey: 'resource-key',
      capabilities: { canDownload: true, canEdit: true, canModifyContent: true, canDelete: false },
    });
    const folderUrl = new URL(String(fetchMock.mock.calls[1]![0]));
    expect(folderUrl.searchParams.get('supportsAllDrives')).toBe('true');
    const listUrl = new URL(String(fetchMock.mock.calls[2]![0]));
    expect(listUrl.searchParams.get('supportsAllDrives')).toBe('true');
    expect(listUrl.searchParams.get('includeItemsFromAllDrives')).toBe('true');
    expect(listUrl.searchParams.get('corpora')).toBe('drive');
    expect(listUrl.searchParams.get('driveId')).toBe('shared_drive_456');
  });

  it('does not create a project in a shared folder where the user cannot add children', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ access_token: 'private-access' }))
      .mockResolvedValueOnce(Response.json({ id: 'shared_folder_123', name: 'Read only', mimeType: 'application/vnd.google-apps.folder', driveId: 'shared_drive_456', capabilities: { canAddChildren: false } }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(prepareGoogleDriveProjectUpload({ ownerUserId: 'user-1', name: 'New Set', size: 10, projectRevision: 'b'.repeat(64), workId: 'set-1' }))
      .rejects.toMatchObject({ status: 403, kind: 'authorization' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not update a shared Drive project when the native role cannot modify content', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ access_token: 'private-access' }))
      .mockResolvedValueOnce(Response.json(projectFile({ canDownload: true, canEdit: true, canModifyContent: false, canDelete: false })));
    vi.stubGlobal('fetch', fetchMock);
    await expect(prepareGoogleDriveProjectUpload({
      ownerUserId: 'user-1', fileId: 'drive_file_12345', name: 'Shared Set', size: 10,
      projectRevision: 'b'.repeat(64), expectedProviderRevision: headToken('native-head-1'),
      expectedProjectRevision: 'a'.repeat(64), expectedAccountId: 'google-user-1', workId: 'set-1',
    })).rejects.toMatchObject({ status: 403, kind: 'authorization' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not delete a shared Drive project when the native role cannot delete it', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ access_token: 'private-access' }))
      .mockResolvedValueOnce(Response.json(projectFile({ canDownload: true, canEdit: true, canModifyContent: true, canDelete: false })));
    vi.stubGlobal('fetch', fetchMock);
    await expect(deleteGoogleDriveProject({
      ownerUserId: 'user-1', fileId: 'drive_file_12345', expectedProviderRevision: headToken('native-head-1'), expectedProjectRevision: 'a'.repeat(64),
    })).rejects.toMatchObject({ status: 403, kind: 'authorization' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
