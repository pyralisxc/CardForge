import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const readSource = (relativePath: string) => readFileSync(
  resolve(process.cwd(), relativePath),
  'utf8',
);

describe('responsive feature parity', () => {
  it('uses the shared navigation catalog in Studio and keeps a compact global menu', () => {
    const studioHeader = readSource('src/features/app-shell/components/StudioHeader.tsx');
    const publicInterface = readSource('src/features/public-site/client.ts');
    const navigation = readSource('src/features/public-site/model/publicNavigation.ts');
    const styles = readSource('src/app/globals.css');

    expect(navigation).toContain('STUDIO_NAVIGATION');
    expect(publicInterface).toContain('STUDIO_NAVIGATION');
    expect(studioHeader).toContain('STUDIO_NAVIGATION');
    expect(studioHeader).toContain("@/features/public-site/client");
    expect(studioHeader).not.toContain('const studioNavItems');
    expect(studioHeader).toContain('aria-label="Open global navigation"');
    expect(studioHeader).toContain('xl:hidden');
    expect(studioHeader).toContain('developerCockpitHref');
    expect(studioHeader).toContain('Developer cockpit');
    expect(studioHeader.match(/href=\{developerCockpitHref\}/g)).toHaveLength(2);
    expect(styles).not.toMatch(/\.cardforge-studio-nav\s*\{[\s\S]*?display:\s*none\s*!important;/);
  });

  it('shows the protected developer shortcut only from the safe access projection', () => {
    const shell = readSource('src/features/app-shell/components/CardForgeStudioShell.tsx');
    const publicHeader = readSource('src/features/public-site/components/PublicSiteHeader.tsx');

    expect(shell).toContain('developerCockpitHref={developerAccess.hasCockpitAccess ? developerAccess.cockpitHref : null}');
    expect(publicHeader).toContain('useDeveloperAccess()');
    expect(publicHeader).toContain('developerAccess.hasCockpitAccess');
    expect(publicHeader).toContain('href={developerAccess.cockpitHref}');
    expect(publicHeader).toContain('Developer cockpit');
    expect(publicHeader).toContain('lg:inline-flex');
  });

  it('makes library failures recoverable and asks before retargeting existing cards', () => {
    const shell = readSource('src/features/app-shell/components/CardForgeStudioShell.tsx');
    const dialogs = readSource('src/features/app-shell/components/StudioConfirmationDialogs.tsx');
    const bootstrap = readSource('src/features/app-shell/hooks/useBootstrapLibraries.ts');

    expect(bootstrap).toContain('templateLibraryFailed');
    expect(bootstrap).toContain('styleLibraryFailed');
    expect(bootstrap).toContain('retryLibraries');
    expect(shell).toContain('Some Studio library content did not load');
    expect(shell).toContain('Retry library');
    expect(dialogs).toContain('Use the saved design on existing cards?');
    expect(dialogs).toContain('New cards only');
    expect(dialogs).toContain('Update existing cards');
    expect(shell).toContain('retargetGeneratedCardsTemplateAction');
  });

  it('renders one Studio mode switch at every supported width', () => {
    const shell = readSource('src/features/app-shell/components/CardForgeStudioShell.tsx');

    expect(shell).not.toContain('isMobileMenuOpen');
    expect(shell).not.toContain('Menu (');
    expect(shell).toContain('data-testid={`studio-tab-${tab.value}`}');
    expect(shell).toContain('grid-cols-2');
    expect(shell).not.toContain('hidden w-full');
  });

  it('defines every canvas command once and exposes the registry on compact screens', () => {
    const actions = readSource('src/features/template-editor/lib/templateEditorActions.ts');
    const topBar = readSource('src/features/template-editor/components/TemplateEditorTopBar.tsx');
    const mobileControls = readSource('src/features/template-editor/components/MobileCanvasControls.tsx');

    for (const actionId of [
      'undo',
      'redo',
      'zoom-out',
      'zoom-in',
      'fit',
      'actual-size',
      'center',
      'grid',
      'snap',
      'preview',
      'command-palette',
      'save',
    ]) {
      expect(actions).toContain(`id: '${actionId}'`);
    }

    expect(topBar).toContain('actions: TemplateEditorAction[]');
    expect(mobileControls).toContain('actions: TemplateEditorAction[]');
    expect(mobileControls).toContain('Editor tools');
    expect(mobileControls).toContain('aria-label="Undo"');
    expect(mobileControls).toContain('aria-label="Redo"');
  });

  it('uses a responsive card action rail instead of covering the preview', () => {
    const gallery = readSource('src/features/card-generator/components/GeneratedCardGallery.tsx');

    expect(gallery).toContain("useState<GeneratedGalleryDensity>('comfortable')");
    expect(gallery).toContain('data-testid="generated-card-action-rail"');
    expect(gallery).toContain('aria-label="Preview card face"');
    expect(gallery).toContain('face={visiblePreviewFace}');
    expect(gallery).not.toContain('absolute bottom-2 right-2');
    expect(gallery).not.toContain('absolute right-2 top-2');
  });

  it('uses the shared public header for profile management', () => {
    const profilePage = readSource('src/app/profile/page.tsx');
    const profileManagement = readSource('src/features/account/components/ProfileManagementPage.tsx');

    expect(profilePage).toContain('PublicSiteHeader');
    expect(profilePage).toContain('PublicAuthControls');
    expect(profileManagement).not.toContain('<header');
  });

  it('converges one-card, list, and edit flows on shared field and review owners', () => {
    const singleCard = readSource('src/features/card-generator/components/SingleCardGenerator.tsx');
    const editCard = readSource('src/features/card-generator/components/EditCardDialog.tsx');
    const bulkCards = readSource('src/features/card-generator/components/BulkGenerator.tsx');
    const workspace = readSource('src/features/card-generator/components/GenerationWorkspace.tsx');
    const exportControls = readSource('src/features/card-generator/components/ExportControlsPanel.tsx');

    expect(singleCard).toContain('<GeneratorFieldGroups');
    expect(editCard).toContain('<GeneratorFieldGroups');
    expect(singleCard).toContain('Back Details');
    expect(editCard).toContain('Back Details');
    expect(singleCard).toContain('backingData: finalBackingData');
    expect(editCard).toContain('backingData: finalBackingData');
    expect(bulkCards).toContain('onCardsGenerated(generatedCards)');

    for (const sharedWorkspaceOwner of [
      '<SingleCardGenerator',
      '<BulkGenerator',
      '<GeneratedCardGallery',
      '<ExportControlsPanel',
    ]) {
      expect(workspace).toContain(sharedWorkspaceOwner);
    }

    expect(exportControls).toContain('<SaveAsPdfButton');
    expect(workspace.indexOf('<GeneratedCardGallery')).toBeLessThan(workspace.indexOf('<ExportControlsPanel'));
  });
});
