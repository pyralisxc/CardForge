
import type { ElementType } from 'react';
import type { TCGCardTemplate } from '@/types';
import { PackageOpen, PenTool } from 'lucide-react';


export const PAPER_SIZES: Array<{ name: string; widthMm: number; heightMm: number }> = [
  // Standard office
  { name: 'US Letter (8.5×11 in)', widthMm: 215.9, heightMm: 279.4 },
  { name: 'US Legal (8.5×14 in)', widthMm: 215.9, heightMm: 355.6 },
  { name: 'A4 (210×297 mm)', widthMm: 210, heightMm: 297 },
  { name: 'A3 (297×420 mm)', widthMm: 297, heightMm: 420 },
  { name: 'A5 (148×210 mm)', widthMm: 148, heightMm: 210 },
  // Card game formats
  { name: 'Standard TCG Card (63×88 mm)', widthMm: 63, heightMm: 88 },
  { name: 'Poker Card (63.5×88.9 mm)', widthMm: 63.5, heightMm: 88.9 },
  { name: 'Bridge Card (57×89 mm)', widthMm: 57, heightMm: 89 },
  { name: 'Tarot Card (70×121 mm)', widthMm: 70, heightMm: 121 },
  { name: 'Business Card (85.6×54 mm)', widthMm: 85.6, heightMm: 54 },
  { name: 'Mini Card (44×67 mm)', widthMm: 44, heightMm: 67 },
];

export const TCG_ASPECT_RATIO = '63:88'; // Standard TCG card aspect ratio

export const FONT_WEIGHTS = ['font-normal', 'font-medium', 'font-semibold', 'font-bold'] as const;
export const TEXT_ALIGNS = ['left', 'center', 'right', 'justify'] as const;
export const FONT_STYLES = ['normal', 'italic'] as const;

export const AVAILABLE_FONTS: Array<{name: string, value: string}> = [
  { name: 'System Sans', value: 'font-sans' },
  { name: 'Serif Classic', value: 'font-serif' },
  { name: 'Monospaced', value: 'font-mono' },
  { name: 'Fantasy Display (Cinzel)', value: 'font-cinzel' },
  { name: 'Clean Sans (Lato)', value: 'font-lato' },
  { name: 'Trajan-Style Small Caps', value: 'font-trajan' },
  { name: 'Oldstyle Book', value: 'font-book' },
  { name: 'Humanist Card Text', value: 'font-humanist' },
  { name: 'Condensed Title', value: 'font-condensed' },
  { name: 'Engraved Serif', value: 'font-engraved' },
];

export const PADDING_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'None (0px)', value: 'p-0' }, { label: 'XS (0.125rem)', value: 'p-0.5' },
  { label: 'S (0.25rem)', value: 'p-1' }, { label: 'M (0.5rem)', value: 'p-2' },
  { label: 'L (0.75rem)', value: 'p-3' }, { label: 'XL (1rem)', value: 'p-4' },
];

export const BORDER_WIDTH_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'No Border', value: '_none_' }, { label: '1px (All Sides)', value: 'border' },
  { label: '2px (All Sides)', value: 'border-2' }, { label: '4px (All Sides)', value: 'border-4' },
  { label: 'Top (1px)', value: 'border-t' }, { label: 'Bottom (1px)', value: 'border-b' },
  { label: 'Left (1px)', value: 'border-l' }, { label: 'Right (1px)', value: 'border-r' },
];

export const BORDER_RADIUS_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'None', value: 'rounded-none' },
  { label: 'Small', value: 'rounded-sm' },
  { label: 'Medium', value: 'rounded-md' },
  { label: 'Large', value: 'rounded-lg' },
  { label: 'X-Large', value: 'rounded-xl' },
  { label: 'Full', value: 'rounded-full' },
];

export const FRAME_STYLES: Array<{ label: string; value: string }> = [
  { label: 'Standard', value: 'standard' },
  { label: "Custom Colors", value: "custom" },
  { label: 'Classic Gold', value: 'classic-gold' },
  { label: 'Minimal Dark', value: 'minimal-dark' },
  { label: 'Arcane Purple', value: 'arcane-purple' },
];

export const CARD_BORDER_STYLES: Array<{ label: string; value: NonNullable<TCGCardTemplate['cardBorderStyle']> | '_default_' }> = [
  { label: 'Default (from Frame/Theme)', value: '_default_' },
  { label: 'Solid', value: 'solid' },
  { label: 'Dashed', value: 'dashed' },
  { label: 'Dotted', value: 'dotted' },
  { label: 'Double', value: 'double' },
  { label: 'None', value: 'none' },
];

export const DIMENSION_UNITS: Array<{ label: string; value: string }> = [
  { label: 'Millimeters (mm)', value: 'mm' },
  { label: 'Inches (in)', value: 'in' },
  { label: 'Centimeters (cm)', value: 'cm' },
  { label: 'Pixels – screen (96 dpi)', value: 'px96' },
  { label: 'Pixels – print (300 dpi)', value: 'px300' },
];

export const TABS_CONFIG: Array<{ value: string; label: string; icon: ElementType }> = [
  { value: "template-maker", label: "Card Template Maker", icon: PenTool },
  { value: "generator", label: "Card Generator", icon: PackageOpen },
];
