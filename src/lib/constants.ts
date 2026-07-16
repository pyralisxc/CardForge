
import type { ElementType } from 'react';
import type { TCGCardTemplate } from '@/domain/templates';
import { PackageOpen, PenTool } from 'lucide-react';

export const FONT_WEIGHTS = ['font-normal', 'font-medium', 'font-semibold', 'font-bold'] as const;
export const TEXT_ALIGNS = ['left', 'center', 'right', 'justify'] as const;
export const FONT_STYLES = ['normal', 'italic'] as const;

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
  { value: "template-maker", label: "Layout Studio", icon: PenTool },
  { value: "generator", label: "Generate", icon: PackageOpen },
];
