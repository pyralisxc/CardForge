
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
  'PowerToughness', // Also used for Planeswalker Loyalty
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
  { label: 'Artwork Default (120px)', value: 'min-h-[120px]' },
  { label: 'X-Large (180px)', value: 'min-h-[180px]' },
  { label: 'XX-Large (240px)', value: 'min-h-[240px]' },
];

export const FRAME_STYLES: Array<{ label: string; value: string }> = [
  { label: 'Standard', value: 'standard' },
  { label: 'Classic Gold', value: 'classic-gold' },
  { label: 'Minimal Dark', value: 'minimal-dark' },
  { label: 'Arcane Purple', value: 'arcane-purple' },
];


export const createDefaultSection = (id: string, type: CardSectionType, overrides?: Partial<CardSection>): CardSection => {
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

  let specificContentPlaceholder = `{{${type.toLowerCase().replace(/\s+/g, '')}}}`; 

  switch (type) {
    case 'CardName':
      specificContentPlaceholder = '{{cardName:"New Card"}}';
      return { ...baseSection, id, type, contentPlaceholder: specificContentPlaceholder, fontFamily: 'font-cinzel', fontSize: 'text-lg', fontWeight: 'font-bold', padding: 'px-2 pt-1 pb-0', textAlign: 'left', flexGrow: 1, ...overrides };
    case 'ManaCost':
      specificContentPlaceholder = '{{manaCost:"X"}}';
      return { ...baseSection, id, type, contentPlaceholder: specificContentPlaceholder, fontFamily: 'font-lato', fontSize: 'text-base', fontWeight: 'font-bold', textAlign: 'right', padding: 'px-2 pt-1 pb-0', flexGrow: 0, ...overrides };
    case 'Artwork':
      specificContentPlaceholder = '{{artworkUrl:"https://placehold.co/600x400.png?text=Artwork"}}';
      return { ...baseSection, id, type, contentPlaceholder: specificContentPlaceholder, backgroundColor: 'hsl(var(--muted))', minHeight: 'min-h-[120px]', padding: 'p-0', borderWidth: 'border-b-2', borderColor: 'hsl(var(--border))', flexGrow: 1, customHeight: '120px', customWidth: '100%', ...overrides };
    case 'TypeLine':
      specificContentPlaceholder = '{{cardType:"Type"}} \u2014 {{subTypes:"Subtype"}}';
      return { ...baseSection, id, type, contentPlaceholder: specificContentPlaceholder, fontFamily: 'font-lato', fontWeight: 'font-semibold', backgroundColor: 'hsl(var(--muted)/0.7)', padding: 'px-2 py-0.5', borderWidth: 'border-y', borderColor: 'hsl(var(--border))', fontSize: 'text-sm', textAlign: 'left', flexGrow: 1, ...overrides };
    case 'RulesText':
      specificContentPlaceholder = '{{rulesText:"Card effects and abilities."}}';
      return { ...baseSection, id, type, contentPlaceholder: specificContentPlaceholder, fontFamily: 'font-serif', minHeight: 'min-h-[80px]', padding: 'p-2', fontSize: 'text-sm', flexGrow: 1, ...overrides };
    case 'FlavorText':
      specificContentPlaceholder = '"{{flavorText:"An evocative quote or description."}}"';
      return { ...baseSection, id, type, contentPlaceholder: specificContentPlaceholder, fontFamily: 'font-serif', fontStyle: 'italic', fontSize: 'text-xs', minHeight: 'min-h-[40px]', padding: 'p-2 pt-1', borderWidth: 'border-t', borderColor: 'hsl(var(--border))', flexGrow: 1, customHeight: '40px', ...overrides };
    case 'PowerToughness':
      specificContentPlaceholder = '{{power:"X"}}/{{toughness:"Y"}}'; // Also for loyalty: '{{loyalty:"L"}}'
      return { ...baseSection, id, type, contentPlaceholder: specificContentPlaceholder, fontFamily: 'font-lato', fontWeight: 'font-bold', fontSize: 'text-lg', textAlign: 'right', padding: 'px-2 py-1', backgroundColor: 'hsl(var(--muted)/0.7)', borderWidth: 'border-t', borderColor: 'hsl(var(--border))', flexGrow: 0, ...overrides };
    case 'ArtistCredit':
      specificContentPlaceholder = 'Illus. {{artistName:"Artist"}} \u2022 {{rarity:"Common"}}';
      return { ...baseSection, id, type, contentPlaceholder: specificContentPlaceholder, fontFamily: 'font-lato', fontSize: 'text-xs', padding: 'px-2 pb-1 pt-0.5', textAlign: 'left', flexGrow: 1, ...overrides };
    case 'CustomText':
      specificContentPlaceholder = '{{customValue:"Custom Text"}}';
      return { ...baseSection, id, type, contentPlaceholder: specificContentPlaceholder, fontFamily: 'font-sans', padding: 'p-1', fontSize: 'text-sm', flexGrow: 1, ...overrides };
    case 'Divider':
      return { ...baseSection, id, type, contentPlaceholder: '', minHeight: '_auto_', backgroundColor: 'hsl(var(--border))', padding: 'my-1 mx-2', fontSize: 'text-sm', flexGrow: 1, customHeight: '1px', customWidth: 'auto', ...overrides }; 
    default:
      const _exhaustiveCheck: never = type; 
      console.warn(`Unhandled section type in createDefaultSection: ${_exhaustiveCheck}`);
      return { ...baseSection, id, type, contentPlaceholder: specificContentPlaceholder, fontSize: 'text-sm', ...overrides };
  }
};

export const createDefaultRow = (id: string, columns: CardSection[] = [], alignItems: CardRow['alignItems'] = 'flex-start', customHeight: string = ''): CardRow => {
    const processedColumns = columns.map(col => {
        if (!col.id) { 
            console.warn("A column in a default row was created without a hardcoded ID. Please provide a stable ID in DEFAULT_TEMPLATES definition for this column:", col);
            return { ...col, id: nanoid() }; // Fallback for dynamic cases, NOT for DEFAULT_TEMPLATES
        }
        return col;
    });

    return {
      id: id, 
      columns: processedColumns,
      alignItems,
      customHeight: customHeight || '',
    };
  };


// --- DEFAULT TEMPLATES (Using Rows and Columns) ---
// ALL IDs within DEFAULT_TEMPLATES must be hardcoded static strings.
export const DEFAULT_TEMPLATES: TCGCardTemplate[] = [
  {
    id: 'sfc-v6-stable-id', 
    name: 'MTG - Standard Creature',
    aspectRatio: TCG_ASPECT_RATIO,
    frameStyle: 'standard',
    baseBackgroundColor: '',
    baseTextColor: '',
    borderColor: '',
    legacyFrameColor: '',
    rows: [
      createDefaultRow('sfc-row1-namecost-v6', [
        createDefaultSection('sfc-sec1-name-v6', 'CardName', { flexGrow: 1, textAlign: 'left' }),
        createDefaultSection('sfc-sec2-cost-v6', 'ManaCost', { flexGrow: 0, textAlign: 'right' }),
      ], 'center'),
      createDefaultRow('sfc-row2-art-v6', [createDefaultSection('sfc-sec3-art-v6', 'Artwork', {flexGrow: 1, customHeight: '120px'})]),
      createDefaultRow('sfc-row3-type-v6', [createDefaultSection('sfc-sec4-type-v6', 'TypeLine')]),
      createDefaultRow('sfc-row4-rules-v6', [createDefaultSection('sfc-sec5-rules-v6', 'RulesText', {flexGrow: 1})]),
      createDefaultRow('sfc-row5-flavorpt-v6', [
         createDefaultSection('sfc-sec6-flavor-v6', 'FlavorText', {flexGrow: 1, contentPlaceholder: '"{{flavorText:"Its roar is its battle cry."}}"'}),
         createDefaultSection('sfc-sec7-pt-v6', 'PowerToughness', {flexGrow: 0, textAlign: 'right'})
      ], 'flex-end'),
      createDefaultRow('sfc-row6-artist-v6', [createDefaultSection('sfc-sec8-artist-v6', 'ArtistCredit', { flexGrow: 0, customHeight: 'auto' })]),
    ]
  },
  {
    id: 'mtg-sorcery-v1', 
    name: 'MTG - Sorcery',
    aspectRatio: TCG_ASPECT_RATIO,
    frameStyle: 'standard',
    baseBackgroundColor: '',
    baseTextColor: '',
    borderColor: '',
    legacyFrameColor: '',
    rows: [
      createDefaultRow('sorc-r1-namecost-v1', [
        createDefaultSection('sorc-s1-name-v1', 'CardName', { flexGrow: 1, contentPlaceholder: '{{cardName:"Arcane Blast"}}' }),
        createDefaultSection('sorc-s2-cost-v1', 'ManaCost', { flexGrow: 0, contentPlaceholder: '{{manaCost:"1R"}}' }),
      ], 'center'),
      createDefaultRow('sorc-r2-art-v1', [createDefaultSection('sorc-s3-art-v1', 'Artwork',{customHeight: "120px"})]),
      createDefaultRow('sorc-r3-type-v1', [createDefaultSection('sorc-s4-type-v1', 'TypeLine', {contentPlaceholder: '{{cardType:"Sorcery"}}'})]),
      createDefaultRow('sorc-r4-rules-v1', [createDefaultSection('sorc-s5-rules-v1', 'RulesText', {flexGrow: 1, contentPlaceholder: '{{rulesText:"Deal 3 damage to any target."}}', customHeight: '80px'})]),
      createDefaultRow('sorc-r5-flavor-v1', [createDefaultSection('sorc-s6-flavor-v1', 'FlavorText', {flexGrow: 1, contentPlaceholder: '"{{flavorText:"Magic unbound."}}"', customHeight: '40px'})]),
      createDefaultRow('sorc-r6-artist-v1', [createDefaultSection('sorc-s7-artist-v1', 'ArtistCredit')]),
    ]
  },
  {
    id: 'mtg-instant-v1', 
    name: 'MTG - Instant',
    aspectRatio: TCG_ASPECT_RATIO,
    frameStyle: 'standard',
    baseBackgroundColor: '',
    baseTextColor: '',
    borderColor: '',
    legacyFrameColor: '',
    rows: [
      createDefaultRow('inst-r1-namecost-v1', [
        createDefaultSection('inst-s1-name-v1', 'CardName', { flexGrow: 1, contentPlaceholder: '{{cardName:"Counterspell"}}' }),
        createDefaultSection('inst-s2-cost-v1', 'ManaCost', { flexGrow: 0, contentPlaceholder: '{{manaCost:"UU"}}' }),
      ], 'center'),
      createDefaultRow('inst-r2-art-v1', [createDefaultSection('inst-s3-art-v1', 'Artwork',{customHeight: "120px"})]),
      createDefaultRow('inst-r3-type-v1', [createDefaultSection('inst-s4-type-v1', 'TypeLine', {contentPlaceholder: '{{cardType:"Instant"}}'})]),
      createDefaultRow('inst-r4-rules-v1', [createDefaultSection('inst-s5-rules-v1', 'RulesText', {flexGrow: 1, contentPlaceholder: '{{rulesText:"Counter target spell."}}', customHeight: '80px'})]),
      createDefaultRow('inst-r5-flavor-v1', [createDefaultSection('inst-s6-flavor-v1', 'FlavorText', {flexGrow: 1, contentPlaceholder: '"{{flavorText:"Not this time."}}"', customHeight: '40px'})]),
      createDefaultRow('inst-r6-artist-v1', [createDefaultSection('inst-s7-artist-v1', 'ArtistCredit')]),
    ]
  },
  {
    id: 'mtg-land-v1', 
    name: 'MTG - Land',
    aspectRatio: TCG_ASPECT_RATIO,
    frameStyle: 'standard',
    baseBackgroundColor: '',
    baseTextColor: '',
    borderColor: '',
    legacyFrameColor: '',
    rows: [
      createDefaultRow('land-r1-name-v1', [ 
        createDefaultSection('land-s1-name-v1', 'CardName', { flexGrow: 1, contentPlaceholder: '{{cardName:"Mystic Sanctuary"}}' }),
         createDefaultSection('land-s2-symbol-v1', 'CustomText', { flexGrow: 0, contentPlaceholder: '{{landSymbol:""}}', textAlign: 'right' }), 
      ], 'center'),
      createDefaultRow('land-r2-art-v1', [createDefaultSection('land-s3-art-v1', 'Artwork',{customHeight: "120px"})]),
      createDefaultRow('land-r3-type-v1', [createDefaultSection('land-s4-type-v1', 'TypeLine', {contentPlaceholder: '{{cardType:"Land"}} \u2014 {{subTypes:"Island"}}'})]),
      createDefaultRow('land-r4-rules-v1', [createDefaultSection('land-s5-rules-v1', 'RulesText', {flexGrow: 1, contentPlaceholder: '{{rulesText:"({T}: Add {U}.)\\nMystic Sanctuary enters the battlefield tapped unless you control three or more other Islands."}}', customHeight: '60px'})]),
      createDefaultRow('land-r5-flavor-v1', [createDefaultSection('land-s6-flavor-v1', 'FlavorText', {flexGrow: 1, contentPlaceholder: '"{{flavorText:"A place of ancient power."}}"', customHeight: '30px'})]),
      createDefaultRow('land-r6-artist-v1', [createDefaultSection('land-s7-artist-v1', 'ArtistCredit')]),
    ]
  },
  {
    id: 'mtg-artifact-v1', 
    name: 'MTG - Artifact',
    aspectRatio: TCG_ASPECT_RATIO,
    frameStyle: 'standard',
    baseBackgroundColor: '',
    baseTextColor: '',
    borderColor: '',
    legacyFrameColor: '',
    rows: [
      createDefaultRow('artf-r1-namecost-v1', [
        createDefaultSection('artf-s1-name-v1', 'CardName', { flexGrow: 1, contentPlaceholder: '{{cardName:"Sol Ring"}}' }),
        createDefaultSection('artf-s2-cost-v1', 'ManaCost', { flexGrow: 0, contentPlaceholder: '{{manaCost:"1"}}' }),
      ], 'center'),
      createDefaultRow('artf-r2-art-v1', [createDefaultSection('artf-s3-art-v1', 'Artwork',{customHeight: "120px"})]),
      createDefaultRow('artf-r3-type-v1', [createDefaultSection('artf-s4-type-v1', 'TypeLine', {contentPlaceholder: '{{cardType:"Artifact"}}'})]),
      createDefaultRow('artf-r4-rules-v1', [createDefaultSection('artf-s5-rules-v1', 'RulesText', {flexGrow: 1, contentPlaceholder: '{{rulesText:"{T}: Add {C}{C}."}}', customHeight: '80px'})]),
      createDefaultRow('artf-r5-flavor-v1', [createDefaultSection('artf-s6-flavor-v1', 'FlavorText', {flexGrow: 1, contentPlaceholder: '"{{flavorText:"A source of immense power."}}"', customHeight: '40px'})]),
      createDefaultRow('artf-r6-artist-v1', [createDefaultSection('artf-s7-artist-v1', 'ArtistCredit')]),
    ]
  },
  {
    id: 'mtg-enchantment-v1', 
    name: 'MTG - Enchantment',
    aspectRatio: TCG_ASPECT_RATIO,
    frameStyle: 'standard',
    baseBackgroundColor: '',
    baseTextColor: '',
    borderColor: '',
    legacyFrameColor: '',
    rows: [
      createDefaultRow('ench-r1-namecost-v1', [
        createDefaultSection('ench-s1-name-v1', 'CardName', { flexGrow: 1, contentPlaceholder: '{{cardName:"Rhystic Study"}}' }),
        createDefaultSection('ench-s2-cost-v1', 'ManaCost', { flexGrow: 0, contentPlaceholder: '{{manaCost:"2U"}}' }),
      ], 'center'),
      createDefaultRow('ench-r2-art-v1', [createDefaultSection('ench-s3-art-v1', 'Artwork',{customHeight: "120px"})]),
      createDefaultRow('ench-r3-type-v1', [createDefaultSection('ench-s4-type-v1', 'TypeLine', {contentPlaceholder: '{{cardType:"Enchantment"}}'})]),
      createDefaultRow('ench-r4-rules-v1', [createDefaultSection('ench-s5-rules-v1', 'RulesText', {flexGrow: 1, contentPlaceholder: '{{rulesText:"Whenever an opponent casts a spell, you may draw a card unless that player pays {1}."}}', customHeight: '80px'})]),
      createDefaultRow('ench-r5-flavor-v1', [createDefaultSection('ench-s6-flavor-v1', 'FlavorText', {flexGrow: 1, contentPlaceholder: '"{{flavorText:"Knowledge is power."}}"', customHeight: '40px'})]),
      createDefaultRow('ench-r6-artist-v1', [createDefaultSection('ench-s7-artist-v1', 'ArtistCredit')]),
    ]
  },
  {
    id: 'mtg-planeswalker-v1', 
    name: 'MTG - Planeswalker (Basic)',
    aspectRatio: TCG_ASPECT_RATIO,
    frameStyle: 'standard',
    baseBackgroundColor: '',
    baseTextColor: '',
    borderColor: '',
    legacyFrameColor: '',
    rows: [
      createDefaultRow('plns-r1-namecost-v1', [
        createDefaultSection('plns-s1-name-v1', 'CardName', { flexGrow: 1, contentPlaceholder: '{{cardName:"Jace, Mind Sculptor"}}' }),
        createDefaultSection('plns-s2-cost-v1', 'ManaCost', { flexGrow: 0, contentPlaceholder: '{{manaCost:"2UU"}}' }),
      ], 'center'),
      createDefaultRow('plns-r2-art-v1', [createDefaultSection('plns-s3-art-v1', 'Artwork',{customHeight: "120px"})]),
      createDefaultRow('plns-r3-type-v1', [createDefaultSection('plns-s4-type-v1', 'TypeLine', {contentPlaceholder: '{{cardType:"Planeswalker"}} \u2014 {{subTypes:"Jace"}}'})]),
      createDefaultRow('plns-r4-ability1-v1', [
          createDefaultSection('plns-s5-ability1-v1', 'CustomText', { flexGrow: 1, contentPlaceholder: '{{loyaltyCost1:"+2"}}: {{abilityText1:"Look at the top card of target player\'s library. You may put that card on the bottom of that player\'s library."}}', padding: 'px-2 py-1', fontSize: 'text-xs'}),
      ]),
      createDefaultRow('plns-r5-divider1-v1', [createDefaultSection('plns-s6-divider1-v1', 'Divider', {padding: 'my-0.5 mx-2'})]),
      createDefaultRow('plns-r6-ability2-v1', [
          createDefaultSection('plns-s7-ability2-v1', 'CustomText', { flexGrow: 1, contentPlaceholder: '{{loyaltyCost2:"0"}}: {{abilityText2:"Draw three cards, then put two cards from your hand on top of your library in any order."}}', padding: 'px-2 py-1', fontSize: 'text-xs'}),
      ]),
      createDefaultRow('plns-r7-divider2-v1', [createDefaultSection('plns-s8-divider2-v1', 'Divider', {padding: 'my-0.5 mx-2'})]),
      createDefaultRow('plns-r8-ability3-v1', [
          createDefaultSection('plns-s9-ability3-v1', 'CustomText', { flexGrow: 1, contentPlaceholder: '{{loyaltyCost3:"-1"}}: {{abilityText3:"Return target creature to its owner\'s hand."}}', padding: 'px-2 py-1', fontSize: 'text-xs'}),
      ]),
      createDefaultRow('plns-r9-divider3-v1', [createDefaultSection('plns-s10-divider3-v1', 'Divider', {padding: 'my-0.5 mx-2'})]),
       createDefaultRow('plns-r10-ability4-v1', [
          createDefaultSection('plns-s11-ability4-v1', 'CustomText', { flexGrow: 1, contentPlaceholder: '{{loyaltyCost4:"-12"}}: {{abilityText4:"Exile all cards from target player\'s library, then that player shuffles their hand into their library."}}', padding: 'px-2 py-1', fontSize: 'text-xs'}),
      ]),
      createDefaultRow('plns-r11-loyalty-artist-v1', [
        createDefaultSection('plns-s12-artist-v1', 'ArtistCredit', {flexGrow: 1}),
        createDefaultSection('plns-s13-loyalty-v1', 'PowerToughness', { flexGrow: 0, contentPlaceholder: '{{loyalty:"3"}}', textAlign: 'right', padding: 'p-1', borderWidth: 'border-t-0 border-l-2 border-b-2', borderColor: 'hsl(var(--border))'}),
      ], 'flex-end'),
    ]
  },
  {
    id: 'bcc-v6-stable-id', 
    name: 'Basic Custom Card (Row Layout)',
    aspectRatio: TCG_ASPECT_RATIO,
    frameStyle: 'minimal-dark',
    baseBackgroundColor: '',
    baseTextColor: '',
    borderColor: '',
    legacyFrameColor: '',
    rows: [
      createDefaultRow('bcc-row1-name-v6', [createDefaultSection('bcc-sec1-name-v6', 'CardName')]),
      createDefaultRow('bcc-row2-art-v6', [createDefaultSection('bcc-sec2-art-v6', 'Artwork', {customHeight: '120px', flexGrow: 1})]),
      createDefaultRow('bcc-row3-custom-v6', [createDefaultSection('bcc-sec3-custom-v6', 'CustomText', {minHeight: 'min-h-[80px]', flexGrow: 1})]),
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
  { key: 'landSymbol', label: 'Land Symbol', type: 'input', example: '{T}'},
  { key: 'loyalty', label: 'Loyalty', type: 'input', example: '3'},
  { key: 'loyaltyCost1', label: 'Loyalty Cost 1', type: 'input', example: '+1'},
  { key: 'abilityText1', label: 'Ability Text 1', type: 'textarea', example: 'Draw a card.'},
  { key: 'loyaltyCost2', label: 'Loyalty Cost 2', type: 'input', example: '-2'},
  { key: 'abilityText2', label: 'Ability Text 2', type: 'textarea', example: 'Destroy target creature.'},
  { key: 'loyaltyCost3', label: 'Loyalty Cost 3', type: 'input', example: '-7'},
  { key: 'abilityText3', label: 'Ability Text 3', type: 'textarea', example: 'You get an emblem with...'},
  { key: 'loyaltyCost4', label: 'Loyalty Cost 4', type: 'input', example: ''},
  { key: 'abilityText4', label: 'Ability Text 4', type: 'textarea', example: ''},
];


    