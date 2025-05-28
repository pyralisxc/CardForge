
export type CardSectionType =
  | 'CardName'
  | 'ManaCost'
  | 'Artwork'
  | 'TypeLine'
  | 'RulesText'
  | 'FlavorText'
  | 'PowerToughness'
  | 'ArtistCredit'
  | 'CustomText'
  | 'Divider';

export interface CardSection {
  id: string;
  type: CardSectionType;
  contentPlaceholder: string;

  textColor?: string;
  backgroundColor?: string;
  fontFamily?: string;
  fontSize?: 'text-xs' | 'text-sm' | 'text-base' | 'text-lg' | 'text-xl' | 'text-2xl';
  fontWeight?: 'font-normal' | 'font-medium' | 'font-semibold' | 'font-bold';
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  fontStyle?: 'normal' | 'italic';
  padding?: string;
  borderColor?: string; // This was the name before defaultSectionBorderColor
  borderWidth?: string;
  minHeight?: string;
  flexGrow?: number;
  customHeight?: string;
  customWidth?: string;
}

export interface CardRow {
  id: string;
  columns: CardSection[];
  alignItems?: 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline';
  customHeight?: string;
}

// CardBorderStyle type is removed as it was part of the overhaul
// export type CardBorderStyle = 'solid' | 'dashed' | 'dotted' | 'double' | 'none';

export interface TCGCardTemplate {
  id: string;
  name: string;
  aspectRatio: string;
  legacyFrameColor?: string; // Reverted state included this
  borderColor?: string; // Reverted state: general border color for sections/fallback
  baseBackgroundColor?: string;
  baseTextColor?: string;
  frameStyle?: string;
  rows: CardRow[];

  // The following were added in the overhaul, so they are removed:
  // cardBorderColor?: string;
  // cardBorderWidth?: string;
  // cardBorderStyle?: CardBorderStyle;
  // cardBorderRadius?: string;
}

export interface CardData {
  [key: string]: string | number | undefined;
}

export interface PaperSize {
  name: string;
  widthMm: number;
  heightMm: number;
}

export interface DisplayCard {
  template: TCGCardTemplate;
  data: CardData;
  uniqueId: string;
}

export interface AbilityContextSet {
  id: string;
  name: string;
  description: string;
}
