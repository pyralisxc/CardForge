export const CARD_WATERMARK_URL = '/brand/cardforge-studio/watermark.svg';
export const GENERATED_PREVIEW_WATERMARK_OPACITY = 0.24;
export const GENERATED_PREVIEW_WATERMARK_WIDTH_PERCENT = 68;
export const SOCIAL_SHARE_WATERMARK_OPACITY = 0.28;

export const shouldShowVisibleCardWatermark = (canExportClean: boolean): boolean =>
  !canExportClean;
