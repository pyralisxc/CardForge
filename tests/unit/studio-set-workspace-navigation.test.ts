import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { normalizeActiveTab } from '@/features/project/store/workspaceDefaults';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Studio set workspace navigation', () => {
  it('keeps Sets as a first-class persisted Studio destination and preserves workspace height', () => {
    const tabs = readSource('src/features/app-shell/lib/studioTabs.tsx');
    const shell = readSource('src/features/app-shell/components/CardForgeStudioShell.tsx');

    expect(normalizeActiveTab('sets')).toBe('sets');
    expect(tabs).toContain("value: 'sets'");
    expect(tabs).toContain("label: 'Sets'");
    expect(shell).toContain('grid-cols-3');
    expect(shell).toContain('value="sets"');
    expect(shell).toContain('data-testid="sets-panel"');
    expect(shell).toContain('<SetLibraryWorkspace');
    expect(shell).toContain('min-h-0 flex-1 overflow-hidden');
    expect(shell).not.toContain('cardforge-studio-context');
    expect(shell).not.toContain('p-4 text-center text-sm text-[#a8946d]');
  });

  it('uses Sets as the production library while Account remains the storage lens', () => {
    const sets = readSource('src/features/card-generator/components/SetLibraryWorkspace.tsx');
    const accountStorage = readSource('src/features/storage-management/components/AccountStorageLibrary.tsx');

    expect(sets).toContain('data-cardforge-set-library="true"');
    expect(sets).toContain('useProjectStore');
    expect(sets).toContain('useCloudSetActions');
    expect(sets).toContain('useCardTransferActions');
    expect(sets).toContain('Make cards');
    expect(sets).toContain('Cards in this set');
    expect(sets).toContain('Cloud only');
    expect(sets).not.toContain('AssistantDraftLibrary');
    expect(sets).not.toContain('Browser storage');

    expect(accountStorage).toContain('Storage &amp; Library');
    expect(accountStorage).toContain('This device');
    expect(accountStorage).toContain('CardForge cloud');
    expect(accountStorage).toContain('AssistantDraftLibrary');
  });

  it('clears temporary Template handoff state when either production workspace is selected', () => {
    const handoffs = readSource('src/features/app-shell/hooks/useTemplateStudioHandoffs.ts');

    expect(handoffs).toContain("if (tab !== 'template-maker')");
    expect(handoffs).toContain('setGeneratorBackWorkflow(null)');
    expect(handoffs).toContain('setPendingGeneratorBackSave(null)');
    expect(handoffs).not.toContain("if (tab === 'generator')");
  });

  it('lazy-loads the set library instead of adding it to the initial Studio bundle', () => {
    const client = readSource('src/features/card-generator/client.ts');
    const lazy = readSource('src/features/app-shell/components/StudioLazyWorkspaces.tsx');

    expect(client).toContain("loadSetLibraryWorkspace = () => import('./components/SetLibraryWorkspace')");
    expect(lazy).toContain('export const SetLibraryWorkspace = dynamic(');
    expect(lazy).toContain('module.loadSetLibraryWorkspace()');
  });
});
