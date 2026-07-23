import { describe, expect, it } from 'vitest';
import type { DisplayCard } from '@/domain/rendering';

import {
  createCardZipExportItems,
  createTabletopSimulatorSheets,
  createTabletopSimulatorManifest,
  getTabletopSimulatorExportProfile,
  getTabletopSimulatorCardCellSize,
  createZipExportCopy,
  getTabletopSimulatorSheetFileName,
  getZipExportFileName,
} from '@/features/card-generator/lib/zipExport';

const makeCard = (overrides: Partial<DisplayCard> = {}): DisplayCard => ({
  uniqueId: overrides.uniqueId || 'card-1',
  data: overrides.data || { cardName: 'Arcane Output' },
  template: {
    id: 'template-1',
    name: 'Template',
    aspectRatio: '63:88',
    ...overrides.template,
  },
  backingTemplate: overrides.backingTemplate,
  backingTemplateId: overrides.backingTemplateId || overrides.backingTemplate?.id || null,
  setId: overrides.setId || 'set-1',
  setName: overrides.setName || 'Arcane Deck',
});

describe('zip export helpers', () => {
  it('creates one export item for a front-only output', () => {
    const [item] = createCardZipExportItems([makeCard()]);

    expect(item).toMatchObject({
      cardIndex: 0,
      face: 'front',
    });
  });

  it('does not create a back export item from an old template back canvas', () => {
    const items = createCardZipExportItems([
      makeCard({
        template: {
          id: 'template-1',
          name: 'Double Sided',
          aspectRatio: '63:88',
          backCanvas: { width: 630, height: 880, elements: [] },
        } as unknown as DisplayCard['template'],
      }),
    ]);

    expect(items.map((item) => item.face)).toEqual(['front']);
  });

  it('creates front and back export items when a card has a separate backing template', () => {
    const items = createCardZipExportItems([
      makeCard({
        backingTemplate: {
          id: 'backing-template',
          name: 'Reusable Backing',
          aspectRatio: '63:88',
          templateUsage: 'back-preset',
          freeformCanvas: { width: 630, height: 880, elements: [] },
        },
      }),
    ]);

    expect(items.map((item) => item.face)).toEqual(['front', 'back']);
  });

  it('builds stable zip copy from the export mode and face count', () => {
    expect(createZipExportCopy('physical', 2)).toEqual({
      outputLabel: 'print-ready card faces',
      folderName: 'physical-print-output-faces',
      fileNamePrefix: 'cardforge-physical-print-output-faces',
      buttonLabel: 'Export Print PNG ZIP (2 faces)',
    });

    expect(createZipExportCopy('virtual', 1)).toMatchObject({
      outputLabel: 'digital card images',
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

  it('keeps large Tabletop Simulator sheets inside the recommended texture boundary', () => {
    const cell = getTabletopSimulatorCardCellSize(3012, 3897);

    expect(cell.sheetWidthPx).toBeLessThanOrEqual(4096);
    expect(cell.sheetHeightPx).toBeLessThanOrEqual(4096);
    expect(cell.cardWidthPx / cell.cardHeightPx).toBeCloseTo(3012 / 3897, 2);
  });

  it('uses a single-pixel-ratio render profile for memory-bounded large-set exports', () => {
    expect(getTabletopSimulatorExportProfile()).toMatchObject({
      mode: 'virtual',
      dpi: 120,
      canvasPixelRatio: 1,
    });
  });

  it('creates stable Tabletop Simulator manifest and file names', () => {
    const sheets = createTabletopSimulatorSheets([makeCard({ data: { cardName: 'A Name: With / Weird * Things' } })]);
    const manifest = createTabletopSimulatorManifest(sheets, [{
      sheetIndex: 0,
      cardWidthPx: 372,
      cardHeightPx: 520,
    }]);

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

  it('records the rendered dimensions for each Tabletop Simulator sheet', () => {
    const cards = Array.from({ length: 70 }, (_, index) => makeCard({
      uniqueId: `card-${index + 1}`,
      data: { cardName: `Card ${index + 1}` },
    }));
    const sheets = createTabletopSimulatorSheets(cards);
    const manifest = createTabletopSimulatorManifest(sheets, [
      { sheetIndex: 0, cardWidthPx: 409, cardHeightPx: 529 },
      { sheetIndex: 1, cardWidthPx: 300, cardHeightPx: 400 },
    ]);

    expect(manifest.sheets.map(({ cardWidthPx, cardHeightPx }) => ({ cardWidthPx, cardHeightPx }))).toEqual([
      { cardWidthPx: 409, cardHeightPx: 529 },
      { cardWidthPx: 300, cardHeightPx: 400 },
    ]);
  });
});
