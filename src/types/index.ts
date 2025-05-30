
export interface CardSection {
  id: string;
  contentPlaceholder: string;
  backgroundImageUrl?: string; // New for section-specific backgrounds

  textColor?: string;
  backgroundColor?: string;
  fontFamily?: string;
  fontSize?: 'text-xs' | 'text-sm' | 'text-base' | 'text-lg' | 'text-xl' | 'text-2xl';
  fontWeight?: 'font-normal' | 'font-medium' | 'font-semibold' | 'font-bold';
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  fontStyle?: 'normal' | 'italic';
  padding?: string;
  borderColor?: string;
  borderWidth?: string; // Tailwind classes like 'border', 'border-2', 'border-t-2' or '_none_'
  minHeight?: string; // Tailwind class like 'min-h-[120px]' or '_auto_'
  flexGrow?: number; // For flex distribution within a row
  customHeight?: string; // e.g., "150px", "auto", "40%"
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
  frameStyle?: string; // e.g., "standard", "classic-gold"

  baseBackgroundColor?: string;
  baseTextColor?: string;
  defaultSectionBorderColor?: string; // Fallback border color for sections

  // Specific outer card border controls
  cardBorderColor?: string;
  cardBorderWidth?: string; // e.g., "4px"
  cardBorderStyle?: 'solid' | 'dashed' | 'dotted' | 'double' | 'none' | '_default_';
  cardBorderRadius?: string; // e.g., "8px", "0.5rem"

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
