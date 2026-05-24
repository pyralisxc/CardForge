import { describe, expect, it } from 'vitest';

import {
  createCardZipExportItems,
  createTabletopSimulatorSheets,
  createTabletopSimulatorManifest,
  createZipExportCopy,
  getTabletopSimulatorSheetFileName,
  getZipExportFileName,
} from '@/features/card-generator/lib/zipExport';
import type { DisplayCard } from '@/types';

const makeCard = (overrides: Partial<DisplayCard> = {}): DisplayCard => ({
  uniqueId: overrides.uniqueId || 'card-1',
  data: overrides.data || { cardName: 'Arcane Output' },
  template: {
    id: 'template-1',
    name: 'Template',
    aspectRatio: '63:88',
    ...overrides.template,
  },
});

describe('zip export helpers', () => {
  it('creates one export item for a front-only output', () => {
    const [item] = createCardZipExportItems([makeCard()]);

    expect(item).toMatchObject({
      cardIndex: 0,
      face: 'front',
    });
  });

  it('creates front and back export items when a template has a back canvas', () => {
    const items = createCardZipExportItems([
      makeCard({
        template: {
          id: 'template-1',
          name: 'Double Sided',
          aspectRatio: '63:88',
          backCanvas: { width: 630, height: 880, elements: [] },
        },
      }),
    ]);

    expect(items.map((item) => item.face)).toEqual(['front', 'back']);
  });

  it('builds stable zip copy from the export mode and face count', () => {
    expect(createZipExportCopy('physical', 2)).toEqual({
      outputLabel: 'physical print output faces',
      folderName: 'physical-print-output-faces',
      fileNamePrefix: 'cardforge-physical-print-output-faces',
      buttonLabel: 'Export Print PNG ZIP (2 faces)',
    });

    expect(createZipExportCopy('virtual', 1)).toMatchObject({
      outputLabel: 'digital output images',
      folderName: 'digital-output-images',
      fileNamePrefix: 'cardforge-digital-output-images',
      buttonLabel: 'Export Digital PNG ZIP (1 images)',
    });
  });

  it('sanitizes output names for individual files inside the zip', () => {
    const fileName = getZipExportFileName({
      card: makeCard({ data: { cardName: 'A Name: With / Weird * Things' } }),
      cardIndex: 11,
      face: 'back',
    });

    expect(fileName).toBe('012_A_Name__With___Weird___Things_back.png');
  });

  it('splits Tabletop Simulator sprite sheets at the 69-card deck limit', () => {
    const cards = Array.from({ length: 70 }, (_, index) => makeCard({
      uniqueId: `card-${index + 1}`,
      data: { cardName: `Card ${index + 1}` },
    }));

    const sheets = createTabletopSimulatorSheets(cards);

    expect(sheets).toHaveLength(2);
    expect(sheets[0].cards).toHaveLength(69);
    expect(sheets[1].cards).toHaveLength(1);
    expect(sheets[0].grid).toEqual({ columns: 10, rows: 7, cardsPerSheet: 69 });
  });

  it('creates stable Tabletop Simulator manifest and file names', () => {
    const sheets = createTabletopSimulatorSheets([makeCard({ data: { cardName: 'A Name: With / Weird * Things' } })]);
    const manifest = createTabletopSimulatorManifest(sheets, 372, 520);

    expect(getTabletopSimulatorSheetFileName(sheets[0], 'front')).toBe('tts-sheet-001-front.png');
    expect(manifest.sheets[0]).toMatchObject({
      frontFile: 'tts-sheet-001-front.png',
      columns: 10,
      rows: 7,
      cardWidthPx: 372,
      cardHeightPx: 520,
      cards: [{ number: 1, name: 'A Name: With / Weird * Things' }],
    });
  });
});
