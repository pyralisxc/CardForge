import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  normalizeTemplatePanelSectionMemory,
  touchRecentTemplatePanelContext,
} from '@/features/template-editor/hooks/useTemplatePanelSectionMemory';
import { resolveCompactWorkspaceSwipe } from '@/features/template-editor/hooks/useTemplateEditorViewport';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Template panel workspaces', () => {
  it('keeps focused section state valid and filters locked sections that the current layer cannot use', () => {
    expect(normalizeTemplatePanelSectionMemory(
      { activeSectionId: 'typography', pinnedSectionIds: ['typography', 'border', 'missing'] },
      ['source', 'border', 'layout'],
      'source',
    )).toEqual({
      activeSectionId: 'source',
      pinnedSectionIds: ['border'],
    });
  });

  it('retains only the ten most recent layer panel contexts', () => {
    let recent: string[] = [];
    for (let index = 0; index < 12; index += 1) {
      recent = touchRecentTemplatePanelContext(recent, `layer-${index}`, 10);
    }

    expect(recent).toHaveLength(10);
    expect(recent[0]).toBe('layer-11');
    expect(recent).not.toContain('layer-0');
    expect(touchRecentTemplatePanelContext(recent, 'layer-5', 10)[0]).toBe('layer-5');
  });

  it('supports compact touch swipes between Library, Canvas, and Inspector without treating vertical motion as navigation', () => {
    expect(resolveCompactWorkspaceSwipe({ activePanel: 'canvas', deltaX: 90, deltaY: 12, durationMs: 220 })).toBe('library');
    expect(resolveCompactWorkspaceSwipe({ activePanel: 'canvas', deltaX: -90, deltaY: 12, durationMs: 220 })).toBe('inspector');
    expect(resolveCompactWorkspaceSwipe({ activePanel: 'inspector', deltaX: 90, deltaY: 10, durationMs: 220 })).toBe('canvas');
    expect(resolveCompactWorkspaceSwipe({ activePanel: 'library', deltaX: -90, deltaY: 10, durationMs: 220 })).toBe('canvas');
    expect(resolveCompactWorkspaceSwipe({ activePanel: 'canvas', deltaX: 35, deltaY: 4, durationMs: 220 })).toBeNull();
    expect(resolveCompactWorkspaceSwipe({ activePanel: 'canvas', deltaX: 90, deltaY: 85, durationMs: 220 })).toBeNull();
  });

  it('uses one shared focused navigator with subtle pinning, resize snaps, and recent position memory', () => {
    const workspace = readSource('src/features/template-editor/components/TemplatePanelWorkspace.tsx');
    const library = readSource('src/features/template-editor/components/TemplateEditorLibrarySidebar.tsx');
    const inspector = readSource('src/features/template-editor/components/TemplateEditorInspectorSidebar.tsx');
    const styles = readSource('src/features/template-editor/components/TemplatePanelWorkspace.module.css');
    const viewport = readSource('src/features/template-editor/hooks/useTemplateEditorViewport.ts');

    expect(workspace).toContain('role="toolbar"');
    expect(workspace).toContain('active || pinned');
    expect(workspace).toContain("pinned ? 'Unpin' : 'Pin'");
    expect(workspace).toContain('pinnedSections');
    expect(workspace).toContain('visibleSections');
    expect(workspace).toContain('scrollMemoryRef');
    expect(workspace).toContain('MAX_SCROLL_MEMORY_CONTEXTS = 10');
    expect(workspace).toContain('viewport.scrollTo');
    expect(workspace).toContain('role="separator"');
    expect(workspace).toContain('COMPACT_PANEL_SNAP_POINTS = [28, 40, 60]');
    expect(library).toContain('<TemplatePanelWorkspace');
    expect(library).toContain("id: 'templates'");
    expect(library).toContain("id: 'layers'");
    expect(inspector).toContain('<TemplatePanelWorkspace');
    expect(inspector).toContain('maxContexts: 10');
    expect(inspector).toContain('memoryKey={memoryContextKey}');
    expect(inspector).toContain("id: 'layout'");
    expect(inspector).not.toContain('activeTab:');
    expect(inspector).not.toContain('onActiveTabChange');
    expect(styles).toContain('data-mobile-panel="library"');
    expect(styles).toContain('data-mobile-panel="inspector"');
    expect(styles).toContain('var(--cf-mobile-panel-size, 40%)');
    expect(styles).toContain('cardforge-panel-resize-handle');
    expect(styles).toContain('cardforge-workspace-section-header');
    expect(styles).toContain('cardforge-inspector-flow-section-header');
    expect(styles).toContain('orientation: landscape');
    expect(styles).not.toContain('cardforge-mobile-overlay-backdrop');
    expect(styles).not.toContain('cardforge-mobile-menu-close');
    expect(styles).not.toContain('cardforge-mobile-inspector-close');
    expect(viewport).toContain('resolveCompactWorkspaceSwipe');
    expect(viewport).toContain("!target.closest?.('[data-cardforge-canvas=\"true\"]')");
  });

  it('routes Template settings to Library Setup and retires the old Inspector tab/overlay owners', () => {
    const maker = readSource('src/features/template-editor/components/CardTemplateMaker.tsx');

    expect(maker).toContain("onShowTemplateSettings={() => openLibrarySection('setup')}");
    expect(maker).toContain('requestedSectionId={requestedLibrarySectionId}');
    expect(maker).toContain("onClose={() => setMobilePanel('canvas')}");
    expect(maker).not.toContain('activeInspectorTab');
    expect(maker).not.toContain('cardforge-mobile-overlay-backdrop');
    expect(maker).not.toContain('cardforge-mobile-menu-close');
    expect(maker).not.toContain('cardforge-mobile-inspector-close');
  });

  it('makes active mobile Template Studio own the viewport instead of rendering as a website page', () => {
    const presentation = readSource('src/app/cardforgePresentation.css');
    const maker = readSource('src/features/template-editor/components/CardTemplateMaker.tsx');

    expect(presentation).toContain('.cardforge-studio-workspace:has([data-testid="layout-studio-panel"][data-state="active"])');
    expect(presentation).toContain('height: 100dvh');
    expect(presentation).toContain('.cardforge-studio-header > div');
    expect(presentation).toContain('padding: 0 !important;');
    expect(presentation).toContain('> div > footer');
    expect(presentation).toContain('display: none !important;');
    expect(presentation).toContain('.cardforge-template-status-description');
    expect(presentation).toContain('.cardforge-template-status-action');
    expect(presentation).toContain('.cardforge-maker-mobile-switcher');
    expect(presentation).toContain('position: relative !important;');
    expect(presentation).toContain('order: -1;');
    expect(presentation).toContain('padding-top: 0.5rem !important;');
    expect(presentation).not.toContain('padding-top: 3.5rem !important;');
    expect(maker).toContain('cardforge-template-status');
    expect(maker).toContain('cardforge-template-status-description');
  });
});
