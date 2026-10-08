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
  createPrintProductionManifest,
  createTabletopSimulatorManifest,
  createTabletopSimulatorSheets,
  createZipExportCopy,
  getTabletopSimulatorCardCellSize,
  getTabletopSimulatorExportPreset,
  getTabletopSimulatorExportProfile,
  getTabletopSimulatorSheetFileName,
  getPrintProductionFileName,
  getZipExportFileName,
  type TabletopSimulatorExportQuality,
} from '@/features/card-generator/lib/zipExport';
import { hasCardBacking } from '@/domain/rendering';
import type { DisplayCard } from '@/domain/rendering';
import { trackExportCompleted, trackExportFailed, trackExportStarted } from '@/features/analytics/client/tracking';
import { useBrandPresentation } from '@/features/brand-presentation/client';
import { resolveCardExportWatermark } from '@/features/card-generator/lib/cardPreviewExport';

type ToastFn = ReturnType<typeof useToast>['toast'];
export type ZipExportKind = 'png-set' | 'print-png-set' | 'tabletop-simulator';

interface UseCardZipExportActionsInput {
  canExportClean: boolean;
  exportDpi: number;
  exportMode: ExportMode;
  generatedDisplayCards: DisplayCard[];
  richTextHighlightColor: string;
  toast: ToastFn;
}

export function useCardZipExportActions({
  canExportClean,
  exportDpi,
  exportMode,
  generatedDisplayCards,
  richTextHighlightColor,
  toast,
}: UseCardZipExportActionsInput) {
  const [zipProgress, setZipProgress] = useState<{ done: number; total: number } | null>(null);
  const [isZipExporting, setIsZipExporting] = useState(false);
  const [zipExportKind, setZipExportKind] = useState<ZipExportKind | null>(null);
  const brand = useBrandPresentation();
  const exportWatermark = resolveCardExportWatermark(canExportClean, brand);

  const handleExportAllAsZip = useCallback(async () => {
    if (generatedDisplayCards.length === 0) return;
    const exportItems = createCardZipExportItems(generatedDisplayCards);
    const exportCopy = createZipExportCopy(exportMode, exportItems.length);
    setZipExportKind('png-set');
    setIsZipExporting(true);
    setZipProgress({ done: 0, total: exportItems.length });
    trackExportStarted('png_set', generatedDisplayCards.length);

    try {
      const exportProfile = getExportProfile(exportMode, exportDpi);
      const JSZip = (await import('jszip')).default;
      const { createCardFaceExportRenderer } = await import('@/features/card-generator/lib/cardPreviewExport');
      const zip = new JSZip();
      const folder = zip.folder(exportCopy.folderName)!;
      const renderer = createCardFaceExportRenderer(exportProfile, richTextHighlightColor, exportWatermark);

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
      const fileNamePrefix = `${exportCopy.fileNamePrefix}${canExportClean ? '' : '-watermarked'}`;
      link.download = `${fileNamePrefix}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      trackExportCompleted('png_set', generatedDisplayCards.length);
      toast({
        title: 'ZIP Exported',
        description: `${exportItems.length} ${exportCopy.outputLabel} saved to ${fileNamePrefix}.zip using ${getRasterExportQualityOption(exportDpi).label.toLowerCase()} raster quality${canExportClean ? '' : ' with the CardForge watermark'}.`,
      });
    } catch (err) {
      trackExportFailed('png_set', 'render_or_archive', generatedDisplayCards.length);
      toast({ title: 'Export Failed', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setIsZipExporting(false);
      setZipProgress(null);
      setZipExportKind(null);
    }
  }, [canExportClean, exportDpi, exportMode, exportWatermark, generatedDisplayCards, richTextHighlightColor, toast]);

  const handleExportPrintPngSet = useCallback(async () => {
    if (generatedDisplayCards.length === 0) return;
    const exportItems = createCardZipExportItems(generatedDisplayCards);
    setZipExportKind('print-png-set');
    setIsZipExporting(true);
    setZipProgress({ done: 0, total: exportItems.length });
    trackExportStarted('print_png_set', generatedDisplayCards.length);

    try {
      const exportProfile = getExportProfile('physical', exportDpi);
      const JSZip = (await import('jszip')).default;
      const { createCardFaceExportRenderer } = await import('@/features/card-generator/lib/cardPreviewExport');
      const zip = new JSZip();
      const folder = zip.folder('print-production-png-faces')!;
      const renderer = createCardFaceExportRenderer(exportProfile, richTextHighlightColor, exportWatermark);

      try {
        for (let i = 0; i < exportItems.length; i++) {
          const exportItem = exportItems[i];
          const blob = await renderer.renderProductionToBlob(exportItem.card, exportItem.face);
          folder.file(getPrintProductionFileName(exportItem), blob);
          setZipProgress({ done: i + 1, total: exportItems.length });
        }
      } finally {
        renderer.cleanup();
      }

      folder.file(
        'cardforge-print-production-manifest.json',
        JSON.stringify(createPrintProductionManifest(exportItems), null, 2),
      );
      folder.file(
        'README.txt',
        [
          'CardForge print production PNG faces',
          '',
          'Each face keeps the authored trim composition and adds the CardForge format bleed outside the trim edge.',
          'The bleed is edge-extended from the trim render so the authored card is not scaled or shifted.',
          'Use cardforge-print-production-manifest.json for exact trim, bleed, safe-margin, and production dimensions.',
          'Inspect full-bleed artwork before professional production.',
          'These files are RGB raster PNGs. They are not yet a PDF/X or printer-specific ICC/color-output contract.',
          ...(canExportClean ? [] : ['This Free export includes the CardForge watermark.']),
        ].join('\n'),
      );

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      const fileName = `cardforge-print-production-png-faces${canExportClean ? '' : '-watermarked'}.zip`;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      trackExportCompleted('print_png_set', generatedDisplayCards.length);
      toast({
        title: 'Print production PNGs exported',
        description: `${exportItems.length} bleed-bearing face${exportItems.length === 1 ? '' : 's'} saved with production geometry metadata${canExportClean ? '' : ' and the CardForge watermark'}.`,
      });
    } catch (err) {
      trackExportFailed('print_png_set', 'render_or_archive', generatedDisplayCards.length);
      toast({ title: 'Print production export failed', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setIsZipExporting(false);
      setZipProgress(null);
      setZipExportKind(null);
    }
  }, [canExportClean, exportDpi, exportWatermark, generatedDisplayCards, richTextHighlightColor, toast]);

  const handleExportTabletopSimulatorSpritesheets = useCallback(async (
    quality: TabletopSimulatorExportQuality = 'standard'
  ) => {
    if (generatedDisplayCards.length === 0) return;
    const preset = getTabletopSimulatorExportPreset(quality);
    const sheets = createTabletopSimulatorSheets(generatedDisplayCards, quality);
    const totalRenderJobs = sheets.reduce((total, sheet) => total + 1 + (sheet.hasBacks ? 1 : 0), 0);
    setZipExportKind('tabletop-simulator');
    setIsZipExporting(true);
    setZipProgress({ done: 0, total: totalRenderJobs });
    trackExportStarted('tabletop_simulator', generatedDisplayCards.length);

    try {
      const exportProfile = getTabletopSimulatorExportProfile(quality);
      const JSZip = (await import('jszip')).default;
      const { createCardFaceExportRenderer } = await import('@/features/card-generator/lib/cardPreviewExport');
      const zip = new JSZip();
      const folder = zip.folder('tabletop-simulator-spritesheets')!;
      const renderer = createCardFaceExportRenderer(exportProfile, richTextHighlightColor, exportWatermark);
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
          ...(canExportClean ? [] : ['This free-tier proof export includes the CardForge watermark on every card face.']),
        ].join('\n')
      );

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cardforge-tabletop-simulator-${quality}${canExportClean ? '' : '-watermarked'}-spritesheets.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      trackExportCompleted('tabletop_simulator', generatedDisplayCards.length);
      toast({
        title: 'Tabletop Simulator ZIP exported',
        description: `${sheets.length} ${preset.label.toLowerCase()} sheet${sheets.length === 1 ? '' : 's'} saved with a manifest${canExportClean ? '' : ' and the CardForge watermark'}. Create each custom deck with ${preset.grid.columns} columns and ${preset.grid.rows} rows.`,
      });
    } catch (err) {
      trackExportFailed('tabletop_simulator', 'render_or_archive', generatedDisplayCards.length);
      toast({ title: 'Tabletop Simulator export failed', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setIsZipExporting(false);
      setZipProgress(null);
      setZipExportKind(null);
    }
  }, [canExportClean, exportWatermark, generatedDisplayCards, richTextHighlightColor, toast]);

  return {
    handleExportAllAsZip,
    handleExportPrintPngSet,
    handleExportTabletopSimulatorSpritesheets,
    isZipExporting,
    zipExportKind,
    zipProgress,
  };
}