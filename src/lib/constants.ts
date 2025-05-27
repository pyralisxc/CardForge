
import type { PaperSize, TCGCardTemplate } from '@/types';
import { nanoid } from 'nanoid';

export const PAPER_SIZES: PaperSize[] = [
  { name: 'US Letter (8.5x11 in)', widthMm: 215.9, heightMm: 279.4 },
  { name: 'A4 (210x297 mm)', widthMm: 210, heightMm: 297 },
  // Business Card and Greeting Card sizes are less relevant for TCG sheets
];

// Standard TCG card aspect ratio (approx 2.5 x 3.5 inches or 63mm x 88mm)
export const TCG_ASPECT_RATIO = '63:88'; // More precise than 5:7

export const DEFAULT_TEMPLATES: TCGCardTemplate[] = [
  {
    id: nanoid(),
    name: 'Blue Creature Template',
    cardNamePlaceholder: '{{cardName}}',
    manaCostPlaceholder: '{{manaCost}}', // e.g., "2UU"
    artworkUrlPlaceholder: `https://placehold.co/375x275.png`, // Art area is smaller than full card
    cardTypeLinePlaceholder: 'Creature - {{subType}}',
    rulesTextPlaceholder: '{{abilityDescription}}\n{{triggeredAbility}}',
    flavorTextPlaceholder: '"{{flavorText}}"',
    powerToughnessPlaceholder: '{{power}}/{{toughness}}',
    rarityPlaceholder: '{{rarity}}', // e.g. C, U, R, M
    artistCreditPlaceholder: 'Illus. {{artistName}}',
    aspectRatio: TCG_ASPECT_RATIO,
    frameColor: '#A0C8E0', // Light Blue
    borderColor: '#5A8AA8', // Darker Blue
    baseBackgroundColor: '#F0F4F7',
    baseTextColor: '#1C1C1C',
  },
  {
    id: nanoid(),
    name: 'Red Spell Template',
    cardNamePlaceholder: '{{spellName}}',
    manaCostPlaceholder: '{{manaCost}}', // e.g., "1RR"
    artworkUrlPlaceholder: `https://placehold.co/375x275.png`,
    cardTypeLinePlaceholder: 'Instant', // Could be {{spellType}}
    rulesTextPlaceholder: '{{spellEffect}}\n{{additionalCost}}',
    flavorTextPlaceholder: '"{{spellQuote}}"',
    // No P/T for spells typically
    rarityPlaceholder: '{{rarity}}',
    artistCreditPlaceholder: 'Illus. {{artistName}}',
    aspectRatio: TCG_ASPECT_RATIO,
    frameColor: '#E8B0A0', // Light Red
    borderColor: '#A8605A', // Darker Red
    baseBackgroundColor: '#F7F0F0',
    baseTextColor: '#1C1C1C',
  },
  {
    id: nanoid(),
    name: 'Artifact Template',
    cardNamePlaceholder: '{{artifactName}}',
    manaCostPlaceholder: '{{manaCost}}', // e.g., "3"
    artworkUrlPlaceholder: `https://placehold.co/375x275.png`,
    cardTypeLinePlaceholder: 'Artifact - {{artifactSubType}}',
    rulesTextPlaceholder: '{{staticAbility}}\n{{activatedAbility}}',
    flavorTextPlaceholder: '"{{artifactLore}}"',
    // P/T if it's an artifact creature
    powerToughnessPlaceholder: '{{power}}/{{toughness}}',
    rarityPlaceholder: '{{rarity}}',
    artistCreditPlaceholder: 'Illus. {{artistName}}',
    aspectRatio: TCG_ASPECT_RATIO,
    frameColor: '#C0C0C0', // Grey/Silver for artifacts
    borderColor: '#808080', // Darker Grey
    baseBackgroundColor: '#F5F5F5',
    baseTextColor: '#1C1C1C',
  }
];
