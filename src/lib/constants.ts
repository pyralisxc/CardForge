
import type { PaperSize, TCGCardTemplate, CardSection, CardSectionType, CardRow } from '@/types';
import { nanoid } from 'nanoid';

export const PAPER_SIZES: PaperSize[] = [
  { name: 'US Letter (8.5x11 in)', widthMm: 215.9, heightMm: 279.4 },
  { name: 'A4 (210x297 mm)', widthMm: 210, heightMm: 297 },
];

export const TCG_ASPECT_RATIO = '63:88'; // Standard TCG card aspect ratio

export const SECTION_TYPES: CardSectionType[] = [
  'CardName',
  'ManaCost',
  'Artwork',
  'TypeLine',
  'RulesText',
  'FlavorText',
  'PowerToughness',
  'ArtistCredit',
  'CustomText',
  'Divider'
];

export const FONT_SIZES: Array<{ label: string; value: CardSection['fontSize'] }> = [
  { label: 'X-Small (0.75rem)', value: 'text-xs' },
  { label: 'Small (0.875rem)', value: 'text-sm' },
  { label: 'Medium (1rem)', value: 'text-base' },
  { label: 'Large (1.125rem)', value: 'text-lg' },
  { label: 'X-Large (1.25rem)', value: 'text-xl' },
  { label: 'XX-Large (1.5rem)', value: 'text-2xl' },
];

export const FONT_WEIGHTS: Array<CardSection['fontWeight']> = ['font-normal', 'font-medium', 'font-semibold', 'font-bold'];
export const TEXT_ALIGNS: Array<CardSection['textAlign']> = ['left', 'center', 'right', 'justify'];
export const FONT_STYLES: Array<CardSection['fontStyle']> = ['normal', 'italic'];

export const ROW_ALIGN_ITEMS: Array<{ label: string; value: CardRow['alignItems'] }> = [
    { label: 'Align Top (flex-start)', value: 'flex-start' },
    { label: 'Align Middle (center)', value: 'center' },
    { label: 'Align Bottom (flex-end)', value: 'flex-end' },
    { label: 'Stretch to Fill (stretch)', value: 'stretch' },
    { label: 'Align Baselines (baseline)', value: 'baseline' },
  ];


export const AVAILABLE_FONTS: Array<{name: string, value: string}> = [
    { name: 'Default Sans-Serif', value: 'font-sans' },
    { name: 'Serif (Georgia-like)', value: 'font-serif' },
    { name: 'Monospaced', value: 'font-mono' },
    { name: 'Fantasy (Cinzel)', value: 'font-cinzel' },
    { name: 'Clean Sans (Lato)', value: 'font-lato' },
];

export const PADDING_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'None (0px)', value: 'p-0' },
  { label: 'XS (0.125rem)', value: 'p-0.5' },
  { label: 'S (0.25rem)', value: 'p-1' },
  { label: 'M (0.5rem)', value: 'p-2' },
  { label: 'L (0.75rem)', value: 'p-3' },
  { label: 'XL (1rem)', value: 'p-4' },
  { label: '2XL (1.5rem)', value: 'p-6' },
  { label: 'XS (X-axis)', value: 'px-0.5' },
  { label: 'S (X-axis)', value: 'px-1' },
  { label: 'M (X-axis)', value: 'px-2' },
  { label: 'L (X-axis)', value: 'px-3' },
  { label: 'XL (X-axis)', value: 'px-4' },
  { label: 'XS (Y-axis)', value: 'py-0.5' },
  { label: 'S (Y-axis)', value: 'py-1' },
  { label: 'M (Y-axis)', value: 'py-2' },
  { label: 'L (Y-axis)', value: 'py-3' },
  { label: 'XL (Y-axis)', value: 'py-4' },
];

export const BORDER_WIDTH_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'None', value: '_none_' },
  { label: '1px (All Sides)', value: 'border' },
  { label: '2px (All Sides)', value: 'border-2' },
  { label: '4px (All Sides)', value: 'border-4' },
  { label: 'Top (1px)', value: 'border-t' },
  { label: 'Top (2px)', value: 'border-t-2' },
  { label: 'Bottom (1px)', value: 'border-b' },
  { label: 'Bottom (2px)', value: 'border-b-2' },
  { label: 'Left (1px)', value: 'border-l' },
  { label: 'Left (2px)', value: 'border-l-2' },
  { label: 'Right (1px)', value: 'border-r' },
  { label: 'Right (2px)', value: 'border-r-2' },
  { label: 'Vertical (1px)', value: 'border-y' },
  { label: 'Vertical (2px)', value: 'border-y-2' },
  { label: 'Horizontal (1px)', value: 'border-x' },
  { label: 'Horizontal (2px)', value: 'border-x-2' },
];

export const MIN_HEIGHT_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'Auto', value: '_auto_' },
  { label: 'Extra Small (20px)', value: 'min-h-[20px]' },
  { label: 'Small (40px)', value: 'min-h-[40px]' },
  { label: 'Medium (80px)', value: 'min-h-[80px]' },
  { label: 'Large (120px)', value: 'min-h-[120px]' },
  { label: 'Artwork Default (180px)', value: 'min-h-[180px]' },
  { label: 'X-Large (240px)', value: 'min-h-[240px]' },
];

export const FRAME_STYLES: Array<{ label: string; value: string }> = [
  { label: 'Standard', value: 'standard' },
  { label: 'Classic Gold', value: 'classic-gold' },
  { label: 'Minimal Dark', value: 'minimal-dark' },
  { label: 'Arcane Purple', value: 'arcane-purple' },
];


export const createDefaultSection = (type: CardSectionType, id?: string, overrides?: Partial<CardSection>): CardSection => {
  const baseSection: Omit<CardSection, 'type' | 'id' | 'contentPlaceholder'> & { contentPlaceholder: string } = {
    contentPlaceholder: '',
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

  const sectionId = id || nanoid(); 
  let specificContentPlaceholder = `{{${type.toLowerCase().replace(/\s+/g, '')}}}`; 

  switch (type) {
    case 'CardName':
      specificContentPlaceholder = '{{cardName}}';
      return { ...baseSection, id: sectionId, type, contentPlaceholder: specificContentPlaceholder, fontFamily: 'font-cinzel', fontSize: 'text-lg', fontWeight: 'font-bold', padding: 'px-2 pt-1 pb-0', textAlign: 'left', flexGrow: 1, ...overrides };
    case 'ManaCost':
      specificContentPlaceholder = '{{manaCost}}';
      return { ...baseSection, id: sectionId, type, contentPlaceholder: specificContentPlaceholder, fontFamily: 'font-lato', fontSize: 'text-base', fontWeight: 'font-bold', textAlign: 'right', padding: 'px-2 pt-1 pb-0', flexGrow: 0, ...overrides };
    case 'Artwork':
      specificContentPlaceholder = '{{artworkUrl}}';
      return { ...baseSection, id: sectionId, type, contentPlaceholder: specificContentPlaceholder, backgroundColor: 'hsl(var(--muted))', minHeight: 'min-h-[180px]', padding: 'p-0', borderWidth: 'border-b-2', borderColor: 'hsl(var(--border))', flexGrow: 1, customHeight: '180px', customWidth: '100%', ...overrides };
    case 'TypeLine':
      specificContentPlaceholder = '{{cardType}} \u2014 {{subTypes}}';
      return { ...baseSection, id: sectionId, type, contentPlaceholder: specificContentPlaceholder, fontFamily: 'font-lato', fontWeight: 'font-semibold', backgroundColor: 'hsl(var(--muted)/0.7)', padding: 'px-2 py-0.5', borderWidth: 'border-y', borderColor: 'hsl(var(--border))', fontSize: 'text-sm', textAlign: 'left', flexGrow: 1, ...overrides };
    case 'RulesText':
      specificContentPlaceholder = '{{rulesText}}';
      return { ...baseSection, id: sectionId, type, contentPlaceholder: specificContentPlaceholder, fontFamily: 'font-serif', minHeight: 'min-h-[80px]', padding: 'p-2', fontSize: 'text-sm', flexGrow: 1, ...overrides };
    case 'FlavorText':
      specificContentPlaceholder = '"{{flavorText}}"';
      return { ...baseSection, id: sectionId, type, contentPlaceholder: specificContentPlaceholder, fontFamily: 'font-serif', fontStyle: 'italic', fontSize: 'text-xs', minHeight: 'min-h-[40px]', padding: 'p-2 pt-1', borderWidth: 'border-t', borderColor: 'hsl(var(--border))', flexGrow: 1, ...overrides };
    case 'PowerToughness':
      specificContentPlaceholder = '{{power}}/{{toughness}}';
      return { ...baseSection, id: sectionId, type, contentPlaceholder: specificContentPlaceholder, fontFamily: 'font-lato', fontWeight: 'font-bold', fontSize: 'text-lg', textAlign: 'right', padding: 'px-2 py-1', backgroundColor: 'hsl(var(--muted)/0.7)', borderWidth: 'border-t', borderColor: 'hsl(var(--border))', flexGrow: 0, ...overrides };
    case 'ArtistCredit':
      specificContentPlaceholder = 'Illus. {{artistName}} \u2022 {{rarity}}';
      return { ...baseSection, id: sectionId, type, contentPlaceholder: specificContentPlaceholder, fontFamily: 'font-lato', fontSize: 'text-xs', padding: 'px-2 pb-1 pt-0.5', textAlign: 'left', flexGrow: 1, ...overrides };
    case 'CustomText':
      specificContentPlaceholder = '{{customValue}}';
      return { ...baseSection, id: sectionId, type, contentPlaceholder: specificContentPlaceholder, fontFamily: 'font-sans', padding: 'p-1', fontSize: 'text-sm', flexGrow: 1, ...overrides };
    case 'Divider':
      return { ...baseSection, id: sectionId, type, contentPlaceholder: '', minHeight: 'min-h-[1px]', backgroundColor: 'hsl(var(--border))', padding: 'my-1 mx-2', fontSize: 'text-sm', flexGrow: 1, customHeight: '1px', customWidth: 'auto', ...overrides }; 
    default:
      const _exhaustiveCheck: never = type; 
      console.warn(`Unhandled section type in createDefaultSection: ${_exhaustiveCheck}`);
      return { ...baseSection, id: sectionId, type, contentPlaceholder: specificContentPlaceholder, fontSize: 'text-sm', ...overrides };
  }
};

export const createDefaultRow = (id?: string, columns: CardSection[] = [], alignItems: CardRow['alignItems'] = 'flex-start'): CardRow => {
    const rowId = id || nanoid();
    
    // Ensure columns passed in (especially for defaults) have IDs.
    // If creating a new row via UI, columns array might be empty initially.
    const processedColumns = columns.map(col => {
        if (!col.id && id) { // if row 'id' is provided, it's likely a default template, so column IDs should be stable too
            console.warn("A column in a default row was created without a hardcoded ID. This might lead to hydration issues. Forcing nanoid(), but please provide a stable ID in DEFAULT_TEMPLATES definition for this column.", col);
            return { ...col, id: nanoid() };
        } else if (!col.id) {
            return { ...col, id: nanoid() }; // For dynamically added columns in UI
        }
        return col;
    });

    return {
      id: rowId!, 
      columns: processedColumns,
      alignItems,
      customHeight: '', // Initialize customHeight for rows
    };
  };


// --- DEFAULT TEMPLATES (Using Rows and Columns) ---
export const DEFAULT_TEMPLATES: TCGCardTemplate[] = [
  {
    id: 'sfc-v6-stable-id', // Standard Fantasy Creature
    name: 'Standard Fantasy Creature (Row Layout)',
    aspectRatio: TCG_ASPECT_RATIO,
    frameStyle: 'standard',
    baseBackgroundColor: '',
    baseTextColor: '',
    borderColor: '',
    rows: [
      createDefaultRow('sfc-row1-namecost-v6-id', [
        createDefaultSection('CardName', 'sfc-sec1-name-v6-id', { flexGrow: 1, textAlign: 'left' }),
        createDefaultSection('ManaCost', 'sfc-sec2-cost-v6-id', { flexGrow: 0, textAlign: 'right' }),
      ], 'center'),
      createDefaultRow('sfc-row2-art-v6-id', [createDefaultSection('Artwork', 'sfc-sec3-art-v6-id', {flexGrow: 1})]),
      createDefaultRow('sfc-row3-type-v6-id', [createDefaultSection('TypeLine', 'sfc-sec4-type-v6-id')]),
      createDefaultRow('sfc-row4-rules-v6-id', [createDefaultSection('RulesText', 'sfc-sec5-rules-v6-id', {flexGrow: 1})]),
      createDefaultRow('sfc-row5-flavorpt-v6-id', [
         createDefaultSection('FlavorText', 'sfc-sec6-flavor-v6-id', {flexGrow: 1}),
         createDefaultSection('PowerToughness', 'sfc-sec7-pt-v6-id', {flexGrow: 0, textAlign: 'right'})
      ], 'flex-end'),
      createDefaultRow('sfc-row6-artist-v6-id', [createDefaultSection('ArtistCredit', 'sfc-sec8-artist-v6-id')]),
    ]
  },
  {
    id: 'bcc-v6-stable-id', // Basic Custom Card
    name: 'Basic Custom Card (Row Layout)',
    aspectRatio: TCG_ASPECT_RATIO,
    frameStyle: 'minimal-dark',
    baseBackgroundColor: '',
    baseTextColor: '',
    borderColor: '',
    rows: [
      createDefaultRow('bcc-row1-name-v6-id', [createDefaultSection('CardName', 'bcc-sec1-name-v6-id')]),
      createDefaultRow('bcc-row2-art-v6-id', [createDefaultSection('Artwork', 'bcc-sec2-art-v6-id', {customHeight: '250px', flexGrow: 1})]),
      createDefaultRow('bcc-row3-custom-v6-id', [createDefaultSection('CustomText', 'bcc-sec3-custom-v6-id', {minHeight: 'min-h-[80px]', flexGrow: 1})]),
    ]
  }
];

export const TCG_FIELD_DEFINITIONS: { key: string; label: string; type?: 'input' | 'textarea'; example?: string }[] = [
  { key: 'cardName', label: 'Card Name', type: 'input', example: 'Goblin Raider' },
  { key: 'manaCost', label: 'Mana Cost', type: 'input', example: '1R' },
  { key: 'artworkUrl', label: 'Artwork URL / Data URI', type: 'input', example: 'https://placehold.co/600x400.png or data:image/...' },
  { key: 'cardType', label: 'Card Type', type: 'input', example: 'Creature' },
  { key: 'subTypes', label: 'Sub-Types', type: 'input', example: 'Goblin Warrior' },
  { key: 'rulesText', label: 'Rules Text / Abilities', type: 'textarea', example: 'Haste\\nWhen this enters, deal 1 damage.' },
  { key: 'flavorText', label: 'Flavor Text', type: 'textarea', example: 'It charges mindlessly.' },
  { key: 'power', label: 'Power', type: 'input', example: '2' },
  { key: 'toughness', label: 'Toughness', type: 'input', example: '1' },
  { key: 'raritySymbol', label: 'Rarity Symbol (Text)', type: 'input', example: 'C' },
  { key: 'artistName', label: 'Artist Name', type: 'input', example: 'AI Artist' },
  { key: 'customValue', label: 'Custom Value', type: 'input', example: 'Some text' },
  { key: 'level', label: 'Level', type: 'input' },
  { key: 'attribute', label: 'Attribute', type: 'input' },
  { key: 'energyCost', label: 'Energy Cost', type: 'input' },
  { key: 'points', label: 'Points', type: 'input' },
  { key: 'effectText', label: 'Effect Text', type: 'textarea' },
  { key: 'rarity', label: 'Rarity', type: 'input', example: 'Common' },
];
