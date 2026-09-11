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

import { PROJECT_LIBRARY_CHANGE_EVENT } from '@/features/project/client/assets';
import { GOOGLE_DRIVE_FOLDER_MIME_TYPE, GOOGLE_DRIVE_PROJECT_MIME_TYPE } from '@/features/project/model/googleDriveProject';
import {
  authorizeExistingGoogleDriveProjects,
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

  it('starts a destination change from My Drive, forwards a Picker resource key, and refreshes project discovery', async () => {
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
    const windowTarget = new EventTarget();
    const refreshListener = vi.fn();
    windowTarget.addEventListener(PROJECT_LIBRARY_CHANGE_EVENT, refreshListener);
    vi.stubGlobal('window', windowTarget);

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
    expect(refreshListener).toHaveBeenCalledOnce();
  });

  it('opens a folder-scoped multiselect Picker to authorize existing CardForge projects without broad Drive access', async () => {
    mocks.pickItems.mockResolvedValue([
      { id: 'drive_project_1', name: 'One.cardforge', mimeType: GOOGLE_DRIVE_PROJECT_MIME_TYPE },
      { id: 'drive_project_2', name: 'Two.cardforge', mimeType: GOOGLE_DRIVE_PROJECT_MIME_TYPE },
    ]);
    const windowTarget = new EventTarget();
    const refreshListener = vi.fn();
    windowTarget.addEventListener(PROJECT_LIBRARY_CHANGE_EVENT, refreshListener);
    vi.stubGlobal('window', windowTarget);

    await expect(authorizeExistingGoogleDriveProjects('drive_folder_456')).resolves.toBe(2);
    expect(mocks.pickItems).toHaveBeenCalledWith({
      title: 'Add existing CardForge projects from this folder',
      mimeTypes: [GOOGLE_DRIVE_PROJECT_MIME_TYPE],
      includeFolders: false,
      selectFolders: false,
      multiselect: true,
      initialFolderId: 'drive_folder_456',
    });
    expect(refreshListener).toHaveBeenCalledOnce();
  });

  it('does not refresh discovery when the creator cancels existing-project authorization', async () => {
    mocks.pickItems.mockResolvedValue(null);
    const windowTarget = new EventTarget();
    const refreshListener = vi.fn();
    windowTarget.addEventListener(PROJECT_LIBRARY_CHANGE_EVENT, refreshListener);
    vi.stubGlobal('window', windowTarget);

    await expect(authorizeExistingGoogleDriveProjects('drive_folder_456')).resolves.toBeNull();
    expect(refreshListener).not.toHaveBeenCalled();
  });

  it('creates a project folder through CardForge, makes it active, and refreshes project discovery', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 'drive_folder_created',
      name: 'CardForge Shared QA',
      resourceKey: null,
      canAddChildren: true,
    }), { status: 201, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const windowTarget = new EventTarget();
    const refreshListener = vi.fn();
    windowTarget.addEventListener(PROJECT_LIBRARY_CHANGE_EVENT, refreshListener);
    vi.stubGlobal('window', windowTarget);

    await expect(createGoogleDriveProjectFolder('CardForge Shared QA')).resolves.toMatchObject({
      id: 'drive_folder_created',
      name: 'CardForge Shared QA',
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/project-sources/google-drive', expect.objectContaining({
      method: 'POST',
    }));
    expect(JSON.parse(fetchMock.mock.calls[0]![1]!.body as string)).toEqual({ folderName: 'CardForge Shared QA' });
    expect(mocks.disconnectBinding).toHaveBeenCalledOnce();
    expect(refreshListener).toHaveBeenCalledOnce();
  });
});