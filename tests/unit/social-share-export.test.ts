import { describe, expect, it } from 'vitest';

import {
  getSocialShareLayout,
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

  it('centers the card while reserving a branded attribution footer', () => {
    const layout = getSocialShareLayout({ preset: 'square', cardWidth: 750, cardHeight: 1050 });
    expect(layout.cardX).toBeGreaterThanOrEqual(0);
    expect(layout.cardY).toBeGreaterThanOrEqual(0);
    expect(layout.cardWidth).toBeLessThan(1080);
    expect(layout.cardHeight).toBeLessThan(1080);
    expect(layout.watermarkUrl).toBe('/brand/cardforge-studio/watermark.svg');
    expect(layout.footerY).toBeGreaterThan(layout.cardY + layout.cardHeight);
  });

  it('uses the repository-approved CardForge Studio watermark', () => {
    expect(SOCIAL_SHARE_WATERMARK_URL).toBe('/brand/cardforge-studio/watermark.svg');
  });
});
