import {
  CARD_WATERMARK_URL,
  GENERATED_PREVIEW_WATERMARK_WIDTH_PERCENT,
  SOCIAL_SHARE_WATERMARK_OPACITY,
} from '@/features/card-rendering/client';
import type { ExportMode } from '@/features/card-generator/lib/printValidation';
import { renderCardToCanvas } from '@/features/card-generator/lib/cardPreviewExport';
import type { DisplayCard } from '@/domain/rendering';

export const SOCIAL_SHARE_PRESETS = {
  square: { label: 'Square post', width: 1080, height: 1080 },
  portrait: { label: 'Portrait post', width: 1080, height: 1350 },
  story: { label: 'Story', width: 1080, height: 1920 },
} as const;

export type SocialSharePreset = keyof typeof SOCIAL_SHARE_PRESETS;
export const SOCIAL_SHARE_WATERMARK_URL = CARD_WATERMARK_URL;

export interface SocialShareWatermark {
  url: string;
  width: number;
  height: number;
  widthPercent: number;
  opacity: number;
}

export const DEFAULT_SOCIAL_SHARE_WATERMARK: SocialShareWatermark = {
  url: SOCIAL_SHARE_WATERMARK_URL,
  width: 1000,
  height: 260,
  widthPercent: GENERATED_PREVIEW_WATERMARK_WIDTH_PERCENT,
  opacity: SOCIAL_SHARE_WATERMARK_OPACITY,
};

export const getSocialShareLayout = ({
  preset,
  cardWidth,
  cardHeight,
  watermark = DEFAULT_SOCIAL_SHARE_WATERMARK,
}: {
  preset: SocialSharePreset;
  cardWidth: number;
  cardHeight: number;
  watermark?: SocialShareWatermark;
}) => {
  const output = SOCIAL_SHARE_PRESETS[preset];
  const horizontalMargin = 92;
  const topMargin = preset === 'story' ? 150 : 72;
  const bottomMargin = topMargin;
  const maxWidth = output.width - horizontalMargin * 2;
  const maxHeight = output.height - topMargin - bottomMargin;
  const scale = Math.min(maxWidth / cardWidth, maxHeight / cardHeight);
  const renderedCardWidth = Math.round(cardWidth * scale);
  const renderedCardHeight = Math.round(cardHeight * scale);
  const contentHeight = output.height - topMargin - bottomMargin;

  return {
    ...output,
    cardX: Math.round((output.width - renderedCardWidth) / 2),
    cardY: Math.round(topMargin + (contentHeight - renderedCardHeight) / 2),
    cardWidth: renderedCardWidth,
    cardHeight: renderedCardHeight,
    watermark,
  };
};

export type SocialShareLayout = ReturnType<typeof getSocialShareLayout>;

export const getSocialShareWatermarkPlacement = (layout: SocialShareLayout) => {
  const width = Math.round(layout.cardWidth * layout.watermark.widthPercent / 100);
  const height = Math.round(width * layout.watermark.height / layout.watermark.width);

  return {
    x: Math.round(layout.cardX + (layout.cardWidth - width) / 2),
    y: Math.round(layout.cardY + (layout.cardHeight - height) / 2),
    width,
    height,
    opacity: layout.watermark.opacity,
  };
};

const loadImage = (source: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('The CardForge watermark could not be loaded.'));
  image.src = source;
});

const canvasToBlob = (canvas: HTMLCanvasElement): Promise<Blob> => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (blob) resolve(blob);
    else reject(new Error('The social image could not be encoded.'));
  }, 'image/png');
});

export const renderSocialShareImage = async ({
  card,
  preset,
  exportMode,
  exportDpi,
  richTextHighlightColor,
  watermark = DEFAULT_SOCIAL_SHARE_WATERMARK,
}: {
  card: DisplayCard;
  preset: SocialSharePreset;
  exportMode: ExportMode;
  exportDpi: number;
  richTextHighlightColor: string;
  watermark?: SocialShareWatermark;
}): Promise<Blob> => {
  const cardCanvas = await renderCardToCanvas(card, exportMode, exportDpi, 'front', richTextHighlightColor);
  const layout = getSocialShareLayout({
    preset,
    cardWidth: cardCanvas.width,
    cardHeight: cardCanvas.height,
    watermark,
  });
  const canvas = document.createElement('canvas');
  canvas.width = layout.width;
  canvas.height = layout.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas rendering is unavailable.');

  const gradient = context.createLinearGradient(0, 0, layout.width, layout.height);
  gradient.addColorStop(0, '#0c0b09');
  gradient.addColorStop(0.55, '#1b1209');
  gradient.addColorStop(1, '#3a2410');
  context.fillStyle = gradient;
  context.fillRect(0, 0, layout.width, layout.height);

  context.save();
  context.shadowColor = 'rgba(0, 0, 0, 0.65)';
  context.shadowBlur = 36;
  context.shadowOffsetY = 18;
  context.drawImage(cardCanvas, layout.cardX, layout.cardY, layout.cardWidth, layout.cardHeight);
  context.restore();

  context.strokeStyle = 'rgba(226, 170, 74, 0.48)';
  context.lineWidth = 2;
  context.strokeRect(38, 38, layout.width - 76, layout.height - 76);
  const watermarkImage = await loadImage(layout.watermark.url);
  const watermarkPlacement = getSocialShareWatermarkPlacement(layout);
  context.save();
  context.globalAlpha = watermarkPlacement.opacity;
  context.drawImage(
    watermarkImage,
    watermarkPlacement.x,
    watermarkPlacement.y,
    watermarkPlacement.width,
    watermarkPlacement.height,
  );
  context.restore();

  return canvasToBlob(canvas);
};

export const downloadSocialShareImage = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
