import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('shared CardForge interaction architecture', () => {
  it('gives the Studio one canonical desktop viewport owner instead of per-pane viewport arithmetic', () => {
    const scopedStudio = readSource('src/features/app-shell/components/ScopedCardForgeStudioShell.tsx');
    const presentationCss = readSource('src/app/cardforgePresentation.css');
    const layout = readSource('src/app/layout.tsx');

    expect(scopedStudio).toContain('cardforge-application-viewport');
    expect(scopedStudio).toContain('cardforge-studio-workspace');
    expect(layout).toContain("import './cardforgePresentation.css';");
    expect(presentationCss).toContain('.cardforge-application-viewport');
    expect(presentationCss).toContain('height: 100dvh;');
    expect(presentationCss).toContain('.cardforge-application-viewport .cardforge-maker-scroll');
    expect(presentationCss).toContain('height: 100% !important;');
    expect(presentationCss).toContain('.cardforge-application-viewport .cardforge-canvas-scroll');
    expect(presentationCss).toContain('flex: 1 1 auto;');
    expect(presentationCss).not.toMatch(/calc\(100vh\s*-/u);
  });

  it('uses one constrained scrolling-dialog contract for long modal editors', () => {
    const dialog = readSource('src/components/ui/scrollable-dialog.tsx');
    const editCard = readSource('src/features/card-generator/components/EditCardDialog.tsx');

    expect(dialog).toContain('min-h-0');
    expect(dialog).toContain('flex-1');
    expect(dialog).toContain('max-h-[90dvh]');
    expect(editCard).toContain('ScrollableDialogContent');
    expect(editCard).toContain('ScrollableDialogBody');
    expect(editCard).not.toContain('<ScrollArea className="flex-grow');
  });

  it('centralizes recurring CardForge surfaces, status, workspace navigation, and lazy workspace states', () => {
    const primitives = readSource('src/components/ui/cardforge-presentation.tsx');
    const developer = readSource('src/features/developer-cockpit/components/DeveloperCockpitPage.tsx');
    const backWorkflow = readSource('src/features/app-shell/components/GeneratorBackWorkflowBanner.tsx');
    const scopedStudio = readSource('src/features/app-shell/components/ScopedCardForgeStudioShell.tsx');

    expect(primitives).toContain('CardForgeSurface');
    expect(primitives).toContain('CardForgeSectionIntro');
    expect(primitives).toContain('CardForgeStatusBadge');
    expect(primitives).toContain('CardForgeWorkspaceNavigation');
    expect(primitives).toContain('CardForgeWorkspaceState');

    expect(developer).toContain('CardForgeWorkspaceNavigation');
    expect(developer).toContain('CardForgeWorkspaceState');
    expect(developer).toContain('CardForgeStatusBadge');
    expect(developer).not.toContain('function LazyWorkspace');
    expect(backWorkflow).toContain('CardForgeSurface');
    expect(scopedStudio).toContain('CardForgeWorkspaceState');
  });

  it('defines semantic CardForge presentation tokens as the shared branding seam', () => {
    const presentationCss = readSource('src/app/cardforgePresentation.css');
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
      '--cf-editor-canvas',
      '--cf-editor-surface',
    ]) {
      expect(presentationCss).toContain(token);
    }

    expect(presentationCss).toContain('--public-obsidian: var(--cf-canvas);');
    expect(presentationCss).toContain('--public-border: var(--cf-border);');
    expect(makerTheme).toContain('var(--cf-editor-');
  });
});
