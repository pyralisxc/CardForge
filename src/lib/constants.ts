
import type { PaperSize, TCGCardTemplate, CardSection, CardRow } from '@/types';
import type { ElementType } from 'react';
import {
  PackageOpen, LayoutDashboard as EditorIcon, Wand2, ScrollText,
  Settings2, Paintbrush, PlusCircle, ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  Cog, Frame, Rows, Save, Eye, Edit2, XCircle,
  Palette, Image as ImageIconLucide, Lightbulb, Copy as CopyIcon
} from 'lucide-react';
import { nanoid } from 'nanoid';

export const PAPER_SIZES: PaperSize[] = [
  { name: 'US Letter (8.5x11 in)', widthMm: 215.9, heightMm: 279.4 },
  { name: 'A4 (210x297 mm)', widthMm: 210, heightMm: 297 },
];

export const TCG_ASPECT_RATIO = '63:88';

// ICON_MAP and SECTION_TYPES are removed as section types are now generic

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
  { label: 'Medium (80px)', value: 'min-h-[80px]' }, { label: 'Large (120px)', value: 'min-h-[120px]' }, // Adjusted from Artwork Default
  { label: 'X-Large (180px)', value: 'min-h-[180px]' },
];

export const FRAME_STYLES: Array<{ label: string; value: string }> = [
  { label: 'Standard', value: 'standard' }, { label: "Custom Colors", value: "custom" },
  { label: 'Classic Gold', value: 'classic-gold' }, { label: 'Minimal Dark', value: 'minimal-dark' },
  { label: 'Arcane Purple', value: 'arcane-purple' },
];

export const CARD_BORDER_STYLES: Array<{ label: string; value: TCGCardTemplate['cardBorderStyle'] }> = [
  { label: 'Default (from theme/frame)', value: '_default_' },
  { label: 'Solid', value: 'solid' }, { label: 'Dashed', value: 'dashed' },
  { label: 'Dotted', value: 'dotted' }, { label: 'Double', value: 'double' },
  { label: 'None', value: 'none' },
];

export const createDefaultSection = (id: string): CardSection => {
  return {
    id: id,
    contentPlaceholder: '{{new_field:"Sample Text"}}', // Generic placeholder
    backgroundImageUrl: '',
    // Sensible generic defaults
    textColor: '',
    backgroundColor: '',
    fontFamily: 'font-sans',
    fontSize: 'text-sm',
    fontWeight: 'font-normal',
    textAlign: 'left',
    fontStyle: 'normal',
    padding: 'p-1',
    borderColor: '',
    borderWidth: '_none_',
    minHeight: '_auto_',
    flexGrow: 0, // Default to not growing, user can change
    customHeight: '',
    customWidth: '',
  };
};

export const createDefaultRow = (id: string, columns: CardSection[] = [], alignItems: CardRow['alignItems'] = 'flex-start', customHeight: string = ''): CardRow => {
  return {
    id: id,
    columns: columns.length > 0 ? columns : [createDefaultSection(nanoid())], // Ensure a new row has at least one section
    alignItems: alignItems,
    customHeight: customHeight,
  };
};

export const DEFAULT_TEMPLATES: TCGCardTemplate[] = [
  {
    id: 'basic-custom-v7-id',
    name: 'My Custom Card',
    aspectRatio: TCG_ASPECT_RATIO,
    frameStyle: 'standard',
    baseBackgroundColor: '', baseTextColor: '', defaultSectionBorderColor: '',
    cardBorderColor: '', cardBorderWidth: '4px', cardBorderStyle: 'solid', cardBorderRadius: '0.5rem',
    rows: [
      {
        id: 'basic-row1-v7-id',
        alignItems: 'center',
        customHeight: '',
        columns: [
          {
            id: 'basic-section1-title-v7-id',
            contentPlaceholder: '{{title:"Card Title"}}',
            backgroundImageUrl: '',
            fontFamily: 'font-cinzel', fontSize: 'text-lg', fontWeight: 'font-bold',
            textAlign: 'center', padding: 'p-2',
            flexGrow: 1, customHeight: '', customWidth: '',
            textColor: '', backgroundColor: '', fontStyle: 'normal',
            borderColor: '', borderWidth: '_none_', minHeight: '_auto_',
          }
        ]
      },
      {
        id: 'basic-row2-art-v7-id',
        alignItems: 'flex-start',
        customHeight: '',
        columns: [
          {
            id: 'basic-section2-art-v7-id',
            contentPlaceholder: '{{artworkUrl}}', // Intended for image URL
            backgroundImageUrl: '',
            fontFamily: 'font-sans', fontSize: 'text-sm', fontWeight: 'font-normal',
            textAlign: 'center', padding: 'p-0',
            flexGrow: 1, customHeight: '180px', customWidth: '100%',
            textColor: '', backgroundColor: '', fontStyle: 'normal',
            borderColor: '', borderWidth: '_none_', minHeight: '_auto_',
          }
        ]
      },
      {
        id: 'basic-row3-desc-v7-id',
        alignItems: 'flex-start',
        customHeight: '',
        columns: [
          {
            id: 'basic-section3-desc-v7-id',
            contentPlaceholder: '{{description:"Card description or rules text."}}',
            backgroundImageUrl: '',
            fontFamily: 'font-serif', fontSize: 'text-sm', fontWeight: 'font-normal',
            textAlign: 'left', padding: 'p-2',
            flexGrow: 1, customHeight: '100px', customWidth: '',
            textColor: '', backgroundColor: '', fontStyle: 'normal',
            borderColor: '', borderWidth: '_none_', minHeight: '_auto_',
          }
        ]
      }
    ]
  }
];

// TCG_FIELD_DEFINITIONS is removed as section types are gone.

export const TABS_CONFIG = [
  { value: "editor", label: "Template Editor", icon: EditorIcon },
  { value: "generator", label: "Card Generator", icon: PackageOpen },
  { value: "contexts", label: "Context Sets", icon: ScrollText },
  { value: "ai", label: "AI Helper", icon: Wand2 },
];
