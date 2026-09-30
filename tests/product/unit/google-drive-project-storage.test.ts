import { describe, expect, it } from 'vitest';

import {
  applyCachedGoogleDriveProjectPreviews,
  cacheGoogleDriveProjectPreview,
  clearCachedGoogleDriveProjectPreviews,
  getCachedGoogleDriveProjectPreview,
} from '@/features/project/client/provider-google-drive';
import { getGoogleDriveProjectPreviewCards } from '@/features/card-generator/lib/googleDriveProjectThumbnail';
import { createProjectScaleFixture } from '../../fixtures/projectScale';
import { getUnexpectedGoogleDriveScopes, hasGoogleDriveProjectRevisionConflict } from '@/features/project/model/googleDriveProject';
import {
  GOOGLE_DRIVE_FILE_SCOPE,
  GOOGLE_DRIVE_PROJECT_MIME_TYPE,
  GOOGLE_DRIVE_ROOT_FOLDER_NAME,
} from '@/features/project/server';
import {
  decryptProjectStorageToken,
  encryptProjectStorageToken,
} from '@/features/project/server/projectStorageTokenCrypto';
import { createLibraryLocationsHref } from '@/features/storage-management/lib/accountLibraryActions';

describe('Google Drive project storage', () => {
  it('uses user-owned per-file Drive authority and the CardForge project contract', () => {
    expect(GOOGLE_DRIVE_FILE_SCOPE).toBe('https://www.googleapis.com/auth/drive.file');
    expect(GOOGLE_DRIVE_PROJECT_MIME_TYPE).toBe('application/vnd.cardforge.project+zip');
    expect(GOOGLE_DRIVE_ROOT_FOLDER_NAME).toBe('CardForge');
  });

  it('rejects every broader Google Drive scope while allowing per-file access', () => {
    expect(getUnexpectedGoogleDriveScopes([
      'openid',
      'https://www.googleapis.com/auth/userinfo.email',
      GOOGLE_DRIVE_FILE_SCOPE,
    ])).toEqual([]);
    expect(getUnexpectedGoogleDriveScopes([
      GOOGLE_DRIVE_FILE_SCOPE,
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/drive.metadata.readonly',
    ])).toEqual([
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/drive.metadata.readonly',
      'https://www.googleapis.com/auth/drive.readonly',
    ]);
  });

  it('builds exact Library return paths for connected storage', () => {
    expect(createLibraryLocationsHref('published')).toBe('/account?section=library&scope=published&tool=locations');
    expect(createLibraryLocationsHref('pipeline')).toBe('/account?section=library&scope=pipeline&tool=locations');
  });

  it('encrypts refresh credentials independently of provider code', () => {
    const key = Buffer.alloc(32, 7).toString('base64');
    const encrypted = encryptProjectStorageToken('refresh-token-example', key);
    expect(encrypted.ciphertext).not.toContain('refresh-token-example');
    expect(decryptProjectStorageToken(encrypted, key)).toBe('refresh-token-example');
  });

  it('selects several real project cards for a Drive Set preview without opening it', () => {
    const project = createProjectScaleFixture(100);
    expect(getGoogleDriveProjectPreviewCards(project).map((card) => card.uniqueId)).toEqual([
      'scale-card-1',
      'scale-card-2',
      'scale-card-3',
      'scale-card-4',
      'scale-card-5',
    ]);
  });

  it('keys compatibility previews to the exact Drive content identity', () => {
    clearCachedGoogleDriveProjectPreviews();
    const summary = {
      fileId: 'drive_preview_123',
      projectRevision: 'a'.repeat(64),
      providerRevision: `head:${'b'.repeat(64)}`,
    };
    const dataUrl = 'data:image/png;base64,ZmFrZQ==';
    cacheGoogleDriveProjectPreview(summary, dataUrl);
    expect(getCachedGoogleDriveProjectPreview(summary)).toBe(dataUrl);
    expect(getCachedGoogleDriveProjectPreview({ ...summary, projectRevision: 'c'.repeat(64) })).toBeNull();
    expect(getCachedGoogleDriveProjectPreview({ ...summary, providerRevision: `head:${'d'.repeat(64)}` })).toBeNull();
    clearCachedGoogleDriveProjectPreviews();
  });

  it('lets a revision-matched CardForge preview supersede the native first-card thumbnail', () => {
    clearCachedGoogleDriveProjectPreviews();
    const summary = {
      provider: 'google-drive' as const,
      fileId: 'drive_preview_456',
      name: 'Rich Set',
      providerRevision: `head:${'1'.repeat(64)}`,
      projectRevision: '2'.repeat(64),
      modifiedAt: '2026-09-29T00:00:00.000Z',
      size: 1024,
      webViewLink: null,
      thumbnailLink: 'https://drive.google.com/native-first-card.png',
      workId: null,
      capabilities: {
        canDownload: true, canEdit: true, canModifyContent: true, canTrash: true, canDelete: true,
      },
    };
    const richPreview = 'data:image/png;base64,cmljaA==';
    cacheGoogleDriveProjectPreview(summary, richPreview);
    expect(applyCachedGoogleDriveProjectPreviews({
      connection: {
        provider: 'google-drive',
        configured: true,
        connected: true,
        displayName: 'Drive',
        rootFolderId: 'folder',
        status: 'active',
        statusNote: null,
        lastVerifiedAt: '2026-09-29T00:00:00.000Z',
      },
      projects: [summary],
    }).projects[0]?.thumbnailLink).toBe(richPreview);
    clearCachedGoogleDriveProjectPreviews();
  });

  it.each([
    [{ currentProviderRevision: '7', currentProjectRevision: 'a'.repeat(64), expectedProviderRevision: '7', expectedProjectRevision: 'a'.repeat(64) }, false],
    [{ currentProviderRevision: '8', currentProjectRevision: 'a'.repeat(64), expectedProviderRevision: '7', expectedProjectRevision: 'a'.repeat(64) }, true],
    [{ currentProviderRevision: '7', currentProjectRevision: 'b'.repeat(64), expectedProviderRevision: '7', expectedProjectRevision: 'a'.repeat(64) }, true],
    [{ currentProviderRevision: '7', currentProjectRevision: 'a'.repeat(64), expectedProviderRevision: null, expectedProjectRevision: null }, true],
  ])('detects provider and package revision conflicts', (revisions, expected) => {
    expect(hasGoogleDriveProjectRevisionConflict(revisions)).toBe(expected);
  });
});
