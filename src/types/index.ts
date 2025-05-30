
export interface CardSection {
  id: string;
  sectionContentType: 'placeholder' | 'image'; // New: Explicitly define content type
  contentPlaceholder: string; // For 'placeholder': "Text with {{key}}". For 'image': "imageKeyName"
  backgroundImageUrl?: string;

  // Styling for the section's container div
  textColor?: string;
  backgroundColor?: string;
  fontFamily?: string;
  fontSize?: 'text-xs' | 'text-sm' | 'text-base' | 'text-lg' | 'text-xl' | 'text-2xl';
  fontWeight?: 'font-normal' | 'font-medium' | 'font-semibold' | 'font-bold';
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  fontStyle?: 'normal' | 'italic';
  padding?: string; // Tailwind class e.g. 'p-1', 'p-0'
  borderColor?: string;
  borderWidth?: string; // Tailwind class e.g. 'border', 'border-2', or '_none_'
  minHeight?: string; // Tailwind class e.g. 'min-h-[120px]' or '_auto_'
  flexGrow?: number;
  customHeight?: string; // e.g., "150px", "50%", "auto" - for the section container
  customWidth?: string; // e.g., "100%", "200px", "auto" - for the section container

  // Specific to sectionContentType: 'image'
  imageWidthPx?: string; // e.g., "100" (will be treated as px)
  imageHeightPx?: string; // e.g., "150" (will be treated as px)
  // objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down'; // Future: for image sections
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
  aspectRatio: string;
  frameStyle?: string;

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
