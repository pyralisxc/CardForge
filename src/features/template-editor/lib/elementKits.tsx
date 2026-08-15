/**
 * elementKits.tsx
 *
 * Insertable element seeds for the template editor element rail.
 * These are asset-free editor primitives. Visual recipes and media come from the Forge Pipeline.
 */

import type { ElementType } from 'react';
import {
  Image as ImageIcon,
  MinusIcon,
  Sparkles,
  Square,
  Type,
} from 'lucide-react';
import type { FreeformCardElement } from '@/domain/templates';

export type ElementKit = {
  label: string;
  description: string;
  category: 'Core' | 'Element Recipes' | 'Ornaments';
  icon: ElementType;
  type: FreeformCardElement['type'];
  preset?: Partial<FreeformCardElement>;
};

export const CONSOLIDATED_ELEMENT_KITS: ElementKit[] = [
  { label: 'Text', description: 'Static or placeholder-driven text.', category: 'Core', icon: Type, type: 'text' },
  { label: 'Picture', description: 'Artwork, uploaded picture, or data-key picture slot.', category: 'Core', icon: ImageIcon, type: 'image' },
  { label: 'Icon', description: 'Lucide, TCG symbol, or uploaded custom icon.', category: 'Core', icon: Sparkles, type: 'icon' },
  { label: 'Shape', description: 'Rectangle or ellipse primitive for badges and masks.', category: 'Core', icon: Square, type: 'shape' },
  {
    label: 'Divider / Rule',
    description: 'A line element for section breaks, separators, and ornamental dividers.',
    category: 'Core',
    icon: MinusIcon,
    type: 'shape',
    preset: {
      name: 'Divider',
      shapeKind: 'line',
      shapeRole: 'divider',
      width: 470,
      height: 36,
      strokeWidth: 0,
      borderWidth: '_none_',
      borderRadius: 'rounded-none',
      appearance: {
        assetKind: 'divider',
        shapeRole: 'divider',
        textureOpacity: 100,
        material: { baseColor: 'transparent', texture: { kind: 'none' } },
        border: { kind: 'none', width: 0, radius: 0 },
      },
    },
  },
];

export const elementKits = CONSOLIDATED_ELEMENT_KITS;
