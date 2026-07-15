import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  CARD_WATERMARK_URL,
  GENERATED_PREVIEW_WATERMARK_OPACITY,
  GENERATED_PREVIEW_WATERMARK_WIDTH_PERCENT,
  SOCIAL_SHARE_WATERMARK_OPACITY,
  shouldShowVisibleCardWatermark,
} from '@/features/card-generator/lib/cardWatermarkPolicy';

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
      resolve(process.cwd(), 'src/components/card-forge/CardPreview.tsx'),
      'utf8',
    );
    const cleanExportSource = readFileSync(
      resolve(process.cwd(), 'src/lib/cardPreviewExport.tsx'),
      'utf8',
    );

    expect(cardPreviewSource).not.toContain('CardWatermarkOverlay');
    expect(cleanExportSource).not.toContain('cardWatermarkPolicy');
    expect(cleanExportSource).not.toContain('CardWatermarkOverlay');
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
    const gallerySource = readFileSync(
      resolve(process.cwd(), 'src/features/card-generator/components/GeneratedCardGallery.tsx'),
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
    expect(workspaceSource).toContain('showPreviewWatermark={showGeneratedPreviewWatermark}');
    expect(gallerySource).toContain('showPreviewWatermark ? <CardWatermarkOverlay /> : null');
    expect(makerSource).toContain('showCardWatermark={showCardWatermark}');
    expect(stageSource).toContain('showCardWatermark ? <CardWatermarkOverlay testId="template-editor-watermark" /> : null');
    expect(librarySource).toContain('showCardWatermark ? <CardWatermarkOverlay testId="template-library-watermark" /> : null');
  });
});
