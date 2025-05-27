
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
  textAlign?: 'left' | 'center' | 'right' | 'justify'; // Added justify
  fontStyle?: 'normal' | 'italic';
  padding?: string; 
  borderColor?: string; 
  borderWidth?: string; 
  minHeight?: string; 
  flexGrow?: number; // For space distribution within a row: 0 = content size, >0 = proportion of extra space
  // Optional: Explicit width/basis if needed, e.g., 'w-1/3', 'basis-1/4' (Tailwind or CSS value)
  // For now, flexGrow should cover most cases.
}

export interface CardRow {
  id: string; // Unique ID for the row
  columns: CardSection[]; // Each item in 'columns' is a CardSection
  alignItems?: 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline'; 
  // Optional: explicit height for the row, or min/max height
}

export interface TCGCardTemplate {
  id: string;
  name: string;
  // templateType: 'CustomSequential'; // This might become less relevant with rows/cols

  aspectRatio: string; 
  frameColor?: string; 
  borderColor?: string; 
  baseBackgroundColor?: string; 
  baseTextColor?: string; 
  frameStyle?: string; 
  
  rows: CardRow[]; // Changed from sections: CardSection[]
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
