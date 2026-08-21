import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('shared CardForge interaction architecture', () => {
  it('gives the Studio one desktop viewport owner instead of per-pane viewport arithmetic', () => {
    const studioShell = readSource('src/features/app-shell/components/CardForgeStudioShell.tsx');
    const maker = readSource('src/features/template-editor/components/CardTemplateMaker.tsx');
    const library = readSource('src/features/template-editor/components/TemplateEditorLibrarySidebar.tsx');
    const inspector = readSource('src/features/template-editor/components/TemplateEditorInspectorSidebar.tsx');
    const canvas = readSource('src/features/template-editor/components/TemplateCanvasStage.tsx');
    const gallery = readSource('src/features/card-generator/components/GeneratedCardGallery.tsx');
    const globals = readSource('src/app/globals.css');

    expect(studioShell).toContain('cardforge-application-viewport');
    expect(studioShell).toContain('cardforge-studio-workspace');

    for (const source of [maker, library, inspector, canvas, gallery]) {
      expect(source).not.toMatch(/calc\(100vh\s*-/u);
    }

    expect(globals).not.toContain('height: calc(100vh - 205px) !important;');
    expect(globals).not.toContain('height: calc(100vh - 238px) !important;');
    expect(globals).not.toContain('min-height: 760px !important;');
    expect(globals).not.toContain('min-height: 720px !important;');
  });

  it('uses one constrained scrolling-dialog contract for long modal editors', () => {
    const dialog = readSource('src/components/ui/scrollable-dialog.tsx');
    const editCard = readSource('src/features/card-generator/components/EditCardDialog.tsx');

    expect(dialog).toContain('min-h-0');
    expect(dialog).toContain('flex-1');
    expect(editCard).toContain('ScrollableDialogContent');
    expect(editCard).toContain('ScrollableDialogBody');
    expect(editCard).not.toContain('<ScrollArea className="flex-grow');
  });

  it('centralizes recurring CardForge surfaces, section introductions, status, and workspace navigation', () => {
    const primitives = readSource('src/components/ui/cardforge-presentation.tsx');
    const owner = readSource('src/features/owner/components/OwnerConsolePage.tsx');
    const developer = readSource('src/features/developer-cockpit/components/DeveloperCockpitPage.tsx');
    const account = readSource('src/features/account/components/AccountProfilePage.tsx');

    expect(primitives).toContain('CardForgeSurface');
    expect(primitives).toContain('CardForgeSectionIntro');
    expect(primitives).toContain('CardForgeStatusBadge');
    expect(primitives).toContain('CardForgeWorkspaceNavigation');
    expect(primitives).toContain('CardForgeWorkspaceState');

    expect(owner).toContain('CardForgeWorkspaceNavigation');
    expect(owner).not.toContain('function WorkspaceIntroduction');
    expect(developer).toContain('CardForgeWorkspaceNavigation');
    expect(developer).not.toContain('function LazyWorkspace');
    expect(account).toContain('CardForgeSectionIntro');
    expect(account).not.toContain('function SectionHeading');
    expect(account).not.toContain('function SummaryCard');
  });

  it('defines semantic CardForge presentation tokens as the shared branding seam', () => {
    const globals = readSource('src/app/globals.css');
    const makerTheme = readSource('src/features/template-editor/lib/makerTheme.ts');

    for (const token of [
      '--cf-canvas',
      '--cf-surface',
      '--cf-surface-inset',
      '--cf-surface-raised',
      '--cf-border',
      '--cf-text',
      '--cf-text-strong',
      '--cf-text-muted',
      '--cf-accent',
      '--cf-accent-strong',
      '--cf-panel-radius',
    ]) {
      expect(globals).toContain(token);
    }

    expect(globals).toContain('--public-obsidian: var(--cf-canvas);');
    expect(makerTheme).toContain('var(--cf-editor-');
  });
});
