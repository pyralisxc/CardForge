import { describe, expect, it } from 'vitest';

import {
  CARD_WATERMARK_URL,
  GENERATED_PREVIEW_WATERMARK_OPACITY,
  GENERATED_PREVIEW_WATERMARK_WIDTH_PERCENT,
  SOCIAL_SHARE_WATERMARK_OPACITY,
  shouldShowVisibleCardWatermark,
} from '@/features/card-rendering/client';

describe('card watermark policy', () => {
  it('brands visible card surfaces only when clean export is unavailable', () => {
    expect(shouldShowVisibleCardWatermark(false)).toBe(true);
    expect(shouldShowVisibleCardWatermark(true)).toBe(false);
  });

  it('uses the approved transparent mark and visual treatment', () => {
    expect(CARD_WATERMARK_URL).toBe('/brand/cardforge-studio/watermark.svg');
    expect(GENERATED_PREVIEW_WATERMARK_OPACITY).toBe(0.24);
    expect(GENERATED_PREVIEW_WATERMARK_WIDTH_PERCENT).toBe(68);
    expect(SOCIAL_SHARE_WATERMARK_OPACITY).toBe(0.28);
  });
});
