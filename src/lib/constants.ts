
import type { PaperSize, TCGCardTemplate, CardSection, CardSectionType, CardRow } from '@/types';
import type { ElementType } from 'react';
import {
  PackageOpen, LayoutDashboard as EditorIcon, Wand2, ScrollText, TextCursorInput, FileImage, Type as TypeIcon,
  AlignLeft as RulesIcon, Italic as FlavorIcon, ChevronsUpDown, Baseline, SquarePen, Minus,
  Palette, Image as ImageIconLucide, Paintbrush as PaintbrushIconLucide, Lightbulb, Copy as CopyIcon, Cog, Frame, Rows, Columns, /* GripVertical removed for this revert point */ Save, Edit2, XCircle, PlusCircle, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Eye
} from 'lucide-react'; // Removed GripVertical import
import { nanoid } from 'nanoid';

export const PAPER_SIZES: PaperSize[] = [
  { name: 'US Letter (8.5x11 in)', widthMm: 215.9, heightMm: 279.4 },
  { name: 'A4 (210x297 mm)', widthMm: 210, heightMm: 297 },
];

export const TCG_ASPECT_RATIO = '63:88';

export const SECTION_TYPES: CardSectionType[] = [
  'CardName', 'ManaCost', 'Artwork', 'TypeLine', 'RulesText',
  'FlavorText', 'PowerToughness', 'ArtistCredit', 'CustomText', 'Divider'
];

export const ICON_MAP: Record<CardSectionType, ElementType> = {
  CardName: TextCursorInput, ManaCost: Baseline, Artwork: FileImage, TypeLine: TypeIcon,
  RulesText: RulesIcon, FlavorText: FlavorIcon, PowerToughness: ChevronsUpDown,
  ArtistCredit: Baseline, CustomText: SquarePen, Divider: Minus,
};

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
  { label: 'None', value: '_none_' }, { label: '1px (All Sides)', value: 'border' },
  { label: '2px (All Sides)', value: 'border-2' }, { label: '4px (All Sides)', value: 'border-4' },
  { label: 'Top (1px)', value: 'border-t' }, { label: 'Bottom (1px)', value: 'border-b' },
  { label: 'Left (1px)', value: 'border-l' }, { label: 'Right (1px)', value: 'border-r' },
];

export const MIN_HEIGHT_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'Auto', value: '_auto_' }, { label: 'Small (40px)', value: 'min-h-[40px]' },
  { label: 'Medium (80px)', value: 'min-h-[80px]' }, { label: 'Artwork Default (120px)', value: 'min-h-[120px]' },
  { label: 'Large (180px)', value: 'min-h-[180px]' },
];

export const FRAME_STYLES: Array<{ label: string; value: string }> = [
  { label: 'Standard', value: 'standard' }, { label: "Custom Colors", value: "custom" },
  { label: 'Classic Gold', value: 'classic-gold' }, { label: 'Minimal Dark', value: 'minimal-dark' },
  { label: 'Arcane Purple', value: 'arcane-purple' },
];

export const CARD_BORDER_STYLES: Array<{ label: string; value: TCGCardTemplate['cardBorderStyle'] }> = [
  { label: 'Default (from theme/frame)', value: '_default_' }, // Corrected from ''
  { label: 'Solid', value: 'solid' },
  { label: 'Dashed', value: 'dashed' },
  { label: 'Dotted', value: 'dotted' },
  { label: 'Double', value: 'double' },
  { label: 'None', value: 'none' },
];


export const createDefaultSection = (type: CardSectionType, id?: string, overrides?: Partial<CardSection>): CardSection => {
  const sectionId = id || nanoid();
  // Simpler baseSection, as it was before the "undefined errors" mitigation
  const baseSection: CardSection = {
    id: sectionId,
    type,
    contentPlaceholder: '', // Will be overridden
    // Not all optional props are initialized here in this reverted state
    fontFamily: 'font-sans',
    fontSize: 'text-sm',
    fontWeight: 'font-normal',
    textAlign: 'left',
    fontStyle: 'normal',
    padding: 'p-1',
    flexGrow: 0,
    customHeight: '',
    customWidth: '',
    minHeight: '_auto_',
    borderWidth: '_none_',
  };

  let specificContentPlaceholder = `{{${type.toLowerCase().replace(/\s+/g, '')}}}`;
  let specificOverrides: Partial<CardSection> = { flexGrow: 1 };

  switch (type) {
    case 'CardName':
      specificContentPlaceholder = '{{cardName:"New Card"}}';
      specificOverrides = { ...specificOverrides, fontFamily: 'font-cinzel', fontSize: 'text-lg', fontWeight: 'font-bold', padding: 'px-2 pt-1 pb-0', textAlign: 'left' };
      break;
    case 'ManaCost':
      specificContentPlaceholder = '{{manaCost:"X"}}';
      specificOverrides = { fontFamily: 'font-lato', fontSize: 'text-base', fontWeight: 'font-bold', textAlign: 'right', padding: 'px-2 pt-1 pb-0', flexGrow: 0 };
      break;
    case 'Artwork':
      specificContentPlaceholder = '{{artworkUrl}}';
      specificOverrides = { minHeight: 'min-h-[120px]', padding: 'p-0', borderWidth: '_none_', flexGrow: 1, customHeight: '120px', customWidth: '100%' };
      break;
    case 'TypeLine':
      specificContentPlaceholder = '{{cardType:"Type"}} \u2014 {{subTypes:"Subtype"}}';
      specificOverrides = { ...specificOverrides, fontFamily: 'font-lato', fontWeight: 'font-semibold', backgroundColor: 'hsl(var(--muted)/0.7)', padding: 'px-2 py-0.5', borderWidth: 'border-y', fontSize: 'text-sm', textAlign: 'left' };
      break;
    case 'RulesText':
      specificContentPlaceholder = '{{rulesText:"Card effects and abilities."}}';
      specificOverrides = { ...specificOverrides, fontFamily: 'font-serif', minHeight: 'min-h-[80px]', padding: 'p-2', fontSize: 'text-sm' };
      break;
    case 'FlavorText':
      specificContentPlaceholder = '"{{flavorText:"An evocative quote or description."}}"';
      specificOverrides = { ...specificOverrides, fontFamily: 'font-serif', fontStyle: 'italic', fontSize: 'text-xs', minHeight: 'min-h-[40px]', padding: 'p-2 pt-1', borderWidth: 'border-t', customHeight: '40px' };
      break;
    case 'PowerToughness':
      specificContentPlaceholder = '{{power:"X"}}/{{toughness:"Y"}}';
      specificOverrides = { fontFamily: 'font-lato', fontWeight: 'font-bold', fontSize: 'text-lg', textAlign: 'right', padding: 'px-2 py-1', backgroundColor: 'hsl(var(--muted)/0.7)', borderWidth: 'border-t', flexGrow: 0 };
      break;
    case 'ArtistCredit':
      specificContentPlaceholder = 'Illus. {{artistName:"Artist"}} \u2022 {{rarity:"Common"}}';
      specificOverrides = { fontFamily: 'font-lato', fontSize: 'text-xs', padding: 'px-2 pb-1 pt-0.5', textAlign: 'left', flexGrow: 0, customHeight: 'auto' };
      break;
    case 'CustomText':
      specificContentPlaceholder = '{{customValue:"Custom Text"}}';
      specificOverrides = { ...specificOverrides, fontFamily: 'font-sans', padding: 'p-1', fontSize: 'text-sm' };
      break;
    case 'Divider':
      specificContentPlaceholder = '';
      specificOverrides = { minHeight: '_auto_', backgroundColor: 'hsl(var(--border))', padding: 'my-1 mx-2', fontSize: 'text-sm', flexGrow: 0, customHeight: '1px', customWidth: 'auto' };
      break;
    default:
      specificOverrides = { ...specificOverrides, fontSize: 'text-sm' };
      break;
  }
  return {
    ...baseSection,
    contentPlaceholder: specificContentPlaceholder,
    ...specificOverrides,
    ...overrides,
  } as CardSection;
};

export const createDefaultRow = (id: string, columns: CardSection[] = [], alignItems: CardRow['alignItems'] = 'flex-start', customHeight: string = ''): CardRow => {
  return {
    id: id,
    columns: columns, // Will be populated with sections having IDs
    alignItems: alignItems,
    customHeight: customHeight,
  };
};

// DEFAULT_TEMPLATES will use hardcoded IDs for all nested structures
export const DEFAULT_TEMPLATES: TCGCardTemplate[] = [
  {
    id: 'sfc-v6-stable-id', name: 'Standard Fantasy Creature', aspectRatio: TCG_ASPECT_RATIO,
    frameStyle: 'standard', baseBackgroundColor: '', baseTextColor: '', legacyFrameColor: '', defaultSectionBorderColor: '',
    cardBorderColor: '', cardBorderWidth: '', cardBorderStyle: '_default_', cardBorderRadius: '',
    rows: [
      { id: 'sfc-row1-namecost-v6-id', alignItems: 'center', customHeight: '', columns: [
        createDefaultSection('CardName', 'sfc-sec1-name-v6-id', { flexGrow: 1 }),
        createDefaultSection('ManaCost', 'sfc-sec2-cost-v6-id', { flexGrow: 0 }),
      ]},
      { id: 'sfc-row2-art-v6-id', alignItems: 'flex-start', customHeight: '', columns: [
        createDefaultSection('Artwork', 'sfc-sec3-art-v6-id')
      ]},
      { id: 'sfc-row3-type-v6-id', alignItems: 'flex-start', customHeight: '', columns: [
        createDefaultSection('TypeLine', 'sfc-sec4-type-v6-id')
      ]},
      { id: 'sfc-row4-rules-v6-id', alignItems: 'flex-start', customHeight: '', columns: [
        createDefaultSection('RulesText', 'sfc-sec5-rules-v6-id')
      ]},
      { id: 'sfc-row5-flavorpt-v6-id', alignItems: 'flex-end', customHeight: '', columns: [
         createDefaultSection('FlavorText', 'sfc-sec6-flavor-v6-id', { flexGrow: 1 }),
         createDefaultSection('PowerToughness', 'sfc-sec7-pt-v6-id', { flexGrow: 0 })
      ]},
      { id: 'sfc-row6-artist-v6-id', alignItems: 'flex-start', customHeight: '', columns: [
        createDefaultSection('ArtistCredit', 'sfc-sec8-artist-v6-id', { flexGrow: 0, customHeight: 'auto' })
      ]},
    ]
  },
  {
    id: 'mtg-sorcery-v1-id', name: 'MTG - Sorcery', aspectRatio: TCG_ASPECT_RATIO,
    frameStyle: 'standard', baseBackgroundColor: '', baseTextColor: '', legacyFrameColor: '', defaultSectionBorderColor: '',
    cardBorderColor: '', cardBorderWidth: '', cardBorderStyle: '_default_', cardBorderRadius: '',
    rows: [
      { id: 'sorc-r1-namecost-v1-id', alignItems: 'center', customHeight: '', columns: [
        createDefaultSection('CardName', 'sorc-s1-name-v1-id', { flexGrow: 1, contentPlaceholder: '{{cardName:"Arcane Blast"}}' }),
        createDefaultSection('ManaCost', 'sorc-s2-cost-v1-id', { flexGrow: 0, contentPlaceholder: '{{manaCost:"1R"}}' }),
      ]},
      { id: 'sorc-r2-art-v1-id', alignItems: 'flex-start', customHeight: '', columns: [
        createDefaultSection('Artwork', 'sorc-s3-art-v1-id', { contentPlaceholder: '{{artworkUrl}}' })
      ]},
      { id: 'sorc-r3-type-v1-id', alignItems: 'flex-start', customHeight: '', columns: [
        createDefaultSection('TypeLine', 'sorc-s4-type-v1-id', { contentPlaceholder: '{{cardType:"Sorcery"}}' })
      ]},
      { id: 'sorc-r4-rules-v1-id', alignItems: 'flex-start', customHeight: '', columns: [
        createDefaultSection('RulesText', 'sorc-s5-rules-v1-id', { contentPlaceholder: '{{rulesText:"Deal 3 damage to any target."}}' })
      ]},
      { id: 'sorc-r5-flavor-v1-id', alignItems: 'flex-start', customHeight: '', columns: [
        createDefaultSection('FlavorText', 'sorc-s6-flavor-v1-id', { contentPlaceholder: '"{{flavorText:"Magic unbound."}}"'})
      ]},
      { id: 'sorc-r6-artist-v1-id', alignItems: 'flex-start', customHeight: '', columns: [
        createDefaultSection('ArtistCredit', 'sorc-s7-artist-v1-id', { flexGrow: 0, customHeight: 'auto', contentPlaceholder: 'Illus. {{artistName:"Artist"}} \u2022 {{rarity:"Common"}}' })
      ]},
    ]
  },
  // ... (Similar structure for Instant, Land, Artifact, Enchantment, Planeswalker, Basic Custom Card)
  // Ensuring all IDs are hardcoded and createDefaultSection is used with explicit IDs
  {
    id: 'mtg-instant-v1-id', name: 'MTG - Instant', aspectRatio: TCG_ASPECT_RATIO,
    frameStyle: 'standard', baseBackgroundColor: '', baseTextColor: '', legacyFrameColor: '', defaultSectionBorderColor: '',
    cardBorderColor: '', cardBorderWidth: '', cardBorderStyle: '_default_', cardBorderRadius: '',
    rows: [
      { id: 'inst-r1-namecost-v1-id', alignItems: 'center', customHeight: '', columns: [
        createDefaultSection('CardName', 'inst-s1-name-v1-id', { flexGrow: 1, contentPlaceholder: '{{cardName:"Counterspell"}}' }),
        createDefaultSection('ManaCost', 'inst-s2-cost-v1-id', { flexGrow: 0, contentPlaceholder: '{{manaCost:"UU"}}' }),
      ]},
      { id: 'inst-r2-art-v1-id', alignItems: 'flex-start', customHeight: '', columns: [createDefaultSection('Artwork', 'inst-s3-art-v1-id')]},
      { id: 'inst-r3-type-v1-id', alignItems: 'flex-start', customHeight: '', columns: [createDefaultSection('TypeLine', 'inst-s4-type-v1-id', { contentPlaceholder: '{{cardType:"Instant"}}' })]},
      { id: 'inst-r4-rules-v1-id', alignItems: 'flex-start', customHeight: '', columns: [createDefaultSection('RulesText', 'inst-s5-rules-v1-id', { contentPlaceholder: '{{rulesText:"Counter target spell."}}' })]},
      { id: 'inst-r5-flavor-v1-id', alignItems: 'flex-start', customHeight: '', columns: [createDefaultSection('FlavorText', 'inst-s6-flavor-v1-id', { contentPlaceholder: '"{{flavorText:"Not this time."}}"'})]},
      { id: 'inst-r6-artist-v1-id', alignItems: 'flex-start', customHeight: '', columns: [createDefaultSection('ArtistCredit', 'inst-s7-artist-v1-id', { flexGrow: 0, customHeight: 'auto' })]},
    ]
  },
  {
    id: 'mtg-land-v1-id', name: 'MTG - Land', aspectRatio: TCG_ASPECT_RATIO,
    frameStyle: 'standard', baseBackgroundColor: '', baseTextColor: '', legacyFrameColor: '', defaultSectionBorderColor: '',
    cardBorderColor: '', cardBorderWidth: '', cardBorderStyle: '_default_', cardBorderRadius: '',
    rows: [
      { id: 'land-r1-name-v1-id', alignItems: 'center', customHeight: '', columns: [
        createDefaultSection('CardName', 'land-s1-name-v1-id', { flexGrow: 1, contentPlaceholder: '{{cardName:"Mystic Sanctuary"}}' }),
        createDefaultSection('CustomText', 'land-s2-symbol-v1-id', { flexGrow: 0, contentPlaceholder: '{{landSymbol:""}}', textAlign: 'right'}),
      ]},
      { id: 'land-r2-art-v1-id', alignItems: 'flex-start', customHeight: '', columns: [createDefaultSection('Artwork', 'land-s3-art-v1-id', { customHeight: '160px' })]},
      { id: 'land-r3-type-v1-id', alignItems: 'flex-start', customHeight: '', columns: [createDefaultSection('TypeLine', 'land-s4-type-v1-id', { contentPlaceholder: '{{cardType:"Land"}} \u2014 {{subTypes:"Island"}}' })]},
      { id: 'land-r4-rules-v1-id', alignItems: 'flex-start', customHeight: '', columns: [createDefaultSection('RulesText', 'land-s5-rules-v1-id', { minHeight: 'min-h-[60px]', contentPlaceholder: '{{rulesText:"({T}: Add {U}.)\\nMystic Sanctuary enters the battlefield tapped unless you control three or more other Islands."}}' })]},
      { id: 'land-r5-flavor-v1-id', alignItems: 'flex-start', customHeight: '', columns: [createDefaultSection('FlavorText', 'land-s6-flavor-v1-id', { contentPlaceholder: '"{{flavorText:"A place of ancient power."}}"'})]},
      { id: 'land-r6-artist-v1-id', alignItems: 'flex-start', customHeight: '', columns: [createDefaultSection('ArtistCredit', 'land-s7-artist-v1-id', { flexGrow: 0, customHeight: 'auto' })]},
    ]
  },
  {
    id: 'mtg-artifact-v1-id', name: 'MTG - Artifact', aspectRatio: TCG_ASPECT_RATIO,
    frameStyle: 'standard', baseBackgroundColor: '#d1d5db', baseTextColor: '#1f2937', legacyFrameColor: '', defaultSectionBorderColor: '',
    cardBorderColor: '', cardBorderWidth: '', cardBorderStyle: '_default_', cardBorderRadius: '',
    rows: [
      { id: 'artf-r1-namecost-v1-id', alignItems: 'center', customHeight: '', columns: [
        createDefaultSection('CardName', 'artf-s1-name-v1-id', { flexGrow: 1, contentPlaceholder: '{{cardName:"Sol Ring"}}' }),
        createDefaultSection('ManaCost', 'artf-s2-cost-v1-id', { flexGrow: 0, contentPlaceholder: '{{manaCost:"1"}}' }),
      ]},
      { id: 'artf-r2-art-v1-id', alignItems: 'flex-start', customHeight: '', columns: [createDefaultSection('Artwork', 'artf-s3-art-v1-id')]},
      { id: 'artf-r3-type-v1-id', alignItems: 'flex-start', customHeight: '', columns: [createDefaultSection('TypeLine', 'artf-s4-type-v1-id', { contentPlaceholder: '{{cardType:"Artifact"}}' })]},
      { id: 'artf-r4-rules-v1-id', alignItems: 'flex-start', customHeight: '', columns: [createDefaultSection('RulesText', 'artf-s5-rules-v1-id', { minHeight: 'min-h-[60px]', contentPlaceholder: '{{rulesText:"{T}: Add {C}{C}."}}' })]},
      { id: 'artf-r5-flavor-v1-id', alignItems: 'flex-start', customHeight: '', columns: [createDefaultSection('FlavorText', 'artf-s6-flavor-v1-id', { contentPlaceholder: '"{{flavorText:"A source of immense power."}}"'})]},
      { id: 'artf-r6-artist-v1-id', alignItems: 'flex-start', customHeight: '', columns: [createDefaultSection('ArtistCredit', 'artf-s7-artist-v1-id', { flexGrow: 0, customHeight: 'auto' })]},
    ]
  },
  {
    id: 'mtg-enchantment-v1-id', name: 'MTG - Enchantment', aspectRatio: TCG_ASPECT_RATIO,
    frameStyle: 'standard', baseBackgroundColor: '', baseTextColor: '', legacyFrameColor: '', defaultSectionBorderColor: '',
    cardBorderColor: '', cardBorderWidth: '', cardBorderStyle: '_default_', cardBorderRadius: '',
    rows: [
      { id: 'ench-r1-namecost-v1-id', alignItems: 'center', customHeight: '', columns: [
        createDefaultSection('CardName', 'ench-s1-name-v1-id', { flexGrow: 1, contentPlaceholder: '{{cardName:"Rhystic Study"}}' }),
        createDefaultSection('ManaCost', 'ench-s2-cost-v1-id', { flexGrow: 0, contentPlaceholder: '{{manaCost:"2U"}}' }),
      ]},
      { id: 'ench-r2-art-v1-id', alignItems: 'flex-start', customHeight: '', columns: [createDefaultSection('Artwork', 'ench-s3-art-v1-id')]},
      { id: 'ench-r3-type-v1-id', alignItems: 'flex-start', customHeight: '', columns: [createDefaultSection('TypeLine', 'ench-s4-type-v1-id', { contentPlaceholder: '{{cardType:"Enchantment"}}' })]},
      { id: 'ench-r4-rules-v1-id', alignItems: 'flex-start', customHeight: '', columns: [createDefaultSection('RulesText', 'ench-s5-rules-v1-id', { contentPlaceholder: '{{rulesText:"Whenever an opponent casts a spell, you may draw a card unless that player pays {1}."}}' })]},
      { id: 'ench-r5-flavor-v1-id', alignItems: 'flex-start', customHeight: '', columns: [createDefaultSection('FlavorText', 'ench-s6-flavor-v1-id', { contentPlaceholder: '"{{flavorText:"Knowledge is power."}}"'})]},
      { id: 'ench-r6-artist-v1-id', alignItems: 'flex-start', customHeight: '', columns: [createDefaultSection('ArtistCredit', 'ench-s7-artist-v1-id', { flexGrow: 0, customHeight: 'auto' })]},
    ]
  },
  {
    id: 'mtg-planeswalker-v1-id', name: 'MTG - Planeswalker (Basic)', aspectRatio: TCG_ASPECT_RATIO,
    frameStyle: 'standard', baseBackgroundColor: '', baseTextColor: '', legacyFrameColor: '', defaultSectionBorderColor: '',
    cardBorderColor: '', cardBorderWidth: '', cardBorderStyle: '_default_', cardBorderRadius: '',
    rows: [
      { id: 'plns-r1-namecost-v1-id', alignItems: 'center', customHeight: '', columns: [
        createDefaultSection('CardName', 'plns-s1-name-v1-id', { flexGrow: 1, contentPlaceholder: '{{cardName:"Jace, Mind Sculptor"}}' }),
        createDefaultSection('ManaCost', 'plns-s2-cost-v1-id', { flexGrow: 0, contentPlaceholder: '{{manaCost:"2UU"}}' }),
      ]},
      { id: 'plns-r2-art-v1-id', alignItems: 'flex-start', customHeight: '', columns: [createDefaultSection('Artwork', 'plns-s3-art-v1-id', { customHeight: "100px" })]},
      { id: 'plns-r3-type-v1-id', alignItems: 'flex-start', customHeight: '', columns: [createDefaultSection('TypeLine', 'plns-s4-type-v1-id', { contentPlaceholder: '{{cardType:"Planeswalker"}} \u2014 {{subTypes:"Jace"}}' })]},
      { id: 'plns-r4-ability1-v1-id', alignItems: 'flex-start', customHeight: '', columns: [createDefaultSection('CustomText', 'plns-s5-ability1-v1-id', { contentPlaceholder: '{{loyaltyCost1:"+2"}}: {{abilityText1:"Look at the top card of target player\'s library. You may put that card on the bottom of that player\'s library."}}', padding: 'px-2 py-1', fontSize: 'text-xs', flexGrow: 1 })]},
      { id: 'plns-r5-divider1-v1-id', alignItems: 'flex-start', customHeight: '', columns: [createDefaultSection('Divider', 'plns-s6-divider1-v1-id')]},
      { id: 'plns-r6-ability2-v1-id', alignItems: 'flex-start', customHeight: '', columns: [createDefaultSection('CustomText', 'plns-s7-ability2-v1-id', { contentPlaceholder: '{{loyaltyCost2:"0"}}: {{abilityText2:"Draw three cards, then put two cards from your hand on top of your library in any order."}}', padding: 'px-2 py-1', fontSize: 'text-xs', flexGrow: 1 })]},
      { id: 'plns-r7-divider2-v1-id', alignItems: 'flex-start', customHeight: '', columns: [createDefaultSection('Divider', 'plns-s8-divider2-v1-id')]},
      { id: 'plns-r8-ability3-v1-id', alignItems: 'flex-start', customHeight: '', columns: [createDefaultSection('CustomText', 'plns-s9-ability3-v1-id', { contentPlaceholder: '{{loyaltyCost3:"-1"}}: {{abilityText3:"Return target creature to its owner\'s hand."}}', padding: 'px-2 py-1', fontSize: 'text-xs', flexGrow: 1 })]},
      { id: 'plns-r9-divider3-v1-id', alignItems: 'flex-start', customHeight: '', columns: [createDefaultSection('Divider', 'plns-s10-divider3-v1-id')]},
      { id: 'plns-r10-ability4-v1-id', alignItems: 'flex-start', customHeight: '', columns: [createDefaultSection('CustomText', 'plns-s11-ability4-v1-id', { contentPlaceholder: '{{loyaltyCost4:"-12"}}: {{abilityText4:"Exile all cards from target player\'s library, then that player shuffles their hand into their library."}}', padding: 'px-2 py-1', fontSize: 'text-xs', flexGrow: 1 })]},
      { id: 'plns-r11-loyalty-artist-v1-id', alignItems: 'flex-end', customHeight: '', columns: [
        createDefaultSection('ArtistCredit', 'plns-s12-artist-v1-id', { flexGrow: 1, customHeight: 'auto' }),
        createDefaultSection('PowerToughness', 'plns-s13-loyalty-v1-id', { contentPlaceholder: '{{loyalty:"3"}}', textAlign: 'right', padding: 'p-1', borderWidth: 'border-t-0 border-l-2 border-b-2', backgroundColor: 'hsl(var(--muted)/0.9)', flexGrow: 0 }),
      ]},
    ]
  },
  {
    id: 'bcc-v6-stable-id', name: 'Basic Custom Card (Row Layout)', aspectRatio: TCG_ASPECT_RATIO,
    frameStyle: 'minimal-dark', baseBackgroundColor: '', baseTextColor: '', legacyFrameColor: '', defaultSectionBorderColor: '',
    cardBorderColor: '', cardBorderWidth: '', cardBorderStyle: '_default_', cardBorderRadius: '',
    rows: [
      { id: 'bcc-row1-name-v6-id', alignItems: 'flex-start', customHeight: '', columns: [
        createDefaultSection('CardName', 'bcc-sec1-name-v6-id')
      ]},
      { id: 'bcc-row2-art-v6-id', alignItems: 'flex-start', customHeight: '', columns: [
        createDefaultSection('Artwork', 'bcc-sec2-art-v6-id')
      ]},
      { id: 'bcc-row3-custom-v6-id', alignItems: 'flex-start', customHeight: '', columns: [
        createDefaultSection('CustomText', 'bcc-sec3-custom-v6-id', {minHeight: 'min-h-[80px]'})
      ]},
    ]
  }
];

export const TCG_FIELD_DEFINITIONS: { key: string; label: string; type?: 'input' | 'textarea'; example?: string }[] = [
  { key: 'cardName', label: '{{cardName}}', type: 'input', example: 'Goblin Raider' },
  { key: 'manaCost', label: '{{manaCost}}', type: 'input', example: '1R' },
  { key: 'artworkUrl', label: '{{artworkUrl}}', type: 'input', example: 'https://placehold.co/600x400.png or data:image/...' },
  { key: 'cardType', label: '{{cardType}}', type: 'input', example: 'Creature' },
  { key: 'subTypes', label: '{{subTypes}}', type: 'input', example: 'Goblin Warrior' },
  { key: 'rulesText', label: '{{rulesText}}', type: 'textarea', example: 'Haste\\nWhen this enters, deal 1 damage.' },
  { key: 'flavorText', label: '{{flavorText}}', type: 'textarea', example: 'It charges mindlessly.' },
  { key: 'power', label: '{{power}}', type: 'input', example: '2' },
  { key: 'toughness', label: '{{toughness}}', type: 'input', example: '1' },
  { key: 'raritySymbol', label: '{{raritySymbol}}', type: 'input', example: 'C' },
  { key: 'artistName', label: '{{artistName}}', type: 'input', example: 'AI Artist' },
  { key: 'customValue', label: '{{customValue}}', type: 'input', example: 'Some text' },
  { key: 'level', label: '{{level}}', type: 'input' },
  { key: 'attribute', label: '{{attribute}}', type: 'input' },
  { key: 'energyCost', label: '{{energyCost}}', type: 'input' },
  { key: 'points', label: '{{points}}', type: 'input' },
  { key: 'effectText', label: '{{effectText}}', type: 'textarea' },
  { key: 'rarity', label: '{{rarity}}', type: 'input', example: 'Common' },
  { key: 'landSymbol', label: '{{landSymbol}}', type: 'input', example: '{T}'},
  { key: 'loyalty', label: '{{loyalty}}', type: 'input', example: '3'},
  { key: 'loyaltyCost1', label: '{{loyaltyCost1}}', type: 'input', example: '+1'},
  { key: 'abilityText1', label: '{{abilityText1}}', type: 'textarea', example: 'Draw a card.'},
  { key: 'loyaltyCost2', label: '{{loyaltyCost2}}', type: 'input', example: '-2'},
  { key: 'abilityText2', label: '{{abilityText2}}', type: 'textarea', example: 'Destroy target creature.'},
  { key: 'loyaltyCost3', label: '{{loyaltyCost3}}', type: 'input', example: '-7'},
  { key: 'abilityText3', label: '{{abilityText3}}', type: 'textarea', example: 'You get an emblem with...'},
  { key: 'loyaltyCost4', label: '{{loyaltyCost4}}', type: 'input', example: ''},
  { key: 'abilityText4', label: '{{abilityText4}}', type: 'textarea', example: ''},
];

export const TABS_CONFIG = [
  { value: "editor", label: "Template Editor", icon: EditorIcon }, // Changed from SquarePen
  { value: "generator", label: "Card Generator", icon: PackageOpen },
  { value: "contexts", label: "Context Sets", icon: ScrollText },
  { value: "ai", label: "AI Helper", icon: Wand2 },
];
