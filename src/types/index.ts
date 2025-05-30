
export interface CardSection {
  id: string;
  sectionContentType: 'placeholder' | 'image'; // New: Explicit type
  contentPlaceholder: string; // For 'placeholder' type, it's the template string. For 'image' type, it's the data key for the URL.
  backgroundImageUrl?: string;

  // Styling for the section's container div
  textColor?: string;
  backgroundColor?: string;
  fontFamily?: string;
  fontSize?: 'text-xs' | 'text-sm' | 'text-base' | 'text-lg' | 'text-xl' | 'text-2xl';
  fontWeight?: 'font-normal' | 'font-medium' | 'font-semibold' | 'font-bold';
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  fontStyle?: 'normal' | 'italic';
  padding?: string; // Tailwind padding class e.g. p-1, p-2
  borderColor?: string;
  borderWidth?: string; // Tailwind border width class e.g., border, border-2, border-t-2. '_none_' for no border.
  minHeight?: string; // Tailwind min-height class e.g., min-h-[40px]
  flexGrow?: number; // Flex grow factor for this section within its row
  customHeight?: string; // e.g., "50px", "10%", "auto"
  customWidth?: string; // e.g., "100px", "33.33%", "auto"

  // Specific to sectionContentType: 'image'
  imageWidthPx?: string;  // e.g., "100" (parsed as px)
  imageHeightPx?: string; // e.g., "150" (parsed as px)
}

export interface CardRow {
  id: string;
  columns: CardSection[];
  alignItems?: 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline';
  customHeight?: string; // e.g., "50px", "20%", "auto"
}

export interface TCGCardTemplate {
  id: string | null; // Null for a new, unsaved template
  name?: string; // Temporarily optional
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
