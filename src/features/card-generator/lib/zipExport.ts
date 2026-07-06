import type { CardFace, DisplayCard } from '@/types';
import type { ExportMode } from '@/lib/printValidation';

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

export const createCardZipExportItems = (cards: DisplayCard[]): CardZipExportItem[] =>
  cards.flatMap((card, index) => {
    const faces: CardFace[] = card.template.backCanvas ? ['front', 'back'] : ['front'];
    return faces.map((face) => ({ card, cardIndex: index, face }));
  });

export const createZipExportCopy = (exportMode: ExportMode, faceCount: number): ZipExportCopy => (
  exportMode === 'physical'
    ? {
        outputLabel: 'physical print output faces',
        folderName: 'physical-print-output-faces',
        fileNamePrefix: 'cardforge-physical-print-output-faces',
        buttonLabel: `Export Print PNG ZIP (${faceCount} faces)`,
      }
    : {
        outputLabel: 'digital output images',
        folderName: 'digital-output-images',
        fileNamePrefix: 'cardforge-digital-output-images',
        buttonLabel: `Export Digital PNG ZIP (${faceCount} images)`,
      }
);

export const getZipExportFileName = ({ card, cardIndex, face }: CardZipExportItem): string => {
  const safeName = (card.data?.cardName || card.data?.name || `output-${cardIndex + 1}`)
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
      hasBacks: slice.some((card) => Boolean(card.template.backCanvas)),
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
  cardWidthPx: number,
  cardHeightPx: number
): TabletopSimulatorManifest => ({
  format: 'cardforge-tabletop-simulator-spritesheets-v1',
  notes: [
    'Upload the exported sheet images to a public or local source that Tabletop Simulator can access.',
    'Use 10 columns and 7 rows. CardForge reserves the final grid slot so each sheet contains at most 69 playable cards.',
    'If a back sheet is present, use it as the matching custom deck back for that numbered sheet.',
  ],
  sheets: sheets.map((sheet) => ({
    sheet: sheet.sheetIndex + 1,
    frontFile: getTabletopSimulatorSheetFileName(sheet, 'front'),
    backFile: sheet.hasBacks ? getTabletopSimulatorSheetFileName(sheet, 'back') : null,
    columns: sheet.grid.columns,
    rows: sheet.grid.rows,
    cardsPerSheet: sheet.grid.cardsPerSheet,
    cardWidthPx,
    cardHeightPx,
    cards: sheet.cards.map((item) => ({
      number: item.sheetCardIndex + 1,
      name: String(item.card.data?.cardName || item.card.data?.name || `Output ${item.sourceIndex + 1}`),
      uniqueId: item.card.uniqueId,
      hasBack: Boolean(item.card.template.backCanvas),
    })),
  })),
});
