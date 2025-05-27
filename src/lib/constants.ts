
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

export const FONT_SIZES: Array<CardSection['fontSize']> = ['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl'];
export const FONT_WEIGHTS: Array<CardSection['fontWeight']> = ['font-normal', 'font-medium', 'font-semibold', 'font-bold'];
export const TEXT_ALIGNS: Array<CardSection['textAlign']> = ['left', 'center', 'right'];
export const FONT_STYLES: Array<CardSection['fontStyle']> = ['normal', 'italic'];

export const AVAILABLE_FONTS: Array<{name: string, value: string}> = [
    { name: 'Default Sans-Serif', value: 'font-sans' },
    { name: 'Serif (Georgia-like)', value: 'font-serif' },
    { name: 'Monospaced', value: 'font-mono' },
    { name: 'Fantasy (Cinzel)', value: 'font-cinzel' }, // Added new font
    { name: 'Clean Sans (Lato)', value: 'font-lato' }, // Added new font
];


export const createDefaultSection = (type: CardSectionType): CardSection => {
  const baseSection = {
    id: nanoid(),
    type,
    contentPlaceholder: '',
    textColor: '#000000', // Default to black
    backgroundColor: '', // Default to transparent
    fontFamily: 'font-sans', // Default font
    fontSize: 'text-sm' as CardSection['fontSize'],
    fontWeight: 'font-normal' as CardSection['fontWeight'],
    textAlign: 'left' as CardSection['textAlign'],
    fontStyle: 'normal' as CardSection['fontStyle'],
    padding: 'p-1',
    borderColor: '',
    borderWidth: '',
    minHeight: '',
    flexGrow: false,
  };

  switch (type) {
    case 'CardName':
      return { ...baseSection, contentPlaceholder: '{{cardName}}', fontFamily: 'font-cinzel', fontSize: 'text-base', fontWeight: 'font-bold', padding: 'px-2 pt-1 pb-0.5' };
    case 'ManaCost':
      return { ...baseSection, contentPlaceholder: '{{manaCost}}', fontFamily: 'font-lato', textAlign: 'right', padding: 'px-2 pt-1 pb-0.5' };
    case 'Artwork':
      return { ...baseSection, contentPlaceholder: '{{artworkUrl}}', backgroundColor: '#CCCCCC', minHeight: 'min-h-[150px]', flexGrow: true, padding: 'p-0.5' };
    case 'TypeLine':
      return { ...baseSection, contentPlaceholder: '{{cardType}} - {{subTypes}}', fontFamily: 'font-lato', fontWeight: 'font-semibold', backgroundColor: '#DDDDDD', padding: 'px-2 py-1', borderWidth: 'border-y', borderColor: '#AAAAAA'};
    case 'RulesText':
      return { ...baseSection, contentPlaceholder: '{{rulesText}}', fontFamily: 'font-serif', minHeight: 'min-h-[60px]', flexGrow: true, backgroundColor: '#FFFFFF', padding: 'p-2', borderWidth: 'border', borderColor: '#CCCCCC'};
    case 'FlavorText':
      return { ...baseSection, contentPlaceholder: '"{{flavorText}}"', fontFamily: 'font-serif', fontStyle: 'italic', fontSize: 'text-xs', minHeight: 'min-h-[30px]', backgroundColor: '#FFFFFF', padding: 'p-2 pt-1', borderWidth: 'border-t', borderColor: '#DDDDDD' };
    case 'PowerToughness':
      return { ...baseSection, contentPlaceholder: '{{power}}/{{toughness}}', fontFamily: 'font-lato', fontWeight: 'font-bold', textAlign: 'right', padding: 'px-2 py-1', backgroundColor: '#DDDDDD', borderWidth: 'border-t', borderColor: '#AAAAAA' };
    case 'ArtistCredit':
      return { ...baseSection, contentPlaceholder: 'Illus. {{artistName}} {{{raritySymbol}}}', fontFamily: 'font-lato', fontSize: 'text-xs', padding: 'px-2 pb-1 pt-0.5' };
    case 'CustomText':
      return { ...baseSection, contentPlaceholder: '{{customValue}}', fontFamily: 'font-sans', padding: 'p-1' };
    case 'Divider':
      return { ...baseSection, contentPlaceholder: '', minHeight: 'min-h-[1px]', backgroundColor: '#CCCCCC', padding: 'my-1' }; // Placeholder content not used
    default:
      return baseSection;
  }
};


export const DEFAULT_TEMPLATES: TCGCardTemplate[] = [
  {
    id: nanoid(),
    name: 'Standard Fantasy Creature',
    templateType: 'StandardFantasyTCG',
    aspectRatio: TCG_ASPECT_RATIO,
    frameColor: '#777777', // Neutral Grey Frame
    borderColor: '#444444', // Darker Grey for inner borders
    baseBackgroundColor: '#F0F0F0', // Light Grey card body
    baseTextColor: '#1C1C1C', // Dark text
    sections: [
      { ...createDefaultSection('CardName'), contentPlaceholder: '{{cardName}}', textColor: '#102A43', fontFamily: 'font-cinzel', fontWeight: 'font-bold', fontSize: 'text-lg', padding: 'px-2 pt-1.5 pb-0', textAlign: 'left' },
      { ...createDefaultSection('ManaCost'), contentPlaceholder: '{{manaCost}}', textColor: '#102A43', fontFamily: 'font-lato', fontWeight: 'font-bold', fontSize: 'text-base', padding: 'px-2 pt-1.5 pb-0', textAlign: 'right' },
      { ...createDefaultSection('Artwork'), contentPlaceholder: '{{artworkUrl}}', backgroundColor: '#D0D0D0', minHeight: 'min-h-[180px]', flexGrow: true, padding: 'p-1', borderColor: '#555555', borderWidth: 'border-2' },
      { ...createDefaultSection('TypeLine'), contentPlaceholder: '{{cardType}} \u2014 {{subTypes}}', textColor: '#FFFFFF', fontFamily: 'font-lato', fontWeight: 'font-semibold', backgroundColor: '#555555', padding: 'px-2 py-1', borderWidth: 'border-y-2', borderColor: '#333333', textAlign: 'center', fontSize: 'text-sm' },
      { ...createDefaultSection('RulesText'), contentPlaceholder: '{{rulesText}}', textColor: '#243B53', fontFamily: 'font-serif', fontSize: 'text-sm', backgroundColor: '#FFFFFF', padding: 'p-2', borderColor: '#AAAAAA', borderWidth: 'border-2', minHeight: 'min-h-[80px]', flexGrow: true },
      { ...createDefaultSection('FlavorText'), contentPlaceholder: '"{{flavorText}}"', textColor: '#486581', fontFamily: 'font-serif', fontSize: 'text-xs', fontStyle: 'italic', backgroundColor: '#FFFFFF', padding: 'p-2 pt-1', borderColor: '#AAAAAA', borderWidth: 'border-t-2' },
      { ...createDefaultSection('PowerToughness'), contentPlaceholder: '{{power}}/{{toughness}}', textColor: '#FFFFFF', fontFamily: 'font-lato', fontWeight: 'font-bold', fontSize: 'text-lg', backgroundColor: '#555555', padding: 'px-3 py-1', textAlign: 'center', borderWidth: 'border-t-2', borderColor: '#333333'},
      { ...createDefaultSection('ArtistCredit'), contentPlaceholder: 'Illus. {{artistName}} \u2022 {{rarity}}', textColor: '#333333', fontFamily: 'font-lato', fontSize: 'text-xs', padding: 'px-2 py-1 text-center' },
    ]
  },
  {
    id: nanoid(),
    name: 'Basic Custom Card',
    templateType: 'CustomSequential',
    aspectRatio: TCG_ASPECT_RATIO,
    frameColor: '#AAAAAA',
    borderColor: '#777777',
    baseBackgroundColor: '#FFFFFF',
    baseTextColor: '#000000',
    sections: [
      createDefaultSection('CardName'),
      createDefaultSection('Artwork'),
      createDefaultSection('CustomText'),
    ]
  }
];

// For SingleCardGenerator: provides hints for labels and input types
// if a dynamically extracted placeholder key matches one of these.
// The 'key' should match the placeholder name *inside* {{...}}.
export const TCG_FIELD_DEFINITIONS: { key: string; label: string; type?: 'input' | 'textarea'; example?: string }[] = [
  { key: 'cardName', label: 'Card Name', type: 'input', example: 'Goblin Raider' },
  { key: 'manaCost', label: 'Mana Cost', type: 'input', example: '1R' },
  { key: 'artworkUrl', label: 'Artwork URL', type: 'input', example: 'https://placehold.co/300x200.png' },
  { key: 'cardType', label: 'Card Type', type: 'input', example: 'Creature' },
  { key: 'subTypes', label: 'Sub-Types', type: 'input', example: 'Goblin Warrior' },
  { key: 'rulesText', label: 'Rules Text / Abilities', type: 'textarea', example: 'Haste\nWhen this enters, deal 1 damage.' },
  { key: 'flavorText', label: 'Flavor Text', type: 'textarea', example: 'It charges mindlessly.' },
  { key: 'power', label: 'Power', type: 'input', example: '2' },
  { key: 'toughness', label: 'Toughness', type: 'input', example: '1' },
  { key: 'rarity', label: 'Rarity', type: 'input', example: 'Common' },
  { key: 'artistName', label: 'Artist Name', type: 'input', example: 'AI Artist' },
  { key: 'customValue', label: 'Custom Value', type: 'input', example: 'Some text' },
  // Add other common TCG terms that might be used as placeholders
  { key: 'level', label: 'Level', type: 'input' },
  { key: 'attribute', label: 'Attribute', type: 'input' },
  { key: 'energyCost', label: 'Energy Cost', type: 'input' },
  { key: 'points', label: 'Points', type: 'input' },
  { key: 'effectText', label: 'Effect Text', type: 'textarea' },
  { key: 'raritySymbol', label: 'Rarity Symbol (Text)', type: 'input', example: 'C' }
];

