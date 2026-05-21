import { describe, expect, it } from 'vitest';

import {
  createZipExportManifest,
  getZipExportFaceCount,
  getZipExportLabels,
  getZipSafeCardName,
} from '@/lib/zipExportLayout';
import type { DisplayCard } from '@/types';

const makeCard = (overrides: Partial<DisplayCard> = {}): DisplayCard => ({
  uniqueId: 'card-1',
  data: {},
  template: {
    id: 'template-1',
    name: 'Template',
    aspectRatio: '63:88',
  },
  ...overrides,
});

describe('zip export layout helpers', () => {
  it('uses distinct labels and archive names for print and digital workflows', () => {
    expect(getZipExportLabels('physical')).toEqual({
      outputLabel: 'physical print card faces',
      folderName: 'physical-print-card-faces',
      fileName: 'cardforge-physical-print-card-faces.zip',
    });
    expect(getZipExportLabels('virtual')).toEqual({
      outputLabel: 'digital card images',
      folderName: 'digital-card-images',
      fileName: 'cardforge-digital-card-images.zip',
    });
  });

  it('creates front/back manifest entries only when the template has a back face', () => {
    const cards = [
      makeCard({ uniqueId: 'front-only', data: { cardName: 'Front Only' } }),
      makeCard({
        uniqueId: 'duplex',
        data: { cardName: 'Duplex Card' },
        template: {
          id: 'duplex-template',
          name: 'Duplex Template',
          aspectRatio: '63:88',
          backCanvas: { width: 630, height: 880, gridSize: 18, elements: [] },
        },
      }),
    ];

    const manifest = createZipExportManifest(cards, 'physical');

    expect(getZipExportFaceCount(cards)).toBe(3);
    expect(manifest.map((item) => item.path)).toEqual([
      'physical-print-card-faces/001_Front_Only_front.png',
      'physical-print-card-faces/002_Duplex_Card_front.png',
      'physical-print-card-faces/002_Duplex_Card_back.png',
    ]);
  });

  it('sanitizes generated filenames without losing fallback naming', () => {
    expect(getZipSafeCardName(makeCard({ data: { cardName: 'Blade / Crown: Alpha!' } }), 0)).toBe('Blade___Crown__Alpha_');
    expect(getZipSafeCardName(makeCard(), 2)).toBe('card-3');
  });
});
