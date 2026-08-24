import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('account storage library', () => {
  const accountPage = readSource('src/app/account/page.tsx');
  const storageLibrary = readSource('src/features/storage-management/components/AccountStorageLibrary.tsx');
  const unifiedLibrary = readSource('src/features/storage-management/components/UnifiedAccountLibrary.tsx');
  const assistantDraftLibrary = readSource('src/features/storage-management/components/AssistantDraftLibrary.tsx');

  it('makes storage a first-class account surface while preserving project ownership', () => {
    expect(accountPage).toContain("UnifiedAccountLibrary");
    expect(accountPage).toContain("AccountStorageLibrary");
    expect(accountPage).toContain("createProjectPersistenceScope");
    expect(accountPage).toContain("entitlement.capabilities.cloudSetLimit");
    expect(storageLibrary).toContain("hydrateProjectWorkspaceForScope(persistenceScope)");
    expect(unifiedLibrary).toContain('One inventory across this device, CardForge Cloud, Google Drive, local project folders, and private working drafts.');
  });

  it('keeps device, cloud, and working-draft deletion boundaries explicit', () => {
    expect(storageLibrary).toContain('Remove from device');
    expect(storageLibrary).toContain('Remove cloud');
    expect(assistantDraftLibrary).toContain('Delete draft');
    expect(storageLibrary).toContain('Shared Templates/assets and any cloud backup were left alone');
    expect(storageLibrary).toContain('Copies already on your devices will remain');
    expect(assistantDraftLibrary).toContain('Installed local work and cloud sets were not deleted');
    expect(assistantDraftLibrary).toContain('Recoverable trash');
    expect(assistantDraftLibrary).toContain('Restore draft');
    expect(storageLibrary).not.toContain('Delete everywhere');
  });

  it('shows exact aggregate storage separately from overlapping local set estimates', () => {
    expect(storageLibrary).toContain('getBrowserStorageHealth');
    expect(storageLibrary).toContain('portable estimate');
    expect(storageLibrary).toContain('Portable-size estimates can overlap');
    expect(storageLibrary).toContain('storageBytes');
    expect(storageLibrary).toContain('Slot limits are separate from byte usage');
  });

  it('keeps account cloud saves and private AI working documents independently manageable', () => {
    expect(assistantDraftLibrary).toContain("fetch('/api/studio-documents'");
    expect(assistantDraftLibrary).toContain("method: 'DELETE'");
    expect(assistantDraftLibrary).toContain('<AlertDialog');
    expect(assistantDraftLibrary).toContain('setPendingDocumentDelete(document)');
    expect(storageLibrary).toContain('useCloudSetActions');
    expect(assistantDraftLibrary).toContain('AI &amp; Studio working drafts');
    expect(storageLibrary).toContain('Cloud sets');
  });
});
