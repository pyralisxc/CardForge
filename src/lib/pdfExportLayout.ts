import { getCardPhysicalSizeMm } from '@/lib/cardExportGeometry';
import type { CardFace, DisplayCard, PdfDuplexLayout } from '@/types';
import type { ExportMode } from '@/lib/printValidation';

export const MAX_PDF_CARDS_PER_FILE = 500;
export const MAX_TOTAL_PDF_EXPORT_CARDS = 10000;
export const MM_TO_POINTS = 72 / 25.4;

export interface PdfCardPlacement {
  card: DisplayCard;
  face: CardFace;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PdfPlacementOptions {
  forcedFace?: CardFace;
  printableWidthMm: number;
  printableHeightMm: number;
  marginMm: number;
  spacingMm: number;
}

type PdfPlacementItem = DisplayCard | { card: DisplayCard; face: CardFace };

export function getPdfSafeName(templateName?: string, fallbackName = 'tcg-cards') {
  return (templateName || fallbackName)
    .replace(/[^a-zA-Z0-9_\- ]/g, '')
    .trim()
    .replace(/\s+/g, '-') || 'tcg-cards';
}

export function getPdfModeSlug(exportMode: ExportMode, duplexLayout: PdfDuplexLayout) {
  if (exportMode !== 'physical') return 'digital-sheet';
  return duplexLayout === 'same-page' ? 'print-same-sheet' : 'print-duplex-sheets';
}

export function getPdfTotalChunks(cardCount: number) {
  return Math.ceil(cardCount / MAX_PDF_CARDS_PER_FILE);
}

export function createPdfPlacementPages(
  items: PdfPlacementItem[],
  options: PdfPlacementOptions
): PdfCardPlacement[][] {
  const pages: PdfCardPlacement[][] = [];
  let currentPage: PdfCardPlacement[] = [];
  let currentX = options.marginMm;
  let currentY = options.marginMm;
  let currentRowMaxHeightMm = 0;

  for (const item of items) {
    const cardItem = 'card' in item ? item.card : item;
    const face = options.forcedFace ?? ('face' in item ? item.face : 'front');
    const { widthMm: cardWidthMm, heightMm: cardHeightMm } = getCardPhysicalSizeMm(
      cardItem,
      options.printableWidthMm,
      options.printableHeightMm
    );

    if (currentX + cardWidthMm > options.printableWidthMm + options.marginMm && currentPage.length > 0) {
      currentX = options.marginMm;
      currentY += currentRowMaxHeightMm + options.spacingMm;
      currentRowMaxHeightMm = 0;
    }

    if (currentY + cardHeightMm > options.printableHeightMm + options.marginMm && currentPage.length > 0) {
      pages.push(currentPage);
      currentPage = [];
      currentX = options.marginMm;
      currentY = options.marginMm;
      currentRowMaxHeightMm = 0;
    }

    currentPage.push({ card: cardItem, face, x: currentX, y: currentY, w: cardWidthMm, h: cardHeightMm });
    currentRowMaxHeightMm = Math.max(currentRowMaxHeightMm, cardHeightMm);
    currentX += cardWidthMm + options.spacingMm;
  }

  if (currentPage.length > 0) pages.push(currentPage);
  return pages;
}
