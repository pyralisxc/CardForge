
import type { PaperSize, TCGCardTemplate, CardData } from '@/types';
import { nanoid } from 'nanoid';

export const PAPER_SIZES: PaperSize[] = [
  { name: 'US Letter (8.5x11 in)', widthMm: 215.9, heightMm: 279.4 },
  { name: 'A4 (210x297 mm)', widthMm: 210, heightMm: 297 },
];

export const TCG_ASPECT_RATIO = '63:88'; // Standard TCG card aspect ratio

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
    cardNamePlaceholder: '{{spellName}}', // Note: use 'cardName' for consistency if preferred, or allow any key
    manaCostPlaceholder: '{{manaCost}}',
    artworkUrlPlaceholder: `https://placehold.co/375x275.png`,
    cardTypeLinePlaceholder: 'Instant - {{spellSubType}}',
    rulesTextPlaceholder: '{{spellEffect}}\n{{additionalCost}}',
    flavorTextPlaceholder: '"{{spellQuote}}"',
    powerToughnessPlaceholder: '', 
    rarityPlaceholder: '{{rarity}}',
    artistCreditPlaceholder: 'Illus. {{artistName}}',
    aspectRatio: TCG_ASPECT_RATIO,
    frameColor: '#E8B0A0', 
    borderColor: '#A8605A', 
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
    cardNamePlaceholder: '{{artifactName}}', // Note: use 'cardName' for consistency if preferred
    manaCostPlaceholder: '{{manaCost}}',
    artworkUrlPlaceholder: `https://placehold.co/375x275.png`,
    cardTypeLinePlaceholder: 'Artifact - {{artifactSubType}}',
    rulesTextPlaceholder: '{{staticAbility}}\n{{activatedAbility}}',
    flavorTextPlaceholder: '"{{artifactLore}}"',
    powerToughnessPlaceholder: '{{power}}/{{toughness}}', 
    rarityPlaceholder: '{{rarity}}',
    artistCreditPlaceholder: 'Illus. {{artistName}}',
    aspectRatio: TCG_ASPECT_RATIO,
    frameColor: '#C0C0C0', 
    borderColor: '#808080', 
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

// For SingleCardGenerator: provides hints for labels and input types
// if a dynamically extracted placeholder key matches one of these.
// The 'key' should match the placeholder name *inside* {{...}}.
export const TCG_FIELD_DEFINITIONS: { key: string; label: string; type?: 'input' | 'textarea' }[] = [
  { key: 'cardName', label: 'Card Name', type: 'input' },
  { key: 'spellName', label: 'Spell Name', type: 'input' }, // Example for 'Red Spell Template'
  { key: 'artifactName', label: 'Artifact Name', type: 'input' }, // Example for 'Artifact Template'
  { key: 'manaCost', label: 'Mana Cost', type: 'input' },
  { key: 'artworkUrl', label: 'Artwork URL', type: 'input' },
  { key: 'cardType', label: 'Card Type Line', type: 'input' }, // General key if user uses {{cardType}}
  { key: 'subType', label: 'Sub-Type', type: 'input' }, // e.g. Goblin, Warrior, Instant, etc.
  { key: 'spellSubType', label: 'Spell Sub-Type', type: 'input' },
  { key: 'artifactSubType', label: 'Artifact Sub-Type', type: 'input' },
  { key: 'rulesText', label: 'Rules Text / Abilities', type: 'textarea' },
  { key: 'abilityDescription', label: 'Ability Description', type: 'textarea' },
  { key: 'triggeredAbility', label: 'Triggered Ability', type: 'textarea' },
  { key: 'staticAbility', label: 'Static Ability', type: 'textarea' },
  { key: 'activatedAbility', label: 'Activated Ability', type: 'textarea' },
  { key: 'spellEffect', label: 'Spell Effect', type: 'textarea' },
  { key: 'additionalCost', label: 'Additional Cost', type: 'textarea' },
  { key: 'flavorText', label: 'Flavor Text', type: 'textarea' },
  { key: 'spellQuote', label: 'Spell Quote', type: 'textarea' },
  { key: 'artifactLore', label: 'Artifact Lore', type: 'textarea' },
  { key: 'power', label: 'Power', type: 'input' },
  { key: 'toughness', label: 'Toughness', type: 'input' },
  { key: 'rarity', label: 'Rarity (e.g., C, U, R, M)', type: 'input' },
  { key: 'artistName', label: 'Artist Name', type: 'input' },
  // Add other common TCG terms that might be used as placeholders
  { key: 'level', label: 'Level', type: 'input' },
  { key: 'attribute', label: 'Attribute', type: 'input' },
  { key: 'energyCost', label: 'Energy Cost', type: 'input' },
  { key: 'points', label: 'Points', type: 'input' },
];
