import type { TCGCardTemplate } from '@/types';

export interface CardFrameKit {
  id: string;
  name: string;
  assetUrl: string;
  aspectRatio: string;
  templateIds: string[];
  baseBackgroundColor: string;
  baseTextColor: string;
  cardBorderRadius: string;
}

export const CARD_FRAME_KITS: CardFrameKit[] = [
  {
    id: 'arcane-creature-premium',
    name: 'Arcane Creature',
    assetUrl: '/card-assets/textures/arcane-forge/frame-creature-premium.webp',
    aspectRatio: '63:88',
    templateIds: ['default-mtg-theme'],
    baseBackgroundColor: '#17120d',
    baseTextColor: '#2a170b',
    cardBorderRadius: '18px',
  },
  {
    id: 'arcane-ttrpg-premium',
    name: 'Arcane Sheet',
    assetUrl: '/card-assets/textures/arcane-forge/frame-ttrpg-premium.webp',
    aspectRatio: '85:110',
    templateIds: ['default-ttrpg-stat-sheet'],
    baseBackgroundColor: '#18130f',
    baseTextColor: '#25160b',
    cardBorderRadius: '8px',
  },
  {
    id: 'arcane-playing-premium',
    name: 'Arcane Playing',
    assetUrl: '/card-assets/textures/arcane-forge/frame-playing-premium.webp',
    aspectRatio: '63:88',
    templateIds: ['default-playing-card-theme'],
    baseBackgroundColor: '#f4e2bb',
    baseTextColor: '#291609',
    cardBorderRadius: '22px',
  },
  {
    id: 'obsidian-neon-back-premium',
    name: 'Obsidian Neon Back',
    assetUrl: '/card-assets/textures/arcane-forge/back-obsidian-neon-premium.webp',
    aspectRatio: '63:88',
    templateIds: ['default-obsidian-neon-card-back'],
    baseBackgroundColor: '#05030a',
    baseTextColor: '#f5d27b',
    cardBorderRadius: '18px',
  },
];

export const getFrameKitForTemplate = (templateId?: string | null) =>
  CARD_FRAME_KITS.find((kit) => kit.templateIds.includes(templateId || ''));

export const getFrameKitTemplateUpdates = (kit: CardFrameKit): Partial<TCGCardTemplate> => ({
  aspectRatio: kit.aspectRatio,
  frameStyle: 'custom',
  cardBackgroundImageUrl: kit.assetUrl,
  baseBackgroundColor: kit.baseBackgroundColor,
  baseTextColor: kit.baseTextColor,
  cardBorderColor: 'transparent',
  cardBorderWidth: '0px',
  cardBorderStyle: 'none',
  cardBorderRadius: kit.cardBorderRadius,
  cardBorderImageSource: undefined,
});
