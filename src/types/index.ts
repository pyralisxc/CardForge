
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
  borderColor?: string;
  borderWidth?: string; // Tailwind class e.g. border-2, border-t
  minHeight?: string; // Tailwind class e.g. min-h-[120px]
  flexGrow?: number;
  customHeight?: string; // e.g., "150px", "auto", "50%"
  customWidth?: string; // e.g., "100%", "200px", "auto"
}

export interface CardRow {
  id: string;
  columns: CardSection[];
  alignItems?: 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline';
  customHeight?: string; // e.g., "100px", "20%", "auto"
}

export interface TCGCardTemplate {
  id: string;
  name: string;
  aspectRatio: string; // e.g., "63:88"
  legacyFrameColor?: string | undefined; // For older template compatibility or specific user override
  defaultSectionBorderColor?: string; // Fallback border color for sections
  baseBackgroundColor?: string;
  baseTextColor?: string;
  frameStyle?: string; // e.g., "standard", "classic-gold"
  rows: CardRow[];
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

export interface ExtractedPlaceholder {
  key: string;
  defaultValue?: string;
}
