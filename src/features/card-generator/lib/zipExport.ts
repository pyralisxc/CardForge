import type { CardFace } from '@/domain/cards';
import {
  getExportProfile,
  type ExportMode,
  type ExportProfile,
} from '@/features/card-generator/lib/printValidation';
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

export type TabletopSimulatorExportQuality = 'standard' | 'high-detail';

export interface TabletopSimulatorExportPreset {
  id: TabletopSimulatorExportQuality;
  label: string;
  description: string;
  grid: TabletopSimulatorSheetGrid;
  renderDpi: number;
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

export const TABLETOP_SIMULATOR_HIGH_DETAIL_GRID: TabletopSimulatorSheetGrid = {
  columns: 5,
  rows: 4,
  cardsPerSheet: 19,
};

// Tabletop Simulator recommends custom-deck textures around 4096 × 4096.
// Keeping the assembled canvas inside that boundary also avoids browser PNG
// encoding failures caused by very large print-resolution source canvases.
export const TABLETOP_SIMULATOR_MAX_SHEET_DIMENSION_PX = 4096;
export const TABLETOP_SIMULATOR_RENDER_DPI = 165;

export const TABLETOP_SIMULATOR_EXPORT_PRESETS: Record<
  TabletopSimulatorExportQuality,
  TabletopSimulatorExportPreset
> = {
  standard: {
    id: 'standard',
    label: 'Standard',
    description: '10 × 7 sheets use fewer texture files and fit up to 69 playable cards each.',
    grid: TABLETOP_SIMULATOR_GRID,
    renderDpi: TABLETOP_SIMULATOR_RENDER_DPI,
  },
  'high-detail': {
    id: 'high-detail',
    label: 'High detail',
    description: '5 × 4 sheets use more files and give each card nearly twice the linear detail.',
    grid: TABLETOP_SIMULATOR_HIGH_DETAIL_GRID,
    renderDpi: TABLETOP_SIMULATOR_RENDER_DPI * 2,
  },
};

export const getTabletopSimulatorExportPreset = (
  quality: TabletopSimulatorExportQuality = 'standard'
): TabletopSimulatorExportPreset => TABLETOP_SIMULATOR_EXPORT_PRESETS[quality];

export const getTabletopSimulatorExportProfile = (
  quality: TabletopSimulatorExportQuality = 'standard'
): ExportProfile =>
  ({
    ...getExportProfile('virtual', getTabletopSimulatorExportPreset(quality).renderDpi),
    // The assembled sheet—not each temporary card render—owns the final 4K
    // texture budget. A 1× source fills that budget for the selected grid
    // without recreating the large intermediate canvases that exhausted
    // browser memory during large-set exports.
    canvasPixelRatio: 1,
  });

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
        outputLabel: 'physical card PNG faces',
        folderName: 'physical-card-png-faces',
        fileNamePrefix: 'cardforge-physical-card-png-faces',
        buttonLabel: `Export Physical Card PNG ZIP (${faceCount} faces)`,
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

export const createTabletopSimulatorSheets = (
  cards: DisplayCard[],
  quality: TabletopSimulatorExportQuality = 'standard'
): TabletopSimulatorSheet[] => {
  const grid = getTabletopSimulatorExportPreset(quality).grid;
  const sheets: TabletopSimulatorSheet[] = [];
  for (let start = 0; start < cards.length; start += grid.cardsPerSheet) {
    const slice = cards.slice(start, start + grid.cardsPerSheet);
    sheets.push({
      sheetIndex: sheets.length,
      grid,
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
  const grid = sheets[0]?.grid ?? TABLETOP_SIMULATOR_GRID;

  return {
    format: 'cardforge-tabletop-simulator-spritesheets-v1',
    notes: [
      'Upload the exported sheet images to a public or local source that Tabletop Simulator can access.',
      `Use ${grid.columns} columns and ${grid.rows} rows. CardForge reserves the final grid slot so each sheet contains at most ${grid.cardsPerSheet} playable cards.`,
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
