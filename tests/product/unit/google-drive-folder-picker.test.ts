import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  disconnectBinding: vi.fn(),
  pickItems: vi.fn(),
}));

vi.mock('@/features/project/client/googleDrivePicker', () => ({
  pickGoogleDriveItems: mocks.pickItems,
}));

vi.mock('@/features/project/client/googleDriveProjectTransfer', () => ({
  disconnectGoogleDriveProjectBinding: mocks.disconnectBinding,
}));

import { GOOGLE_DRIVE_FOLDER_MIME_TYPE } from '@/features/project/model/googleDriveProject';
import { chooseGoogleDriveProjectFolder } from '@/features/project/client/googleDriveFolderPicker';

describe('Google Drive project-folder selection', () => {
  beforeEach(() => {
    mocks.disconnectBinding.mockReset();
    mocks.pickItems.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts a destination change from My Drive instead of the current project folder', async () => {
    mocks.pickItems.mockResolvedValue([{
      id: 'drive_folder_456',
      name: 'New CardForge destination',
      mimeType: GOOGLE_DRIVE_FOLDER_MIME_TYPE,
    }]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({
      id: 'drive_folder_456',
      name: 'New CardForge destination',
      canAddChildren: true,
    })));

    await expect(chooseGoogleDriveProjectFolder()).resolves.toMatchObject({
      id: 'drive_folder_456',
      name: 'New CardForge destination',
    });

    expect(mocks.pickItems).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Choose where CardForge projects live',
      includeFolders: true,
      selectFolders: true,
      initialFolderId: null,
    }));
    expect(mocks.disconnectBinding).toHaveBeenCalledOnce();
  });
});
