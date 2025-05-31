
export interface CardSection {
  id: string;
  sectionContentType: 'placeholder' | 'image'; 
  contentPlaceholder: string; 
  backgroundImageUrl?: string;
  imageWidthPx?: string;  
  imageHeightPx?: string; 

  // Styling
  textColor?: string;
  backgroundColor?: string;
  fontFamily?: string;
  fontSize?: 'text-xs' | 'text-sm' | 'text-base' | 'text-lg' | 'text-xl' | 'text-2xl';
  fontWeight?: 'font-normal' | 'font-medium' | 'font-semibold' | 'font-bold';
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  fontStyle?: 'normal' | 'italic';
  padding?: string; 
  borderColor?: string;
  borderWidth?: string; 
  borderRadius?: string; // Added border radius
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

export interface TCGCardTemplate {
  id: string | null; 
  name: string; 
  aspectRatio: string;
  frameStyle?: string;
  cardBackgroundImageUrl?: string;

  baseBackgroundColor?: string;
  baseTextColor?: string;
  defaultSectionBorderColor?: string;

  cardBorderColor?: string;
  cardBorderWidth?: string;
  cardBorderStyle?: 'solid' | 'dashed' | 'dotted' | 'double' | 'none' | '_default_';
  cardBorderRadius?: string;

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

export interface ExtractedPlaceholder {
  key: string;
  defaultValue?: string;
}
