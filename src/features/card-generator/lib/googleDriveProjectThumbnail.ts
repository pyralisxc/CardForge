"use client";

import type { ProjectDocumentV1 } from '@/features/project/client/model';

/** Drive owns thumbnail storage and delivery; the canonical card renderer owns pixels. */
export async function createGoogleDriveProjectThumbnail(project: ProjectDocumentV1): Promise<string | null> {
  const card = project.storedCards[0];
  if (!card) return null;
  const template = project.userTemplates.find((candidate) => candidate.id === card.templateId);
  if (!template) throw new Error('The first card’s Template is unavailable for the Drive preview.');
  const { renderCardToPngBlob } = await import('./cardPreviewExport');
  const blob = await renderCardToPngBlob({ ...card, template }, 'virtual', 150);
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = Math.max(1, Math.round(512 * bitmap.height / bitmap.width));
  try {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('The browser could not create the Drive preview.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png').split(',')[1]!.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } finally {
    bitmap.close();
    canvas.width = 0;
    canvas.height = 0;
  }
}
