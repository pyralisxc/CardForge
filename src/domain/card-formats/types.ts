export type StandardCardFormatId =
  | 'poker'
  | 'bridge'
  | 'tarot'
  | 'us-business'
  | 'event-badge'
  | 'ttrpg-reference';

export type CardFormatId = StandardCardFormatId | 'custom';
export type CardMeasurementUnit = 'mm' | 'in' | 'px';

export interface CardFormat {
  id: StandardCardFormatId;
  label: string;
  category: string;
  description: string;
  widthMm: number;
  heightMm: number;
  canvasWidthPx: number;
  canvasHeightPx: number;
  bleedMm: number;
  safeMarginMm: number;
}

export interface TemplateCardFormatSource {
  id?: string | null;
  name?: string;
  formatId?: CardFormatId;
  trimWidthMm?: number;
  trimHeightMm?: number;
  aspectRatio?: string;
  freeformCanvas?: {
    width?: number;
    height?: number;
  };
}

export interface ResolvedTemplateCardFormat {
  formatId: CardFormatId;
  format: CardFormat | null;
  widthMm: number;
  heightMm: number;
  canvasWidthPx: number;
  canvasHeightPx: number;
}

export interface CardFormatMeasurement {
  width: number;
  height: number;
  suffix: CardMeasurementUnit;
  label: string;
}
