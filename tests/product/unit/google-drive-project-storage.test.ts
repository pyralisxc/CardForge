import { describe, expect, it } from 'vitest';

import { hasGoogleDriveProjectRevisionConflict } from '@/features/project/model/googleDriveProject';
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

  it.each([
    [{ currentProviderRevision: '7', currentProjectRevision: 'a'.repeat(64), expectedProviderRevision: '7', expectedProjectRevision: 'a'.repeat(64) }, false],
    [{ currentProviderRevision: '8', currentProjectRevision: 'a'.repeat(64), expectedProviderRevision: '7', expectedProjectRevision: 'a'.repeat(64) }, true],
    [{ currentProviderRevision: '7', currentProjectRevision: 'b'.repeat(64), expectedProviderRevision: '7', expectedProjectRevision: 'a'.repeat(64) }, true],
    [{ currentProviderRevision: '7', currentProjectRevision: 'a'.repeat(64), expectedProviderRevision: null, expectedProjectRevision: null }, true],
  ])('detects provider and package revision conflicts', (revisions, expected) => {
    expect(hasGoogleDriveProjectRevisionConflict(revisions)).toBe(expected);
  });
});
