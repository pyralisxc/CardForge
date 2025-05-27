
import type { PaperSize, TCGCardTemplate, CardSection, CardSectionType } from '@/types';
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
  { label: 'X-Small (0.75rem / 12px)', value: 'text-xs' },
  { label: 'Small (0.875rem / 14px)', value: 'text-sm' },
  { label: 'Medium (1rem / 16px)', value: 'text-base' },
  { label: 'Large (1.125rem / 18px)', value: 'text-lg' },
  { label: 'X-Large (1.25rem / 20px)', value: 'text-xl' },
  { label: 'XX-Large (1.5rem / 24px)', value: 'text-2xl' },
];

export const FONT_WEIGHTS: Array<CardSection['fontWeight']> = ['font-normal', 'font-medium', 'font-semibold', 'font-bold'];
export const TEXT_ALIGNS: Array<CardSection['textAlign']> = ['left', 'center', 'right'];
export const FONT_STYLES: Array<CardSection['fontStyle']> = ['normal', 'italic'];

export const AVAILABLE_FONTS: Array<{name: string, value: string}> = [
    { name: 'Default Sans-Serif', value: 'font-sans' },
    { name: 'Serif (Georgia-like)', value: 'font-serif' },
    { name: 'Monospaced', value: 'font-mono' },
    { name: 'Fantasy (Cinzel)', value: 'font-cinzel' },
    { name: 'Clean Sans (Lato)', value: 'font-lato' },
];

export const PADDING_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'None', value: 'p-0' },
  { label: 'Tiny (0.25rem)', value: 'p-1' },
  { label: 'Small (0.5rem)', value: 'p-2' },
  { label: 'Medium (0.75rem)', value: 'p-3' },
  { label: 'Large (1rem)', value: 'p-4' },
  { label: 'X-Large (1.5rem)', value: 'p-6' },
  { label: 'Tiny (X)', value: 'px-1' },
  { label: 'Small (X)', value: 'px-2' },
  { label: 'Medium (X)', value: 'px-3' },
  { label: 'Large (X)', value: 'px-4' },
  { label: 'Tiny (Y)', value: 'py-1' },
  { label: 'Small (Y)', value: 'py-2' },
  { label: 'Medium (Y)', value: 'py-3' },
  { label: 'Large (Y)', value: 'py-4' },
];

export const BORDER_WIDTH_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'None', value: '' },
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
  { label: 'Auto', value: '' },
  { label: 'Extra Small (20px)', value: 'min-h-[20px]' },
  { label: 'Small (40px)', value: 'min-h-[40px]' },
  { label: 'Medium (80px)', value: 'min-h-[80px]' },
  { label: 'Large (120px)', value: 'min-h-[120px]' },
  { label: 'Artwork Default (180px)', value: 'min-h-[180px]' },
  { label: 'X-Large (240px)', value: 'min-h-[240px]' },
];


export const createDefaultSection = (type: CardSectionType, id?: string): CardSection => {
  const baseSection: Omit<CardSection, 'type' | 'id' | 'contentPlaceholder'> = {
    textColor: '#000000',
    backgroundColor: '',
    fontFamily: 'font-sans',
    fontSize: 'text-sm',
    fontWeight: 'font-normal',
    textAlign: 'left',
    fontStyle: 'normal',
    padding: 'p-1',
    borderColor: '',
    borderWidth: '',
    minHeight: '',
    flexGrow: false,
  };

  const sectionId = id || nanoid();

  switch (type) {
    case 'CardName':
      return { ...baseSection, id: sectionId, type, contentPlaceholder: '{{cardName}}', fontFamily: 'font-cinzel', fontSize: 'text-lg', fontWeight: 'font-bold', padding: 'px-2 pt-1.5 pb-0' };
    case 'ManaCost':
      return { ...baseSection, id: sectionId, type, contentPlaceholder: '{{manaCost}}', fontFamily: 'font-lato', fontSize: 'text-base', textAlign: 'right', padding: 'px-2 pt-1.5 pb-0' };
    case 'Artwork':
      return { ...baseSection, id: sectionId, type, contentPlaceholder: '{{artworkUrl}}', backgroundColor: '#CCCCCC', minHeight: 'min-h-[180px]', flexGrow: true, padding: 'p-0', borderWidth: 'border-2' };
    case 'TypeLine':
      return { ...baseSection, id: sectionId, type, contentPlaceholder: '{{cardType}} \u2014 {{subTypes}}', fontFamily: 'font-lato', fontWeight: 'font-semibold', backgroundColor: '#DDDDDD', padding: 'px-2 py-1', borderWidth: 'border-y', borderColor: '#AAAAAA', fontSize: 'text-sm'};
    case 'RulesText':
      return { ...baseSection, id: sectionId, type, contentPlaceholder: '{{rulesText}}', fontFamily: 'font-serif', minHeight: 'min-h-[80px]', flexGrow: true, backgroundColor: '#FFFFFF', padding: 'p-2', borderWidth: 'border', borderColor: '#CCCCCC', fontSize: 'text-sm'};
    case 'FlavorText':
      return { ...baseSection, id: sectionId, type, contentPlaceholder: '"{{flavorText}}"', fontFamily: 'font-serif', fontStyle: 'italic', fontSize: 'text-xs', minHeight: 'min-h-[40px]', backgroundColor: '#FFFFFF', padding: 'p-2 pt-1', borderWidth: 'border-t', borderColor: '#DDDDDD' };
    case 'PowerToughness':
      return { ...baseSection, id: sectionId, type, contentPlaceholder: '{{power}}/{{toughness}}', fontFamily: 'font-lato', fontWeight: 'font-bold', fontSize: 'text-lg', textAlign: 'right', padding: 'px-2 py-1', backgroundColor: '#DDDDDD', borderWidth: 'border-t', borderColor: '#AAAAAA' };
    case 'ArtistCredit':
      return { ...baseSection, id: sectionId, type, contentPlaceholder: 'Illus. {{artistName}} {{{raritySymbol}}}', fontFamily: 'font-lato', fontSize: 'text-xs', padding: 'px-2 pb-1 pt-0.5' };
    case 'CustomText':
      return { ...baseSection, id: sectionId, type, contentPlaceholder: '{{customValue}}', fontFamily: 'font-sans', padding: 'p-1', fontSize: 'text-sm' };
    case 'Divider':
      return { ...baseSection, id: sectionId, type, contentPlaceholder: '', minHeight: 'min-h-[1px]', backgroundColor: '#CCCCCC', padding: 'my-1', fontSize: 'text-sm' }; // fontSize is just to satisfy the type, not used
    default:
      // This case should ideally not be reached if all types are handled
      const _exhaustiveCheck: never = type;
      console.warn(`Unhandled section type in createDefaultSection: ${_exhaustiveCheck}`);
      return { ...baseSection, id: sectionId, type, contentPlaceholder: '{{unknown}}', fontSize: 'text-sm' };
  }
};


export const DEFAULT_TEMPLATES: TCGCardTemplate[] = [
  {
    id: 'default-fantasy-creature-v1',
    name: 'Standard Fantasy Creature',
    templateType: 'CustomSequential', // Changed to CustomSequential to use the new system
    aspectRatio: TCG_ASPECT_RATIO,
    frameColor: '#777777', 
    borderColor: '#444444', 
    baseBackgroundColor: '#F0F0F0', 
    baseTextColor: '#1C1C1C', 
    sections: [
      createDefaultSection('CardName', 'sfc-name-v1'),
      createDefaultSection('ManaCost', 'sfc-cost-v1'),
      createDefaultSection('Artwork', 'sfc-art-v1'),
      createDefaultSection('TypeLine', 'sfc-type-v1'),
      createDefaultSection('RulesText', 'sfc-rules-v1'),
      createDefaultSection('FlavorText', 'sfc-flavor-v1'),
      createDefaultSection('PowerToughness', 'sfc-pt-v1'),
      createDefaultSection('ArtistCredit', 'sfc-artist-v1'),
    ]
  },
  {
    id: 'default-basic-custom-v1',
    name: 'Basic Custom Card',
    templateType: 'CustomSequential',
    aspectRatio: TCG_ASPECT_RATIO,
    frameColor: '#AAAAAA',
    borderColor: '#777777',
    baseBackgroundColor: '#FFFFFF',
    baseTextColor: '#000000',
    sections: [
      createDefaultSection('CardName', 'bcc-name-v1'),
      createDefaultSection('Artwork', 'bcc-art-v1'),
      createDefaultSection('CustomText', 'bcc-custom-v1'),
    ]
  }
];

export const TCG_FIELD_DEFINITIONS: { key: string; label: string; type?: 'input' | 'textarea'; example?: string }[] = [
  { key: 'cardName', label: 'Card Name', type: 'input', example: 'Goblin Raider' },
  { key: 'manaCost', label: 'Mana Cost', type: 'input', example: '1R' },
  { key: 'artworkUrl', label: 'Artwork URL', type: 'input', example: 'https://placehold.co/600x400.png or data:image/png;base64,...' },
  { key: 'cardType', label: 'Card Type', type: 'input', example: 'Creature' },
  { key: 'subTypes', label: 'Sub-Types', type: 'input', example: 'Goblin Warrior' },
  { key: 'rulesText', label: 'Rules Text / Abilities', type: 'textarea', example: 'Haste\nWhen this enters, deal 1 damage.' },
  { key: 'flavorText', label: 'Flavor Text', type: 'textarea', example: 'It charges mindlessly.' },
  { key: 'power', label: 'Power', type: 'input', example: '2' },
  { key: 'toughness', label: 'Toughness', type: 'input', example: '1' },
  { key: 'rarity', label: 'Rarity', type: 'input', example: 'Common' },
  { key: 'artistName', label: 'Artist Name', type: 'input', example: 'AI Artist' },
  { key: 'customValue', label: 'Custom Value', type: 'input', example: 'Some text' },
  { key: 'level', label: 'Level', type: 'input' },
  { key: 'attribute', label: 'Attribute', type: 'input' },
  { key: 'energyCost', label: 'Energy Cost', type: 'input' },
  { key: 'points', label: 'Points', type: 'input' },
  { key: 'effectText', label: 'Effect Text', type: 'textarea' },
  { key: 'raritySymbol', label: 'Rarity Symbol (Text)', type: 'input', example: 'C' }
];


    