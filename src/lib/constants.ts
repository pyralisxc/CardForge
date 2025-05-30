
import type { TCGCardTemplate, CardSection, CardRow } from '@/types';
import { nanoid } from 'nanoid';
import {
  Type, ChevronsUpDown, AlignLeft, Italic, Baseline, Settings2, Paintbrush, TextCursorInput, Minus, Ratio, Ruler, FileImage,
  LayoutDashboard, Edit2, Cog, Frame, Rows, Columns, GripVertical, AlignVerticalSpaceAround, Save, SquarePen, Palette, EyeOff, Eye,
  PlusCircle, ScrollText, Wand2, PackageOpen, Menu as MenuIcon, TextQuote, Image as ImageIconLucide, Lightbulb, Copy as CopyIcon, FolderDown, FolderUp, Trash2
} from 'lucide-react';
import type { ElementType } from 'react';


export const PAPER_SIZES: PaperSize[] = [
  { name: 'US Letter (8.5x11 in)', widthMm: 215.9, heightMm: 279.4 },
  { name: 'A4 (210x297 mm)', widthMm: 210, heightMm: 297 },
];

export const TCG_ASPECT_RATIO = '63:88';

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

export const MIN_HEIGHT_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'Auto', value: '_auto_' }, { label: 'Small (40px)', value: 'min-h-[40px]' },
  { label: 'Medium (80px)', value: 'min-h-[80px]' }, { label: 'Artwork Default (120px)', value: 'min-h-[120px]' },
  { label: 'X-Large (180px)', value: 'min-h-[180px]' },
];

export const FRAME_STYLES: Array<{ label: string; value: string }> = [
  { label: 'Standard', value: 'standard' }, { label: "Custom Colors", value: "custom" },
  { label: 'Classic Gold', value: 'classic-gold' }, { label: 'Minimal Dark', value: 'minimal-dark' },
  { label: 'Arcane Purple', value: 'arcane-purple' },
];

// Removed CARD_BORDER_STYLES as this logic was reverted.
// If we re-add granular outer border style selection, it would go here.

export const createDefaultSection = (id: string): CardSection => {
  return {
    id: id || nanoid(),
    contentPlaceholder: '{{new_field}}',
    backgroundImageUrl: '',
    textColor: '',
    backgroundColor: '',
    fontFamily: 'font-sans',
    fontSize: 'text-sm',
    fontWeight: 'font-normal',
    textAlign: 'left',
    fontStyle: 'normal',
    padding: 'p-1',
    borderColor: '',
    borderWidth: '_none_', // Default to no border via this special value
    minHeight: '_auto_',   // Default to auto min-height
    flexGrow: 0,
    customHeight: '',
    customWidth: '',
  };
};

export const createDefaultRow = (id: string, columns?: CardSection[], alignItems?: CardRow['alignItems'], customHeight?: string): CardRow => {
  return {
    id: id || nanoid(),
    columns: columns && columns.length > 0 ? columns : [createDefaultSection(nanoid())],
    alignItems: alignItems || 'flex-start',
    customHeight: customHeight || '',
  };
};


export const DEFAULT_TEMPLATES: TCGCardTemplate[] = [];


export const TABS_CONFIG = [
  { value: "editor", label: "Template Editor", icon: Cog },
  { value: "generator", label: "Card Generator", icon: PackageOpen },
  { value: "contexts", label: "Context Sets", icon: ScrollText },
  { value: "ai", label: "AI Helper", icon: Wand2 },
];

export const ICON_MAP: Record<string, ElementType> = {
  // This map was used when sections had types. It's currently unused due to generic sections.
  // If re-introducing section-type specific icons in the editor, this would be the place.
  Default: SquarePen,
};
