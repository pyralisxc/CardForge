
export interface CardSection {
  id: string;
  contentPlaceholder: string; // User defines this, e.g., "{{cardName}}", "{{rulesText}}", "{{artworkUrl}}"
  backgroundImageUrl?: string; // For section background image, can be a URL or placeholder like "{{bgImage}}"

  // Existing styling properties
  textColor?: string;
  backgroundColor?: string; // For section foreground/content background
  fontFamily?: string;
  fontSize?: 'text-xs' | 'text-sm' | 'text-base' | 'text-lg' | 'text-xl' | 'text-2xl';
  fontWeight?: 'font-normal' | 'font-medium' | 'font-semibold' | 'font-bold';
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  fontStyle?: 'normal' | 'italic';
  padding?: string;
  borderColor?: string;
  borderWidth?: string; // Tailwind class, e.g., 'border', 'border-2', or '_none_'
  minHeight?: string; // Tailwind class, e.g., 'min-h-[40px]' or '_auto_'
  flexGrow?: number;
  customHeight?: string; // e.g., "150px", "50%", "auto"
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
  frameStyle?: string; // e.g., 'standard', 'classic-gold'

  // Overall card styling
  baseBackgroundColor?: string;
  baseTextColor?: string;
  defaultSectionBorderColor?: string;

  cardBorderColor?: string;
  cardBorderWidth?: string; // e.g., "4px"
  cardBorderStyle?: 'solid' | 'dashed' | 'dotted' | 'double' | 'none' | '_default_';
  cardBorderRadius?: string; // e.g., "8px"

  rows: CardRow[];
}

export interface CardData {
  [key: string]: string | number | undefined; // Can store resolved values for placeholders
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
