import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  CARD_WATERMARK_URL,
  GENERATED_PREVIEW_WATERMARK_OPACITY,
  GENERATED_PREVIEW_WATERMARK_WIDTH_PERCENT,
  SOCIAL_SHARE_WATERMARK_OPACITY,
  shouldShowVisibleCardWatermark,
} from '@/features/card-rendering/client';

describe('card watermark policy', () => {
  it('brands every visible card surface without clean-export entitlement', () => {
    expect(shouldShowVisibleCardWatermark(false)).toBe(true);
    expect(shouldShowVisibleCardWatermark(true)).toBe(false);
  });

  it('uses the approved transparent mark and visual treatment', () => {
    expect(CARD_WATERMARK_URL).toBe('/brand/cardforge-studio/watermark.svg');
    expect(GENERATED_PREVIEW_WATERMARK_OPACITY).toBe(0.24);
    expect(GENERATED_PREVIEW_WATERMARK_WIDTH_PERCENT).toBe(68);
    expect(SOCIAL_SHARE_WATERMARK_OPACITY).toBe(0.28);
  });

  it('keeps entitlement branding out of the shared clean card renderer', () => {
    const cardPreviewSource = readFileSync(
      resolve(process.cwd(), 'src/features/card-rendering/components/CardPreview.tsx'),
      'utf8',
    );
    const cleanExportSource = readFileSync(
      resolve(process.cwd(), 'src/features/card-generator/lib/cardPreviewExport.tsx'),
      'utf8',
    );

    expect(cardPreviewSource).not.toContain('CardWatermarkOverlay');
    expect(cleanExportSource).not.toContain('cardWatermarkPolicy');
    expect(cleanExportSource).not.toContain('CardWatermarkOverlay');
  });

  it('applies owner-configured watermarks to every free finished export path', () => {
    const rendererSource = readFileSync(
      resolve(process.cwd(), 'src/features/card-generator/lib/cardPreviewExport.tsx'),
      'utf8',
    );
    const imageSource = readFileSync(
      resolve(process.cwd(), 'src/features/card-generator/components/ExportCardImageButton.tsx'),
      'utf8',
    );
    const pdfSource = readFileSync(
      resolve(process.cwd(), 'src/features/card-generator/components/SaveAsPdfButton.tsx'),
      'utf8',
    );
    const zipSource = readFileSync(
      resolve(process.cwd(), 'src/features/card-generator/hooks/useCardZipExportActions.ts'),
      'utf8',
    );

    expect(rendererSource).toContain('applyCardExportWatermark(canvas, watermark)');
    expect(rendererSource).toContain('brand.watermarkPreviewOpacity');
    expect(imageSource).toContain('resolveCardExportWatermark(canExportClean, brand)');
    expect(pdfSource).toContain('resolveCardExportWatermark(canExportClean, brand)');
    expect(zipSource).toContain('createCardFaceExportRenderer(exportProfile, richTextHighlightColor, exportWatermark)');
    expect(imageSource).not.toContain('if (gateMessage)');
    expect(pdfSource).not.toContain('if (gateMessage)');
    expect(zipSource).not.toContain('if (!canExportClean)');
  });

  it('applies the entitlement policy at every free-visible Studio card surface', () => {
    const shellSource = readFileSync(
      resolve(process.cwd(), 'src/features/app-shell/components/CardForgeStudioShell.tsx'),
      'utf8',
    );
    const workspaceSource = readFileSync(
      resolve(process.cwd(), 'src/features/card-generator/components/GenerationWorkspace.tsx'),
      'utf8',
    );
    const setDeskSource = readFileSync(
      resolve(process.cwd(), 'src/features/card-generator/components/StudioSetDesk.tsx'),
      'utf8',
    );
    const visualPreviewSource = readFileSync(
      resolve(process.cwd(), 'src/features/card-generator/components/CardVisualPreviewDialog.tsx'),
      'utf8',
    );
    const makerSource = readFileSync(
      resolve(process.cwd(), 'src/features/template-editor/components/CardTemplateMaker.tsx'),
      'utf8',
    );
    const stageSource = readFileSync(
      resolve(process.cwd(), 'src/features/template-editor/components/TemplateCanvasStage.tsx'),
      'utf8',
    );
    const librarySource = readFileSync(
      resolve(process.cwd(), 'src/features/template-editor/components/TemplateLibraryPanel.tsx'),
      'utf8',
    );

    expect(shellSource).toContain('shouldShowVisibleCardWatermark(projectCapabilities.canExportClean)');
    expect(shellSource).toContain('showCardWatermark={showVisibleCardWatermark}');
    expect(workspaceSource).toContain('shouldShowVisibleCardWatermark(canExportClean)');
    expect(workspaceSource).toContain('showGeneratedPreviewWatermark ? <CardWatermarkOverlay testId="deck-front-watermark" /> : null');
    expect(setDeskSource).toContain('showCardWatermark ? <CardWatermarkOverlay testId={`studio-set-desk-watermark-${card.uniqueId}`} /> : null');
    expect(visualPreviewSource).toContain('showWatermark ? <CardWatermarkOverlay testId={`visual-preview-watermark-${card.uniqueId}`} /> : null');
    expect(makerSource).toContain('showCardWatermark={showCardWatermark}');
    expect(stageSource).toContain('showCardWatermark ? <CardWatermarkOverlay testId="template-editor-watermark" /> : null');
    expect(librarySource).toContain('showCardWatermark ? <CardWatermarkOverlay testId="template-library-watermark" /> : null');
  });
});
