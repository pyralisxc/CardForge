import { describe, expect, it } from 'vitest';

import { GOOGLE_DRIVE_PROJECT_MIME_TYPE } from '@/features/project/model/googleDriveProject';
import { isGoogleDriveProjectFileInFolder } from '@/features/project/server/googleDriveProjectStore';

describe('Google Drive legacy project discovery', () => {
  const selectedFolderId = '1CardForgePreviewFolder123456789';

  it('recognizes an explicitly authorized legacy CardForge project without requiring modern appProperties', () => {
    expect(isGoogleDriveProjectFileInFolder({
      mimeType: GOOGLE_DRIVE_PROJECT_MIME_TYPE,
      parents: [selectedFolderId],
    }, selectedFolderId)).toBe(true);
  });

  it('does not widen discovery beyond the CardForge MIME type and selected folder', () => {
    expect(isGoogleDriveProjectFileInFolder({
      mimeType: 'application/octet-stream',
      parents: [selectedFolderId],
    }, selectedFolderId)).toBe(false);
    expect(isGoogleDriveProjectFileInFolder({
      mimeType: GOOGLE_DRIVE_PROJECT_MIME_TYPE,
      parents: ['1DifferentFolder123456789'],
    }, selectedFolderId)).toBe(false);
  });
});