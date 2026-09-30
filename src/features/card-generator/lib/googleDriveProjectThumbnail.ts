"use client";

import type { DisplayCard } from '@/domain/rendering';
import type { ProjectDocumentV1 } from '@/features/project/client/model';

const MAX_DRIVE_PREVIEW_CARDS = 5;
const PREVIEW_CANVAS_WIDTH = 600;
const PREVIEW_CANVAS_HEIGHT = 740;
const PREVIEW_CARD_WIDTH = 300;

const FAN = [
  { x: 0, y: 18, rotation: 0 },
  { x: -82, y: 10, rotation: -6 },
  { x: 82, y: 12, rotation: 6 },
  { x: -132, y: 28, rotation: -11 },
  { x: 132, y: 30, rotation: 11 },
] as const;

export const getGoogleDriveProjectPreviewCards = (project: ProjectDocumentV1): DisplayCard[] => {
  const templates = new Map(project.userTemplates.flatMap((template) => template.id ? [[template.id, template] as const] : []));
  return project.storedCards.flatMap((card) => {
    const template = templates.get(card.templateId);
    return template ? [{ ...card, template }] : [];
  }).slice(0, MAX_DRIVE_PREVIEW_CARDS);
};

const encodeCanvas = (canvas: HTMLCanvasElement): string => (
  canvas.toDataURL('image/png').split(',')[1]!.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '')
);

/**
 * Drive owns thumbnail storage and delivery; CardForge owns the preview
 * composition. Show enough of the Set to communicate contents without opening
 * or importing the provider-owned project into editable browser state.
 */
export async function createGoogleDriveProjectThumbnail(project: ProjectDocumentV1): Promise<string | null> {
  const cards = getGoogleDriveProjectPreviewCards(project);
  if (!cards.length) return null;

  const { renderCardToPngBlob } = await import('./cardPreviewExport');
  const bitmaps: ImageBitmap[] = [];
  const canvas = document.createElement('canvas');
  canvas.width = PREVIEW_CANVAS_WIDTH;
  canvas.height = PREVIEW_CANVAS_HEIGHT;

  try {
    for (const card of cards) {
      const blob = await renderCardToPngBlob(card, 'virtual', 96);
      bitmaps.push(await createImageBitmap(blob));
    }

    const context = canvas.getContext('2d');
    if (!context) throw new Error('The browser could not create the Drive preview.');

    // Paint outer cards first, then the center/front card.
    const order = cards.length === 1
      ? [0]
      : [4, 3, 2, 1, 0].filter((index) => index < cards.length);

    for (const index of order) {
      const bitmap = bitmaps[index]!;
      const fan = FAN[index]!;
      const width = PREVIEW_CARD_WIDTH;
      const height = Math.max(1, width * bitmap.height / bitmap.width);
      context.save();
      context.translate(PREVIEW_CANVAS_WIDTH / 2 + fan.x, PREVIEW_CANVAS_HEIGHT / 2 + fan.y);
      context.rotate(fan.rotation * Math.PI / 180);
      context.drawImage(bitmap, -width / 2, -height / 2, width, height);
      context.restore();
    }

    return encodeCanvas(canvas);
  } finally {
    bitmaps.forEach((bitmap) => bitmap.close());
    canvas.width = 0;
    canvas.height = 0;
  }
}
