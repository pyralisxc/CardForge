
import type { ElementType } from 'react';
import type { TCGCardTemplate, CardSection, CardRow } from '@/types';
import { nanoid } from 'nanoid';
import { Cog, PackageOpen, Wand2 } from 'lucide-react';


export const PAPER_SIZES: Array<{ name: string; widthMm: number; heightMm: number }> = [
  { name: 'US Letter (8.5x11 in)', widthMm: 215.9, heightMm: 279.4 },
  { name: 'A4 (210x297 mm)', widthMm: 210, heightMm: 297 },
];

export const TCG_ASPECT_RATIO = '63:88'; // Standard TCG card aspect ratio

export const FONT_SIZES: Array<{ label: string; value: CardSection['fontSize'] }> = [
  { label: 'X-Small (0.75rem)', value: 'text-xs' }, { label: 'Small (0.875rem)', value: 'text-sm' },
  { label: 'Base/Medium (1rem)', value: 'text-base' }, { label: 'Large (1.125rem)', value: 'text-lg' },
  { label: 'X-Large (1.25rem)', value: 'text-xl' }, { label: 'XX-Large (1.5rem)', value: 'text-2xl' },
];

export const FONT_WEIGHTS: Array<CardSection['fontWeight']> = ['font-normal', 'font-medium', 'font-semibold', 'font-bold'];
export const TEXT_ALIGNS: Array<CardSection['textAlign']> = ['left', 'center', 'right', 'justify'];
export const FONT_STYLES: Array<CardSection['fontStyle']> = ['normal', 'italic'];

export const ROW_ALIGN_ITEMS: Array<{ label: string; value: CardRow['alignItems'] }> = [
  { label: 'Align Top', value: 'flex-start' }, { label: 'Align Middle', value: 'center' },
  { label: 'Align Bottom', value: 'flex-end' }, { label: 'Stretch to Fill', value: 'stretch' },
  { label: 'Align Baselines', value: 'baseline' },
];

export const AVAILABLE_FONTS: Array<{name: string, value: string}> = [
  { name: 'Default Sans-Serif', value: 'font-sans' }, { name: 'Serif (Georgia-like)', value: 'font-serif' },
  { name: 'Monospaced', value: 'font-mono' }, { name: 'Fantasy (Cinzel)', value: 'font-cinzel' },
  { name: 'Clean Sans (Lato)', value: 'font-lato' },
];

export const PADDING_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'None (0px)', value: 'p-0' }, { label: 'XS (0.125rem)', value: 'p-0.5' },
  { label: 'S (0.25rem)', value: 'p-1' }, { label: 'M (0.5rem)', value: 'p-2' },
  { label: 'L (0.75rem)', value: 'p-3' }, { label: 'XL (1rem)', value: 'p-4' },
];

export const BORDER_WIDTH_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'No Border', value: '_none_' }, { label: '1px (All Sides)', value: 'border' },
  { label: '2px (All Sides)', value: 'border-2' }, { label: '4px (All Sides)', value: 'border-4' },
  { label: 'Top (1px)', value: 'border-t' }, { label: 'Bottom (1px)', value: 'border-b' },
  { label: 'Left (1px)', value: 'border-l' }, { label: 'Right (1px)', value: 'border-r' },
];

export const BORDER_RADIUS_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'None', value: 'rounded-none' },
  { label: 'Small', value: 'rounded-sm' },
  { label: 'Medium', value: 'rounded-md' },
  { label: 'Large', value: 'rounded-lg' },
  { label: 'X-Large', value: 'rounded-xl' },
  { label: 'Full', value: 'rounded-full' },
];

export const MIN_HEIGHT_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'Auto', value: '_auto_' }, { label: 'Small (40px)', value: 'min-h-[40px]' },
  { label: 'Medium (80px)', value: 'min-h-[80px]' }, { label: 'Default Artwork (120px)', value: 'min-h-[120px]' },
  { label: 'Large (180px)', value: 'min-h-[180px]' },
];

export const FRAME_STYLES: Array<{ label: string; value: string }> = [
  { label: 'Standard', value: 'standard' },
  { label: "Custom Colors", value: "custom" },
  { label: 'Classic Gold', value: 'classic-gold' },
  { label: 'Minimal Dark', value: 'minimal-dark' },
  { label: 'Arcane Purple', value: 'arcane-purple' },
];

export const CARD_BORDER_STYLES: Array<{ label: string; value: TCGCardTemplate['cardBorderStyle'] | '_default_' }> = [
  { label: 'Default (from Frame/Theme)', value: '_default_' },
  { label: 'Solid', value: 'solid' },
  { label: 'Dashed', value: 'dashed' },
  { label: 'Dotted', value: 'dotted' },
  { label: 'Double', value: 'double' },
  { label: 'None', value: 'none' },
];

export const SECTION_CONTENT_TYPES: Array<{label: string, value: CardSection['sectionContentType']}> = [
  { label: 'Text Placeholder', value: 'placeholder' },
  { label: 'Dedicated Image', value: 'image' },
];

export const DIMENSION_UNITS: Array<{ label: string; value: string }> = [
  { label: 'Millimeters (mm)', value: 'mm' },
  { label: 'Inches (in)', value: 'in' },
  { label: 'Centimeters (cm)', value: 'cm' },
  { label: 'Pixels (px)', value: 'px' },
];

// Utility function to create a default section, used by store and components.
export const createDefaultSection = (id: string, overrides: Partial<CardSection> = {}): CardSection => {
  const baseSection: CardSection = {
    id: id,
    sectionContentType: 'placeholder',
    contentPlaceholder: '{{new_field:"Default Text"}}',
    // backgroundImageUrl: '', // Omitted to be truly undefined unless specified
    // textColor: '', // Omitted
    // backgroundColor: '', // Omitted
    fontFamily: 'font-sans',
    fontSize: 'text-sm',
    fontWeight: 'font-normal',
    textAlign: 'left',
    fontStyle: 'normal',
    padding: 'p-1',
    // borderColor: '', // Omitted
    borderWidth: '_none_', // Represents "no border" as a default choice
    borderRadius: 'rounded-none', // Represents "no radius"
    minHeight: '_auto_', // Represents "auto height"
    flexGrow: 0,
    // customHeight: '', // Omitted
    // customWidth: '', // Omitted
    imageWidthPx: '100', // Default for image type
    imageHeightPx: '100', // Default for image type
    ...overrides,
  };
  // Clean up any empty string optional fields that might have been set by overrides
  // to ensure they are truly omitted if meant to be "not set".
  // This is more for ensuring canonical structure if an override explicitly sets an empty string.
  (Object.keys(baseSection) as Array<keyof CardSection>).forEach(key => {
    if (baseSection[key] === '' && 
        !['id', 'sectionContentType', 'contentPlaceholder', 'fontFamily', 'fontSize', 'fontWeight', 'textAlign', 'fontStyle', 'padding', 'borderWidth', 'borderRadius', 'minHeight', 'flexGrow', 'imageWidthPx', 'imageHeightPx'].includes(key)) {
      delete baseSection[key];
    }
  });
  return baseSection;
};

// Utility function to create a default row, used by store and components.
export const createDefaultRow = (id: string, columns?: CardSection[], alignItems?: CardRow['alignItems'], customHeight?: string): CardRow => {
  const defaultColumnId = `default-col-for-row-${id}`; // Deterministic default column ID
  return {
    id: id,
    columns: columns && columns.length > 0 ? columns : [createDefaultSection(defaultColumnId)],
    alignItems: alignItems || 'flex-start',
    customHeight: customHeight && customHeight.trim() !== '' ? customHeight : undefined, // Omit if empty
  };
};

// DEFAULT_TEMPLATES has been moved to appStore.ts to be DEFAULT_TEMPLATES_DATA to avoid circular deps
// and to be closer to the store initialization logic.

export const TABS_CONFIG: Array<{ value: string; label: string; icon: ElementType }> = [
  { value: "editor", label: "Template Editor", icon: Cog },
  { value: "generator", label: "Card Generator", icon: PackageOpen },
  { value: "ai", label: "AI Helper", icon: Wand2 },
];
