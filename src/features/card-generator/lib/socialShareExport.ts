import type { DisplayCard } from '@/types';
import type { ExportMode } from '@/features/card-generator/lib/printValidation';
import { renderCardToCanvas } from '@/lib/cardPreviewExport';

export const SOCIAL_SHARE_PRESETS = {
  square: { label: 'Square post', width: 1080, height: 1080 },
  portrait: { label: 'Portrait post', width: 1080, height: 1350 },
  story: { label: 'Story', width: 1080, height: 1920 },
} as const;

export type SocialSharePreset = keyof typeof SOCIAL_SHARE_PRESETS;

export const getSocialShareLayout = ({
  preset,
  cardWidth,
  cardHeight,
}: {
  preset: SocialSharePreset;
  cardWidth: number;
  cardHeight: number;
}) => {
  const output = SOCIAL_SHARE_PRESETS[preset];
  const horizontalMargin = 92;
  const topMargin = preset === 'story' ? 150 : 72;
  const footerSpace = 150;
  const maxWidth = output.width - horizontalMargin * 2;
  const maxHeight = output.height - topMargin - footerSpace;
  const scale = Math.min(maxWidth / cardWidth, maxHeight / cardHeight);
  const renderedCardWidth = Math.round(cardWidth * scale);
  const renderedCardHeight = Math.round(cardHeight * scale);
  const contentHeight = output.height - topMargin - footerSpace;

  return {
    ...output,
    cardX: Math.round((output.width - renderedCardWidth) / 2),
    cardY: Math.round(topMargin + (contentHeight - renderedCardHeight) / 2),
    cardWidth: renderedCardWidth,
    cardHeight: renderedCardHeight,
    footerY: output.height - 72,
    watermark: 'CardForge • cardforges.com',
  };
};

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
}: {
  card: DisplayCard;
  preset: SocialSharePreset;
  exportMode: ExportMode;
  exportDpi: number;
}): Promise<Blob> => {
  const cardCanvas = await renderCardToCanvas(card, exportMode, exportDpi);
  const layout = getSocialShareLayout({
    preset,
    cardWidth: cardCanvas.width,
    cardHeight: cardCanvas.height,
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
  context.fillStyle = '#f2cf83';
  context.font = '600 34px Georgia, serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(layout.watermark, layout.width / 2, layout.footerY);

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
