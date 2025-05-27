
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
  borderWidth?: string; 
  minHeight?: string; 
  flexGrow?: number;
  customHeight?: string; // e.g., "150px", "50%", "auto"
  customWidth?: string;  // e.g., "100%", "200px", "auto"
}

export interface CardRow {
  id: string; 
  columns: CardSection[]; 
  alignItems?: 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline'; 
}

export interface TCGCardTemplate {
  id: string;
  name: string;
  aspectRatio: string; 
  borderColor?: string; 
  baseBackgroundColor?: string; 
  baseTextColor?: string; 
  frameStyle?: string; 
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
