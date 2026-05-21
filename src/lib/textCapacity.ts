import type { FreeformCardElement, TemplateFieldContract } from '@/types';
import { textFontSizePx } from '@/lib/textTools';

export type TextCapacityStatus = 'comfortable' | 'tight' | 'overflow';

export interface TextBlockCapacityEstimate {
  widthPx: number;
  heightPx: number;
  baseFontSizePx: number;
  minFontSizePx: number;
  lineHeightRatio: number;
  maxRowsAtBaseFont: number;
  maxRowsAtMinFont: number;
  maxCharactersAtBaseFont: number;
  maxCharactersAtMinFont: number;
  autoFitEnabled: boolean;
}

export interface StructuredListPressureSummary {
  status: TextCapacityStatus;
  rowCount: number;
  baseRowLimit: number;
  minRowLimit: number;
  message: string;
}

export interface TextValuePressureSummary {
  status: TextCapacityStatus;
  characterCount: number;
  baseCharacterLimit: number;
  minCharacterLimit: number;
  message: string;
}

export interface RenderedTextGeometry {
  clientWidth: number;
  clientHeight: number;
  scrollWidth: number;
  scrollHeight: number;
}

export interface RenderedTextFit {
  fits: boolean;
  overflowsX: boolean;
  overflowsY: boolean;
  overflowX: number;
  overflowY: number;
}

const DEFAULT_LINE_HEIGHT_RATIO = 1.2;
const AVERAGE_CHARACTER_WIDTH_RATIO = 0.55;

const parseLineHeightRatio = (lineHeight?: string | number): number => {
  if (lineHeight === undefined || lineHeight === null || lineHeight === '') return DEFAULT_LINE_HEIGHT_RATIO;
  if (typeof lineHeight === 'number') {
    return Number.isFinite(lineHeight) && lineHeight > 0 ? lineHeight : DEFAULT_LINE_HEIGHT_RATIO;
  }
  const trimmed = lineHeight.trim();
  if (!trimmed) return DEFAULT_LINE_HEIGHT_RATIO;
  if (trimmed.endsWith('px')) return DEFAULT_LINE_HEIGHT_RATIO;
  if (trimmed.endsWith('%')) {
    const percentValue = Number(trimmed.replace('%', ''));
    return Number.isFinite(percentValue) && percentValue > 0
      ? percentValue / 100
      : DEFAULT_LINE_HEIGHT_RATIO;
  }

  const numericValue = Number(trimmed);
  return Number.isFinite(numericValue) && numericValue > 0
    ? numericValue
    : DEFAULT_LINE_HEIGHT_RATIO;
};

const estimateForFontSize = (
  widthPx: number,
  heightPx: number,
  fontSizePx: number,
  lineHeightRatio: number
) => {
  const lineHeightPx = Math.max(1, fontSizePx * lineHeightRatio);
  const maxRows = Math.max(1, Math.floor(heightPx / lineHeightPx));
  const charactersPerLine = Math.max(1, Math.floor(widthPx / Math.max(1, fontSizePx * AVERAGE_CHARACTER_WIDTH_RATIO)));

  return {
    maxRows,
    maxCharacters: maxRows * charactersPerLine,
  };
};

export function estimateTextBlockCapacity(
  element: Pick<FreeformCardElement, 'width' | 'height' | 'fontSize' | 'fontSizePx' | 'lineHeight' | 'textAutoFit' | 'textMinFontSizePx'>,
  contract?: Pick<TemplateFieldContract, 'fontSizePx' | 'lineHeight' | 'textAutoFit' | 'minFontSizePx'>
): TextBlockCapacityEstimate {
  const widthPx = Math.max(1, Math.round(Number(element.width) || 1));
  const heightPx = Math.max(1, Math.round(Number(element.height) || 1));
  const baseFontSizePx = Math.max(1, Math.round(Number(contract?.fontSizePx) || textFontSizePx(element)));
  const autoFitEnabled = Boolean(contract?.textAutoFit ?? element.textAutoFit);
  const minFontSizePx = autoFitEnabled
    ? Math.max(1, Math.min(baseFontSizePx, Math.round(Number(contract?.minFontSizePx ?? element.textMinFontSizePx) || 8)))
    : baseFontSizePx;
  const lineHeightRatio = parseLineHeightRatio(contract?.lineHeight || element.lineHeight);
  const baseEstimate = estimateForFontSize(widthPx, heightPx, baseFontSizePx, lineHeightRatio);
  const minEstimate = estimateForFontSize(widthPx, heightPx, minFontSizePx, lineHeightRatio);

  return {
    widthPx,
    heightPx,
    baseFontSizePx,
    minFontSizePx,
    lineHeightRatio,
    maxRowsAtBaseFont: baseEstimate.maxRows,
    maxRowsAtMinFont: minEstimate.maxRows,
    maxCharactersAtBaseFont: baseEstimate.maxCharacters,
    maxCharactersAtMinFont: minEstimate.maxCharacters,
    autoFitEnabled,
  };
}

export function summarizeStructuredListPressure(
  rowCount: number,
  estimate?: TextBlockCapacityEstimate
): StructuredListPressureSummary | undefined {
  if (!estimate) return undefined;
  const safeRowCount = Math.max(0, rowCount);
  const baseRowLimit = estimate.maxRowsAtBaseFont;
  const minRowLimit = estimate.maxRowsAtMinFont;

  if (safeRowCount <= baseRowLimit) {
    return {
      status: 'comfortable',
      rowCount: safeRowCount,
      baseRowLimit,
      minRowLimit,
      message: `${safeRowCount} ${safeRowCount === 1 ? 'row' : 'rows'} should fit at the template font size. Estimated max: ${baseRowLimit} rows at ${estimate.baseFontSizePx}px.`,
    };
  }

  if (estimate.autoFitEnabled && safeRowCount <= minRowLimit) {
    return {
      status: 'tight',
      rowCount: safeRowCount,
      baseRowLimit,
      minRowLimit,
      message: `${safeRowCount} rows may fit only by shrinking text toward ${estimate.minFontSizePx}px. Base estimate: ${baseRowLimit} rows; shrink-to-fit estimate: ${minRowLimit} rows.`,
    };
  }

  return {
    status: 'overflow',
    rowCount: safeRowCount,
    baseRowLimit,
    minRowLimit,
    message: `${safeRowCount} rows will likely overflow this text box. Estimated limit: ${estimate.autoFitEnabled ? `${minRowLimit} rows with shrink-to-fit` : `${baseRowLimit} rows`}.`,
  };
}

export function summarizeTextValuePressure(
  value: string,
  estimate?: TextBlockCapacityEstimate
): TextValuePressureSummary | undefined {
  if (!estimate) return undefined;
  const characterCount = value.trim().length;
  const baseCharacterLimit = estimate.maxCharactersAtBaseFont;
  const minCharacterLimit = estimate.maxCharactersAtMinFont;

  if (characterCount <= baseCharacterLimit) {
    return {
      status: 'comfortable',
      characterCount,
      baseCharacterLimit,
      minCharacterLimit,
      message: `${characterCount} characters should fit at the template font size. Estimated max: ${baseCharacterLimit} characters at ${estimate.baseFontSizePx}px.`,
    };
  }

  if (estimate.autoFitEnabled && characterCount <= minCharacterLimit) {
    return {
      status: 'tight',
      characterCount,
      baseCharacterLimit,
      minCharacterLimit,
      message: `${characterCount} characters may fit only by shrinking text toward ${estimate.minFontSizePx}px. Base estimate: ${baseCharacterLimit}; shrink-to-fit estimate: ${minCharacterLimit}.`,
    };
  }

  return {
    status: 'overflow',
    characterCount,
    baseCharacterLimit,
    minCharacterLimit,
    message: `${characterCount} characters will likely overflow this text box. Estimated limit: ${estimate.autoFitEnabled ? `${minCharacterLimit} characters with shrink-to-fit` : `${baseCharacterLimit} characters`}.`,
  };
}

export function measureRenderedTextFit(
  geometry: RenderedTextGeometry,
  tolerancePx = 1
): RenderedTextFit {
  const overflowX = Math.max(0, geometry.scrollWidth - geometry.clientWidth);
  const overflowY = Math.max(0, geometry.scrollHeight - geometry.clientHeight);
  const overflowsX = overflowX > tolerancePx;
  const overflowsY = overflowY > tolerancePx;

  return {
    fits: !overflowsX && !overflowsY,
    overflowsX,
    overflowsY,
    overflowX,
    overflowY,
  };
}
