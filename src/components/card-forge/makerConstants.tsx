"use client";

/**
 * makerConstants.tsx
 *
 * All static data, presets, element kits, utility functions, and the
 * ColorField component extracted from CardTemplateMaker.tsx to keep
 * the main component file focused on rendering and interaction logic.
 */

import { useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Badge,
  BoxSelect,
  Crown,
  Frame,
  Gem,
  Image as ImageIcon,
  LineChart,
  MinusIcon,
  Sparkles,
  Square,
  Type,
} from 'lucide-react';
import type { FreeformCardElement, TCGCardTemplate } from '@/types';
import { TCG_ASPECT_RATIO } from '@/lib/constants';
import { createDefaultFreeformCanvas, reconstructMinimalTemplate } from '@/lib/templateModel';

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

// ─── Element Kits ─────────────────────────────────────────────────────────────

export const elementKits: Array<{
  label: string;
  description: string;
  category: 'Core' | 'Premium Parts' | 'Card Parts' | 'Ornaments';
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

// --- Font Class to CSS Map ---

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

// ─── Rich Text Toolbar ────────────────────────────────────────────────────────

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

export const makeNewFreeformTemplate = (name = 'New Card Template'): TCGCardTemplate => reconstructMinimalTemplate({
  id: null,
  name,
  templateSource: 'user',
  aspectRatio: TCG_ASPECT_RATIO,
  frameStyle: 'custom',
  baseBackgroundColor: '#f7ead0',
  baseTextColor: '#21180d',
  cardBorderColor: '#c89f42',
  cardBorderWidth: '4px',
  cardBorderStyle: 'solid',
  cardBorderRadius: '0.75rem',
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

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
