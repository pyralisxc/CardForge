import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { getCardPreviewLayout } from '@/domain/rendering';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('editor, preview, and export rendering parity', () => {
  it('renders every freeform card from its canonical canvas before scaling the whole surface', () => {
    const canvas = {
      width: 630,
      height: 880,
      gridSize: 10,
      elements: [],
    };

    expect(getCardPreviewLayout({
      targetWidthPx: 1260,
      aspectRatio: '63:88',
      canvas,
      isPrintMode: true,
    })).toEqual({
      renderWidthPx: 630,
      renderHeightPx: 880,
      visualWidthPx: 1260,
      visualHeightPx: 1760,
      visualScale: 2,
    });

    expect(getCardPreviewLayout({
      targetWidthPx: 315,
      aspectRatio: '63:88',
      canvas,
      isPrintMode: false,
    })).toEqual({
      renderWidthPx: 630,
      renderHeightPx: 880,
      visualWidthPx: 315,
      visualHeightPx: 440,
      visualScale: 0.5,
    });
  });

  it('uses CardPreview as the editor visual surface and keeps editable elements interaction-only', () => {
    const stageSource = readSource('src/features/template-editor/components/TemplateCanvasStage.tsx');
    const overlaySource = readSource('src/features/template-editor/components/TemplateEditableElement.tsx');
    const previewSource = readSource('src/features/card-rendering/components/CardPreview.tsx');

    expect(stageSource.match(/<CardPreview/g)).toHaveLength(1);
    expect(stageSource).toContain('interactionOverlay={!previewMode ? (');
    expect(stageSource.indexOf('<CardPreview')).toBeLessThan(stageSource.indexOf('map(renderEditableElement)'));
    expect(previewSource).toContain('{interactionOverlay}');

    expect(overlaySource).not.toContain('<CardTextContent');
    expect(overlaySource).not.toContain('<VectorShapeElement');
    expect(overlaySource).not.toContain('<img');
    expect(overlaySource).not.toContain('appearanceToStyle');
  });
});
