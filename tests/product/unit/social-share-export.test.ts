import { describe, expect, it } from 'vitest';

import {
  CARD_WATERMARK_URL,
  SOCIAL_SHARE_WATERMARK_OPACITY,
} from '@/features/card-rendering/client';
import {
  getSocialShareLayout,
  getSocialShareWatermarkPlacement,
  SOCIAL_SHARE_PRESETS,
  SOCIAL_SHARE_WATERMARK_URL,
} from '@/features/card-generator/lib/socialShareExport';

describe('social share export', () => {
  it('provides square, portrait, and story presets', () => {
    expect(SOCIAL_SHARE_PRESETS).toEqual({
      square: { label: 'Square post', width: 1080, height: 1080 },
      portrait: { label: 'Portrait post', width: 1080, height: 1350 },
      story: { label: 'Story', width: 1080, height: 1920 },
    });
  });

  it('centers the card within balanced social margins', () => {
    const layout = getSocialShareLayout({ preset: 'square', cardWidth: 750, cardHeight: 1050 });
    expect(layout.cardX).toBeGreaterThanOrEqual(0);
    expect(layout.cardY).toBeGreaterThanOrEqual(0);
    expect(layout.cardWidth).toBeLessThan(1080);
    expect(layout.cardHeight).toBeLessThan(1080);
    expect(layout.watermark.url).toBe(CARD_WATERMARK_URL);
    expect(layout).not.toHaveProperty('footerY');
  });

  it('uses the repository-approved CardForge Studio watermark', () => {
    expect(SOCIAL_SHARE_WATERMARK_URL).toBe('/brand/cardforge-studio/watermark.svg');
  });

  it.each(Object.keys(SOCIAL_SHARE_PRESETS) as Array<keyof typeof SOCIAL_SHARE_PRESETS>)(
    'places the %s watermark inside the rendered card',
    (preset) => {
      const layout = getSocialShareLayout({ preset, cardWidth: 750, cardHeight: 1050 });
      const watermark = getSocialShareWatermarkPlacement(layout);

      expect(watermark.opacity).toBe(SOCIAL_SHARE_WATERMARK_OPACITY);
      expect(watermark.x).toBeGreaterThanOrEqual(layout.cardX);
      expect(watermark.y).toBeGreaterThanOrEqual(layout.cardY);
      expect(watermark.x + watermark.width).toBeLessThanOrEqual(layout.cardX + layout.cardWidth);
      expect(watermark.y + watermark.height).toBeLessThanOrEqual(layout.cardY + layout.cardHeight);
    },
  );
});
