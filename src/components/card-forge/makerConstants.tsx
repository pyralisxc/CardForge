"use client";

/**
 * makerConstants.tsx
 *
 * All static data, presets, element kits, utility functions, and the
 * ColorField component extracted from CardTemplateMaker2.tsx to keep
 * the main component file focused on rendering and interaction logic.
 */

import { Fragment, useRef, useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Badge,
  Bold,
  BoxSelect,
  Crown,
  Frame,
  Gem,
  Highlighter,
  Image as ImageIcon,
  Italic,
  LineChart,
  List,
  ListOrdered,
  MinusIcon,
  Palette,
  Sparkles,
  Square,
  Type,
  Underline,
} from 'lucide-react';
import type { FreeformCardElement, TCGCardTemplate } from '@/types';
import { TCG_ASPECT_RATIO } from '@/lib/constants';
import { parseRichText } from '@/lib/utils';
import { createDefaultFreeformCanvas, reconstructMinimalTemplate } from '@/store/appStore';

// ─── Frame Visual Properties ──────────────────────────────────────────────────

export const PREDEFINED_FRAME_VISUAL_PROPERTIES: Record<string, Partial<TCGCardTemplate>> = {
  'classic-gold': {
    baseBackgroundColor: '#fDF4D8',
    baseTextColor: '#4A3B2A',
    cardBorderRadius: '0.75rem',
    cardBorderColor: 'transparent',
    cardBorderWidth: '6px',
    cardBorderStyle: 'solid',
    cardBackgroundImageUrl: undefined,
    frameStyle: 'classic-gold',
    cardBorderImageSource: 'CSS: Classic Gold Gradient',
  },
  'minimal-dark': {
    baseBackgroundColor: '#282828',
    baseTextColor: '#c0c0c0',
    cardBorderColor: '#4a4a4a',
    cardBorderWidth: '2px',
    cardBorderStyle: 'solid',
    cardBorderRadius: '0.25rem',
    cardBackgroundImageUrl: undefined,
    frameStyle: 'minimal-dark',
    cardBorderImageSource: undefined,
  },
  'arcane-purple': {
    baseBackgroundColor: '#4A0E7E',
    baseTextColor: '#E6E6FA',
    cardBorderColor: '#D8BFD8',
    cardBorderWidth: '5px',
    cardBorderStyle: 'solid',
    cardBorderRadius: '0.6rem',
    cardBackgroundImageUrl: undefined,
    frameStyle: 'arcane-purple',
    cardBorderImageSource: undefined,
  },
  standard: {
    baseBackgroundColor: '#FFFFFF',
    baseTextColor: '#000000',
    cardBorderRadius: '0.5rem',
    cardBorderColor: undefined,
    cardBorderWidth: '4px',
    cardBorderStyle: 'solid',
    cardBackgroundImageUrl: undefined,
    frameStyle: 'standard',
    cardBorderImageSource: undefined,
  },
  custom: {
    baseBackgroundColor: '',
    baseTextColor: '',
    cardBorderRadius: '0.5rem',
    cardBorderColor: '',
    cardBorderWidth: '4px',
    cardBorderStyle: 'solid',
    cardBackgroundImageUrl: undefined,
    frameStyle: 'custom',
    cardBorderImageSource: undefined,
  },
};

// ─── Icon Options ─────────────────────────────────────────────────────────────

export const ICON_OPTIONS = [
  'Sparkles', 'Swords', 'Shield', 'Flame', 'Droplets', 'Zap', 'Heart', 'Star', 'CircleDot', 'Gem',
  'Skull', 'Crown', 'Sword', 'ShieldCheck', 'WandSparkles', 'Sun', 'Moon', 'Snowflake', 'Leaf', 'Mountain',
  'Castle', 'Coins', 'Scroll', 'BookOpen', 'Hourglass', 'Crosshair', 'Target', 'Aperture', 'Atom', 'Dices',
  'Club', 'Diamond', 'Spade', 'Circle', 'Triangle', 'Hexagon', 'Trophy', 'Medal', 'Landmark', 'Anvil',
  'Hammer', 'Pickaxe', 'Axe', 'TentTree', 'Trees', 'Flower2', 'CloudLightning', 'CloudSun', 'Eye', 'KeyRound',
  'LockKeyhole', 'ScrollText', 'BookMarked', 'Compass', 'Map', 'Flag', 'Ribbon', 'BadgeCheck',
];

// ─── Maker Theme ──────────────────────────────────────────────────────────────

export const makerTheme = {
  shell: 'border-[#2d2618] bg-[#090b0f] text-[#d8d1c4] shadow-[0_28px_90px_rgba(0,0,0,0.6)]',
  panel: 'border-[#2b2f39] bg-[#12161d]',
  panelInset: 'border-[#2a2f39] bg-[#0d1117]',
  goldPanel: 'border-[#5f4b20] bg-[#141108]',
  goldText: 'text-[#d5ad54]',
  mutedText: 'text-[#8f95a3]',
  control: 'h-8 rounded-[4px] border-[#2d3340] bg-[#0d1117] text-[#d8d1c4]',
  button: 'h-8 rounded-[4px] border-[#2d3340] bg-[#151a23] hover:border-[#715829] hover:bg-[#1a1e26]',
  toolButton: 'h-8 rounded-[4px] border border-[#2d3340] bg-[#111720] text-[#d8d1c4] hover:border-[#6d55b8] hover:bg-[#171d29]',
  activeButton: 'border-[#7a52cc] bg-[#211a33] text-[#f3e9ff]',
};

// ─── Template Presets ─────────────────────────────────────────────────────────

export const templatePresets = [
  {
    id: 'emberclaw',
    templateId: 'default-emberclaw-hd-freeform',
    name: 'Emberclaw HD',
    caption: 'Fantasy creature',
    accent: '#c9872a',
    bg: '#140e09',
    art: 'radial-gradient(circle at 50% 18%, #f5d27b55, transparent 34%), linear-gradient(135deg, #3a140d, #8c3e16 45%, #1b1f27)',
  },
  {
    id: 'arcane-spell',
    templateId: 'default-arcane-spell-freeform',
    name: 'Arcane Spell',
    caption: 'Spell showcase',
    accent: '#7a52cc',
    bg: '#120b20',
    art: 'radial-gradient(circle at 40% 20%, #d8c4ff88, transparent 28%), linear-gradient(135deg, #22113d, #7a52cc 55%, #d5ad54)',
  },
  {
    id: 'relic-artifact',
    templateId: 'default-relic-artifact-freeform',
    name: 'Relic Artifact',
    caption: 'Artifact showcase',
    accent: '#b6a36d',
    bg: '#101419',
    art: 'radial-gradient(circle at 50% 20%, #fff2b855, transparent 28%), linear-gradient(135deg, #232a34, #987a37 55%, #0b0f15)',
  },
  {
    id: 'quest',
    templateId: 'default-quest-adventure-freeform',
    name: 'Quest Template',
    caption: 'Adventure showcase',
    accent: '#4fb286',
    bg: '#0d1813',
    art: 'radial-gradient(circle at 42% 22%, #a6f4ce88, transparent 30%), linear-gradient(135deg, #0f2a20, #4fb286 45%, #d5ad54)',
  },
  {
    id: 'portrait-token',
    templateId: 'default-portrait-token-freeform',
    name: 'Portrait Token',
    caption: 'Token showcase',
    accent: '#7a52cc',
    bg: '#101419',
    art: 'radial-gradient(circle at 50% 18%, #d8c4ff88, transparent 32%), linear-gradient(135deg, #120b20, #7a52cc 56%, #d5ad54)',
  },
];

// ─── Element Kits ─────────────────────────────────────────────────────────────

export const elementKits: Array<{
  label: string;
  description: string;
  category: 'Core' | 'Card Parts' | 'Ornaments';
  icon: React.ElementType;
  type: FreeformCardElement['type'];
  preset?: Partial<FreeformCardElement>;
}> = [
  { label: 'Free Text', description: 'Plain dynamic or static text layer.', category: 'Core', icon: Type, type: 'text' },
  { label: 'Artwork', description: 'Image slot linked to a data key or URL.', category: 'Core', icon: ImageIcon, type: 'image' },
  { label: 'Rune Icon', description: 'A scalable symbol with stroke and fill controls.', category: 'Core', icon: Sparkles, type: 'icon' },
  { label: 'Shape', description: 'Basic rectangle, ellipse, or line foundation.', category: 'Core', icon: Square, type: 'shape' },
  {
    label: 'Cost Orb',
    description: 'Circular cost counter designed for top-right card costs.',
    category: 'Card Parts',
    icon: Badge,
    type: 'text',
    preset: {
      name: 'Cost Badge',
      content: '{{cost:"3"}}',
      width: 64,
      height: 64,
      fontSize: 'text-2xl',
      fontWeight: 'font-bold',
      textAlign: 'center',
      backgroundColor: '#1b1410',
      textColor: '#f5d27b',
      borderColor: '#d5ad54',
      borderWidth: 'border-2',
      borderRadius: 'rounded-full',
    },
  },
  {
    label: 'Art Window',
    description: 'Gold-lined ornamental frame for artwork regions.',
    category: 'Card Parts',
    icon: Frame,
    type: 'shape',
    preset: {
      name: 'Art Frame',
      width: 502,
      height: 338,
      backgroundColor: 'rgba(0,0,0,0.12)',
      fillColor: 'rgba(0,0,0,0.12)',
      borderColor: '#d5ad54',
      strokeColor: '#d5ad54',
      strokeWidth: 2,
      borderRadius: 'rounded-md',
    },
  },
  {
    label: 'Parchment',
    description: 'Readable fantasy text panel for rules or flavor copy.',
    category: 'Card Parts',
    icon: LineChart,
    type: 'text',
    preset: {
      name: 'Rules Text',
      content: '{{rulesText:"Flying\\nWhen this enters play, draw a card."}}',
      width: 500,
      height: 170,
      fontSize: 'text-sm',
      fontWeight: 'font-normal',
      textAlign: 'left',
      backgroundColor: 'rgba(246,232,199,0.82)',
      textColor: '#21180d',
      borderColor: '#b58b35',
      borderWidth: 'border',
      borderRadius: 'rounded-md',
    },
  },
  {
    label: 'Gold Rule',
    description: 'Ornamental metallic divider for type lines and footer breaks.',
    category: 'Ornaments',
    icon: MinusIcon,
    type: 'shape',
    preset: {
      name: 'Gilded Divider',
      shapeKind: 'rectangle',
      width: 460,
      height: 14,
      fillColor: '#d5ad54',
      strokeColor: '#d5ad54',
      strokeWidth: 0,
      borderWidth: '_none_',
      borderRadius: 'rounded-full',
      backgroundImageUrl: 'linear-gradient(90deg, transparent 0%, #7f5d1f 8%, #f5d27b 18%, #7f5d1f 28%, transparent 36%, #d5ad54 50%, transparent 64%, #7f5d1f 72%, #f5d27b 82%, #7f5d1f 92%, transparent 100%)',
    },
  },
  {
    label: 'Rune Chain',
    description: 'A row of arcane game symbols for rarity, factions, or schools.',
    category: 'Ornaments',
    icon: Sparkles,
    type: 'text',
    preset: {
      name: 'Rune Chain',
      content: '✦  ◆  ✧  ◆  ✦',
      width: 310,
      height: 32,
      fontSize: 'text-lg',
      fontWeight: 'font-bold',
      textAlign: 'center',
      backgroundColor: 'rgba(13,17,23,0.7)',
      backgroundImageUrl: 'linear-gradient(90deg, transparent, rgba(122,82,204,0.5), rgba(213,173,84,0.35), transparent)',
      textColor: '#f5d27b',
      borderColor: '#7a52cc',
      borderWidth: 'border',
      borderRadius: 'rounded-full',
    },
  },
  {
    label: 'Ornate Text Box',
    description: 'Premium rules/flavor frame with darker fan-card styling.',
    category: 'Card Parts',
    icon: BoxSelect,
    type: 'text',
    preset: {
      name: 'Ornate Text Box',
      content: '{{rulesText:"When this enters play, forge a relic.\\n\\nFlavor text lives here."}}',
      width: 500,
      height: 190,
      fontSize: 'text-sm',
      fontWeight: 'font-normal',
      textAlign: 'left',
      padding: 'p-3',
      backgroundColor: '#15100b',
      backgroundImageUrl: 'linear-gradient(180deg, rgba(213,173,84,0.22), rgba(0,0,0,0.18)), radial-gradient(circle at 50% 0%, rgba(122,82,204,0.22), transparent 48%)',
      textColor: '#f7e6b0',
      borderColor: '#d5ad54',
      borderWidth: 'border-4',
      borderRadius: 'rounded-lg',
    },
  },
  {
    label: 'Stat Orb',
    description: 'Power/toughness or rating counter for card corners.',
    category: 'Card Parts',
    icon: Crown,
    type: 'text',
    preset: {
      name: 'Stat Gem',
      content: '{{power:"2"}}',
      width: 58,
      height: 58,
      fontSize: 'text-xl',
      fontWeight: 'font-bold',
      textAlign: 'center',
      backgroundColor: '#19130e',
      textColor: '#f5d27b',
      borderColor: '#d5ad54',
      borderWidth: 'border-2',
      borderRadius: 'rounded-full',
    },
  },
  {
    label: 'Title Plate',
    description: 'Dark-gold title banner with fantasy border styling.',
    category: 'Card Parts',
    icon: Badge,
    type: 'text',
    preset: {
      name: 'Title Plate',
      content: '{{cardName:"EMBERCLAW WHELP"}}',
      width: 420,
      height: 42,
      fontSize: 'text-lg',
      fontWeight: 'font-bold',
      textAlign: 'center',
      backgroundColor: '#17100b',
      textColor: '#f7df9d',
      borderColor: '#d5ad54',
      borderWidth: 'border-2',
      borderRadius: 'rounded-md',
    },
  },
  {
    label: 'Type Plate',
    description: 'Creature, spell, equipment, or quest type-line strip.',
    category: 'Card Parts',
    icon: LineChart,
    type: 'text',
    preset: {
      name: 'Type Plate',
      content: '{{typeLine:"CREATURE - DRAGON"}}',
      width: 500,
      height: 34,
      fontSize: 'text-xs',
      fontWeight: 'font-semibold',
      textAlign: 'left',
      backgroundColor: '#21170d',
      textColor: '#f6dfaa',
      borderColor: '#d5ad54',
      borderWidth: 'border',
      borderRadius: 'rounded-sm',
    },
  },
  {
    label: 'Corner Sigil',
    description: 'Small rune accent for ornate card corners and frames.',
    category: 'Ornaments',
    icon: Gem,
    type: 'icon',
    preset: {
      name: 'Corner Sigil',
      iconName: 'Gem',
      width: 36,
      height: 36,
      strokeColor: '#d5ad54',
      fillColor: '#17100b',
      backgroundColor: '#17100b',
      borderColor: '#d5ad54',
      borderWidth: 'border',
      borderRadius: 'rounded-full',
    },
  },
  {
    label: 'Foil Veil',
    description: 'Subtle purple-gold overlay for premium card finishes.',
    category: 'Ornaments',
    icon: Sparkles,
    type: 'shape',
    preset: {
      name: 'Foil Veil',
      width: 520,
      height: 780,
      backgroundColor: 'rgba(122,82,204,0.16)',
      fillColor: 'rgba(122,82,204,0.16)',
      backgroundImageUrl: 'linear-gradient(135deg, rgba(122,82,204,0.18), rgba(213,173,84,0.14) 48%, rgba(255,255,255,0.08))',
      borderWidth: '_none_',
      borderRadius: 'rounded-xl',
      opacity: 0.45,
    },
  },
];

export const CONSOLIDATED_ELEMENT_KITS: typeof elementKits = [
  { label: 'Text', description: 'Static or placeholder-driven text.', category: 'Core', icon: Type, type: 'text' },
  { label: 'Image', description: 'Artwork, uploaded image, or data-key image slot.', category: 'Core', icon: ImageIcon, type: 'image' },
  { label: 'Icon', description: 'Lucide, TCG symbol, or uploaded custom icon.', category: 'Core', icon: Sparkles, type: 'icon' },
  { label: 'Shape', description: 'Rectangle or ellipse primitive for badges and masks.', category: 'Core', icon: Square, type: 'shape' },
  {
    label: 'Line / Divider',
    description: 'A primitive line that becomes ornate through divider presets.',
    category: 'Core',
    icon: MinusIcon,
    type: 'shape',
    preset: { name: 'Divider', shapeKind: 'line', shapeRole: 'divider', width: 470, height: 36, strokeWidth: 0, borderWidth: '_none_', borderRadius: 'rounded-none', appearance: { dividerAsset: '/card-assets/dividers/gilded-filigree.svg', assetKind: 'divider', shapeRole: 'divider', textureOpacity: 100, material: { baseColor: 'transparent', texture: { kind: 'none' } }, border: { kind: 'none', width: 0, radius: 0 } } },
  },
];

// ─── Style Presets ────────────────────────────────────────────────────────────

export const ELEMENT_STYLE_PRESETS: Array<{ label: string; updates: Partial<FreeformCardElement> }> = [
  {
    label: 'Parchment Gold',
    updates: {
      backgroundColor: 'rgba(246,232,199,0.88)',
      fillColor: 'rgba(246,232,199,0.88)',
      backgroundImageUrl: 'linear-gradient(135deg, rgba(255,248,222,0.96), rgba(214,174,92,0.25))',
      textColor: '#24190d',
      borderColor: '#b58b35',
      strokeColor: '#b58b35',
      borderWidth: 'border',
      borderRadius: 'rounded-md',
    },
  },
  {
    label: 'Arcane Violet',
    updates: {
      backgroundColor: 'rgba(35,19,62,0.9)',
      fillColor: 'rgba(35,19,62,0.9)',
      backgroundImageUrl: 'linear-gradient(135deg, rgba(122,82,204,0.38), rgba(13,17,23,0.94))',
      textColor: '#f1e8ff',
      borderColor: '#7a52cc',
      strokeColor: '#bda2ff',
      borderWidth: 'border',
      borderRadius: 'rounded-lg',
    },
  },
  {
    label: 'Obsidian Gilt',
    updates: {
      backgroundColor: '#120f0b',
      fillColor: '#120f0b',
      backgroundImageUrl: 'linear-gradient(180deg, rgba(213,173,84,0.18), rgba(0,0,0,0.18))',
      textColor: '#f5d27b',
      borderColor: '#d5ad54',
      strokeColor: '#d5ad54',
      borderWidth: 'border-2',
      borderRadius: 'rounded-md',
    },
  },
  {
    label: 'Dragonfire',
    updates: {
      backgroundColor: '#2a0e08',
      fillColor: '#2a0e08',
      backgroundImageUrl: 'linear-gradient(135deg, rgba(132,37,15,0.92), rgba(213,106,37,0.34), rgba(10,10,12,0.94))',
      textColor: '#ffe3a2',
      borderColor: '#d67425',
      strokeColor: '#ffb35f',
      borderWidth: 'border',
      borderRadius: 'rounded-md',
    },
  },
  {
    label: 'Moonlit Glass',
    updates: {
      backgroundColor: 'rgba(18,24,36,0.58)',
      fillColor: 'rgba(18,24,36,0.58)',
      backgroundImageUrl: 'linear-gradient(135deg, rgba(255,255,255,0.16), rgba(122,82,204,0.18), rgba(255,255,255,0.04))',
      textColor: '#e6ecff',
      borderColor: '#7f8aa3',
      strokeColor: '#dfe7ff',
      borderWidth: 'border',
      borderRadius: 'rounded-xl',
      opacity: 0.88,
    },
  },
  {
    label: 'Etched Gilding',
    updates: {
      backgroundColor: '#140f09',
      fillColor: '#140f09',
      backgroundImageUrl: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.055) 0 2px, transparent 2px 9px), radial-gradient(circle at 50% 0%, rgba(213,173,84,0.22), transparent 48%), linear-gradient(180deg, rgba(213,173,84,0.18), rgba(0,0,0,0.28))',
      textColor: '#f7df9d',
      borderColor: '#d5ad54',
      strokeColor: '#d5ad54',
      borderWidth: 'border-4',
      borderRadius: 'rounded-lg',
    },
  },
  {
    label: 'Purple Foil',
    updates: {
      backgroundColor: '#160d25',
      fillColor: '#160d25',
      backgroundImageUrl: 'repeating-linear-gradient(115deg, rgba(255,255,255,0.12) 0 3px, transparent 3px 16px), linear-gradient(135deg, rgba(122,82,204,0.92), rgba(38,14,74,0.96) 52%, rgba(213,173,84,0.24))',
      textColor: '#f4eaff',
      borderColor: '#d5ad54',
      strokeColor: '#d8c4ff',
      borderWidth: 'border-2',
      borderRadius: 'rounded-lg',
    },
  },
];

export const BORDER_PRESETS: Array<{ label: string; updates: Partial<FreeformCardElement> }> = [
  { label: 'None', updates: { borderWidth: '_none_', strokeWidth: 0 } },
  { label: 'Gold Hairline', updates: { borderWidth: 'border', borderColor: '#d5ad54', strokeColor: '#d5ad54', strokeWidth: 1, borderRadius: 'rounded-md' } },
  { label: 'Heavy Relic', updates: { borderWidth: 'border-4', borderColor: '#9f742a', strokeColor: '#d5ad54', strokeWidth: 4, borderRadius: 'rounded-lg' } },
  { label: 'Arcane Edge', updates: { borderWidth: 'border-2', borderColor: '#7a52cc', strokeColor: '#bda2ff', strokeWidth: 2, borderRadius: 'rounded-xl' } },
  { label: 'Circle Seal', updates: { borderWidth: 'border-2', borderColor: '#d5ad54', strokeColor: '#d5ad54', strokeWidth: 2, borderRadius: 'rounded-full' } },
  { label: 'Etched Frame', updates: { borderWidth: 'border-4', borderColor: '#d5ad54', strokeColor: '#f5d27b', strokeWidth: 3, borderRadius: 'rounded-md', backgroundImageUrl: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.08) 0 1px, transparent 1px 8px), linear-gradient(180deg, rgba(213,173,84,0.18), transparent)' } },
  { label: 'Violet Relic', updates: { borderWidth: 'border-4', borderColor: '#7a52cc', strokeColor: '#d8c4ff', strokeWidth: 3, borderRadius: 'rounded-xl', backgroundImageUrl: 'linear-gradient(135deg, rgba(122,82,204,0.28), rgba(213,173,84,0.12), rgba(0,0,0,0.22))' } },
];

export const SHAPE_PRESETS: Array<{ label: string; updates: Partial<FreeformCardElement> }> = [
  { label: 'Panel', updates: { shapeKind: 'rectangle', width: 320, height: 120, borderRadius: 'rounded-md' } },
  { label: 'Seal Orb', updates: { shapeKind: 'ellipse', width: 72, height: 72, borderRadius: 'rounded-full' } },
  { label: 'Simple Line', updates: { shapeKind: 'line', width: 420, height: 6, strokeWidth: 2, fillColor: '#d5ad54', strokeColor: '#d5ad54', backgroundImageUrl: 'linear-gradient(90deg, transparent, #d5ad54 20%, #fff0a8 50%, #d5ad54 80%, transparent)' } },
  { label: 'Tall Frame', updates: { shapeKind: 'rectangle', width: 520, height: 780, borderRadius: 'rounded-xl', fillColor: 'rgba(0,0,0,0.08)' } },
];

export const DIVIDER_PRESETS: Array<{ label: string; updates: Partial<FreeformCardElement> }> = [
  {
    label: 'Gilded Filigree',
    updates: {
      shapeKind: 'rectangle',
      width: 470,
      height: 14,
      strokeWidth: 0,
      fillColor: '#d5ad54',
      backgroundImageUrl: 'linear-gradient(90deg, transparent 0%, #7f5d1f 8%, #f5d27b 18%, #7f5d1f 28%, transparent 36%, #d5ad54 50%, transparent 64%, #7f5d1f 72%, #f5d27b 82%, #7f5d1f 92%, transparent 100%)',
      borderWidth: '_none_',
      borderRadius: 'rounded-full',
    },
  },
  {
    label: 'Mana Thread',
    updates: {
      shapeKind: 'rectangle',
      width: 470,
      height: 10,
      strokeWidth: 0,
      fillColor: '#7a52cc',
      backgroundImageUrl: 'linear-gradient(90deg, transparent, #7a52cc 16%, #d5ad54 50%, #7a52cc 84%, transparent)',
      borderWidth: '_none_',
      borderRadius: 'rounded-full',
    },
  },
  {
    label: 'Double Gold',
    updates: {
      shapeKind: 'rectangle',
      width: 470,
      height: 12,
      strokeWidth: 0,
      fillColor: '#d5ad54',
      backgroundImageUrl: 'linear-gradient(180deg, transparent 0 25%, #d5ad54 25% 38%, transparent 38% 62%, #d5ad54 62% 75%, transparent 75%)',
      borderWidth: '_none_',
    },
  },
  {
    label: 'Bloodline',
    updates: {
      shapeKind: 'rectangle',
      width: 470,
      height: 10,
      strokeWidth: 0,
      fillColor: '#8c2718',
      backgroundImageUrl: 'linear-gradient(90deg, transparent, #8c2718 18%, #f0b15a 50%, #8c2718 82%, transparent)',
      borderWidth: '_none_',
      borderRadius: 'rounded-full',
    },
  },
  {
    label: 'Chevron Relic',
    updates: {
      shapeKind: 'rectangle',
      width: 470,
      height: 18,
      strokeWidth: 0,
      fillColor: '#7a52cc',
      backgroundImageUrl: 'repeating-linear-gradient(120deg, transparent 0 10px, rgba(255,255,255,0.16) 10px 15px), linear-gradient(90deg, transparent, #4d2096 14%, #d5ad54 50%, #4d2096 86%, transparent)',
      borderWidth: '_none_',
      borderRadius: 'rounded-full',
    },
  },
  {
    label: 'Gem Center',
    updates: {
      shapeKind: 'rectangle',
      width: 470,
      height: 20,
      strokeWidth: 0,
      fillColor: '#d5ad54',
      backgroundImageUrl: 'linear-gradient(90deg, transparent, #7f5d1f 20%, transparent 42%, #f5d27b 47%, #7a52cc 50%, #f5d27b 53%, transparent 58%, #7f5d1f 80%, transparent)',
      borderWidth: '_none_',
      borderRadius: 'rounded-full',
    },
  },
];

export const SYMBOL_STYLE_PRESETS: Array<{ label: string; updates: Partial<FreeformCardElement> }> = [
  { label: 'Fire', updates: { iconName: 'Flame', strokeColor: '#ffb35f', fillColor: 'rgba(132,37,15,0.72)', backgroundColor: '#210b06', borderColor: '#d67425', borderWidth: 'border', borderRadius: 'rounded-full', iconImageSource: undefined } },
  { label: 'Water', updates: { iconName: 'Droplets', strokeColor: '#9ddcff', fillColor: 'rgba(47,125,185,0.45)', backgroundColor: '#071521', borderColor: '#49a7df', borderWidth: 'border', borderRadius: 'rounded-full', iconImageSource: undefined } },
  { label: 'Arcane', updates: { iconName: 'WandSparkles', strokeColor: '#d8c4ff', fillColor: 'rgba(122,82,204,0.42)', backgroundColor: '#190f2c', borderColor: '#7a52cc', borderWidth: 'border-2', borderRadius: 'rounded-full', iconImageSource: undefined } },
  { label: 'Nature', updates: { iconName: 'Leaf', strokeColor: '#b9f2a1', fillColor: 'rgba(62,137,78,0.48)', backgroundColor: '#0b1a0f', borderColor: '#6fb06a', borderWidth: 'border', borderRadius: 'rounded-full', iconImageSource: undefined } },
  { label: 'Shadow', updates: { iconName: 'Skull', strokeColor: '#e6d8ff', fillColor: 'rgba(36,28,46,0.82)', backgroundColor: '#08070a', borderColor: '#8066a8', borderWidth: 'border', borderRadius: 'rounded-full', iconImageSource: undefined } },
  { label: 'Relic', updates: { iconName: 'Gem', strokeColor: '#ffe09b', fillColor: 'rgba(213,173,84,0.34)', backgroundColor: '#151008', borderColor: '#d5ad54', borderWidth: 'border-2', borderRadius: 'rounded-full', iconImageSource: undefined } },
];

export const SHAPE_ROLE_PRESETS: Array<{ label: string; updates: Partial<FreeformCardElement> }> = [
  { label: 'Panel', updates: { shapeRole: 'panel', shapeKind: 'rectangle', width: 360, height: 140, borderRadius: 'rounded-md', appearance: { shapeRole: 'panel', material: { baseColor: 'rgba(18,15,11,0.72)', texture: { kind: 'uploaded', assetSource: '/card-assets/textures/dark-leather.svg', assetKind: 'texture', textureOpacity: 42, textureScale: 180, blendMode: 'overlay' } }, border: { kind: 'relic', color: '#d5ad54', width: 2, radius: 8 }, effects: { innerHighlight: 18, bevel: 20 } } } },
  { label: 'Art Frame', updates: { shapeRole: 'artFrame', shapeKind: 'corner-frame', width: 500, height: 330, fillColor: 'transparent', backgroundColor: 'transparent', appearance: { shapeRole: 'artFrame', material: { baseColor: 'rgba(0,0,0,0.04)', texture: { kind: 'none' } }, border: { kind: 'relic', color: '#d5ad54', secondaryColor: '#7a52cc', width: 4, radius: 10 }, effects: { glow: 10, innerHighlight: 16 } } } },
  { label: 'Rules Box', updates: { shapeRole: 'rulesBox', shapeKind: 'notch-panel', width: 500, height: 180, appearance: { shapeRole: 'rulesBox', material: { baseColor: 'rgba(244,226,186,0.94)', textColor: '#20140a', texture: { kind: 'uploaded', assetSource: '/card-assets/textures/parchment-grain.svg', assetKind: 'texture', textureOpacity: 46, textureScale: 160, blendMode: 'multiply' } }, border: { kind: 'relic', color: '#4a2f12', secondaryColor: '#d5ad54', width: 4, radius: 8 }, effects: { innerHighlight: 28, bevel: 22 } } } },
  { label: 'Title Plate', updates: { shapeRole: 'titlePlate', shapeKind: 'banner', width: 430, height: 48, appearance: { shapeRole: 'titlePlate', material: { baseColor: '#17100b', textColor: '#f7df9d', texture: { kind: 'uploaded', assetSource: '/card-assets/textures/hammered-metal.svg', assetKind: 'texture', textureOpacity: 28, textureScale: 150, blendMode: 'overlay' } }, border: { kind: 'double', color: '#d5ad54', width: 2, radius: 6 }, effects: { glow: 8, bevel: 18 } } } },
  { label: 'Stat Gem', updates: { shapeRole: 'statGem', shapeKind: 'diamond', width: 64, height: 64, appearance: { shapeRole: 'statGem', material: { baseColor: '#0b0f15', texture: { kind: 'uploaded', assetSource: '/card-assets/textures/purple-foil.svg', assetKind: 'texture', textureOpacity: 36, textureScale: 190, blendMode: 'screen' } }, border: { kind: 'foil', color: '#d5ad54', secondaryColor: '#7a52cc', width: 3, radius: 8 }, effects: { glow: 16 } } } },
  { label: 'Cost Orb', updates: { shapeRole: 'costOrb', shapeKind: 'ellipse', width: 64, height: 64, borderRadius: 'rounded-full', appearance: { shapeRole: 'costOrb', material: { baseColor: '#0b0f15', texture: { kind: 'uploaded', assetSource: '/card-assets/textures/hammered-metal.svg', assetKind: 'texture', textureOpacity: 34, textureScale: 150, blendMode: 'overlay' } }, border: { kind: 'foil', color: '#d5ad54', secondaryColor: '#f5d27b', width: 3, radius: 999 }, effects: { glow: 14, innerHighlight: 20 } } } },
];

export const TEXT_FRAME_PRESETS: Array<{ label: string; updates: Partial<FreeformCardElement> }> = [
  {
    label: 'MTG Rules Frame',
    updates: {
      backgroundColor: 'rgba(244,226,186,0.94)',
      backgroundImageUrl: 'linear-gradient(180deg, rgba(255,250,230,0.96), rgba(214,178,105,0.38))',
      textColor: '#20140a',
      borderColor: '#4a2f12',
      borderWidth: 'border-4',
      borderRadius: 'rounded-md',
      padding: 'p-3',
    },
  },
  {
    label: 'Black Legendary',
    updates: {
      backgroundColor: '#15100b',
      backgroundImageUrl: 'linear-gradient(180deg, rgba(213,173,84,0.2), rgba(0,0,0,0.2))',
      textColor: '#f7e6b0',
      borderColor: '#d5ad54',
      borderWidth: 'border-2',
      borderRadius: 'rounded-lg',
      padding: 'p-3',
    },
  },
  {
    label: 'Violet Spellbox',
    updates: {
      backgroundColor: '#1a102c',
      backgroundImageUrl: 'linear-gradient(135deg, rgba(122,82,204,0.44), rgba(7,9,14,0.96))',
      textColor: '#f1e8ff',
      borderColor: '#bda2ff',
      borderWidth: 'border-2',
      borderRadius: 'rounded-xl',
      padding: 'p-3',
    },
  },
  {
    label: 'Gold Nameplate',
    updates: {
      backgroundColor: '#17100b',
      backgroundImageUrl: 'linear-gradient(90deg, rgba(0,0,0,0.38), rgba(213,173,84,0.24), rgba(0,0,0,0.38))',
      textColor: '#f7df9d',
      borderColor: '#d5ad54',
      borderWidth: 'border-2',
      borderRadius: 'rounded-md',
      padding: 'p-2',
      fontWeight: 'font-bold',
      textAlign: 'center',
    },
  },
  {
    label: 'Flavor Scroll',
    updates: {
      backgroundColor: 'rgba(248,235,201,0.9)',
      backgroundImageUrl: 'radial-gradient(circle at 50% 0%, rgba(255,255,255,0.54), transparent 42%), linear-gradient(180deg, rgba(255,246,218,0.95), rgba(207,166,89,0.3))',
      textColor: '#3a2411',
      borderColor: '#8b6424',
      borderWidth: 'border-2',
      borderRadius: 'rounded-xl',
      padding: 'p-4',
      fontStyle: 'italic',
    },
  },
  {
    label: 'Aged Parchment',
    updates: {
      backgroundColor: 'rgba(235,211,159,0.96)',
      backgroundImageUrl: 'radial-gradient(circle at 15% 20%, rgba(80,42,13,0.14), transparent 18%), radial-gradient(circle at 80% 10%, rgba(255,255,255,0.38), transparent 22%), repeating-linear-gradient(0deg, rgba(80,42,13,0.045) 0 1px, transparent 1px 8px), linear-gradient(180deg, rgba(255,249,220,0.96), rgba(198,147,67,0.36))',
      textColor: '#221407',
      borderColor: '#5a3410',
      borderWidth: 'border-4',
      borderRadius: 'rounded-md',
      padding: 'p-4',
    },
  },
  {
    label: 'Carved Obsidian',
    updates: {
      backgroundColor: '#0d0b09',
      backgroundImageUrl: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.055) 0 2px, transparent 2px 10px), linear-gradient(180deg, rgba(213,173,84,0.18), rgba(0,0,0,0.38))',
      textColor: '#f7e6b0',
      borderColor: '#d5ad54',
      borderWidth: 'border-4',
      borderRadius: 'rounded-lg',
      padding: 'p-4',
    },
  },
];

// ─── Font Class → CSS Map ─────────────────────────────────────────────────────

export const FONT_CLASS_TO_CSS: Record<string, string> = {
  'font-sans': 'system-ui, sans-serif',
  'font-serif': 'Georgia, "Times New Roman", serif',
  'font-mono': 'Menlo, Consolas, monospace',
  'font-cinzel': 'Cinzel, serif',
  'font-lato': 'Lato, sans-serif',
  'font-trajan': 'Cinzel, "Trajan Pro", "Palatino Linotype", serif',
  'font-book': '"Iowan Old Style", "Book Antiqua", "Palatino Linotype", Georgia, serif',
  'font-humanist': 'Optima, "Segoe UI", "Trebuchet MS", Arial, sans-serif',
  'font-condensed': '"Arial Narrow", "Roboto Condensed", Arial, sans-serif',
  'font-engraved': 'Garamond, Baskerville, "Times New Roman", serif',
};

// ─── ColorField Component ─────────────────────────────────────────────────────

// ─── Rich Text Renderer ───────────────────────────────────────────────────────

/** Renders inline spans from parseRichText with proper styles */
function InlineRich({ text }: { text: string }) {
  const spans = parseRichText(text);
  return (
    <>
      {spans.map((span, i) => {
        const s: React.CSSProperties = {};
        if (span.bold) s.fontWeight = 'bold';
        if (span.italic) s.fontStyle = 'italic';
        if (span.underline) s.textDecoration = 'underline';
        if (span.highlight) s.backgroundColor = span.highlight;
        if (span.color) s.color = span.color;
        if (Object.keys(s).length === 0) return <Fragment key={i}>{span.text}</Fragment>;
        return <span key={i} style={s}>{span.text}</span>;
      })}
    </>
  );
}

/**
 * RichTextContent — renders a multi-line, list-aware, inline-rich text string
 * for use in the freeform canvas preview. Supports:
 *  - Actual `\n` newlines → line breaks
 *  - Lines starting with `- ` or `• ` → <ul> bullet list
 *  - Lines starting with `N. ` → <ol> numbered list
 *  - **bold**, _italic_, __underline__, ==highlight==, [color:#hex]text[/color]
 */
export function RichTextContent({ text }: { text: string }) {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Bullet list
    if (/^[-•]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-•]\s/.test(lines[i])) {
        items.push(lines[i].slice(2));
        i++;
      }
      nodes.push(
        <ul key={key++} style={{ listStyleType: 'disc', paddingLeft: '1.3em', margin: '0.15em 0' }}>
          {items.map((item, j) => <li key={j}><InlineRich text={item} /></li>)}
        </ul>,
      );
      continue;
    }

    // Numbered list
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ''));
        i++;
      }
      nodes.push(
        <ol key={key++} style={{ listStyleType: 'decimal', paddingLeft: '1.3em', margin: '0.15em 0' }}>
          {items.map((item, j) => <li key={j}><InlineRich text={item} /></li>)}
        </ol>,
      );
      continue;
    }

    // Empty line → spacer
    if (line === '') {
      nodes.push(<span key={key++} style={{ display: 'block', height: '0.5em' }} aria-hidden="true" />);
      i++;
      continue;
    }

    // Normal line
    nodes.push(<p key={key++} style={{ margin: 0 }}><InlineRich text={line} /></p>);
    i++;
  }

  return <>{nodes}</>;
}

// ─── Rich Text Toolbar ────────────────────────────────────────────────────────

function applyFormat(
  el: HTMLTextAreaElement,
  value: string,
  before: string,
  after: string,
  onChange: (v: string) => void,
) {
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const selected = value.slice(start, end) || 'text';
  const next = value.slice(0, start) + before + selected + after + value.slice(end);
  onChange(next);
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(start + before.length, start + before.length + selected.length);
  });
}

function applyListPrefix(
  el: HTMLTextAreaElement,
  value: string,
  prefix: string,
  onChange: (v: string) => void,
) {
  const start = el.selectionStart;
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const lineEnd = value.indexOf('\n', start);
  const end = lineEnd === -1 ? value.length : lineEnd;
  const line = value.slice(lineStart, end);
  if (line.startsWith(prefix)) {
    onChange(value.slice(0, lineStart) + line.slice(prefix.length) + value.slice(end));
  } else {
    const next = value.slice(0, lineStart) + prefix + line + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length);
    });
  }
}

export interface RichTextToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (v: string) => void;
}

export function RichTextToolbar({ textareaRef, value, onChange }: RichTextToolbarProps) {
  const [colorOpen, setColorOpen] = useState(false);
  const [pickedColor, setPickedColor] = useState('#f5d27b');

  const btn = 'flex h-7 w-7 items-center justify-center rounded-[4px] border border-[#2d3340] bg-[#111720] text-[#d8d1c4] hover:border-[#d5ad54] hover:text-[#f5d27b] transition-colors';

  const handle = (before: string, after: string) => {
    const el = textareaRef.current;
    if (!el) return;
    applyFormat(el, value, before, after, onChange);
  };

  const handleList = (prefix: string) => {
    const el = textareaRef.current;
    if (!el) return;
    applyListPrefix(el, value, prefix, onChange);
  };

  const handleColor = () => {
    const el = textareaRef.current;
    if (!el) return;
    applyFormat(el, value, `[color:${pickedColor}]`, '[/color]', onChange);
    setColorOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-[5px] border border-[#252b35] bg-[#0b0f15] px-1.5 py-1">
      <button type="button" className={btn} aria-label="Bold" title="Bold — **text**" onClick={() => handle('**', '**')}>
        <Bold className="h-3.5 w-3.5" />
      </button>
      <button type="button" className={btn} aria-label="Italic" title="Italic — _text_" onClick={() => handle('_', '_')}>
        <Italic className="h-3.5 w-3.5" />
      </button>
      <button type="button" className={btn} aria-label="Underline" title="Underline — __text__" onClick={() => handle('__', '__')}>
        <Underline className="h-3.5 w-3.5" />
      </button>
      <button type="button" className={btn} aria-label="Highlight" title="Highlight — ==text==" onClick={() => handle('==', '==')}>
        <Highlighter className="h-3.5 w-3.5" />
      </button>
      <div className="h-4 w-px bg-[#2d3340]" />
      <button type="button" className={btn} aria-label="Bullet list" title="Bullet list — - item" onClick={() => handleList('- ')}>
        <List className="h-3.5 w-3.5" />
      </button>
      <button type="button" className={btn} aria-label="Numbered list" title="Numbered list — 1. item" onClick={() => handleList('1. ')}>
        <ListOrdered className="h-3.5 w-3.5" />
      </button>
      <div className="h-4 w-px bg-[#2d3340]" />
      <Popover open={colorOpen} onOpenChange={setColorOpen}>
        <PopoverTrigger asChild>
          <button type="button" className={btn} aria-label="Text color" title="Colored text — [color:#hex]text[/color]">
            <Palette className="h-3.5 w-3.5" style={{ color: pickedColor }} />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2 bg-[#0d1117] border-[#252b35]" side="left" align="start">
          <HexColorPicker color={pickedColor} onChange={setPickedColor} />
          <input
            type="text"
            value={pickedColor}
            title="Hex color"
            onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setPickedColor(e.target.value); }}
            className="mt-2 h-7 w-full rounded-[4px] border border-[#2d3340] bg-[#080b10] px-2 text-center font-mono text-xs text-[#d8d1c4] focus:outline-none focus:ring-1 focus:ring-[#d5ad54]"
            maxLength={7}
          />
          <button
            type="button"
            className="mt-2 w-full rounded-[4px] border border-[#7a52cc] bg-[#1a1230] py-1 text-xs font-semibold text-[#d5ad54] hover:bg-[#21183d]"
            onClick={handleColor}
          >
            Apply Color
          </button>
        </PopoverContent>
      </Popover>
      <span className="ml-auto text-[9px] uppercase tracking-[0.14em] text-[#757d8c]">**bold** _italic_ ==hi==</span>
    </div>
  );
}

export function ColorField({ value, onChange, id }: { value: string; onChange: (v: string) => void; id?: string }) {
  const [open, setOpen] = useState(false);
  const hex = /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000';
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          className="h-8 w-full rounded-[4px] border border-[#2d3340] focus:outline-none focus:ring-1 focus:ring-[#d5ad54]"
          style={{ backgroundColor: hex }}
          aria-label={`Color ${hex}`}
        />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2 bg-[#0d1117] border-[#252b35]" side="left" align="start">
        <HexColorPicker color={hex} onChange={onChange} />
        <input
          type="text"
          defaultValue={hex}
          key={hex}
          title="Hex color value"
          onBlur={e => { if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) onChange(e.target.value); }}
          className="mt-2 h-7 w-full rounded-[4px] border border-[#2d3340] bg-[#080b10] px-2 text-center font-mono text-xs text-[#d8d1c4] focus:outline-none focus:ring-1 focus:ring-[#d5ad54]"
          maxLength={7}
        />
      </PopoverContent>
    </Popover>
  );
}

// ─── Template Factory ─────────────────────────────────────────────────────────

export const makeNewFreeformTemplate = (name = 'New 2.0 Template'): TCGCardTemplate => reconstructMinimalTemplate({
  id: null,
  name,
  layoutMode: 'freeform',
  aspectRatio: TCG_ASPECT_RATIO,
  frameStyle: 'custom',
  baseBackgroundColor: '#f7ead0',
  baseTextColor: '#21180d',
  cardBorderColor: '#c89f42',
  cardBorderWidth: '4px',
  cardBorderStyle: 'solid',
  cardBorderRadius: '0.75rem',
  rows: [],
  freeformCanvas: createDefaultFreeformCanvas(),
});

// ─── Utility Functions ────────────────────────────────────────────────────────

export const mmConversion: Record<string, number> = {
  mm: 1,
  cm: 10,
  in: 25.4,
  px96: 25.4 / 96,
  px300: 25.4 / 300,
};

export const borderWidthClassToPixels = (value?: string): number => {
  if (!value || value === '_none_') return 0;
  if (value === 'border') return 1;
  const match = value.match(/border-(\d+)/);
  return match ? Number(match[1]) : 1;
};

export const radiusClassToPixels = (value?: string): string | undefined => {
  switch (value) {
    case 'rounded-sm': return '2px';
    case 'rounded-md': return '6px';
    case 'rounded-lg': return '8px';
    case 'rounded-xl': return '12px';
    case 'rounded-full': return '9999px';
    default: return undefined;
  }
};

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const legacyFontSizeToPx = (value?: FreeformCardElement['fontSize']): number => {
  if (value === 'text-xs') return 12;
  if (value === 'text-sm') return 14;
  if (value === 'text-base') return 16;
  if (value === 'text-lg') return 18;
  if (value === 'text-xl') return 20;
  if (value === 'text-2xl') return 24;
  return 14;
};

export const textFontSizePx = (element: Pick<FreeformCardElement, 'fontSize' | 'fontSizePx'>): number =>
  clamp(Math.round(Number(element.fontSizePx) || legacyFontSizeToPx(element.fontSize)), 6, 96);

export const escapeTemplateText = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, '\\n');

export const unescapeTemplateText = (value: string): string =>
  value.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');

export const parseTextBinding = (content?: string): { field: string; fallback: string } => {
  const raw = content || '';
  const match = raw.match(/^\{\{\s*([A-Za-z_][\w.-]*)\s*:\s*"([\s\S]*)"\s*\}\}$/);
  if (!match) return { field: '', fallback: raw };
  return { field: match[1], fallback: unescapeTemplateText(match[2]) };
};

export const buildTextBinding = (field: string, fallback: string): string => {
  const cleanField = field.trim().replace(/[^\w.-]/g, '');
  return cleanField ? `{{${cleanField}:"${escapeTemplateText(fallback)}"}}` : fallback;
};

export const shapeClipPath = (shapeKind?: FreeformCardElement['shapeKind']): string | undefined => {
  if (shapeKind === 'diamond') return 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';
  if (shapeKind === 'hexagon') return 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)';
  if (shapeKind === 'banner') return 'polygon(0% 0%, 92% 0%, 100% 50%, 92% 100%, 0% 100%, 8% 50%)';
  if (shapeKind === 'notch-panel') return 'polygon(6% 0%, 94% 0%, 100% 14%, 100% 86%, 94% 100%, 6% 100%, 0% 86%, 0% 14%)';
  if (shapeKind === 'bracket-frame') return 'polygon(0% 0%, 18% 0%, 18% 8%, 8% 8%, 8% 92%, 18% 92%, 18% 100%, 0% 100%, 0% 0%, 82% 0%, 100% 0%, 100% 100%, 82% 100%, 82% 92%, 92% 92%, 92% 8%, 82% 8%)';
  if (shapeKind === 'corner-frame') return 'polygon(0% 0%, 28% 0%, 28% 6%, 6% 6%, 6% 28%, 0% 28%, 0% 0%, 72% 0%, 100% 0%, 100% 28%, 94% 28%, 94% 6%, 72% 6%, 72% 0%, 100% 72%, 100% 100%, 72% 100%, 72% 94%, 94% 94%, 94% 72%, 100% 72%, 28% 100%, 0% 100%, 0% 72%, 6% 72%, 6% 94%, 28% 94%)';
  return undefined;
};
