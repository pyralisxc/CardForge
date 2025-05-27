
import type { PaperSize, TCGCardTemplate } from '@/types';
import { nanoid } from 'nanoid';

export const PAPER_SIZES: PaperSize[] = [
  { name: 'US Letter (8.5x11 in)', widthMm: 215.9, heightMm: 279.4 },
  { name: 'A4 (210x297 mm)', widthMm: 210, heightMm: 297 },
];

export const TCG_ASPECT_RATIO = '63:88';

export const DEFAULT_TEMPLATES: TCGCardTemplate[] = [
  {
    id: nanoid(),
    name: 'Blue Creature Template',
    cardNamePlaceholder: '{{cardName}}',
    manaCostPlaceholder: '{{manaCost}}',
    artworkUrlPlaceholder: `https://placehold.co/375x275.png`,
    cardTypeLinePlaceholder: 'Creature - {{subType}}',
    rulesTextPlaceholder: '{{abilityDescription}}\n{{triggeredAbility}}',
    flavorTextPlaceholder: '"{{flavorText}}"',
    powerToughnessPlaceholder: '{{power}}/{{toughness}}',
    rarityPlaceholder: '{{rarity}}',
    artistCreditPlaceholder: 'Illus. {{artistName}}',
    aspectRatio: TCG_ASPECT_RATIO,
    frameColor: '#A0C8E0', // Light Blue frame
    borderColor: '#5A8AA8', // Darker Blue border for elements
    baseBackgroundColor: '#F0F4F7', // Main card background
    baseTextColor: '#1C1C1C', // Default text color
    nameTextColor: '#102A43', // Darker blue for name
    costTextColor: '#102A43', // Darker blue for cost
    typeLineTextColor: '#102A43', // Darker blue for type line
    rulesTextColor: '#243B53', // Standard text for rules
    flavorTextColor: '#486581', // Slightly lighter for flavor
    ptTextColor: '#102A43', // Darker blue for P/T
    artBoxBackgroundColor: '#D0E0E3', // Light muted blue for artbox BG
    textBoxBackgroundColor: '#E0E8F0', // Slightly off-white/blue for textbox BG
  },
  {
    id: nanoid(),
    name: 'Red Spell Template',
    cardNamePlaceholder: '{{spellName}}',
    manaCostPlaceholder: '{{manaCost}}',
    artworkUrlPlaceholder: `https://placehold.co/375x275.png`,
    cardTypeLinePlaceholder: 'Instant - {{spellSubType}}',
    rulesTextPlaceholder: '{{spellEffect}}\n{{additionalCost}}',
    flavorTextPlaceholder: '"{{spellQuote}}"',
    powerToughnessPlaceholder: '', // Spells usually don't have P/T
    rarityPlaceholder: '{{rarity}}',
    artistCreditPlaceholder: 'Illus. {{artistName}}',
    aspectRatio: TCG_ASPECT_RATIO,
    frameColor: '#E8B0A0', // Light Red frame
    borderColor: '#A8605A', // Darker Red for borders
    baseBackgroundColor: '#F7F0F0',
    baseTextColor: '#1C1C1C',
    nameTextColor: '#610316',
    costTextColor: '#610316',
    typeLineTextColor: '#610316',
    rulesTextColor: '#721121',
    flavorTextColor: '#8C1C13',
    ptTextColor: '#610316',
    artBoxBackgroundColor: '#F0D8D4',
    textBoxBackgroundColor: '#F5E8E6',
  },
  {
    id: nanoid(),
    name: 'Artifact Template',
    cardNamePlaceholder: '{{artifactName}}',
    manaCostPlaceholder: '{{manaCost}}',
    artworkUrlPlaceholder: `https://placehold.co/375x275.png`,
    cardTypeLinePlaceholder: 'Artifact - {{artifactSubType}}',
    rulesTextPlaceholder: '{{staticAbility}}\n{{activatedAbility}}',
    flavorTextPlaceholder: '"{{artifactLore}}"',
    powerToughnessPlaceholder: '{{power}}/{{toughness}}', // If artifact creature
    rarityPlaceholder: '{{rarity}}',
    artistCreditPlaceholder: 'Illus. {{artistName}}',
    aspectRatio: TCG_ASPECT_RATIO,
    frameColor: '#C0C0C0', // Grey/Silver
    borderColor: '#808080', // Darker Grey
    baseBackgroundColor: '#F5F5F5',
    baseTextColor: '#1C1C1C',
    nameTextColor: '#333333',
    costTextColor: '#333333',
    typeLineTextColor: '#333333',
    rulesTextColor: '#444444',
    flavorTextColor: '#555555',
    ptTextColor: '#333333',
    artBoxBackgroundColor: '#E0E0E0',
    textBoxBackgroundColor: '#EDEDED',
  }
];

// For SingleCardGenerator: defines the order and labels for common TCG fields
export const TCG_FIELD_DEFINITIONS: { key: keyof CardData; label: string; placeholderKey: keyof TCGCardTemplate, type?: string }[] = [
  { key: 'cardName', label: 'Card Name', placeholderKey: 'cardNamePlaceholder' },
  { key: 'manaCost', label: 'Mana Cost', placeholderKey: 'manaCostPlaceholder' },
  { key: 'artworkUrl', label: 'Artwork URL', placeholderKey: 'artworkUrlPlaceholder' },
  { key: 'cardType', label: 'Card Type Line (e.g. Creature - Goblin)', placeholderKey: 'cardTypeLinePlaceholder' }, // Combines type and subtype
  { key: 'rulesText', label: 'Rules Text / Abilities', placeholderKey: 'rulesTextPlaceholder', type: 'textarea' },
  { key: 'flavorText', label: 'Flavor Text', placeholderKey: 'flavorTextPlaceholder', type: 'textarea' },
  { key: 'power', label: 'Power', placeholderKey: 'powerToughnessPlaceholder' }, // Assuming P/T is split or handled
  { key: 'toughness', label: 'Toughness', placeholderKey: 'powerToughnessPlaceholder' },
  { key: 'rarity', label: 'Rarity (C, U, R, M)', placeholderKey: 'rarityPlaceholder' },
  { key: 'artistName', label: 'Artist Name', placeholderKey: 'artistCreditPlaceholder' },
  // Add more specific fields if your placeholders imply them and you want separate inputs
  // e.g. if cardTypeLinePlaceholder was just '{{type}} - {{subType}}', you could have:
  // { key: 'type', label: 'Type', placeholderKey: 'typePlaceholder' },
  // { key: 'subType', label: 'Subtype', placeholderKey: 'subTypePlaceholder' },
];
