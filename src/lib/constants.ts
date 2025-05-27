import type { PaperSize, SimplifiedCardTemplate } from '@/types';
import { nanoid } from 'nanoid'; // For generating unique IDs

export const PAPER_SIZES: PaperSize[] = [
  { name: 'US Letter (8.5x11 in)', widthMm: 215.9, heightMm: 279.4 },
  { name: 'A4 (210x297 mm)', widthMm: 210, heightMm: 297 },
  { name: 'Business Card Stock (89x51 mm)', widthMm: 89, heightMm: 51 },
  { name: 'Greeting Card Stock (5x7 in)', widthMm: 127, heightMm: 177.8 },
];

export const DEFAULT_TEMPLATES: SimplifiedCardTemplate[] = [
  {
    id: nanoid(),
    name: 'Simple Birthday Card',
    titlePlaceholder: 'Happy Birthday, {{name}}!',
    bodyPlaceholder: 'Wishing you a fantastic day filled with joy and laughter. Hope you enjoy your {{age}}th birthday!',
    imageSlot: true,
    imageSrc: `https://placehold.co/300x200.png`, // Default placeholder
    aspectRatio: '5:7',
    backgroundColor: '#FFFFFF',
    textColor: '#333333',
  },
  {
    id: nanoid(),
    name: 'Basic Thank You Card',
    titlePlaceholder: 'Thank You, {{recipient}}!',
    bodyPlaceholder: 'Your kindness and {{gift_description}} are truly appreciated.',
    imageSlot: false,
    aspectRatio: '3:2',
    backgroundColor: '#FFFFF0', // Ivory
    textColor: '#543D2D', // Dark Brown
  },
  {
    id: nanoid(),
    name: 'Holiday Greetings',
    titlePlaceholder: 'Season\'s Greetings, {{friendName}}!',
    bodyPlaceholder: 'May your holidays be filled with warmth and cheer. Looking forward to {{event_planned}}.',
    imageSlot: true,
    imageSrc: `https://placehold.co/400x300.png`,
    aspectRatio: '7:5',
    backgroundColor: '#F0F8FF', // Alice Blue
    textColor: '#2F4F4F', // Dark Slate Gray
  }
];
