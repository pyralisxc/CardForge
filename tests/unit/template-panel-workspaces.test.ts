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

  it('uses one shared section navigator for Library and Inspector with lockable multi-section views and session position memory', () => {
    const workspace = readSource('src/features/template-editor/components/TemplatePanelWorkspace.tsx');
    const library = readSource('src/features/template-editor/components/TemplateEditorLibrarySidebar.tsx');
    const inspector = readSource('src/features/template-editor/components/TemplateEditorInspectorSidebar.tsx');
    const styles = readSource('src/features/template-editor/components/TemplatePanelWorkspace.module.css');
    const viewport = readSource('src/features/template-editor/hooks/useTemplateEditorViewport.ts');

    expect(workspace).toContain('role="toolbar"');
    expect(workspace).toContain("pinned ? 'Unlock' : 'Lock'");
    expect(workspace).toContain('pinnedSections');
    expect(workspace).toContain('visibleSections');
    expect(workspace).toContain('scrollMemoryRef');
    expect(workspace).toContain('MAX_SCROLL_MEMORY_CONTEXTS = 10');
    expect(workspace).toContain('viewport.scrollTo');
    expect(library).toContain('<TemplatePanelWorkspace');
    expect(library).toContain("id: 'templates'");
    expect(library).toContain("id: 'layers'");
    expect(inspector).toContain('<TemplatePanelWorkspace');
    expect(inspector).toContain('maxContexts: 10');
    expect(inspector).toContain('memoryKey={memoryContextKey}');
    expect(inspector).toContain("id: 'layout'");
    expect(styles).toContain('data-mobile-panel="library"');
    expect(styles).toContain('data-mobile-panel="inspector"');
    expect(styles).toContain('grid-template-rows: minmax(10rem, 1fr) minmax(13rem, 42%)');
    expect(styles).toContain('orientation: landscape');
    expect(styles).toContain('.cardforge-mobile-overlay-backdrop');
    expect(styles).toContain('display: none !important;');
    expect(viewport).toContain('resolveCompactWorkspaceSwipe');
    expect(viewport).toContain("!target.closest?.('[data-cardforge-canvas=\"true\"]')");
  });
});
