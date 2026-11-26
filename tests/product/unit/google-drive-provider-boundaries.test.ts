import { createHash } from 'node:crypto';
const headToken = (version: string) => 'head:' + createHash('sha256').update('native-' + version).digest('hex');
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { toGoogleDriveProjectErrorResponse } from '@/app/api/project-sources/google-drive/_helpers';
import { readApiError } from '@/infrastructure/http/clientResponses';
import {
  disconnectGoogleDriveProjectStorage,
  getGoogleDriveDisconnectGeneration,
  inspectGoogleDriveDisconnect,
  removeGoogleDriveConnectionOnly,
  listGoogleDriveProjects,
  getGoogleDriveProjectThumbnail,
  getGoogleDriveProject,
  prepareGoogleDriveProjectUpload,
  updateGoogleDriveProjectFromServer,
} from '@/features/project/server/googleDriveProjectStore';
import { classifyGoogleProviderFailure, readGoogleProviderFailure, requestGoogleAccessToken } from '@/features/project/server/googleDriveBoundary';
import { encryptProjectStorageToken } from '@/features/project/server/projectStorageTokenCrypto';
import { describeAgentBoundaryFailure } from '@/shared/boundaryFailure';
import {
  retainLastKnownLibrarySource,
  retainScopedLastKnownLibrarySource,
  withConfirmedDriveWorkBinding,
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
    update: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data: connectionRow(), error: null }),
  };
  query.select.mockReturnValue(query);
  query.update.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
};

const writableDriveFolder = () => ({
  id: 'drive_folder_123',
  name: 'CardForge',
  mimeType: 'application/vnd.google-apps.folder',
  capabilities: { canAddChildren: true },
});

const writableProjectCapabilities = {
  canDownload: true,
  canEdit: true,
  canModifyContent: true,
  canTrash: true,
  canDelete: true,
};

describe('Google Drive provider boundaries', () => {
  it('projects a confirmed working binding only onto the matching file and account', () => {
    const library = { connection: { status: 'active' }, projects: [
      { fileId: 'same', accountId: 'account-a' },
      { fileId: 'same', accountId: 'account-b' },
      { fileId: 'other', accountId: 'account-a' },
    ] } as Parameters<typeof withConfirmedDriveWorkBinding>[0];
    const binding = { fileId: 'same', accountId: 'account-a', workId: 'local-set' } as Parameters<typeof withConfirmedDriveWorkBinding>[1];
    expect(withConfirmedDriveWorkBinding(library, binding).projects).toEqual([
      { fileId: 'same', accountId: 'account-a', localWorkId: 'local-set' },
      { fileId: 'same', accountId: 'account-b' },
      { fileId: 'other', accountId: 'account-a' },
    ]);
    expect(library.projects[0]).not.toHaveProperty('localWorkId');
    expect(withConfirmedDriveWorkBinding(library, { ...binding, accountId: undefined })).toBe(library);
  });

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

  it('rejects a stale exact read pin before downloading any package bytes', async () => {
    mockedGetSupabaseServerClient.mockReturnValue({ from: vi.fn().mockReturnValue(selectConnectionQuery()) } as never);
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ access_token: 'private-access' }))
      .mockResolvedValueOnce(Response.json({ id: 'drive-file-12345', name: 'Legacy.cardforge',
        mimeType: 'application/vnd.cardforge.project+zip', headRevisionId: 'native-2', version: '2', modifiedTime: '2026-09-01',
        parents: ['drive_folder_123'], capabilities: writableProjectCapabilities, size: '128' }));
    vi.stubGlobal('fetch', fetch);
    await expect(getGoogleDriveProject({ ownerUserId: 'user-1', fileId: 'drive-file-12345', expectedProviderRevision: headToken('1') })).rejects.toMatchObject({ status: 409, kind: 'conflict' });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls.some(([url]) => String(url).includes('alt=media'))).toBe(false);
  });

  it('reads private native thumbnails without importing the package or exposing credentials to the browser', async () => {
    mockedGetSupabaseServerClient.mockReturnValue({ from: vi.fn().mockReturnValue(selectConnectionQuery()) } as never);
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ access_token: 'private-access' }))
      .mockResolvedValueOnce(Response.json({
        id: 'drive-file-12345', name: 'Set.cardforge', mimeType: 'application/vnd.cardforge.project+zip', version: '1', headRevisionId: 'native-1', modifiedTime: '2026-09-01',
        parents: ['drive_folder_123'], appProperties: { cardforgeProject: '1' }, thumbnailLink: 'https://lh3.googleusercontent.com/private-thumb',
      }))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } }));
    vi.stubGlobal('fetch', fetch);
    expect(await getGoogleDriveProjectThumbnail({ ownerUserId: 'user-1', fileId: 'drive-file-12345' })).toMatchObject({ mimeType: 'image/png' });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls[2]![1]).toMatchObject({ headers: { Authorization: 'Bearer private-access' }, redirect: 'error', cache: 'no-store' });
    expect(fetch.mock.calls.some(([url]) => String(url).includes('alt=media'))).toBe(false);
  });

  it('does not forward Drive credentials to an unexpected thumbnail host', async () => {
    mockedGetSupabaseServerClient.mockReturnValue({ from: vi.fn().mockReturnValue(selectConnectionQuery()) } as never);
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ access_token: 'private-access' }))
      .mockResolvedValueOnce(Response.json({
        id: 'drive-file-12345', name: 'Set.cardforge', mimeType: 'application/vnd.cardforge.project+zip', version: '1', headRevisionId: 'native-1', modifiedTime: '2026-09-01',
        parents: ['drive_folder_123'], appProperties: { cardforgeProject: '1' }, thumbnailLink: 'https://attacker.test/private-thumb',
      }));
    vi.stubGlobal('fetch', fetch);
    await expect(getGoogleDriveProjectThumbnail({ ownerUserId: 'user-1', fileId: 'drive-file-12345' })).rejects.toMatchObject({ kind: 'unavailable' });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('rejects a save bound to a different connected Google account before preparing an upload', async () => {
    mockedGetSupabaseServerClient.mockReturnValue({ from: vi.fn().mockReturnValue(selectConnectionQuery()) } as never);
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ access_token: 'private-access' }));
    vi.stubGlobal('fetch', fetch);
    await expect(prepareGoogleDriveProjectUpload({ ownerUserId: 'user-1', name: 'Set', size: 3, projectRevision: 'a'.repeat(64), expectedAccountId: 'other-google-account', fileId: 'drive-file-12345' })).rejects.toMatchObject({ status: 409 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('supplies the canonical PNG through native Drive contentHints and rejects invalid thumbnails before provider calls', async () => {
    mockedGetSupabaseServerClient.mockReturnValue({ from: vi.fn().mockReturnValue(selectConnectionQuery()) } as never);
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ access_token: 'private-access' }))
      .mockResolvedValueOnce(Response.json(writableDriveFolder()))
      .mockResolvedValueOnce(new Response(null, { headers: { location: 'https://www.googleapis.com/upload/session' } }));
    vi.stubGlobal('fetch', fetch);
    const input = { ownerUserId: 'user-1', name: 'Set', size: 3, projectRevision: 'a'.repeat(64) };
    await expect(prepareGoogleDriveProjectUpload({ ...input, thumbnail: 'not-a-png' })).rejects.toMatchObject({ status: 400 });
    expect(fetch).not.toHaveBeenCalled();
    const thumbnail = Buffer.from('89504e470d0a1a0a', 'hex').toString('base64url');
    await prepareGoogleDriveProjectUpload({ ...input, thumbnail });
    expect(JSON.parse(fetch.mock.calls[2]![1]!.body as string)).toMatchObject({ contentHints: { thumbnail: { image: thumbnail, mimeType: 'image/png' } } });
  });

  it('classifies provider failures once at the shared Google response boundary', async () => {
    for (const [status, payload, context, expected] of [
      [401, { error: { message: 'Invalid credentials.' } }, 'api', { status: 401, kind: 'authentication' }],
      [403, { error: { message: 'Insufficient permissions.' } }, 'api', { status: 403, kind: 'authorization', nextAction: expect.stringContaining('can access') }],
      [403, { error: { errors: [{ reason: 'userRateLimitExceeded' }] } }, 'api', { status: 429, kind: 'limit' }],
      [403, { error: { errors: [{ reason: 'storageQuotaExceeded' }] } }, 'api', { status: 403, kind: 'limit', nextAction: expect.stringContaining('account storage') }],
      [503, { error: 'temporarily_unavailable', error_description: 'Retry later.' }, 'token', { status: 503, kind: 'unavailable', reconnectRequired: false }],
    ] as const) {
      await expect(readGoogleProviderFailure(Response.json(payload, { status }), context)).resolves.toMatchObject(expected);
    }
  });

  it.each(['lost response', 'invalid receipt', 'null receipt', 'missing head', 'provider 503'])('does not advise repeating an uncertain server commit: %s', async (failure) => {
    mockedGetSupabaseServerClient.mockReturnValue({ from: vi.fn().mockReturnValue(selectConnectionQuery()) } as never);
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ access_token: 'private-access' }))
      .mockResolvedValueOnce(Response.json({
        id: 'drive-file-12345', name: 'Set.cardforge', mimeType: 'application/vnd.cardforge.project+zip', version: '1', headRevisionId: 'native-1', modifiedTime: '2026-09-01',
        parents: ['drive_folder_123'], capabilities: writableProjectCapabilities,
        appProperties: { cardforgeProject: '1', cardforgeProjectRevision: 'a'.repeat(64) },
      }))
      .mockResolvedValueOnce(new Response(null, { headers: { location: 'https://www.googleapis.com/upload/session' } }));
    if (failure === 'lost response') fetch.mockRejectedValueOnce(new Error('connection reset'));
    else fetch.mockResolvedValueOnce(failure === 'provider 503' ? new Response(null, { status: 503 }) : Response.json(failure === 'null receipt' ? null : failure === 'missing head' ? { id: 'drive-file-12345', version: '3', name: 'Saved' } : {}));
    fetch.mockResolvedValueOnce(new Response(null, { status: 404 }));
    vi.stubGlobal('fetch', fetch);
    const error = await updateGoogleDriveProjectFromServer({ ownerUserId: 'user-1', fileId: 'drive-file-12345', name: 'Set', blob: new Blob(['new']), projectRevision: 'b'.repeat(64), expectedProviderRevision: headToken('1'), expectedProjectRevision: 'a'.repeat(64) }).catch((error: unknown) => error);
    expect(describeAgentBoundaryFailure(error)).toMatchObject({ status: 503, kind: 'unavailable', retryable: false, nextAction: expect.stringContaining('Do not repeat commit_project') });
    expect(fetch).toHaveBeenCalledTimes(5);
    expect(fetch.mock.calls[4]?.[1]).toMatchObject({ method: 'PUT', headers: expect.objectContaining({ 'Content-Range': 'bytes */3' }) });
  });

  it('does not expose a machine-only Google token error as user-facing copy', () => {
    expect(classifyGoogleProviderFailure(500, {
      error: 'internal_failure',
    }, 'token')).toMatchObject({
      status: 503,
      kind: 'unavailable',
      providerMessage: undefined,
      nextAction: expect.stringContaining('Retry without reconnecting'),
    });
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

  it('follows Google Drive native page tokens instead of stopping at the first page', async () => {
    const connectionQuery = selectConnectionQuery() as ReturnType<typeof selectConnectionQuery> & { update?: ReturnType<typeof vi.fn> };
    connectionQuery.update = vi.fn().mockReturnValue(connectionQuery);
    const from = vi.fn().mockReturnValue(connectionQuery);
    mockedGetSupabaseServerClient.mockReturnValue({ from } as never);
    const project = (id: string, version: string) => ({
      id, name: `${id}.cardforge`, mimeType: 'application/vnd.cardforge.project+zip', version, headRevisionId: `native-${version}`,
      modifiedTime: '2026-09-01T00:00:00.000Z', size: '12', parents: ['drive_folder_123'], thumbnailLink: `https://drive.example.test/${id}.png`,
      appProperties: { cardforgeProject: '1', cardforgeProjectRevision: `${id}-revision` },
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'first-token', expires_in: 3600 }), { status: 200 }))
      .mockResolvedValueOnce(Response.json(writableDriveFolder()))
      .mockResolvedValueOnce(new Response(JSON.stringify({ files: [project('drivefile1', '1')], nextPageToken: 'page-two' }), { status: 200 }))
      .mockResolvedValueOnce(Response.json(writableDriveFolder()))
      .mockResolvedValueOnce(new Response(JSON.stringify({ files: [project('drivefile2', '2')] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(listGoogleDriveProjects('user-1')).resolves.toMatchObject({
      projects: [
        { fileId: 'drivefile1', thumbnailLink: 'https://drive.example.test/drivefile1.png' },
        { fileId: 'drivefile2', thumbnailLink: 'https://drive.example.test/drivefile2.png' },
      ], nextPageToken: null,
    });
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('oauth2.googleapis.com/token'))).toHaveLength(1);
    const secondListUrl = new URL(String(fetchMock.mock.calls[4]?.[0]));
    expect(secondListUrl.searchParams.get('pageToken')).toBe('page-two');
    expect(secondListUrl.searchParams.get('fields')).toContain('thumbnailLink');
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

  it('bounds the shared Google token request used by Drive and Library actions', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ access_token: 'private-access' }));
    vi.stubGlobal('fetch', fetch);

    await expect(requestGoogleAccessToken({
      endpoint: 'https://oauth2.googleapis.com/token',
      refreshToken: 'refresh-token-example',
      clientId: 'google-client',
      clientSecret: 'google-secret',
    })).resolves.toMatchObject({ ok: true, accessToken: 'private-access' });

    expect(fetch.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      cache: 'no-store',
      signal: expect.any(AbortSignal),
    });
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
      status_note: 'Google authorization expired, was revoked, or is missing the required Drive permission.',
    });
  });

  it('requires the exact generation before contacting Google', async () => {
    const row = connectionRow(); const select = selectConnectionQuery(); select.maybeSingle.mockResolvedValue({ data: row, error: null });
    mockedGetSupabaseServerClient.mockReturnValue({ from: vi.fn().mockReturnValue(select) } as never);
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    const { generation } = await getGoogleDriveDisconnectGeneration('user-1');
    await expect(disconnectGoogleDriveProjectStorage('user-1', '')).rejects.toMatchObject({ status: 409 });
    await expect(disconnectGoogleDriveProjectStorage('user-1', 'a'.repeat(64))).rejects.toMatchObject({ status: 409 });
    expect(generation).toHaveLength(64); expect(fetch).not.toHaveBeenCalled();
  });

  it.each([400, 503, 204])('does not treat Google status %s as confirmed', async (status) => {
    const row = connectionRow(); const select = selectConnectionQuery(); select.maybeSingle.mockResolvedValue({ data: row, error: null });
    mockedGetSupabaseServerClient.mockReturnValue({ from: vi.fn().mockReturnValue(select) } as never);
    const { generation } = await getGoogleDriveDisconnectGeneration('user-1');
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status })); vi.stubGlobal('fetch', fetch);
    const failure = await disconnectGoogleDriveProjectStorage('user-1', generation!).catch((error: unknown) => error);
    expect(failure).toMatchObject({ code: 'google_drive_disconnect_unconfirmed', retryable: false });
    await expect(readApiError(toGoogleDriveProjectErrorResponse(failure, 'Unable to disconnect.'), 'Unable to disconnect.')).resolves.toMatchObject({ code: 'google_drive_disconnect_unconfirmed' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('issues a bound receipt after confirmed Google revocation and safely removes only the original record', async () => {
    const row = connectionRow(); const select = selectConnectionQuery(); select.maybeSingle.mockResolvedValue({ data: row, error: null });
    mockedGetSupabaseServerClient.mockReturnValue({ from: vi.fn().mockReturnValue(select) } as never);
    const { generation } = await getGoogleDriveDisconnectGeneration('user-1');
    const deletion = { delete: vi.fn(), eq: vi.fn(), select: vi.fn().mockResolvedValue({ data: null, error: { message: 'unavailable' } }) };
    deletion.delete.mockReturnValue(deletion); deletion.eq.mockReturnValue(deletion);
    mockedGetSupabaseServerClient.mockReturnValue({ from: vi.fn().mockReturnValueOnce(select).mockReturnValueOnce(deletion).mockReturnValueOnce(select) } as never);
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 })); vi.stubGlobal('fetch', fetch);
    const result = await disconnectGoogleDriveProjectStorage('user-1', generation!);
    expect(result?.receipt).toHaveLength(64);
    mockedGetSupabaseServerClient.mockReturnValue({ from: vi.fn().mockReturnValue(select) } as never);
    await expect(inspectGoogleDriveDisconnect('user-1', generation!, result!.receipt)).resolves.toEqual({ record: 'same', google: 'confirmed' });
    await expect(inspectGoogleDriveDisconnect('user-2', generation!, result!.receipt)).rejects.toThrow();
    await expect(inspectGoogleDriveDisconnect('user-1', generation!, 'a'.repeat(64))).rejects.toThrow();
    const newer = selectConnectionQuery(); newer.maybeSingle.mockResolvedValue({ data: connectionRow(), error: null });
    const from = vi.fn().mockReturnValue(newer); mockedGetSupabaseServerClient.mockReturnValue({ from } as never);
    await expect(removeGoogleDriveConnectionOnly('user-1', generation!)).resolves.toEqual({ record: 'changed' });
    expect(from).toHaveBeenCalledTimes(1); expect(fetch).toHaveBeenCalledTimes(1);
    const removed = { delete: vi.fn(), eq: vi.fn(), select: vi.fn().mockResolvedValue({ data: [{ id: row.id }], error: null }) };
    removed.delete.mockReturnValue(removed); removed.eq.mockReturnValue(removed);
    mockedGetSupabaseServerClient.mockReturnValue({ from: vi.fn().mockReturnValueOnce(select).mockReturnValueOnce(removed) } as never);
    await expect(removeGoogleDriveConnectionOnly('user-1', generation!)).resolves.toEqual({ record: 'absent' });
    expect(removed.eq).toHaveBeenCalledWith('refresh_token_ciphertext', row.refresh_token_ciphertext);
    expect(removed.eq).toHaveBeenCalledWith('refresh_token_iv', row.refresh_token_iv);
    expect(removed.eq).toHaveBeenCalledWith('refresh_token_auth_tag', row.refresh_token_auth_tag);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    { head: 'native-1', expected: headToken('1'), status: null },
    { head: 'native-2', expected: headToken('1'), status: 409 },
    { head: 'native-1', expected: headToken('1'), status: 409, hash: 'c' },
    { head: undefined, expected: headToken('1'), status: 503 },
    { head: 'native-1', expected: '1', status: 409 },
  ])('uses native content identity for preflight: %j', async ({ head, expected, status, hash = 'a' }) => {
    mockedGetSupabaseServerClient.mockReturnValue({ from: vi.fn().mockReturnValue(selectConnectionQuery()) } as never);
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ access_token: 'private-access' }))
      .mockResolvedValueOnce(Response.json({
        id: 'drive-file-12345', name: 'Set.cardforge', mimeType: 'application/vnd.cardforge.project+zip',
        version: '2', headRevisionId: head, modifiedTime: '2026-09-01', parents: ['drive_folder_123'],
        capabilities: writableProjectCapabilities,
        appProperties: { cardforgeProject: '1', cardforgeProjectRevision: hash.repeat(64) },
      }))
      .mockResolvedValueOnce(new Response(null, { headers: { location: 'https://www.googleapis.com/upload/session' } }));
    vi.stubGlobal('fetch', fetch);
    const action = prepareGoogleDriveProjectUpload({ ownerUserId: 'user-1', fileId: 'drive-file-12345', name: 'Renamed', size: 3,
      projectRevision: 'b'.repeat(64), expectedProviderRevision: expected, expectedProjectRevision: 'a'.repeat(64) });
    if (status) {
      await expect(action).rejects.toMatchObject({ status });
      expect(fetch).toHaveBeenCalledTimes(2);
    } else {
      await expect(action).resolves.toMatchObject({ projectRevision: 'b'.repeat(64) });
      expect(fetch).toHaveBeenCalledTimes(3);
      expect(fetch.mock.calls[2]![1]).toMatchObject({ method: 'PATCH' });
      expect(JSON.parse(fetch.mock.calls[2]![1]!.body as string)).not.toHaveProperty('name');
    }
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

  it.each(['authentication', 'authorization', 'not_found'] as const)('never claims retained results after an authoritative %s failure', (kind) => {
    expect(describeLibraryBoundaryFailure({
      id: 'google-drive',
      message: 'Google Drive access changed.',
      retryable: false,
      kind,
    })).toContain('Protected results from this source were removed.');
  });
});
