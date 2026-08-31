import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Google Drive project folder selection', () => {
  it('uses the shared native Google Picker with narrow drive.file authorization', () => {
    const folderPicker = read('src/features/project/client/googleDriveFolderPicker.ts');
    const pickerRuntime = read('src/features/project/client/googleDrivePicker.ts');
    const model = read('src/features/project/model/googleDriveProject.ts');

    expect(model).toContain("GOOGLE_DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file'");
    expect(model).toContain("GOOGLE_DRIVE_FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder'");
    expect(pickerRuntime).toContain("https://apis.google.com/js/api.js");
    expect(pickerRuntime).toContain("gapi.load('picker'");
    expect(pickerRuntime).toContain('setOAuthToken(config.accessToken)');
    expect(pickerRuntime).toContain('setContributorKey(config.contributorKey)');
    expect(pickerRuntime).toContain('setAppId(config.appId)');
    expect(folderPicker).toContain('pickGoogleDriveItems');
    expect(folderPicker).toContain('includeFolders: true');
    expect(folderPicker).toContain('selectFolders: true');
    expect(folderPicker).toContain('mimeTypes: [GOOGLE_DRIVE_FOLDER_MIME_TYPE]');
    expect(folderPicker).toContain('initialFolderId: null');
  });

  it('keeps Picker credentials server-configured and persists only the chosen folder id', () => {
    const store = read('src/features/project/server/googleDriveFolderPickerStore.ts');
    const migration = read('supabase/migrations/20260823154500_google_drive_project_storage.sql');

    expect(store).toContain('CARDFORGE_GOOGLE_PICKER_API_KEY');
    expect(store).toContain('CARDFORGE_GOOGLE_CLOUD_PROJECT_NUMBER');
    expect(store).toContain(".update({\n      root_folder_id: verifiedId,");
    expect(store).toContain("url.searchParams.set('supportsAllDrives', 'true')");
    expect(migration).toContain('root_folder_id text not null');
    expect(migration).not.toContain('access_token');
    expect(migration).not.toContain('picker_api_key');
  });

  it('requires an authenticated CardForge account for both Picker setup and folder selection', () => {
    const pickerRoute = read('src/app/api/project-sources/google-drive/picker-config/route.ts');
    const storageRoute = read('src/app/api/project-sources/google-drive/route.ts');

    expect(pickerRoute).toContain('getGoogleDriveProjectAccount()');
    expect(storageRoute).toContain('getGoogleDriveProjectAccount()');
    expect(storageRoute).toContain('selectGoogleDriveProjectFolder');
  });

  it('surfaces folder selection from Account Storage rather than giving MCP provider credentials', () => {
    const panel = read('src/features/storage-management/components/GoogleDriveProjectStoragePanel.tsx');
    const mcp = read('src/features/studio-documents/server/mcpProjectSourceTools.ts');

    expect(panel).toContain('Choose project folder');
    expect(panel).toContain('chooseGoogleDriveProjectFolder');
    expect(mcp).not.toContain('accessToken');
    expect(mcp).not.toContain('contributorKey');
  });
});
