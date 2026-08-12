"use client";

import { useCallback, useState } from 'react';

import {
  getExportProfile,
  getRasterExportQualityOption,
  type ExportMode,
} from '@/features/card-generator/lib/printValidation';

import type { useToast } from '@/components/ui/use-toast';
import {
  createCardZipExportItems,
  createTabletopSimulatorManifest,
  createTabletopSimulatorSheets,
  createZipExportCopy,
  getTabletopSimulatorCardCellSize,
  getTabletopSimulatorExportPreset,
  getTabletopSimulatorExportProfile,
  getTabletopSimulatorSheetFileName,
  getZipExportFileName,
  type TabletopSimulatorExportQuality,
} from '@/features/card-generator/lib/zipExport';
import { hasCardBacking } from '@/domain/rendering';
import type { DisplayCard } from '@/domain/rendering';
import { trackExportCompleted } from '@/features/analytics/client/tracking';

type ToastFn = ReturnType<typeof useToast>['toast'];
export type ZipExportKind = 'png-set' | 'tabletop-simulator';

interface UseCardZipExportActionsInput {
  canExportClean: boolean;
  exportDpi: number;
  exportGateMessage: string | null;
  exportMode: ExportMode;
  generatedDisplayCards: DisplayCard[];
  richTextHighlightColor: string;
  toast: ToastFn;
}

export function useCardZipExportActions({
  canExportClean,
  exportDpi,
  exportGateMessage,
  exportMode,
  generatedDisplayCards,
  richTextHighlightColor,
  toast,
}: UseCardZipExportActionsInput) {
  const [zipProgress, setZipProgress] = useState<{ done: number; total: number } | null>(null);
  const [isZipExporting, setIsZipExporting] = useState(false);
  const [zipExportKind, setZipExportKind] = useState<ZipExportKind | null>(null);

  const handleExportAllAsZip = useCallback(async () => {
    if (generatedDisplayCards.length === 0) return;
    if (!canExportClean) {
      toast({
        title: 'Watermark-free download locked',
        description: exportGateMessage || 'Creator Pass is required for watermark-free downloads.',
        variant: 'default',
      });
      return;
    }

    const exportItems = createCardZipExportItems(generatedDisplayCards);
    const exportCopy = createZipExportCopy(exportMode, exportItems.length);
    setZipExportKind('png-set');
    setIsZipExporting(true);
    setZipProgress({ done: 0, total: exportItems.length });

    try {
      const exportProfile = getExportProfile(exportMode, exportDpi);
      const JSZip = (await import('jszip')).default;
      const { createCardFaceExportRenderer } = await import('@/features/card-generator/lib/cardPreviewExport');
      const zip = new JSZip();
      const folder = zip.folder(exportCopy.folderName)!;
      const renderer = createCardFaceExportRenderer(exportProfile, richTextHighlightColor);

      try {
        for (let i = 0; i < exportItems.length; i++) {
          const exportItem = exportItems[i];
          const blob = await renderer.renderToBlob(exportItem.card, exportItem.face);
          folder.file(getZipExportFileName(exportItem), blob);
          setZipProgress({ done: i + 1, total: exportItems.length });
        }
      } finally {
        renderer.cleanup();
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${exportCopy.fileNamePrefix}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      trackExportCompleted('png_set', generatedDisplayCards.length);
      toast({
        title: 'ZIP Exported',
        description: `${exportItems.length} ${exportCopy.outputLabel} saved to ${exportCopy.fileNamePrefix}.zip using ${getRasterExportQualityOption(exportDpi).label.toLowerCase()} raster quality.`,
      });
    } catch (err) {
      toast({ title: 'Export Failed', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setIsZipExporting(false);
      setZipProgress(null);
      setZipExportKind(null);
    }
  }, [canExportClean, exportDpi, exportGateMessage, exportMode, generatedDisplayCards, richTextHighlightColor, toast]);

  const handleExportTabletopSimulatorSpritesheets = useCallback(async (
    quality: TabletopSimulatorExportQuality = 'standard'
  ) => {
    if (generatedDisplayCards.length === 0) return;
    if (!canExportClean) {
      toast({
        title: 'Watermark-free download locked',
        description: exportGateMessage || 'Creator Pass is required for watermark-free downloads.',
        variant: 'default',
      });
      return;
    }

    const preset = getTabletopSimulatorExportPreset(quality);
    const sheets = createTabletopSimulatorSheets(generatedDisplayCards, quality);
    const totalRenderJobs = sheets.reduce((total, sheet) => total + 1 + (sheet.hasBacks ? 1 : 0), 0);
    setZipExportKind('tabletop-simulator');
    setIsZipExporting(true);
    setZipProgress({ done: 0, total: totalRenderJobs });

    try {
      const exportProfile = getTabletopSimulatorExportProfile(quality);
      const JSZip = (await import('jszip')).default;
      const { createCardFaceExportRenderer } = await import('@/features/card-generator/lib/cardPreviewExport');
      const zip = new JSZip();
      const folder = zip.folder('tabletop-simulator-spritesheets')!;
      const renderer = createCardFaceExportRenderer(exportProfile, richTextHighlightColor);
      let completed = 0;
      const renderedSheetSizes: Array<{ sheetIndex: number; cardWidthPx: number; cardHeightPx: number }> = [];

      const renderSheet = async (
        sheet: typeof sheets[number],
        face: 'front' | 'back',
        requestedCellSize?: ReturnType<typeof getTabletopSimulatorCardCellSize>
      ) => {
        const firstFace = face === 'back' && hasCardBacking(sheet.cards[0].card) ? 'back' : 'front';
        const firstBlob = await renderer.renderToBlob(sheet.cards[0].card, firstFace);
        const firstBitmap = await createImageBitmap(firstBlob);
        const cellSize = requestedCellSize
          ?? getTabletopSimulatorCardCellSize(firstBitmap.width, firstBitmap.height, sheet.grid);
        const sheetCanvas = document.createElement('canvas');
        sheetCanvas.width = cellSize.sheetWidthPx;
        sheetCanvas.height = cellSize.sheetHeightPx;
        const context = sheetCanvas.getContext('2d');
        if (!context) throw new Error('Unable to create Tabletop Simulator spritesheet canvas.');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, sheetCanvas.width, sheetCanvas.height);
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        try {
          context.drawImage(firstBitmap, 0, 0, cellSize.cardWidthPx, cellSize.cardHeightPx);
        } finally {
          firstBitmap.close();
        }

        for (let i = 1; i < sheet.cards.length; i++) {
          const item = sheet.cards[i];
          const cardFace = face === 'back' && hasCardBacking(item.card) ? 'back' : 'front';
          const blob = await renderer.renderToBlob(item.card, cardFace);
          const bitmap = await createImageBitmap(blob);
          const column = item.sheetCardIndex % sheet.grid.columns;
          const row = Math.floor(item.sheetCardIndex / sheet.grid.columns);
          try {
            context.drawImage(
              bitmap,
              column * cellSize.cardWidthPx,
              row * cellSize.cardHeightPx,
              cellSize.cardWidthPx,
              cellSize.cardHeightPx
            );
          } finally {
            bitmap.close();
          }
        }

        let sheetBlob: Blob | null;
        try {
          sheetBlob = await new Promise<Blob | null>((resolve) => sheetCanvas.toBlob(resolve, 'image/png'));
        } finally {
          sheetCanvas.width = 0;
          sheetCanvas.height = 0;
        }
        if (!sheetBlob) throw new Error('Tabletop Simulator spritesheet did not produce a PNG blob.');
        folder.file(getTabletopSimulatorSheetFileName(sheet, face), sheetBlob);
        completed += 1;
        setZipProgress({ done: completed, total: totalRenderJobs });
        return cellSize;
      };

      try {
        for (const sheet of sheets) {
          const cellSize = await renderSheet(sheet, 'front');
          renderedSheetSizes.push({
            sheetIndex: sheet.sheetIndex,
            cardWidthPx: cellSize.cardWidthPx,
            cardHeightPx: cellSize.cardHeightPx,
          });
          if (sheet.hasBacks) {
            await renderSheet(sheet, 'back', cellSize);
          }
        }
      } finally {
        renderer.cleanup();
      }

      folder.file(
        'tabletop-simulator-manifest.json',
        JSON.stringify(createTabletopSimulatorManifest(sheets, renderedSheetSizes), null, 2)
      );
      folder.file(
        'README.txt',
        [
          'CardForge Tabletop Simulator spritesheets',
          '',
          'Use each front PNG as a Custom Deck face sheet in Tabletop Simulator.',
          `Set Width to ${preset.grid.columns} and Height to ${preset.grid.rows}. Each sheet contains at most ${preset.grid.cardsPerSheet} playable cards.`,
          'If a matching back PNG exists, use it as the custom deck back image for that sheet.',
          'The JSON manifest lists card numbers and CardForge card ids.',
        ].join('\n')
      );

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cardforge-tabletop-simulator-${quality}-spritesheets.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      trackExportCompleted('tabletop_simulator', generatedDisplayCards.length);
      toast({
        title: 'Tabletop Simulator ZIP exported',
        description: `${sheets.length} ${preset.label.toLowerCase()} sheet${sheets.length === 1 ? '' : 's'} saved with a manifest. Create each custom deck with ${preset.grid.columns} columns and ${preset.grid.rows} rows.`,
      });
    } catch (err) {
      toast({ title: 'Tabletop Simulator export failed', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setIsZipExporting(false);
      setZipProgress(null);
      setZipExportKind(null);
    }
  }, [canExportClean, exportGateMessage, generatedDisplayCards, richTextHighlightColor, toast]);

  return {
    handleExportAllAsZip,
    handleExportTabletopSimulatorSpritesheets,
    isZipExporting,
    zipExportKind,
    zipProgress,
  };
}
