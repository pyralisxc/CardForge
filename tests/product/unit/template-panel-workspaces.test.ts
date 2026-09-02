import { describe, expect, it } from 'vitest';

import {
  normalizeTemplatePanelSectionMemory,
  touchRecentTemplatePanelContext,
} from '@/features/template-editor/hooks/useTemplatePanelSectionMemory';
import { resolveCanvasFitZoom, resolveCompactWorkspaceSwipe } from '@/features/template-editor/hooks/useTemplateEditorViewport';

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

  it('supports compact touch swipes without treating vertical motion as navigation', () => {
    expect(resolveCompactWorkspaceSwipe({ activePanel: 'canvas', deltaX: 90, deltaY: 12, durationMs: 220 })).toBe('library');
    expect(resolveCompactWorkspaceSwipe({ activePanel: 'canvas', deltaX: -90, deltaY: 12, durationMs: 220 })).toBe('inspector');
    expect(resolveCompactWorkspaceSwipe({ activePanel: 'inspector', deltaX: 90, deltaY: 10, durationMs: 220 })).toBe('canvas');
    expect(resolveCompactWorkspaceSwipe({ activePanel: 'library', deltaX: -90, deltaY: 10, durationMs: 220 })).toBe('canvas');
    expect(resolveCompactWorkspaceSwipe({ activePanel: 'canvas', deltaX: 35, deltaY: 4, durationMs: 220 })).toBeNull();
    expect(resolveCompactWorkspaceSwipe({ activePanel: 'canvas', deltaX: 90, deltaY: 85, durationMs: 220 })).toBeNull();
  });

  it('fits the complete canvas before enabling internal scroll', () => {
    const desktopFit = resolveCanvasFitZoom({ stageWidth: 960, stageHeight: 720, stagePaddingX: 64, stagePaddingY: 64, canvasWidth: 630, canvasHeight: 880 });
    const compactFit = resolveCanvasFitZoom({ stageWidth: 390, stageHeight: 540, stagePaddingX: 16, stagePaddingY: 16, canvasWidth: 630, canvasHeight: 880 });

    expect(desktopFit).toBeLessThanOrEqual((720 - 64 - 98) / 880);
    expect(compactFit).toBeLessThanOrEqual((540 - 16 - 98) / 880);
  });
});
