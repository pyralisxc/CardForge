import type { CardFace } from '@/domain/cards';
import {
  getCardFaceTemplate,
  getCardPhysicalSizeMm,
  getTemplateProductionGeometryMm,
  hasCardBacking,
} from '@/domain/rendering';
import type { DisplayCard } from '@/domain/rendering';

export const PDF_CROP_MARK_GAP_MM = 0.5;
export const PDF_CROP_MARK_LENGTH_MM = 2.5;

export interface PdfCardPlacement {
  card: DisplayCard;
  face: CardFace;
  imageX: number;
  imageY: number;
  imageWidth: number;
  imageHeight: number;
  trimX: number;
  trimY: number;
  trimWidth: number;
  trimHeight: number;
  bleedMm: number;
  cellWidth: number;
  cellHeight: number;
}

export interface PdfLineSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export class PdfProductionLayoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PdfProductionLayoutError';
  }
}

type PdfLayoutItem = DisplayCard | { card: DisplayCard; face: CardFace };

const getCardLabel = (card: DisplayCard): string => (
  String(card.data?.cardName || card.data?.name || card.template?.name || 'Card')
);

const nearlyEqual = (a: number, b: number): boolean => Math.abs(a - b) <= 0.001;

const resolveItem = (
  item: PdfLayoutItem,
  forcedFace?: CardFace,
): { card: DisplayCard; face: CardFace } => ({
  card: 'card' in item ? item.card : item,
  face: forcedFace ?? ('face' in item ? item.face : 'front'),
});

const createPlacementGeometry = ({
  card,
  face,
  physical,
  includeCutLines,
  printableWidthMm,
  printableHeightMm,
}: {
  card: DisplayCard;
  face: CardFace;
  physical: boolean;
  includeCutLines: boolean;
  printableWidthMm: number;
  printableHeightMm: number;
}) => {
  if (!physical) {
    const size = getCardPhysicalSizeMm(card, printableWidthMm, printableHeightMm);
    return {
      imageWidth: size.widthMm,
      imageHeight: size.heightMm,
      trimOffsetX: 0,
      trimOffsetY: 0,
      trimWidth: size.widthMm,
      trimHeight: size.heightMm,
      bleedMm: 0,
      cropGutter: 0,
    };
  }

  const geometry = getTemplateProductionGeometryMm(getCardFaceTemplate(card, face));
  const cropGutter = includeCutLines ? PDF_CROP_MARK_GAP_MM + PDF_CROP_MARK_LENGTH_MM : 0;
  return {
    imageWidth: geometry.productionWidthMm,
    imageHeight: geometry.productionHeightMm,
    trimOffsetX: geometry.trimOffsetXmm,
    trimOffsetY: geometry.trimOffsetYmm,
    trimWidth: geometry.trimWidthMm,
    trimHeight: geometry.trimHeightMm,
    bleedMm: geometry.bleedMm,
    cropGutter,
  };
};

export const createPdfPlacementPages = ({
  items,
  forcedFace,
  printableWidthMm,
  printableHeightMm,
  marginMm,
  spacingMm,
  physical,
  includeCutLines,
}: {
  items: PdfLayoutItem[];
  forcedFace?: CardFace;
  printableWidthMm: number;
  printableHeightMm: number;
  marginMm: number;
  spacingMm: number;
  physical: boolean;
  includeCutLines: boolean;
}): PdfCardPlacement[][] => {
  const pages: PdfCardPlacement[][] = [];
  let currentPage: PdfCardPlacement[] = [];
  let currentX = marginMm;
  let currentY = marginMm;
  let currentRowMaxHeight = 0;

  for (const rawItem of items) {
    const { card, face } = resolveItem(rawItem, forcedFace);
    const geometry = createPlacementGeometry({
      card,
      face,
      physical,
      includeCutLines,
      printableWidthMm,
      printableHeightMm,
    });
    const cellWidth = geometry.imageWidth + geometry.cropGutter * 2;
    const cellHeight = geometry.imageHeight + geometry.cropGutter * 2;

    if (cellWidth > printableWidthMm || cellHeight > printableHeightMm) {
      throw new PdfProductionLayoutError(
        physical
          ? `${getCardLabel(card)} needs ${cellWidth.toFixed(1)} × ${cellHeight.toFixed(1)} mm including bleed${includeCutLines ? ' and crop-mark clearance' : ''}, but the selected paper/margins provide only ${printableWidthMm.toFixed(1)} × ${printableHeightMm.toFixed(1)} mm. Choose a larger paper size or smaller margins.`
          : `${getCardLabel(card)} cannot fit the selected PDF page.`,
      );
    }

    if (
      currentPage.length > 0
      && currentX + cellWidth > marginMm + printableWidthMm
    ) {
      currentX = marginMm;
      currentY += currentRowMaxHeight + spacingMm;
      currentRowMaxHeight = 0;
    }

    if (
      currentPage.length > 0
      && currentY + cellHeight > marginMm + printableHeightMm
    ) {
      pages.push(currentPage);
      currentPage = [];
      currentX = marginMm;
      currentY = marginMm;
      currentRowMaxHeight = 0;
    }

    const imageX = currentX + geometry.cropGutter;
    const imageY = currentY + geometry.cropGutter;
    currentPage.push({
      card,
      face,
      imageX,
      imageY,
      imageWidth: geometry.imageWidth,
      imageHeight: geometry.imageHeight,
      trimX: imageX + geometry.trimOffsetX,
      trimY: imageY + geometry.trimOffsetY,
      trimWidth: geometry.trimWidth,
      trimHeight: geometry.trimHeight,
      bleedMm: geometry.bleedMm,
      cellWidth,
      cellHeight,
    });
    currentRowMaxHeight = Math.max(currentRowMaxHeight, cellHeight);
    currentX += cellWidth + spacingMm;
  }

  if (currentPage.length > 0) pages.push(currentPage);
  return pages;
};

export const createPdfDuplexBackPage = (
  frontPage: PdfCardPlacement[],
): PdfCardPlacement[] => frontPage.flatMap((front) => {
  if (!hasCardBacking(front.card)) return [];
  const backGeometry = getTemplateProductionGeometryMm(getCardFaceTemplate(front.card, 'back'));
  if (
    !nearlyEqual(front.trimWidth, backGeometry.trimWidthMm)
    || !nearlyEqual(front.trimHeight, backGeometry.trimHeightMm)
    || !nearlyEqual(front.bleedMm, backGeometry.bleedMm)
  ) {
    throw new PdfProductionLayoutError(
      `${getCardLabel(front.card)} has front/back physical geometry that does not match. Duplex sheets require the same trim size and bleed on both faces.`,
    );
  }
  return [{ ...front, face: 'back' as const }];
});

export const getPdfCropMarkSegments = (
  placement: PdfCardPlacement,
): PdfLineSegment[] => {
  if (placement.bleedMm < 0) return [];
  const leftBleedEdge = placement.trimX - placement.bleedMm;
  const rightBleedEdge = placement.trimX + placement.trimWidth + placement.bleedMm;
  const topBleedEdge = placement.trimY - placement.bleedMm;
  const bottomBleedEdge = placement.trimY + placement.trimHeight + placement.bleedMm;
  const outer = PDF_CROP_MARK_GAP_MM + PDF_CROP_MARK_LENGTH_MM;

  return [
    { x1: leftBleedEdge - outer, y1: placement.trimY, x2: leftBleedEdge - PDF_CROP_MARK_GAP_MM, y2: placement.trimY },
    { x1: placement.trimX, y1: topBleedEdge - outer, x2: placement.trimX, y2: topBleedEdge - PDF_CROP_MARK_GAP_MM },
    { x1: rightBleedEdge + PDF_CROP_MARK_GAP_MM, y1: placement.trimY, x2: rightBleedEdge + outer, y2: placement.trimY },
    { x1: placement.trimX + placement.trimWidth, y1: topBleedEdge - outer, x2: placement.trimX + placement.trimWidth, y2: topBleedEdge - PDF_CROP_MARK_GAP_MM },
    { x1: leftBleedEdge - outer, y1: placement.trimY + placement.trimHeight, x2: leftBleedEdge - PDF_CROP_MARK_GAP_MM, y2: placement.trimY + placement.trimHeight },
    { x1: placement.trimX, y1: bottomBleedEdge + PDF_CROP_MARK_GAP_MM, x2: placement.trimX, y2: bottomBleedEdge + outer },
    { x1: rightBleedEdge + PDF_CROP_MARK_GAP_MM, y1: placement.trimY + placement.trimHeight, x2: rightBleedEdge + outer, y2: placement.trimY + placement.trimHeight },
    { x1: placement.trimX + placement.trimWidth, y1: bottomBleedEdge + PDF_CROP_MARK_GAP_MM, x2: placement.trimX + placement.trimWidth, y2: bottomBleedEdge + outer },
  ];
};
