import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('shared CardForge interaction architecture', () => {
  it('gives the Studio one canonical desktop viewport owner instead of per-pane viewport arithmetic', () => {
    const scopedStudio = readSource('src/features/app-shell/components/ScopedCardForgeStudioShell.tsx');
    const presentationCss = readSource('src/app/cardforgePresentation.css');
    const globals = readSource('src/app/globals.css');
    const templateMaker = readSource('src/features/template-editor/components/CardTemplateMaker.tsx');
    const templateCanvas = readSource('src/features/template-editor/components/TemplateCanvasStage.tsx');
    const templateLibrary = readSource('src/features/template-editor/components/TemplateEditorLibrarySidebar.tsx');
    const templateInspector = readSource('src/features/template-editor/components/TemplateEditorInspectorSidebar.tsx');

    expect(scopedStudio).toContain('cardforge-application-viewport');
    expect(scopedStudio).toContain('cardforge-studio-workspace');
    expect(presentationCss).toContain('.cardforge-application-viewport');
    expect(presentationCss).toContain('height: 100dvh;');
    expect(presentationCss).toContain('.cardforge-application-viewport .cardforge-maker-scroll');
    expect(presentationCss).toContain('height: 100% !important;');
    expect(presentationCss).toContain('.cardforge-application-viewport .cardforge-canvas-scroll');
    expect(presentationCss).toContain('flex: 1 1 auto;');
    expect(presentationCss).not.toMatch(/calc\(100vh\s*-/u);
    expect(globals).not.toMatch(/calc\(100vh\s*-/u);
    expect(templateMaker).not.toMatch(/calc\(100vh\s*-/u);
    expect(templateCanvas).not.toMatch(/calc\(100vh\s*-/u);
    expect(templateLibrary).not.toMatch(/calc\(100vh\s*-/u);
    expect(templateInspector).not.toMatch(/calc\(100vh\s*-/u);
  });

  it('keeps mobile application surfaces on the dynamic viewport with deliberate scroll ownership', () => {
    const presentationCss = readSource('src/app/cardforgePresentation.css');
    const mobileControls = readSource('src/features/template-editor/components/MobileCanvasControls.tsx');
    const mobileElementActions = readSource('src/features/template-editor/components/MobileElementActions.tsx');
    const publicHeader = readSource('src/features/public-site/components/PublicSiteHeader.tsx');
    const generatedGallery = readSource('src/features/card-generator/components/GeneratedCardGallery.tsx');

    expect(presentationCss).toContain('@media (max-width: 1023px)');
    expect(presentationCss).toContain('.cardforge-studio-workspace:has([data-testid="layout-studio-panel"][data-state="active"])');
    expect(presentationCss).toContain('height: 100dvh;');
    expect(presentationCss).toContain('grid-template-rows: minmax(0, 1fr);');
    expect(presentationCss).toContain('.cardforge-maker-inspector');
    expect(presentationCss).toContain('height: min(78%, 42rem);');
    expect(presentationCss).toContain('.cardforge-mobile-scroll-surface');
    expect(presentationCss).toContain('-webkit-overflow-scrolling: touch;');
    expect(presentationCss).toContain('touch-action: pan-y;');
    expect(mobileControls).toContain('cardforge-mobile-scroll-surface');
    expect(mobileElementActions).toContain('cardforge-mobile-scroll-surface');
    expect(publicHeader).toContain('cardforge-mobile-scroll-surface');
    expect(publicHeader).toContain('h-dvh');
    expect(generatedGallery).toContain('h-[min(70dvh,44rem)]');
    expect(generatedGallery).toContain('overscroll-y-auto');
    expect(generatedGallery).toContain('[-webkit-overflow-scrolling:touch]');
    expect(mobileControls).not.toContain('svh');
    expect(mobileElementActions).not.toContain('svh');
    expect(publicHeader).not.toContain('h-svh');
    expect(generatedGallery).not.toMatch(/calc\(100vh\s*-/u);
  });

  it('keeps selection, drag, tap-through, long-press, context actions, and multi-touch cancellation under the Template interaction owners', () => {
    const pointerOwner = readSource('src/features/template-editor/hooks/useCanvasPointerInteractions.ts');
    const viewportOwner = readSource('src/features/template-editor/hooks/useTemplateEditorViewport.ts');
    const editableOverlay = readSource('src/features/template-editor/components/TemplateEditableElement.tsx');
    const canvasStage = readSource('src/features/template-editor/components/TemplateCanvasStage.tsx');
    const architecture = readSource('docs/architecture.md');

    expect(pointerOwner).toContain('LONG_PRESS_DURATION_MS');
    expect(pointerOwner).toContain('resolvePointerPressSelection');
    expect(pointerOwner).toContain('handleElementContextMenu');
    expect(pointerOwner).toContain('event.button === 2');
    expect(pointerOwner).toContain('onElementContextAction');
    expect(pointerOwner).toContain('clearActivePress');
    expect(viewportOwner).toContain('touchPointersRef.current.size >= 2');
    expect(viewportOwner).toContain('pointer.cancelDrag()');
    expect(viewportOwner).toContain('event.stopPropagation()');
    expect(editableOverlay).toContain('onElementPointerDown(event, element, onElementContextAction)');
    expect(editableOverlay).toContain('onContextMenu');
    expect(editableOverlay).toContain('event.preventDefault()');
    expect(editableOverlay).not.toContain('onElementContextAction(element)');
    expect(editableOverlay).not.toContain('longPressTimerRef');
    expect(editableOverlay).not.toContain('setTimeout(');
    expect(canvasStage).toContain('Tap again: layer below');
    expect(canvasStage).toContain('Hold or right-click for actions');
    expect(architecture).toContain('tap-through');
    expect(architecture).toContain('Long-press');
    expect(architecture).toContain('right-click');
  });

  it('uses one constrained scrolling-dialog contract for long modal editors', () => {
    const dialog = readSource('src/components/ui/scrollable-dialog.tsx');
    const editCard = readSource('src/features/card-generator/components/EditCardDialog.tsx');

    expect(dialog).toContain('min-h-0');
    expect(dialog).toContain('flex-1');
    expect(dialog).toContain('max-h-[calc(100dvh-1rem)]');
    expect(dialog).toContain('sm:max-h-[90dvh]');
    expect(editCard).toContain('ScrollableDialogContent');
    expect(editCard).toContain('ScrollableDialogBody');
    expect(editCard).not.toContain('<ScrollArea className="flex-grow');
  });

  it('centralizes recurring CardForge surfaces, status, workspace navigation, and lazy workspace states', () => {
    const primitives = readSource('src/components/ui/cardforge-presentation.tsx');
    const owner = readSource('src/features/owner/components/OwnerConsolePage.tsx');
    const backWorkflow = readSource('src/features/app-shell/components/GeneratorBackWorkflowBanner.tsx');
    const scopedStudio = readSource('src/features/app-shell/components/ScopedCardForgeStudioShell.tsx');

    expect(primitives).toContain('CardForgeSurface');
    expect(primitives).toContain('CardForgeSectionIntro');
    expect(primitives).toContain('CardForgeStatusBadge');
    expect(primitives).toContain('CardForgeWorkspaceNavigation');
    expect(primitives).toContain('CardForgeWorkspaceState');
    expect(owner).toContain('CardForgeWorkspaceNavigation');
    expect(owner).toContain('CardForgeWorkspaceState');
    expect(owner).not.toContain('function LazyWorkspace');
    expect(backWorkflow).toContain('CardForgeSurface');
    expect(scopedStudio).toContain('CardForgeWorkspaceState');
  });
});
