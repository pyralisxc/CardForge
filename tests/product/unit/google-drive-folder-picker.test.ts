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
import {
  chooseGoogleDriveProjectFolder,
  createGoogleDriveProjectFolder,
} from '@/features/project/client/googleDriveFolderPicker';

describe('Google Drive project-folder selection', () => {
  beforeEach(() => {
    mocks.disconnectBinding.mockReset();
    mocks.pickItems.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts a destination change from My Drive and forwards a Picker resource key', async () => {
    mocks.pickItems.mockResolvedValue([{
      id: 'drive_folder_456',
      name: 'New CardForge destination',
      mimeType: GOOGLE_DRIVE_FOLDER_MIME_TYPE,
      resourceKey: 'resource-key-456',
    }]);
    const fetchMock = vi.fn().mockResolvedValue(Response.json({
      id: 'drive_folder_456',
      name: 'New CardForge destination',
      resourceKey: 'resource-key-456',
      canAddChildren: true,
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(chooseGoogleDriveProjectFolder()).resolves.toMatchObject({
      id: 'drive_folder_456',
      name: 'New CardForge destination',
      resourceKey: 'resource-key-456',
    });

    expect(mocks.pickItems).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Choose where CardForge projects live',
      includeFolders: true,
      selectFolders: true,
      initialFolderId: null,
    }));
    expect(JSON.parse(fetchMock.mock.calls[0]![1]!.body as string)).toEqual({
      folderId: 'drive_folder_456',
      resourceKey: 'resource-key-456',
    });
    expect(mocks.disconnectBinding).toHaveBeenCalledOnce();
  });

  it('creates a project folder through CardForge and makes it the active location', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 'drive_folder_created',
      name: 'CardForge Shared QA',
      resourceKey: null,
      canAddChildren: true,
    }), { status: 201, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(createGoogleDriveProjectFolder('CardForge Shared QA')).resolves.toMatchObject({
      id: 'drive_folder_created',
      name: 'CardForge Shared QA',
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/project-sources/google-drive', expect.objectContaining({
      method: 'POST',
    }));
    expect(JSON.parse(fetchMock.mock.calls[0]![1]!.body as string)).toEqual({ folderName: 'CardForge Shared QA' });
    expect(mocks.disconnectBinding).toHaveBeenCalledOnce();
  });
});
