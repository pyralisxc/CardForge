import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('account storage library', () => {
  const accountPage = readSource('src/app/account/page.tsx');
  const storageWorkspace = readSource('src/features/storage-management/components/AccountStorageWorkspace.tsx');
  const storageLibrary = readSource('src/features/storage-management/components/AccountStorageLibrary.tsx');
  const unifiedLibrary = readSource('src/features/storage-management/components/UnifiedAccountLibrary.tsx');
  const assistantDraftLibrary = readSource('src/features/storage-management/components/AssistantDraftLibrary.tsx');
  const googleDriveProjects = readSource('src/features/storage-management/components/GoogleDriveProjectStoragePanel.tsx');
  const connectedPersonalLibrary = readSource('src/features/storage-management/components/ConnectedPersonalLibraryPanel.tsx');

  it('makes storage a first-class account surface while preserving project ownership', () => {
    expect(accountPage).toContain("UnifiedAccountLibrary");
    expect(accountPage).toContain("AccountStorageLibrary");
    expect(accountPage).toContain("createProjectPersistenceScope");
    expect(accountPage).not.toContain('cloudSetLimit');
    expect(storageLibrary).toContain("hydrateProjectWorkspaceForScope(persistenceScope)");
    expect(unifiedLibrary).toContain('Your materials and work');
    expect(unifiedLibrary).toContain('Personal');
    expect(unifiedLibrary).toContain('Published');
    expect(unifiedLibrary).toContain('Pipeline');
  });

  it('keeps device and working-draft deletion boundaries explicit', () => {
    expect(storageLibrary).toContain('Remove from device');
    expect(assistantDraftLibrary).toContain('Delete draft');
    expect(storageLibrary).toContain('Shared Templates and assets were left alone');
    expect(assistantDraftLibrary).toContain('Installed local work and provider projects were not deleted');
    expect(assistantDraftLibrary).toContain('Recoverable trash');
    expect(assistantDraftLibrary).toContain('Restore draft');
    expect(storageLibrary).not.toContain('Delete everywhere');
  });

  it('shows browser storage separately from overlapping local set estimates', () => {
    expect(storageLibrary).toContain('getBrowserStorageHealth');
    expect(storageLibrary).toContain('portable estimate');
    expect(storageLibrary).toContain('Portable-size estimates can overlap');
    expect(storageLibrary).not.toContain('cloudSetLimit');
  });

  it('keeps private AI working documents independently manageable', () => {
    expect(assistantDraftLibrary).toContain("fetch('/api/studio-documents'");
    expect(assistantDraftLibrary).toContain("method: 'DELETE'");
    expect(assistantDraftLibrary).toContain('<AlertDialog');
    expect(assistantDraftLibrary).toContain('setPendingDocumentDelete(document)');
    expect(storageLibrary).not.toContain('useCloudSetActions');
    expect(assistantDraftLibrary).toContain('AI &amp; Studio working drafts');
  });

  it('projects every storage lifecycle into one compact Library-owned focused tool', () => {
    expect(storageWorkspace).toContain('LibraryStorageConnectionsTool');
    expect(storageWorkspace).toContain('<CompactSettingRow');
    expect(storageWorkspace).toContain('<Sheet');
    expect(storageWorkspace).toContain("id: 'browser-workspace'");
    expect(storageWorkspace).not.toContain("id: 'cloud-mirrors'");
    expect(storageWorkspace).toContain("id: 'working-drafts'");
    expect(storageWorkspace).toContain("id: 'local-project-folder'");
    expect(storageWorkspace).toContain("id: 'google-drive-projects'");
    expect(storageWorkspace).toContain("id: 'connected-assets'");
    expect(storageWorkspace).not.toContain("id: 'cloud-usage'");
    expect(storageWorkspace).toContain("focusedStorageContent(workspaceStorage, 'device')");
    expect(storageWorkspace).toContain('overlayClassName="z-[95]"');
    expect(storageWorkspace).toContain('className="z-[100]');
    expect(unifiedLibrary).toContain('Nothing moves between locations automatically');
    expect(unifiedLibrary).toContain("status === 'google-drive-connected'");
    expect(unifiedLibrary).toContain("status === 'google-drive-error'");
    expect(storageLibrary).toContain("focus = 'overview'");
    expect(storageLibrary).toContain("focus === 'device'");
    expect(storageLibrary).toContain("focus === 'drafts'");
  });

  it('keeps signed-out connected-storage states actionable', () => {
    expect(googleDriveProjects).toContain("createAuthRouteHref('/sign-in', '/account?section=storage')");
    expect(googleDriveProjects).toContain('Sign in to connect');
    expect(connectedPersonalLibrary).toContain("createAuthRouteHref('/sign-in', '/account?section=storage')");
    expect(connectedPersonalLibrary).toContain('Sign in to connect');
  });
});
