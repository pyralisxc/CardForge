import { TCG_ASPECT_RATIO } from './constants';
import { resolveTemplateCardFormat, type TemplateCardFormatSource } from '@/domain/card-formats';
import type { DisplayCard } from './types';

export interface CardPhysicalSizeMm {
  widthMm: number;
  heightMm: number;
}

export interface CardProductionGeometryOptions {
  bleedMm?: number;
  safeMarginMm?: number;
}

export interface CardProductionGeometryMm {
  trimWidthMm: number;
  trimHeightMm: number;
  bleedMm: number;
  safeMarginMm: number;
  productionWidthMm: number;
  productionHeightMm: number;
  trimOffsetXmm: number;
  trimOffsetYmm: number;
  safeXmm: number;
  safeYmm: number;
  safeWidthMm: number;
  safeHeightMm: number;
}

export interface CardProductionGeometryPx {
  trimWidthPx: number;
  trimHeightPx: number;
  bleedPx: number;
  safeMarginPx: number;
  productionWidthPx: number;
  productionHeightPx: number;
  trimOffsetXPx: number;
  trimOffsetYPx: number;
  safeXPx: number;
  safeYPx: number;
  safeWidthPx: number;
  safeHeightPx: number;
}

const DEFAULT_CUSTOM_BLEED_MM = 3;
const DEFAULT_CUSTOM_SAFE_MARGIN_MM = 4;

const roundMm = (value: number): number => Math.round(value * 1000) / 1000;

const normalizeProductionMargin = (value: number | undefined, fallback: number): number => (
  Number.isFinite(value) ? Math.max(0, Number(value)) : fallback
);

export const getTemplateProductionGeometryMm = (
  template: TemplateCardFormatSource,
  options: CardProductionGeometryOptions = {},
): CardProductionGeometryMm => {
  const resolved = resolveTemplateCardFormat(template);
  const formatBleedMm = resolved.format?.bleedMm ?? DEFAULT_CUSTOM_BLEED_MM;
  const formatSafeMarginMm = resolved.format?.safeMarginMm ?? DEFAULT_CUSTOM_SAFE_MARGIN_MM;
  const bleedMm = normalizeProductionMargin(options.bleedMm, formatBleedMm);
  const requestedSafeMarginMm = normalizeProductionMargin(options.safeMarginMm, formatSafeMarginMm);
  const safeMarginMm = Math.min(
    requestedSafeMarginMm,
    Math.max(0, Math.min(resolved.widthMm, resolved.heightMm) / 2),
  );
  const productionWidthMm = resolved.widthMm + bleedMm * 2;
  const productionHeightMm = resolved.heightMm + bleedMm * 2;

  return {
    trimWidthMm: roundMm(resolved.widthMm),
    trimHeightMm: roundMm(resolved.heightMm),
    bleedMm: roundMm(bleedMm),
    safeMarginMm: roundMm(safeMarginMm),
    productionWidthMm: roundMm(productionWidthMm),
    productionHeightMm: roundMm(productionHeightMm),
    trimOffsetXmm: roundMm(bleedMm),
    trimOffsetYmm: roundMm(bleedMm),
    safeXmm: roundMm(safeMarginMm),
    safeYmm: roundMm(safeMarginMm),
    safeWidthMm: roundMm(Math.max(0, resolved.widthMm - safeMarginMm * 2)),
    safeHeightMm: roundMm(Math.max(0, resolved.heightMm - safeMarginMm * 2)),
  };
};

export const getTemplateProductionGeometryPx = (
  template: TemplateCardFormatSource,
  pixelsPerInch: number,
  options: CardProductionGeometryOptions = {},
): CardProductionGeometryPx => {
  const geometry = getTemplateProductionGeometryMm(template, options);
  const ppi = Number.isFinite(pixelsPerInch) && pixelsPerInch > 0 ? pixelsPerInch : 300;
  const toPx = (millimeters: number): number => Math.max(0, Math.round((millimeters / 25.4) * ppi));

  return {
    trimWidthPx: Math.max(1, toPx(geometry.trimWidthMm)),
    trimHeightPx: Math.max(1, toPx(geometry.trimHeightMm)),
    bleedPx: toPx(geometry.bleedMm),
    safeMarginPx: toPx(geometry.safeMarginMm),
    productionWidthPx: Math.max(1, toPx(geometry.productionWidthMm)),
    productionHeightPx: Math.max(1, toPx(geometry.productionHeightMm)),
    trimOffsetXPx: toPx(geometry.trimOffsetXmm),
    trimOffsetYPx: toPx(geometry.trimOffsetYmm),
    safeXPx: toPx(geometry.safeXmm),
    safeYPx: toPx(geometry.safeYmm),
    safeWidthPx: Math.max(0, toPx(geometry.safeWidthMm)),
    safeHeightPx: Math.max(0, toPx(geometry.safeHeightMm)),
  };
};

export const getCardProductionGeometryMm = (
  card: DisplayCard,
  options: CardProductionGeometryOptions = {},
): CardProductionGeometryMm => getTemplateProductionGeometryMm(card.template, options);

export const getCardProductionGeometryPx = (
  card: DisplayCard,
  pixelsPerInch: number,
  options: CardProductionGeometryOptions = {},
): CardProductionGeometryPx => getTemplateProductionGeometryPx(card.template, pixelsPerInch, options);

export const getCardAspectParts = (card: DisplayCard): { width: number; height: number } => {
  const canvasWidth = Number(card.template.freeformCanvas?.width);
  const canvasHeight = Number(card.template.freeformCanvas?.height);
  if (canvasWidth > 0 && canvasHeight > 0) {
    return { width: canvasWidth, height: canvasHeight };
  }
  const [aspectW, aspectH] = (card.template.aspectRatio || TCG_ASPECT_RATIO).split(':').map(Number);
  return {
    width: Number.isFinite(aspectW) && aspectW > 0 ? aspectW : 63,
    height: Number.isFinite(aspectH) && aspectH > 0 ? aspectH : 88,
  };
};

export const getCardExportHeightPx = (card: DisplayCard, renderWidthPx: number): number => {
  const { width, height } = getCardAspectParts(card);
  return Math.round((renderWidthPx / width) * height);
};

export interface CardExportDimensionsPx {
  widthPx: number;
  heightPx: number;
}

export const getCardPhysicalSizeMm = (
  card: DisplayCard,
  printableWidthMm?: number,
  printableHeightMm?: number
): CardPhysicalSizeMm => {
  const resolvedFormat = resolveTemplateCardFormat(card.template);
  let widthMm = resolvedFormat.widthMm;
  let heightMm = resolvedFormat.heightMm;

  if (
    printableWidthMm !== undefined &&
    printableHeightMm !== undefined &&
    (widthMm > printableWidthMm || heightMm > printableHeightMm)
  ) {
    const scale = Math.min(printableWidthMm / widthMm, printableHeightMm / heightMm);
    widthMm = Math.round(widthMm * scale * 1000) / 1000;
    heightMm = Math.round(heightMm * scale * 1000) / 1000;
  }

  return { widthMm, heightMm };
};

export const getCardExportDimensionsPx = (
  card: DisplayCard,
  dpi: number
): CardExportDimensionsPx => {
  const { widthMm, heightMm } = getCardPhysicalSizeMm(card);
  const widthPx = Math.max(1, Math.round((widthMm / 25.4) * dpi));
  const heightPx = Math.max(1, Math.round((heightMm / 25.4) * dpi));
  return { widthPx, heightPx };
};