import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { normalizeActiveTab } from '@/features/project/store/workspaceDefaults';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Studio set workspace navigation', () => {
  it('keeps Sets as a first-class persisted Studio destination in an app-level navigation rail', () => {
    const tabs = readSource('src/features/app-shell/lib/studioTabs.tsx');
    const shell = readSource('src/features/app-shell/components/CardForgeStudioShell.tsx');

    expect(normalizeActiveTab('sets')).toBe('sets');
    expect(tabs).toContain("value: 'sets'");
    expect(tabs).toContain("label: 'Sets'");
    expect(shell).toContain('cardforge-studio-workspace-nav');
    expect(shell.indexOf('cardforge-studio-workspace-nav')).toBeLessThan(shell.indexOf('<main className="cardforge-studio-main'));
    expect(shell).toContain('grid-cols-3');
    expect(shell).toContain('value="sets"');
    expect(shell).toContain('data-testid="sets-panel"');
    expect(shell).toContain('<SetLibraryWorkspace');
    expect(shell).toContain('min-h-0 flex-1 overflow-hidden');
    expect(shell).not.toContain('cardforge-studio-context');
    expect(shell).not.toContain('p-4 text-center text-sm text-[#a8946d]');
  });

  it('keeps inactive force-mounted workspaces out of layout while preserving their editor state', () => {
    const tabs = readSource('src/components/ui/tabs.tsx');
    const shell = readSource('src/features/app-shell/components/CardForgeStudioShell.tsx');

    expect(shell).toContain('value="template-maker" forceMount');
    expect(tabs).toContain('data-[state=inactive]:!hidden');
  });

  it('keeps Make Cards generation-only and makes Sets the finished production workspace', () => {
    const makeCards = readSource('src/features/card-generator/components/GenerationWorkspace.tsx');
    const sets = readSource('src/features/card-generator/components/SetLibraryWorkspace.tsx');

    expect(makeCards).toContain('Bulk generation');
    expect(makeCards).toContain('<BulkGenerator');
    expect(makeCards).toContain('Sets to inspect, edit, share, and export');
    expect(makeCards).not.toContain('<GeneratedCardGallery');
    expect(makeCards).not.toContain('<ExportControlsPanel');

    expect(sets).toContain('data-cardforge-set-library="true"');
    expect(sets).toContain('Cards in this set');
    expect(sets).toContain('Editable set');
    expect(sets).toContain('Rendered output');
    expect(sets).toContain('<CardVisualPreviewDialog');
    expect(sets).toContain('<ShareCardButton');
    expect(sets).toContain('<ExportCardImageButton');
    expect(sets).toContain('<ExportControlsPanel');
  });

  it('uses Sets as the production workspace while Account separates inventory from storage control', () => {
    const sets = readSource('src/features/card-generator/components/SetLibraryWorkspace.tsx');
    const accountStorage = readSource('src/features/storage-management/components/AccountStorageLibrary.tsx');
    const accountLibrary = readSource('src/features/storage-management/components/UnifiedAccountLibrary.tsx');
    const accountLibraryProjection = readSource('src/features/storage-management/hooks/useAccountLibraryProjection.ts');

    expect(sets).toContain('useProjectStore');
    expect(sets).not.toContain('useCloudSetActions');
    expect(sets).toContain('useCardTransferActions');
    expect(sets).toContain('Add cards');
    expect(sets).not.toContain('Cloud only');
    expect(sets).not.toContain('AssistantDraftLibrary');
    expect(sets).not.toContain('Browser storage');

    expect(accountLibrary).toContain('useAccountLibraryProjection');
    expect(accountLibraryProjection).toContain('buildAccountLibraryItems');
    expect(accountLibrary).toContain('Locations &amp; connections');
    expect(accountLibrary).toContain('Changes affect only the named location.');
    expect(accountStorage).toContain('CardForge workspace storage');
    expect(accountStorage).toContain('This device');
    expect(accountStorage).not.toContain('CardForge cloud');
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
