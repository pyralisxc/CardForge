import type { TCGCardTemplate } from '@/domain/templates';

export const PADDING_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'None (0px)', value: 'p-0' },
  { label: 'XS (0.125rem)', value: 'p-0.5' },
  { label: 'S (0.25rem)', value: 'p-1' },
  { label: 'M (0.5rem)', value: 'p-2' },
  { label: 'L (0.75rem)', value: 'p-3' },
  { label: 'XL (1rem)', value: 'p-4' },
];

export const FRAME_STYLES: Array<{ label: string; value: string }> = [
  { label: 'Standard', value: 'standard' },
  { label: 'Custom Colors', value: 'custom' },
  { label: 'Classic Gold', value: 'classic-gold' },
  { label: 'Minimal Dark', value: 'minimal-dark' },
  { label: 'Arcane Purple', value: 'arcane-purple' },
];

export const CARD_BORDER_STYLES: Array<{
  label: string;
  value: NonNullable<TCGCardTemplate['cardBorderStyle']> | '_default_';
}> = [
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
