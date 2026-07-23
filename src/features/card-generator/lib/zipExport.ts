import type { CardFace } from '@/domain/cards';
import type { ExportMode } from '@/features/card-generator/lib/printValidation';
import { hasCardBacking } from '@/domain/rendering';
import type { DisplayCard } from '@/domain/rendering';

export interface CardZipExportItem {
  card: DisplayCard;
  cardIndex: number;
  face: CardFace;
}

export interface ZipExportCopy {
  outputLabel: string;
  folderName: string;
  fileNamePrefix: string;
  buttonLabel: string;
}

export interface TabletopSimulatorSheetGrid {
  columns: number;
  rows: number;
  cardsPerSheet: number;
}

export interface TabletopSimulatorCardCellSize {
  cardWidthPx: number;
  cardHeightPx: number;
  sheetWidthPx: number;
  sheetHeightPx: number;
}

export interface TabletopSimulatorRenderedSheetSize {
  sheetIndex: number;
  cardWidthPx: number;
  cardHeightPx: number;
}

export interface TabletopSimulatorSheetCard {
  card: DisplayCard;
  sourceIndex: number;
  sheetCardIndex: number;
}

export interface TabletopSimulatorSheet {
  sheetIndex: number;
  grid: TabletopSimulatorSheetGrid;
  cards: TabletopSimulatorSheetCard[];
  hasBacks: boolean;
}

export interface TabletopSimulatorManifestSheet {
  sheet: number;
  frontFile: string;
  backFile: string | null;
  columns: number;
  rows: number;
  cardsPerSheet: number;
  cardWidthPx: number;
  cardHeightPx: number;
  cards: Array<{
    number: number;
    name: string;
    uniqueId: string;
    hasBack: boolean;
  }>;
}

export interface TabletopSimulatorManifest {
  format: 'cardforge-tabletop-simulator-spritesheets-v1';
  notes: string[];
  sheets: TabletopSimulatorManifestSheet[];
}

export const TABLETOP_SIMULATOR_GRID: TabletopSimulatorSheetGrid = {
  columns: 10,
  rows: 7,
  cardsPerSheet: 69,
};

// Tabletop Simulator recommends custom-deck textures around 4096 × 4096.
// Keeping the assembled canvas inside that boundary also avoids browser PNG
// encoding failures caused by very large print-resolution source canvases.
export const TABLETOP_SIMULATOR_MAX_SHEET_DIMENSION_PX = 4096;

export const getTabletopSimulatorCardCellSize = (
  sourceWidthPx: number,
  sourceHeightPx: number,
  grid: TabletopSimulatorSheetGrid = TABLETOP_SIMULATOR_GRID
): TabletopSimulatorCardCellSize => {
  const safeWidth = Math.max(1, Math.floor(sourceWidthPx));
  const safeHeight = Math.max(1, Math.floor(sourceHeightPx));
  const scale = Math.min(
    1,
    TABLETOP_SIMULATOR_MAX_SHEET_DIMENSION_PX / (safeWidth * grid.columns),
    TABLETOP_SIMULATOR_MAX_SHEET_DIMENSION_PX / (safeHeight * grid.rows)
  );
  const cardWidthPx = Math.max(1, Math.floor(safeWidth * scale));
  const cardHeightPx = Math.max(1, Math.floor(safeHeight * scale));

  return {
    cardWidthPx,
    cardHeightPx,
    sheetWidthPx: cardWidthPx * grid.columns,
    sheetHeightPx: cardHeightPx * grid.rows,
  };
};

export const createCardZipExportItems = (cards: DisplayCard[]): CardZipExportItem[] =>
  cards.flatMap((card, index) => {
    const faces: CardFace[] = hasCardBacking(card) ? ['front', 'back'] : ['front'];
    return faces.map((face) => ({ card, cardIndex: index, face }));
  });

export const createZipExportCopy = (exportMode: ExportMode, faceCount: number): ZipExportCopy => (
  exportMode === 'physical'
    ? {
        outputLabel: 'print-ready card faces',
        folderName: 'physical-print-output-faces',
        fileNamePrefix: 'cardforge-physical-print-output-faces',
        buttonLabel: `Export Print PNG ZIP (${faceCount} faces)`,
      }
    : {
        outputLabel: 'digital card images',
        folderName: 'digital-output-images',
        fileNamePrefix: 'cardforge-digital-output-images',
        buttonLabel: `Export Digital PNG ZIP (${faceCount} images)`,
      }
);

export const getZipExportFileName = ({ card, cardIndex, face }: CardZipExportItem): string => {
  const safeName = (card.data?.cardName || card.data?.name || `card-${cardIndex + 1}`)
    .toString()
    .replace(/[^a-z0-9_-]/gi, '_')
    .substring(0, 40);
  return `${String(cardIndex + 1).padStart(3, '0')}_${safeName}_${face}.png`;
};

export const createTabletopSimulatorSheets = (cards: DisplayCard[]): TabletopSimulatorSheet[] => {
  const sheets: TabletopSimulatorSheet[] = [];
  for (let start = 0; start < cards.length; start += TABLETOP_SIMULATOR_GRID.cardsPerSheet) {
    const slice = cards.slice(start, start + TABLETOP_SIMULATOR_GRID.cardsPerSheet);
    sheets.push({
      sheetIndex: sheets.length,
      grid: TABLETOP_SIMULATOR_GRID,
      cards: slice.map((card, index) => ({
        card,
        sourceIndex: start + index,
        sheetCardIndex: index,
      })),
      hasBacks: slice.some(hasCardBacking),
    });
  }
  return sheets;
};

export const getTabletopSimulatorSheetFileName = (
  sheet: Pick<TabletopSimulatorSheet, 'sheetIndex'>,
  face: 'front' | 'back'
): string => `tts-sheet-${String(sheet.sheetIndex + 1).padStart(3, '0')}-${face}.png`;

export const createTabletopSimulatorManifest = (
  sheets: TabletopSimulatorSheet[],
  renderedSheetSizes: TabletopSimulatorRenderedSheetSize[]
): TabletopSimulatorManifest => {
  const sizesBySheetIndex = new Map(renderedSheetSizes.map((size) => [size.sheetIndex, size]));

  return {
    format: 'cardforge-tabletop-simulator-spritesheets-v1',
    notes: [
      'Upload the exported sheet images to a public or local source that Tabletop Simulator can access.',
      'Use 10 columns and 7 rows. CardForge reserves the final grid slot so each sheet contains at most 69 playable cards.',
      'If a back sheet is present, use it as the matching custom deck back for that numbered sheet.',
    ],
    sheets: sheets.map((sheet) => {
      const renderedSize = sizesBySheetIndex.get(sheet.sheetIndex);
      if (!renderedSize) {
        throw new Error(`Missing rendered dimensions for Tabletop Simulator sheet ${sheet.sheetIndex + 1}.`);
      }

      return {
        sheet: sheet.sheetIndex + 1,
        frontFile: getTabletopSimulatorSheetFileName(sheet, 'front'),
        backFile: sheet.hasBacks ? getTabletopSimulatorSheetFileName(sheet, 'back') : null,
        columns: sheet.grid.columns,
        rows: sheet.grid.rows,
        cardsPerSheet: sheet.grid.cardsPerSheet,
        cardWidthPx: renderedSize.cardWidthPx,
        cardHeightPx: renderedSize.cardHeightPx,
        cards: sheet.cards.map((item) => ({
          number: item.sheetCardIndex + 1,
          name: String(item.card.data?.cardName || item.card.data?.name || `Card ${item.sourceIndex + 1}`),
          uniqueId: item.card.uniqueId,
          hasBack: hasCardBacking(item.card),
        })),
      };
    }),
  };
};
