import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  GOOGLE_DRIVE_FILE_SCOPE,
  GOOGLE_DRIVE_PROJECT_MIME_TYPE,
  GOOGLE_DRIVE_ROOT_FOLDER_NAME,
} from '@/features/project/server';
import {
  decryptProjectStorageToken,
  encryptProjectStorageToken,
} from '@/features/project/server/projectStorageTokenCrypto';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Google Drive project storage', () => {
  it('uses user-owned per-file Drive authority instead of broad Drive access', () => {
    expect(GOOGLE_DRIVE_FILE_SCOPE).toBe('https://www.googleapis.com/auth/drive.file');
    expect(GOOGLE_DRIVE_PROJECT_MIME_TYPE).toBe('application/vnd.cardforge.project+zip');
    expect(GOOGLE_DRIVE_ROOT_FOLDER_NAME).toBe('CardForge');
    const store = read('src/features/project/server/googleDriveProjectStore.ts');
    expect(store).toContain('GOOGLE_DRIVE_FILE_SCOPE');
    expect(store).not.toContain("'https://www.googleapis.com/auth/drive'");
  });

  it('encrypts refresh credentials independently of provider code', () => {
    const key = Buffer.alloc(32, 7).toString('base64');
    const encrypted = encryptProjectStorageToken('refresh-token-example', key);
    expect(encrypted.ciphertext).not.toContain('refresh-token-example');
    expect(decryptProjectStorageToken(encrypted, key)).toBe('refresh-token-example');
  });

  it('keeps project bytes out of Vercel save request bodies with resumable uploads', () => {
    const serverStore = read('src/features/project/server/googleDriveProjectStore.ts');
    const clientTransfer = read('src/features/project/client/googleDriveProjectTransfer.ts');
    expect(serverStore).toContain("uploadType', 'resumable'");
    expect(serverStore).toContain("response.headers.get('location')");
    expect(clientTransfer).toContain("fetch(plan.uploadSessionUrl");
    expect(clientTransfer).toContain("method: 'PUT'");
  });

  it('stores encrypted provider connections and exact project-source lineage server-side', () => {
    const migration = read('supabase/migrations/20260823154500_google_drive_project_storage.sql');
    expect(migration).toContain('create table if not exists public.cardforge_project_storage_connections');
    expect(migration).toContain('refresh_token_ciphertext');
    expect(migration).toContain('revoke all privileges on table public.cardforge_project_storage_connections');
    expect(migration).toContain('from public, anon, authenticated');
    expect(migration).toContain('source_project_provider');
    expect(migration).toContain('source_provider_revision');
    expect(migration).toContain('source_project_revision');
  });

  it('routes connected storage through generic MCP checkout and commit rather than Drive-specific card tools', () => {
    const aggregator = read('src/features/studio-documents/server/mcpAgentTemplateTools.ts');
    const tools = read('src/features/studio-documents/server/mcpProjectSourceTools.ts');
    const bridge = read('src/features/studio-documents/server/mcpProjectSourceBridge.ts');
    expect(aggregator).toContain('registerProjectSourceTools(options)');
    expect(tools).toContain("'list_connected_projects'");
    expect(tools).toContain("'checkout_project'");
    expect(tools).toContain("'commit_project'");
    expect(bridge).toContain('expectedProviderRevision');
    expect(bridge).toContain('expectedProjectRevision');
    expect(bridge).toContain('expectedDocumentRevision');
    expect(tools).not.toContain('edit_google_drive_card');
  });

  it('keeps connected storage and local folders visible in the account storage surface', () => {
    const account = read('src/app/account/page.tsx');
    expect(account).toContain('LocalProjectFolderPanel');
    expect(account).toContain('GoogleDriveProjectStoragePanel');
  });

  it('uses the native Google Picker for explicit project-folder selection', () => {
    const picker = read('src/features/project/client/googleDriveFolderPicker.ts');
    const pickerStore = read('src/features/project/server/googleDriveFolderPickerStore.ts');
    const accountPanel = read('src/features/storage-management/components/GoogleDriveProjectStoragePanel.tsx');

    expect(picker).toContain("'https://apis.google.com/js/api.js'");
    expect(picker).toContain('.setIncludeFolders(true)');
    expect(picker).toContain('.setSelectFolderEnabled(true)');
    expect(picker).toContain('.setMode(picker.DocsViewMode.LIST)');
    expect(picker).toContain('.setOAuthToken(config.accessToken)');
    expect(picker).toContain('.setDeveloperKey(config.developerKey)');
    expect(picker).toContain('.setAppId(config.appId)');
    expect(pickerStore).toContain('CARDFORGE_GOOGLE_PICKER_API_KEY');
    expect(pickerStore).toContain('CARDFORGE_GOOGLE_CLOUD_PROJECT_NUMBER');
    expect(pickerStore).toContain("url.searchParams.set('fields', 'id,name,mimeType')");
    expect(accountPanel).toContain('chooseGoogleDriveProjectFolder');
    expect(accountPanel).toContain('Existing files were left where they are.');
  });

  it('never treats selecting a Drive folder as permission to recursively crawl pre-existing assets', () => {
    const pickerStore = read('src/features/project/server/googleDriveFolderPickerStore.ts');
    const projectStore = read('src/features/project/server/googleDriveProjectStore.ts');
    const architecture = read('docs/connected-storage-personal-library.md');

    expect(pickerStore).not.toContain('drive.readonly');
    expect(projectStore).not.toContain('drive.readonly');
    expect(architecture).toContain('must **not** be treated as blanket recursive authorization');
    expect(architecture).toContain('use Google Picker to let the user explicitly select one or many files');
  });
});
