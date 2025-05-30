
import type { PaperSize, TCGCardTemplate, CardSection, CardSectionType, CardRow } from '@/types';
import type { ElementType } from 'react';
import {
  LayoutDashboard, Trash2, PlusCircle, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Type, ChevronsUpDown, AlignLeft, Italic, Baseline, Settings2, Paintbrush, TextCursorInput, Minus, Ratio, Ruler, FileImage, Settings, Cog, Frame, Rows, Columns, GripVertical, AlignVerticalSpaceAround, Save, SquarePen, Palette, EyeOff, Eye, Edit2, XCircle, PackageOpen, ScrollText, Wand2, Sparkles, FilePlus2, PackagePlus, Download, Menu as MenuIcon, TextQuote, Image as ImageIconLucide, Lightbulb, Copy as CopyIcon
} from 'lucide-react'; // Added MenuIcon, TextQuote, ImageIconLucide, Lightbulb, CopyIcon
import { nanoid } from 'nanoid';

export const PAPER_SIZES: PaperSize[] = [
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

export const CARD_BORDER_STYLES: Array<{ label: string; value: TCGCardTemplate['cardBorderStyle'] }> = [
  { label: 'Default (from theme/frame)', value: '_default_' },
  { label: 'Solid', value: 'solid' }, { label: 'Dashed', value: 'dashed' },
  { label: 'Dotted', value: 'dotted' }, { label: 'Double', value: 'double' },
  { label: 'None', value: 'none' },
];

export const ICON_MAP: Record<CardSectionType, ElementType> = {
  CardName: TextCursorInput,
  ManaCost: Minus, // Placeholder, consider custom SVG or different icon
  Artwork: FileImage,
  TypeLine: Type,
  RulesText: AlignLeft,
  FlavorText: Italic,
  PowerToughness: Baseline, // Placeholder
  ArtistCredit: SquarePen,
  CustomText: TextCursorInput,
  Divider: Minus,
};

export const createDefaultSection = (id: string): CardSection => {
  const baseSection: CardSection = {
    id: id,
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
    borderWidth: '_none_',
    minHeight: '_auto_',
    flexGrow: 0,
    customHeight: '',
    customWidth: '',
  };

  return { ...baseSection };
};

export const createDefaultRow = (id: string, columns: CardSection[] = [], alignItems: CardRow['alignItems'] = 'flex-start', customHeight: string = ''): CardRow => {
  return {
    id: id,
    columns: columns.length > 0 ? columns.map(col => ({ ...createDefaultSection(col.id || nanoid()), ...col })) : [createDefaultSection(nanoid())],
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
    baseBackgroundColor: '', baseTextColor: '',
    defaultSectionBorderColor: '',
    cardBorderColor: '', cardBorderWidth: '4px', cardBorderStyle: 'solid', cardBorderRadius: '0.5rem',
    rows: [
      {
        id: 'basic-row1-v7-id',
        alignItems: 'flex-start',
        customHeight: '',
        columns: [
          {
            id: 'basic-section1-v7-id',
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
        id: 'basic-row2-v7-id',
        alignItems: 'flex-start',
        customHeight: '',
        columns: [
          {
            id: 'basic-section2-v7-id',
            contentPlaceholder: '{{artworkUrl}}',
            backgroundImageUrl: '',
            fontFamily: 'font-sans', fontSize: 'text-sm', fontWeight: 'font-normal',
            textAlign: 'center', padding: 'p-0',
            flexGrow: 1, customHeight: '120px', customWidth: '100%',
            textColor: '', backgroundColor: '', fontStyle: 'normal',
            borderColor: '', borderWidth: '_none_', minHeight: 'min-h-[120px]',
          }
        ]
      },
       {
        id: 'basic-row3-v7-id',
        alignItems: 'flex-start',
        customHeight: '',
        columns: [
          {
            id: 'basic-section3-v7-id',
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
  },
  // MTG Presets
  {
    id: 'sfc-v6-stable-id', // Standard Fantasy Creature
    name: 'MTG - Creature',
    aspectRatio: TCG_ASPECT_RATIO,
    frameStyle: 'standard',
    baseBackgroundColor: '', baseTextColor: '',
    defaultSectionBorderColor: 'hsl(var(--border))',
    cardBorderColor: '', cardBorderWidth: '6px', cardBorderStyle: 'solid', cardBorderRadius: '0.75rem',
    rows: [
      {
        id: 'sfc-row1-namecost-v6-id',
        alignItems: 'center',
        customHeight: '',
        columns: [
          {
            id: 'sfc-sec1-name-v6-id', contentPlaceholder: '{{cardName:"New Card"}}', fontFamily: 'font-cinzel', fontSize: 'text-lg', fontWeight: 'font-bold', textAlign: 'left', padding: 'px-2 pt-1 pb-0', flexGrow: 1,
            backgroundImageUrl: '', textColor: '', backgroundColor: '', fontStyle: 'normal', borderColor: '', borderWidth: '_none_', minHeight: '_auto_', customHeight: '', customWidth: '',
          },
          {
            id: 'sfc-sec2-cost-v6-id', contentPlaceholder: '{{manaCost:"X"}}', fontFamily: 'font-lato', fontSize: 'text-base', fontWeight: 'font-bold', textAlign: 'right', padding: 'px-2 pt-1 pb-0', flexGrow: 0,
            backgroundImageUrl: '', textColor: '', backgroundColor: '', fontStyle: 'normal', borderColor: '', borderWidth: '_none_', minHeight: '_auto_', customHeight: '', customWidth: '',
          },
        ],
      },
      {
        id: 'sfc-row2-art-v6-id',
        alignItems: 'flex-start',
        customHeight: '',
        columns: [
          {
            id: 'sfc-sec3-art-v6-id', contentPlaceholder: '{{artworkUrl}}', customHeight: '120px', customWidth: '100%', padding: 'p-0', minHeight: 'min-h-[120px]', flexGrow: 1, backgroundColor: 'hsl(var(--muted)/0.3)', borderColor: 'hsl(var(--border))', borderWidth: 'border-b-2',
            backgroundImageUrl: '', fontFamily: 'font-sans', fontSize: 'text-sm', fontWeight: 'font-normal', textAlign: 'center', textColor: '', fontStyle: 'normal',
          },
        ],
      },
      {
        id: 'sfc-row3-type-v6-id',
        alignItems: 'flex-start',
        customHeight: '',
        columns: [
          {
            id: 'sfc-sec4-type-v6-id', contentPlaceholder: '{{cardType:"Type"}} — {{subTypes:"Subtype"}}', fontFamily: 'font-lato', fontSize: 'text-sm', fontWeight: 'font-semibold', padding: 'px-2 py-0.5', backgroundColor: 'hsl(var(--muted)/0.2)', borderWidth: 'border-y', flexGrow: 1,
            backgroundImageUrl: '', textColor: '', textAlign: 'left', fontStyle: 'normal', borderColor: '', minHeight: '_auto_', customHeight: '', customWidth: '',
          },
        ],
      },
      {
        id: 'sfc-row4-rules-v6-id',
        alignItems: 'flex-start',
        customHeight: '',
        columns: [
          {
            id: 'sfc-sec5-rules-v6-id', contentPlaceholder: '{{rulesText:"Card effects and abilities."}}', fontFamily: 'font-serif', fontSize: 'text-sm', padding: 'p-2', flexGrow: 1, minHeight: 'min-h-[80px]',
            backgroundImageUrl: '', textColor: '', backgroundColor: '', fontWeight: 'font-normal', textAlign: 'left', fontStyle: 'normal', borderColor: '', borderWidth: '_none_', customHeight: '', customWidth: '',
          },
        ],
      },
      {
        id: 'sfc-row5-flavorpt-v6-id',
        alignItems: 'flex-end', // Aligns P/T to bottom if flavor text is shorter
        customHeight: '',
        columns: [
          {
            id: 'sfc-sec6-flavor-v6-id', contentPlaceholder: '"{{flavorText:"Its roar is its battle cry."}}"', fontFamily: 'font-serif', fontSize: 'text-xs', fontStyle: 'italic', padding: 'p-2 pt-1', flexGrow: 1, minHeight: 'min-h-[40px]', borderWidth: 'border-t',
            backgroundImageUrl: '', textColor: '', backgroundColor: '', fontWeight: 'font-normal', textAlign: 'left', borderColor: '', customHeight: '40px', customWidth: '',
          },
          {
            id: 'sfc-sec7-pt-v6-id', contentPlaceholder: '{{power:"X"}}/{{toughness:"Y"}}', fontFamily: 'font-lato', fontSize: 'text-lg', fontWeight: 'font-bold', textAlign: 'right', padding: 'px-2 py-1', backgroundColor: 'hsl(var(--muted)/0.2)', borderWidth: 'border-t', flexGrow: 0,
            backgroundImageUrl: '', textColor: '', fontStyle: 'normal', borderColor: '', minHeight: '_auto_', customHeight: '', customWidth: '',
          },
        ],
      },
      {
        id: 'sfc-row6-artist-v6-id',
        alignItems: 'flex-start',
        customHeight: '',
        columns: [
          {
            id: 'sfc-sec8-artist-v6-id', contentPlaceholder: 'Illus. {{artistName:"Artist"}} • {{rarity:"Common"}}', fontFamily: 'font-lato', fontSize: 'text-xs', padding: 'px-2 pb-1 pt-0.5', flexGrow: 0, customHeight: 'auto',
            backgroundImageUrl: '', textColor: '', backgroundColor: '', fontWeight: 'font-normal', textAlign: 'left', fontStyle: 'normal', borderColor: '', borderWidth: '_none_', minHeight: '_auto_', customWidth: '',
          },
        ],
      },
    ],
  },
  {
    id: 'mtg-sorcery-v1-id',
    name: 'MTG - Sorcery',
    aspectRatio: TCG_ASPECT_RATIO,
    frameStyle: 'standard', baseBackgroundColor: '', baseTextColor: '', defaultSectionBorderColor: '',
    cardBorderColor: '', cardBorderWidth: '6px', cardBorderStyle: 'solid', cardBorderRadius: '0.75rem',
    rows: [
      { id: 'sor-r1', alignItems: 'center', customHeight: '', columns: [
          { id: 'sor-s1-name', contentPlaceholder: '{{cardName:"New Sorcery"}}', fontFamily: 'font-cinzel', fontSize: 'text-lg', fontWeight: 'font-bold', flexGrow: 1, padding: 'px-2 pt-1 pb-0',
            backgroundImageUrl: '', textColor: '', backgroundColor: '', textAlign: 'left', fontStyle: 'normal', borderColor: '', borderWidth: '_none_', minHeight: '_auto_', customHeight: '', customWidth: '' },
          { id: 'sor-s2-cost', contentPlaceholder: '{{manaCost:"X"}}', fontFamily: 'font-lato', fontSize: 'text-base', fontWeight: 'font-bold', flexGrow: 0, padding: 'px-2 pt-1 pb-0', textAlign: 'right',
            backgroundImageUrl: '', textColor: '', backgroundColor: '', fontStyle: 'normal', borderColor: '', borderWidth: '_none_', minHeight: '_auto_', customHeight: '', customWidth: '' },
      ]},
      { id: 'sor-r2', alignItems: 'flex-start', customHeight: '', columns: [
          { id: 'sor-s3-art', contentPlaceholder: '{{artworkUrl}}', customHeight: '120px', customWidth: '100%', padding: 'p-0', minHeight: 'min-h-[120px]', flexGrow: 1, backgroundColor: 'hsl(var(--muted)/0.3)', borderColor: 'hsl(var(--border))', borderWidth: 'border-b-2',
            backgroundImageUrl: '', fontFamily: 'font-sans', fontSize: 'text-sm', fontWeight: 'font-normal', textAlign: 'center', textColor: '', fontStyle: 'normal', },
      ]},
      { id: 'sor-r3', alignItems: 'flex-start', customHeight: '', columns: [
          { id: 'sor-s4-type', contentPlaceholder: '{{cardType:"Sorcery"}}', fontFamily: 'font-lato', fontSize: 'text-sm', fontWeight: 'font-semibold', padding: 'px-2 py-0.5', backgroundColor: 'hsl(var(--muted)/0.2)', borderWidth: 'border-y', flexGrow: 1,
            backgroundImageUrl: '', textColor: '', textAlign: 'left', fontStyle: 'normal', borderColor: '', minHeight: '_auto_', customHeight: '', customWidth: '' },
      ]},
      { id: 'sor-r4', alignItems: 'flex-start', customHeight: '', columns: [
          { id: 'sor-s5-rules', contentPlaceholder: '{{rulesText:"Sorcery effect description."}}', fontFamily: 'font-serif', fontSize: 'text-sm', padding: 'p-2', flexGrow: 1, minHeight: 'min-h-[100px]', customHeight: 'auto',
            backgroundImageUrl: '', textColor: '', backgroundColor: '', fontWeight: 'font-normal', textAlign: 'left', fontStyle: 'normal', borderColor: '', borderWidth: '_none_', customWidth: '' },
      ]},
      { id: 'sor-r5', alignItems: 'flex-start', customHeight: '', columns: [
          { id: 'sor-s6-flavor', contentPlaceholder: '"{{flavorText:"Ancient words of power."}}"', fontFamily: 'font-serif', fontSize: 'text-xs', fontStyle: 'italic', padding: 'p-2 pt-1', flexGrow: 1, minHeight: 'min-h-[60px]', customHeight: 'auto', borderWidth: 'border-t',
            backgroundImageUrl: '', textColor: '', backgroundColor: '', fontWeight: 'font-normal', textAlign: 'left', borderColor: '', customWidth: '' },
      ]},
      { id: 'sor-r6', alignItems: 'flex-start', customHeight: '', columns: [
          { id: 'sor-s7-artist', contentPlaceholder: 'Illus. {{artistName:"Artist"}} • {{rarity:"Uncommon"}}', fontFamily: 'font-lato', fontSize: 'text-xs', padding: 'px-2 pb-1 pt-0.5', flexGrow: 1, customHeight: 'auto',
            backgroundImageUrl: '', textColor: '', backgroundColor: '', fontWeight: 'font-normal', textAlign: 'left', fontStyle: 'normal', borderColor: '', borderWidth: '_none_', minHeight: '_auto_', customWidth: '' },
      ]},
    ]
  },
  {
    id: 'mtg-instant-v1-id',
    name: 'MTG - Instant',
    aspectRatio: TCG_ASPECT_RATIO,
    frameStyle: 'standard', baseBackgroundColor: '', baseTextColor: '', defaultSectionBorderColor: '',
    cardBorderColor: '', cardBorderWidth: '6px', cardBorderStyle: 'solid', cardBorderRadius: '0.75rem',
    rows: [
      { id: 'ins-r1', alignItems: 'center', customHeight: '', columns: [
          { id: 'ins-s1-name', contentPlaceholder: '{{cardName:"New Instant"}}', fontFamily: 'font-cinzel', fontSize: 'text-lg', fontWeight: 'font-bold', flexGrow: 1, padding: 'px-2 pt-1 pb-0',
            backgroundImageUrl: '', textColor: '', backgroundColor: '', textAlign: 'left', fontStyle: 'normal', borderColor: '', borderWidth: '_none_', minHeight: '_auto_', customHeight: '', customWidth: '' },
          { id: 'ins-s2-cost', contentPlaceholder: '{{manaCost:"X"}}', fontFamily: 'font-lato', fontSize: 'text-base', fontWeight: 'font-bold', flexGrow: 0, padding: 'px-2 pt-1 pb-0', textAlign: 'right',
            backgroundImageUrl: '', textColor: '', backgroundColor: '', fontStyle: 'normal', borderColor: '', borderWidth: '_none_', minHeight: '_auto_', customHeight: '', customWidth: '' },
      ]},
      { id: 'ins-r2', alignItems: 'flex-start', customHeight: '', columns: [
          { id: 'ins-s3-art', contentPlaceholder: '{{artworkUrl}}', customHeight: '120px', customWidth: '100%', padding: 'p-0', minHeight: 'min-h-[120px]', flexGrow: 1, backgroundColor: 'hsl(var(--muted)/0.3)', borderColor: 'hsl(var(--border))', borderWidth: 'border-b-2',
            backgroundImageUrl: '', fontFamily: 'font-sans', fontSize: 'text-sm', fontWeight: 'font-normal', textAlign: 'center', textColor: '', fontStyle: 'normal', },
      ]},
      { id: 'ins-r3', alignItems: 'flex-start', customHeight: '', columns: [
          { id: 'ins-s4-type', contentPlaceholder: '{{cardType:"Instant"}}', fontFamily: 'font-lato', fontSize: 'text-sm', fontWeight: 'font-semibold', padding: 'px-2 py-0.5', backgroundColor: 'hsl(var(--muted)/0.2)', borderWidth: 'border-y', flexGrow: 1,
            backgroundImageUrl: '', textColor: '', textAlign: 'left', fontStyle: 'normal', borderColor: '', minHeight: '_auto_', customHeight: '', customWidth: '' },
      ]},
      { id: 'ins-r4', alignItems: 'flex-start', customHeight: '', columns: [
          { id: 'ins-s5-rules', contentPlaceholder: '{{rulesText:"Instant effect description."}}', fontFamily: 'font-serif', fontSize: 'text-sm', padding: 'p-2', flexGrow: 1, minHeight: 'min-h-[100px]', customHeight: 'auto',
            backgroundImageUrl: '', textColor: '', backgroundColor: '', fontWeight: 'font-normal', textAlign: 'left', fontStyle: 'normal', borderColor: '', borderWidth: '_none_', customWidth: '' },
      ]},
      { id: 'ins-r5', alignItems: 'flex-start', customHeight: '', columns: [
          { id: 'ins-s6-flavor', contentPlaceholder: '"{{flavorText:"Swift and decisive."}}"', fontFamily: 'font-serif', fontSize: 'text-xs', fontStyle: 'italic', padding: 'p-2 pt-1', flexGrow: 1, minHeight: 'min-h-[60px]', customHeight: 'auto', borderWidth: 'border-t',
            backgroundImageUrl: '', textColor: '', backgroundColor: '', fontWeight: 'font-normal', textAlign: 'left', borderColor: '', customWidth: '' },
      ]},
      { id: 'ins-r6', alignItems: 'flex-start', customHeight: '', columns: [
          { id: 'ins-s7-artist', contentPlaceholder: 'Illus. {{artistName:"Artist"}} • {{rarity:"Common"}}', fontFamily: 'font-lato', fontSize: 'text-xs', padding: 'px-2 pb-1 pt-0.5', flexGrow: 1, customHeight: 'auto',
            backgroundImageUrl: '', textColor: '', backgroundColor: '', fontWeight: 'font-normal', textAlign: 'left', fontStyle: 'normal', borderColor: '', borderWidth: '_none_', minHeight: '_auto_', customWidth: '' },
      ]},
    ]
  },
  {
    id: 'mtg-land-v1-id',
    name: 'MTG - Land',
    aspectRatio: TCG_ASPECT_RATIO,
    frameStyle: 'standard', baseBackgroundColor: '', baseTextColor: '', defaultSectionBorderColor: '',
    cardBorderColor: '', cardBorderWidth: '6px', cardBorderStyle: 'solid', cardBorderRadius: '0.75rem',
    rows: [
      { id: 'lnd-r1', alignItems: 'center', customHeight: '', columns: [
          { id: 'lnd-s1-name', contentPlaceholder: '{{cardName:"New Land"}}', fontFamily: 'font-cinzel', fontSize: 'text-lg', fontWeight: 'font-bold', flexGrow: 1, padding: 'px-2 pt-1 pb-0',
            backgroundImageUrl: '', textColor: '', backgroundColor: '', textAlign: 'left', fontStyle: 'normal', borderColor: '', borderWidth: '_none_', minHeight: '_auto_', customHeight: '', customWidth: '' },
      ]},
      { id: 'lnd-r2', alignItems: 'flex-start', customHeight: '', columns: [
          { id: 'lnd-s2-art', contentPlaceholder: '{{artworkUrl}}', customHeight: '160px', customWidth: '100%', padding: 'p-0', minHeight: 'min-h-[160px]', flexGrow: 1, backgroundColor: 'hsl(var(--muted)/0.3)', borderColor: 'hsl(var(--border))', borderWidth: 'border-b-2',
            backgroundImageUrl: '', fontFamily: 'font-sans', fontSize: 'text-sm', fontWeight: 'font-normal', textAlign: 'center', textColor: '', fontStyle: 'normal', },
      ]},
      { id: 'lnd-r3', alignItems: 'flex-start', customHeight: '', columns: [
          { id: 'lnd-s3-type', contentPlaceholder: '{{cardType:"Land"}} - {{subTypes:"Basic"}}', fontFamily: 'font-lato', fontSize: 'text-sm', fontWeight: 'font-semibold', padding: 'px-2 py-0.5', backgroundColor: 'hsl(var(--muted)/0.2)', borderWidth: 'border-y', flexGrow: 1,
            backgroundImageUrl: '', textColor: '', textAlign: 'left', fontStyle: 'normal', borderColor: '', minHeight: '_auto_', customHeight: '', customWidth: '' },
      ]},
      { id: 'lnd-r4', alignItems: 'flex-start', customHeight: '', columns: [
          { id: 'lnd-s4-rules', contentPlaceholder: '{{rulesText:"({T}: Add {M}.)"}}', fontFamily: 'font-serif', fontSize: 'text-sm', padding: 'p-2', flexGrow: 1, minHeight: 'min-h-[80px]', customHeight: 'auto',
            backgroundImageUrl: '', textColor: '', backgroundColor: '', fontWeight: 'font-normal', textAlign: 'center', fontStyle: 'normal', borderColor: '', borderWidth: '_none_', customWidth: '' },
      ]},
      { id: 'lnd-r5', alignItems: 'flex-start', customHeight: '', columns: [
          { id: 'lnd-s5-flavor', contentPlaceholder: '"{{flavorText:"A source of great power."}}"', fontFamily: 'font-serif', fontSize: 'text-xs', fontStyle: 'italic', padding: 'p-2 pt-1', flexGrow: 1, minHeight: 'min-h-[40px]', customHeight: 'auto', borderWidth: 'border-t',
            backgroundImageUrl: '', textColor: '', backgroundColor: '', fontWeight: 'font-normal', textAlign: 'left', borderColor: '', customWidth: '' },
      ]},
      { id: 'lnd-r6', alignItems: 'flex-start', customHeight: '', columns: [
          { id: 'lnd-s6-artist', contentPlaceholder: 'Illus. {{artistName:"Artist"}} • {{rarity:"Land"}}', fontFamily: 'font-lato', fontSize: 'text-xs', padding: 'px-2 pb-1 pt-0.5', flexGrow: 1, customHeight: 'auto',
            backgroundImageUrl: '', textColor: '', backgroundColor: '', fontWeight: 'font-normal', textAlign: 'left', fontStyle: 'normal', borderColor: '', borderWidth: '_none_', minHeight: '_auto_', customWidth: '' },
      ]},
    ]
  },
  {
    id: 'mtg-artifact-v1-id',
    name: 'MTG - Artifact',
    aspectRatio: TCG_ASPECT_RATIO,
    frameStyle: 'standard', baseBackgroundColor: '', baseTextColor: '', defaultSectionBorderColor: '',
    cardBorderColor: '', cardBorderWidth: '6px', cardBorderStyle: 'solid', cardBorderRadius: '0.75rem',
    rows: [
      { id: 'art-r1', alignItems: 'center', customHeight: '', columns: [
          { id: 'art-s1-name', contentPlaceholder: '{{cardName:"New Artifact"}}', fontFamily: 'font-cinzel', fontSize: 'text-lg', fontWeight: 'font-bold', flexGrow: 1, padding: 'px-2 pt-1 pb-0',
            backgroundImageUrl: '', textColor: '', backgroundColor: '', textAlign: 'left', fontStyle: 'normal', borderColor: '', borderWidth: '_none_', minHeight: '_auto_', customHeight: '', customWidth: '' },
          { id: 'art-s2-cost', contentPlaceholder: '{{manaCost:"X"}}', fontFamily: 'font-lato', fontSize: 'text-base', fontWeight: 'font-bold', flexGrow: 0, padding: 'px-2 pt-1 pb-0', textAlign: 'right',
            backgroundImageUrl: '', textColor: '', backgroundColor: '', fontStyle: 'normal', borderColor: '', borderWidth: '_none_', minHeight: '_auto_', customHeight: '', customWidth: '' },
      ]},
      { id: 'art-r2', alignItems: 'flex-start', customHeight: '', columns: [
          { id: 'art-s3-art', contentPlaceholder: '{{artworkUrl}}', customHeight: '120px', customWidth: '100%', padding: 'p-0', minHeight: 'min-h-[120px]', flexGrow: 1, backgroundColor: 'hsl(var(--muted)/0.3)', borderColor: 'hsl(var(--border))', borderWidth: 'border-b-2',
            backgroundImageUrl: '', fontFamily: 'font-sans', fontSize: 'text-sm', fontWeight: 'font-normal', textAlign: 'center', textColor: '', fontStyle: 'normal', },
      ]},
      { id: 'art-r3', alignItems: 'flex-start', customHeight: '', columns: [
          { id: 'art-s4-type', contentPlaceholder: '{{cardType:"Artifact"}} - {{subTypes:"Equipment"}}', fontFamily: 'font-lato', fontSize: 'text-sm', fontWeight: 'font-semibold', padding: 'px-2 py-0.5', backgroundColor: 'hsl(var(--muted)/0.2)', borderWidth: 'border-y', flexGrow: 1,
            backgroundImageUrl: '', textColor: '', textAlign: 'left', fontStyle: 'normal', borderColor: '', minHeight: '_auto_', customHeight: '', customWidth: '' },
      ]},
      { id: 'art-r4', alignItems: 'flex-start', customHeight: '', columns: [
          { id: 'art-s5-rules', contentPlaceholder: '{{rulesText:"Artifact abilities and effects."}}', fontFamily: 'font-serif', fontSize: 'text-sm', padding: 'p-2', flexGrow: 1, minHeight: 'min-h-[100px]', customHeight: 'auto',
            backgroundImageUrl: '', textColor: '', backgroundColor: '', fontWeight: 'font-normal', textAlign: 'left', fontStyle: 'normal', borderColor: '', borderWidth: '_none_', customWidth: '' },
      ]},
      { id: 'art-r5', alignItems: 'flex-start', customHeight: '', columns: [
          { id: 'art-s6-flavor', contentPlaceholder: '"{{flavorText:"A relic of ancient power."}}"', fontFamily: 'font-serif', fontSize: 'text-xs', fontStyle: 'italic', padding: 'p-2 pt-1', flexGrow: 1, minHeight: 'min-h-[60px]', customHeight: 'auto', borderWidth: 'border-t',
            backgroundImageUrl: '', textColor: '', backgroundColor: '', fontWeight: 'font-normal', textAlign: 'left', borderColor: '', customWidth: '' },
      ]},
      { id: 'art-r6', alignItems: 'flex-start', customHeight: '', columns: [
          { id: 'art-s7-artist', contentPlaceholder: 'Illus. {{artistName:"Artist"}} • {{rarity:"Rare"}}', fontFamily: 'font-lato', fontSize: 'text-xs', padding: 'px-2 pb-1 pt-0.5', flexGrow: 1, customHeight: 'auto',
            backgroundImageUrl: '', textColor: '', backgroundColor: '', fontWeight: 'font-normal', textAlign: 'left', fontStyle: 'normal', borderColor: '', borderWidth: '_none_', minHeight: '_auto_', customWidth: '' },
      ]},
    ]
  },
  {
    id: 'mtg-enchantment-v1-id',
    name: 'MTG - Enchantment',
    aspectRatio: TCG_ASPECT_RATIO,
    frameStyle: 'standard', baseBackgroundColor: '', baseTextColor: '', defaultSectionBorderColor: '',
    cardBorderColor: '', cardBorderWidth: '6px', cardBorderStyle: 'solid', cardBorderRadius: '0.75rem',
    rows: [
      { id: 'enc-r1', alignItems: 'center', customHeight: '', columns: [
          { id: 'enc-s1-name', contentPlaceholder: '{{cardName:"New Enchantment"}}', fontFamily: 'font-cinzel', fontSize: 'text-lg', fontWeight: 'font-bold', flexGrow: 1, padding: 'px-2 pt-1 pb-0',
            backgroundImageUrl: '', textColor: '', backgroundColor: '', textAlign: 'left', fontStyle: 'normal', borderColor: '', borderWidth: '_none_', minHeight: '_auto_', customHeight: '', customWidth: '' },
          { id: 'enc-s2-cost', contentPlaceholder: '{{manaCost:"X"}}', fontFamily: 'font-lato', fontSize: 'text-base', fontWeight: 'font-bold', flexGrow: 0, padding: 'px-2 pt-1 pb-0', textAlign: 'right',
            backgroundImageUrl: '', textColor: '', backgroundColor: '', fontStyle: 'normal', borderColor: '', borderWidth: '_none_', minHeight: '_auto_', customHeight: '', customWidth: '' },
      ]},
      { id: 'enc-r2', alignItems: 'flex-start', customHeight: '', columns: [
          { id: 'enc-s3-art', contentPlaceholder: '{{artworkUrl}}', customHeight: '120px', customWidth: '100%', padding: 'p-0', minHeight: 'min-h-[120px]', flexGrow: 1, backgroundColor: 'hsl(var(--muted)/0.3)', borderColor: 'hsl(var(--border))', borderWidth: 'border-b-2',
            backgroundImageUrl: '', fontFamily: 'font-sans', fontSize: 'text-sm', fontWeight: 'font-normal', textAlign: 'center', textColor: '', fontStyle: 'normal', },
      ]},
      { id: 'enc-r3', alignItems: 'flex-start', customHeight: '', columns: [
          { id: 'enc-s4-type', contentPlaceholder: '{{cardType:"Enchantment"}} - {{subTypes:"Aura"}}', fontFamily: 'font-lato', fontSize: 'text-sm', fontWeight: 'font-semibold', padding: 'px-2 py-0.5', backgroundColor: 'hsl(var(--muted)/0.2)', borderWidth: 'border-y', flexGrow: 1,
            backgroundImageUrl: '', textColor: '', textAlign: 'left', fontStyle: 'normal', borderColor: '', minHeight: '_auto_', customHeight: '', customWidth: '' },
      ]},
      { id: 'enc-r4', alignItems: 'flex-start', customHeight: '', columns: [
          { id: 'enc-s5-rules', contentPlaceholder: '{{rulesText:"Enchantment abilities and effects."}}', fontFamily: 'font-serif', fontSize: 'text-sm', padding: 'p-2', flexGrow: 1, minHeight: 'min-h-[100px]', customHeight: 'auto',
            backgroundImageUrl: '', textColor: '', backgroundColor: '', fontWeight: 'font-normal', textAlign: 'left', fontStyle: 'normal', borderColor: '', borderWidth: '_none_', customWidth: '' },
      ]},
      { id: 'enc-r5', alignItems: 'flex-start', customHeight: '', columns: [
          { id: 'enc-s6-flavor', contentPlaceholder: '"{{flavorText:"Magic woven into reality."}}"', fontFamily: 'font-serif', fontSize: 'text-xs', fontStyle: 'italic', padding: 'p-2 pt-1', flexGrow: 1, minHeight: 'min-h-[60px]', customHeight: 'auto', borderWidth: 'border-t',
            backgroundImageUrl: '', textColor: '', backgroundColor: '', fontWeight: 'font-normal', textAlign: 'left', borderColor: '', customWidth: '' },
      ]},
      { id: 'enc-r6', alignItems: 'flex-start', customHeight: '', columns: [
          { id: 'enc-s7-artist', contentPlaceholder: 'Illus. {{artistName:"Artist"}} • {{rarity:"Uncommon"}}', fontFamily: 'font-lato', fontSize: 'text-xs', padding: 'px-2 pb-1 pt-0.5', flexGrow: 1, customHeight: 'auto',
            backgroundImageUrl: '', textColor: '', backgroundColor: '', fontWeight: 'font-normal', textAlign: 'left', fontStyle: 'normal', borderColor: '', borderWidth: '_none_', minHeight: '_auto_', customWidth: '' },
      ]},
    ]
  },
  {
    id: 'mtg-planeswalker-v1-id',
    name: 'MTG - Planeswalker',
    aspectRatio: TCG_ASPECT_RATIO,
    frameStyle: 'standard', baseBackgroundColor: '', baseTextColor: '', defaultSectionBorderColor: '',
    cardBorderColor: '', cardBorderWidth: '6px', cardBorderStyle: 'solid', cardBorderRadius: '0.75rem',
    rows: [
      { id: 'plw-r1', alignItems: 'center', customHeight: '', columns: [
          { id: 'plw-s1-name', contentPlaceholder: '{{cardName:"New Planeswalker"}}', fontFamily: 'font-cinzel', fontSize: 'text-lg', fontWeight: 'font-bold', flexGrow: 1, padding: 'px-2 pt-1 pb-0',
            backgroundImageUrl: '', textColor: '', backgroundColor: '', textAlign: 'left', fontStyle: 'normal', borderColor: '', borderWidth: '_none_', minHeight: '_auto_', customHeight: '', customWidth: '' },
          { id: 'plw-s2-cost', contentPlaceholder: '{{manaCost:"X"}}', fontFamily: 'font-lato', fontSize: 'text-base', fontWeight: 'font-bold', flexGrow: 0, padding: 'px-2 pt-1 pb-0', textAlign: 'right',
            backgroundImageUrl: '', textColor: '', backgroundColor: '', fontStyle: 'normal', borderColor: '', borderWidth: '_none_', minHeight: '_auto_', customHeight: '', customWidth: '' },
      ]},
      { id: 'plw-r2', alignItems: 'flex-start', customHeight: '', columns: [
          { id: 'plw-s3-art', contentPlaceholder: '{{artworkUrl}}', customHeight: '120px', customWidth: '100%', padding: 'p-0', minHeight: 'min-h-[120px]', flexGrow: 1, backgroundColor: 'hsl(var(--muted)/0.3)', borderColor: 'hsl(var(--border))', borderWidth: 'border-b-2',
            backgroundImageUrl: '', fontFamily: 'font-sans', fontSize: 'text-sm', fontWeight: 'font-normal', textAlign: 'center', textColor: '', fontStyle: 'normal', },
      ]},
      { id: 'plw-r3', alignItems: 'flex-start', customHeight: '', columns: [
          { id: 'plw-s4-type', contentPlaceholder: '{{cardType:"Planeswalker"}} - {{subTypes:"Jace"}}', fontFamily: 'font-lato', fontSize: 'text-sm', fontWeight: 'font-semibold', padding: 'px-2 py-0.5', backgroundColor: 'hsl(var(--muted)/0.2)', borderWidth: 'border-y', flexGrow: 1,
            backgroundImageUrl: '', textColor: '', textAlign: 'left', fontStyle: 'normal', borderColor: '', minHeight: '_auto_', customHeight: '', customWidth: '' },
      ]},
      { id: 'plw-r4', alignItems: 'flex-start', customHeight: '', columns: [
          { id: 'plw-s5-ability1', contentPlaceholder: '{{abilityText1:"+1: Draw a card."}}', fontFamily: 'font-serif', fontSize: 'text-sm', padding: 'p-2 pb-1', flexGrow: 1, customHeight: 'auto',
            backgroundImageUrl: '', textColor: '', backgroundColor: '', fontWeight: 'font-normal', textAlign: 'left', fontStyle: 'normal', borderColor: '', borderWidth: '_none_', minHeight: '_auto_', customWidth: '' },
      ]},
      { id: 'plw-r5', alignItems: 'flex-start', customHeight: '', columns: [
          { id: 'plw-s6-ability2', contentPlaceholder: '{{abilityText2:"-2: Return target creature to its owner\'s hand."}}', fontFamily: 'font-serif', fontSize: 'text-sm', padding: 'p-2 py-1', flexGrow: 1, customHeight: 'auto',
            backgroundImageUrl: '', textColor: '', backgroundColor: '', fontWeight: 'font-normal', textAlign: 'left', fontStyle: 'normal', borderColor: '', borderWidth: '_none_', minHeight: '_auto_', customWidth: '' },
      ]},
      { id: 'plw-r6', alignItems: 'flex-start', customHeight: '', columns: [
        { id: 'plw-s7-ability3', contentPlaceholder: '{{abilityText3:"-7: You get an emblem with..."}}', fontFamily: 'font-serif', fontSize: 'text-sm', padding: 'p-2 pt-1', flexGrow: 1, customHeight: 'auto',
          backgroundImageUrl: '', textColor: '', backgroundColor: '', fontWeight: 'font-normal', textAlign: 'left', fontStyle: 'normal', borderColor: '', borderWidth: '_none_', minHeight: '_auto_', customWidth: '' },
      ]},
      { id: 'plw-r7', alignItems: 'flex-start', customHeight: '', columns: [
        { id: 'plw-s8-loyalty', contentPlaceholder: '{{loyalty:"4"}}', fontFamily: 'font-lato', fontSize: 'text-xl', fontWeight: 'font-bold', padding: 'px-3 py-1', backgroundColor: 'hsl(var(--muted)/0.2)', borderWidth: 'border-2', flexGrow: 0, position: 'absolute', right: '10px', bottom: '10px', // Example positioning
            backgroundImageUrl: '', textColor: '', textAlign: 'center', fontStyle: 'normal', borderColor: 'hsl(var(--primary))', minHeight: '_auto_', customHeight: '', customWidth: '' },
      ]},
      { id: 'plw-r8', alignItems: 'flex-start', customHeight: '', columns: [ // Spacer row if loyalty is absolutely positioned
        { id: 'plw-s9-spacer', contentPlaceholder: 'Illus. {{artistName:"Artist"}} • {{rarity:"Mythic"}}', customHeight: '30px', flexGrow: 1, fontFamily: 'font-lato', fontSize: 'text-xs', padding: 'px-2 pb-1 pt-0.5', textAlign: 'left',
            backgroundImageUrl: '', textColor: '', backgroundColor: '', fontWeight: 'font-normal', fontStyle: 'normal', borderColor: '', borderWidth: '_none_', minHeight: '_auto_', customWidth: ''},
      ]},
    ]
  },
];

// Removed TCG_FIELD_DEFINITIONS as they are less relevant with dynamic placeholder generation

export const TABS_CONFIG = [
  { value: "editor", label: "Template Editor", icon: Cog }, // Changed icon to Cog
  { value: "generator", label: "Card Generator", icon: PackageOpen },
  { value: "contexts", label: "Context Sets", icon: ScrollText },
  { value: "ai", label: "AI Helper", icon: Wand2 },
];
