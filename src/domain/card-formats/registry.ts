import type {
  CardFormat,
  CardFormatId,
  StandardCardFormatId,
  TemplateCardFormatSource,
} from './types';

export const CARD_FORMATS: readonly CardFormat[] = [
  {
    id: 'poker',
    label: 'Poker / TCG',
    category: 'Game card',
    description: 'The common size for trading, collectible, and poker cards.',
    widthMm: 63,
    heightMm: 88,
    canvasWidthPx: 630,
    canvasHeightPx: 880,
    bleedMm: 3,
    safeMarginMm: 4,
  },
  {
    id: 'bridge',
    label: 'Bridge',
    category: 'Game card',
    description: 'A narrower hand-friendly format for cards held in larger sets.',
    widthMm: 57,
    heightMm: 89,
    canvasWidthPx: 570,
    canvasHeightPx: 890,
    bleedMm: 3,
    safeMarginMm: 4,
  },
  {
    id: 'tarot',
    label: 'Tarot',
    category: 'Game card',
    description: 'A tall format suited to tarot, oracle, and character art.',
    widthMm: 70,
    heightMm: 120,
    canvasWidthPx: 700,
    canvasHeightPx: 1200,
    bleedMm: 3,
    safeMarginMm: 5,
  },
  {
    id: 'us-business',
    label: 'US business card',
    category: 'Business',
    description: 'The standard horizontal US business and name-card format.',
    widthMm: 88.9,
    heightMm: 50.8,
    canvasWidthPx: 1050,
    canvasHeightPx: 600,
    bleedMm: 3,
    safeMarginMm: 4,
  },
  {
    id: 'event-badge',
    label: 'Event badge',
    category: 'Business',
    description: 'A portrait credential for events, teams, and access passes.',
    widthMm: 75,
    heightMm: 100,
    canvasWidthPx: 750,
    canvasHeightPx: 1000,
    bleedMm: 3,
    safeMarginMm: 5,
  },
  {
    id: 'ttrpg-reference',
    label: 'TTRPG sheet (US Letter)',
    category: 'Reference',
    description: 'A full-page US Letter sheet for characters, encounters, and rules references.',
    widthMm: 215.9,
    heightMm: 279.4,
    canvasWidthPx: 850,
    canvasHeightPx: 1100,
    bleedMm: 3,
    safeMarginMm: 5,
  },
] as const;

const CARD_FORMATS_BY_ID = new Map<StandardCardFormatId, CardFormat>(
  CARD_FORMATS.map((format) => [format.id, format]),
);

const LEGACY_RATIO_FORMATS: Readonly<Record<string, StandardCardFormatId>> = {
  '63:88': 'poker',
  '57:89': 'bridge',
  '70:120': 'tarot',
  '35:20': 'us-business',
  '3:4': 'event-badge',
  '75:100': 'event-badge',
  '85:110': 'ttrpg-reference',
  '8.5:11': 'ttrpg-reference',
  '215.9:279.4': 'ttrpg-reference',
};

const round = (value: number, precision = 3): number => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

const isPositive = (value: unknown): value is number => Number.isFinite(Number(value)) && Number(value) > 0;

const findFormatByCanvas = (width?: number, height?: number): CardFormat | undefined => (
  CARD_FORMATS.find((format) => (
    isPositive(width)
    && isPositive(height)
    && Math.abs(format.canvasWidthPx - Number(width)) <= 1
    && Math.abs(format.canvasHeightPx - Number(height)) <= 1
  ))
);

const findFormatByTrim = (width?: number, height?: number): CardFormat | undefined => (
  CARD_FORMATS.find((format) => (
    isPositive(width)
    && isPositive(height)
    && Math.abs(format.widthMm - Number(width)) <= 0.05
    && Math.abs(format.heightMm - Number(height)) <= 0.05
  ))
);

const getLegacyRatioParts = (aspectRatio?: string): { width: number; height: number } => {
  const [width, height] = String(aspectRatio || '63:88').split(':').map(Number);
  return {
    width: isPositive(width) ? width : 63,
    height: isPositive(height) ? height : 88,
  };
};

export const getCardFormat = (id?: CardFormatId | null): CardFormat | null => (
  id && id !== 'custom' ? CARD_FORMATS_BY_ID.get(id) || null : null
);

export const resolveTemplateCardFormat = (
  source: TemplateCardFormatSource,
): import('./types').ResolvedTemplateCardFormat => {
  const explicitFormat = getCardFormat(source.formatId);
  const matchingTrim = findFormatByTrim(source.trimWidthMm, source.trimHeightMm);
  const matchingCanvas = findFormatByCanvas(source.freeformCanvas?.width, source.freeformCanvas?.height);
  const legacyFormatId = LEGACY_RATIO_FORMATS[String(source.aspectRatio || '')];
  const inferredFormat = explicitFormat
    || matchingTrim
    || matchingCanvas
    || (legacyFormatId ? getCardFormat(legacyFormatId) : null);

  if (inferredFormat && source.formatId !== 'custom') {
    const hasExplicitTrim = isPositive(source.trimWidthMm) && isPositive(source.trimHeightMm);
    return {
      formatId: inferredFormat.id,
      format: inferredFormat,
      widthMm: hasExplicitTrim ? round(Number(source.trimWidthMm)) : inferredFormat.widthMm,
      heightMm: hasExplicitTrim ? round(Number(source.trimHeightMm)) : inferredFormat.heightMm,
      canvasWidthPx: isPositive(source.freeformCanvas?.width)
        ? Number(source.freeformCanvas?.width)
        : inferredFormat.canvasWidthPx,
      canvasHeightPx: isPositive(source.freeformCanvas?.height)
        ? Number(source.freeformCanvas?.height)
        : inferredFormat.canvasHeightPx,
    };
  }

  const ratio = getLegacyRatioParts(source.aspectRatio);
  const widthMm = isPositive(source.trimWidthMm)
    ? Number(source.trimWidthMm)
    : ratio.width >= 20 && ratio.height >= 20
      ? ratio.width
      : round((ratio.width / ratio.height) * 88);
  const heightMm = isPositive(source.trimHeightMm)
    ? Number(source.trimHeightMm)
    : ratio.width >= 20 && ratio.height >= 20
      ? ratio.height
      : 88;

  return {
    formatId: 'custom',
    format: null,
    widthMm: round(widthMm),
    heightMm: round(heightMm),
    canvasWidthPx: isPositive(source.freeformCanvas?.width)
      ? Number(source.freeformCanvas?.width)
      : Math.max(1, Math.round(widthMm * 10)),
    canvasHeightPx: isPositive(source.freeformCanvas?.height)
      ? Number(source.freeformCanvas?.height)
      : Math.max(1, Math.round(heightMm * 10)),
  };
};
