import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  CARD_WATERMARK_URL,
  GENERATED_PREVIEW_WATERMARK_OPACITY,
  GENERATED_PREVIEW_WATERMARK_WIDTH_PERCENT,
  SOCIAL_SHARE_WATERMARK_OPACITY,
  shouldShowGeneratedPreviewWatermark,
} from '@/features/card-generator/lib/cardWatermarkPolicy';

describe('card watermark policy', () => {
  it('brands only generated previews without clean-export entitlement', () => {
    expect(shouldShowGeneratedPreviewWatermark(false)).toBe(true);
    expect(shouldShowGeneratedPreviewWatermark(true)).toBe(false);
  });

  it('uses the approved transparent mark and visual treatment', () => {
    expect(CARD_WATERMARK_URL).toBe('/brand/cardforge-studio/watermark.svg');
    expect(GENERATED_PREVIEW_WATERMARK_OPACITY).toBe(0.2);
    expect(GENERATED_PREVIEW_WATERMARK_WIDTH_PERCENT).toBe(68);
    expect(SOCIAL_SHARE_WATERMARK_OPACITY).toBe(0.24);
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

  it('applies the entitlement policy only at generated preview surfaces', () => {
    const workspaceSource = readFileSync(
      resolve(process.cwd(), 'src/features/card-generator/components/GenerationWorkspace.tsx'),
      'utf8',
    );
    const gallerySource = readFileSync(
      resolve(process.cwd(), 'src/features/card-generator/components/GeneratedCardGallery.tsx'),
      'utf8',
    );

    expect(workspaceSource).toContain('shouldShowGeneratedPreviewWatermark(canExportClean)');
    expect(workspaceSource).toContain('showPreviewWatermark={showGeneratedPreviewWatermark}');
    expect(gallerySource).toContain('showPreviewWatermark ? <CardWatermarkOverlay /> : null');
  });
});
