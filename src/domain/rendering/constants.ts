import type { PaperSize } from './types';

export const PAPER_SIZES: PaperSize[] = [
  { name: 'US Letter (8.5×11 in)', widthMm: 215.9, heightMm: 279.4 },
  { name: 'US Legal (8.5×14 in)', widthMm: 215.9, heightMm: 355.6 },
  { name: 'A4 (210×297 mm)', widthMm: 210, heightMm: 297 },
  { name: 'A3 (297×420 mm)', widthMm: 297, heightMm: 420 },
  { name: 'A5 (148×210 mm)', widthMm: 148, heightMm: 210 },
  { name: 'Standard TCG Card (63×88 mm)', widthMm: 63, heightMm: 88 },
  { name: 'Poker Card (63.5×88.9 mm)', widthMm: 63.5, heightMm: 88.9 },
  { name: 'Bridge Card (57×89 mm)', widthMm: 57, heightMm: 89 },
  { name: 'Tarot Card (70×121 mm)', widthMm: 70, heightMm: 121 },
  { name: 'Business Card (85.6×54 mm)', widthMm: 85.6, heightMm: 54 },
  { name: 'Mini Card (44×67 mm)', widthMm: 44, heightMm: 67 },
];

export const TCG_ASPECT_RATIO = '63:88';
