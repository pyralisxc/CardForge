
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
  | 'Divider'; // New simple divider type

export interface CardSection {
  id: string; // Unique ID for this section instance
  type: CardSectionType;
  contentPlaceholder: string; // e.g., "{{cardName}}", "Effect: {{effectText}}", for Artwork: "{{artworkUrl}}"
  
  // Optional styling for this specific section
  textColor?: string;
  backgroundColor?: string;
  fontFamily?: string; // e.g., 'font-serif', 'font-fantasy-cinzel'
  fontSize?: 'text-xs' | 'text-sm' | 'text-base' | 'text-lg' | 'text-xl' | 'text-2xl';
  fontWeight?: 'font-normal' | 'font-medium' | 'font-semibold' | 'font-bold';
  textAlign?: 'left' | 'center' | 'right';
  fontStyle?: 'normal' | 'italic';
  padding?: string; // e.g., "p-1", "px-2 py-1"
  borderColor?: string; // Optional border for this section
  borderWidth?: string; // e.g., "border-t-2", "border-b"
  minHeight?: string; // e.g., "min-h-[100px]" for artwork or text boxes
  flexGrow?: boolean; // If this section should try to take up remaining space
}

export interface TCGCardTemplate {
  id: string;
  name: string;
  templateType: 'StandardFantasyTCG' | 'CustomSequential'; // To guide initial setup or behavior

  // Overall card styling
  aspectRatio: string; // e.g., "63:88"
  frameColor?: string; // Main outer frame/border of the card
  borderColor?: string; // Default border color for inner elements if not overridden by section
  baseBackgroundColor?: string; // Overall card background
  baseTextColor?: string; // Default text color if not overridden by section
  
  sections: CardSection[];
}

export interface CardData {
  // Flexible structure for variable replacement
  [key: string]: string | number | undefined; // Allow undefined for optional fields
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

