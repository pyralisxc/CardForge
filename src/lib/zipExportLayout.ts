import type { CardFace, DisplayCard } from '@/types';
import type { ExportMode } from '@/lib/printValidation';

export interface ZipExportLabels {
  outputLabel: string;
  folderName: string;
  fileName: string;
}

export interface ZipExportFaceItem {
  card: DisplayCard;
  cardIndex: number;
  face: CardFace;
  path: string;
}

export function getZipExportLabels(exportMode: ExportMode): ZipExportLabels {
  if (exportMode === 'physical') {
    return {
      outputLabel: 'physical print card faces',
      folderName: 'physical-print-card-faces',
      fileName: 'cardforge-physical-print-card-faces.zip',
    };
  }

  return {
    outputLabel: 'digital card images',
    folderName: 'digital-card-images',
    fileName: 'cardforge-digital-card-images.zip',
  };
}

export function getZipSafeCardName(card: DisplayCard, fallbackIndex: number) {
  return (card.data?.cardName || card.data?.name || `card-${fallbackIndex + 1}`)
    .toString()
    .replace(/[^a-z0-9_-]/gi, '_')
    .substring(0, 40);
}

export function getZipExportFaceCount(generatedDisplayCards: DisplayCard[]) {
  return generatedDisplayCards.reduce(
    (count, card) => count + (card.template.backCanvas ? 2 : 1),
    0
  );
}

export function createZipExportManifest(
  generatedDisplayCards: DisplayCard[],
  exportMode: ExportMode
): ZipExportFaceItem[] {
  const { folderName } = getZipExportLabels(exportMode);

  return generatedDisplayCards.flatMap((card, cardIndex) => {
    const faces: CardFace[] = card.template.backCanvas ? ['front', 'back'] : ['front'];
    const safeName = getZipSafeCardName(card, cardIndex);

    return faces.map((face) => ({
      card,
      cardIndex,
      face,
      path: `${folderName}/${String(cardIndex + 1).padStart(3, '0')}_${safeName}_${face}.png`,
    }));
  });
}
