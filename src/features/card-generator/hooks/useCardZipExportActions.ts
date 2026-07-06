"use client";

import { useCallback, useState } from 'react';

import { getExportProfile, type ExportMode } from '@/lib/printValidation';
import type { DisplayCard } from '@/types';
import type { useToast } from '@/hooks/use-toast';
import {
  createCardZipExportItems,
  createTabletopSimulatorManifest,
  createTabletopSimulatorSheets,
  createZipExportCopy,
  getTabletopSimulatorSheetFileName,
  getZipExportFileName,
} from '@/features/card-generator/lib/zipExport';

type ToastFn = ReturnType<typeof useToast>['toast'];

interface UseCardZipExportActionsInput {
  canExportClean: boolean;
  exportDpi: number;
  exportGateMessage: string | null;
  exportMode: ExportMode;
  generatedDisplayCards: DisplayCard[];
  toast: ToastFn;
}

export function useCardZipExportActions({
  canExportClean,
  exportDpi,
  exportGateMessage,
  exportMode,
  generatedDisplayCards,
  toast,
}: UseCardZipExportActionsInput) {
  const [zipProgress, setZipProgress] = useState<{ done: number; total: number } | null>(null);
  const [isZipExporting, setIsZipExporting] = useState(false);

  const handleExportAllAsZip = useCallback(async () => {
    if (generatedDisplayCards.length === 0) return;
    if (!canExportClean) {
      toast({
        title: 'Clean export locked',
        description: exportGateMessage || 'Clean export requires paid access.',
        variant: 'default',
      });
      return;
    }

    const exportItems = createCardZipExportItems(generatedDisplayCards);
    const exportCopy = createZipExportCopy(exportMode, exportItems.length);
    setIsZipExporting(true);
    setZipProgress({ done: 0, total: exportItems.length });

    try {
      const exportProfile = getExportProfile(exportMode, exportDpi);
      const JSZip = (await import('jszip')).default;
      const { createCardFaceExportRenderer } = await import('@/lib/cardPreviewExport');
      const zip = new JSZip();
      const folder = zip.folder(exportCopy.folderName)!;
      const renderer = createCardFaceExportRenderer(exportProfile);

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
      toast({
        title: 'ZIP Exported',
        description: `${exportItems.length} ${exportCopy.outputLabel} saved to ${exportCopy.fileNamePrefix}.zip using ${exportProfile.label} profile.`,
      });
    } catch (err) {
      toast({ title: 'Export Failed', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setIsZipExporting(false);
      setZipProgress(null);
    }
  }, [canExportClean, exportDpi, exportGateMessage, exportMode, generatedDisplayCards, toast]);

  const handleExportTabletopSimulatorSpritesheets = useCallback(async () => {
    if (generatedDisplayCards.length === 0) return;
    if (!canExportClean) {
      toast({
        title: 'Clean export locked',
        description: exportGateMessage || 'Clean export requires paid access.',
        variant: 'default',
      });
      return;
    }

    const sheets = createTabletopSimulatorSheets(generatedDisplayCards);
    const totalRenderJobs = sheets.reduce((total, sheet) => total + 1 + (sheet.hasBacks ? 1 : 0), 0);
    setIsZipExporting(true);
    setZipProgress({ done: 0, total: totalRenderJobs });

    try {
      const exportProfile = getExportProfile('virtual', Math.max(150, Math.min(exportDpi, 300)));
      const JSZip = (await import('jszip')).default;
      const { createCardFaceExportRenderer } = await import('@/lib/cardPreviewExport');
      const zip = new JSZip();
      const folder = zip.folder('tabletop-simulator-spritesheets')!;
      const renderer = createCardFaceExportRenderer(exportProfile);
      let completed = 0;
      let cardWidthPx = 0;
      let cardHeightPx = 0;

      const renderSheet = async (sheet: typeof sheets[number], face: 'front' | 'back') => {
        const firstCanvas = await renderer.renderToCanvas(sheet.cards[0].card, face === 'back' && sheet.cards[0].card.template.backCanvas ? 'back' : 'front');
        cardWidthPx = firstCanvas.width;
        cardHeightPx = firstCanvas.height;
        const sheetCanvas = document.createElement('canvas');
        sheetCanvas.width = firstCanvas.width * sheet.grid.columns;
        sheetCanvas.height = firstCanvas.height * sheet.grid.rows;
        const context = sheetCanvas.getContext('2d');
        if (!context) throw new Error('Unable to create Tabletop Simulator spritesheet canvas.');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, sheetCanvas.width, sheetCanvas.height);
        context.drawImage(firstCanvas, 0, 0);

        for (let i = 1; i < sheet.cards.length; i++) {
          const item = sheet.cards[i];
          const cardFace = face === 'back' && item.card.template.backCanvas ? 'back' : 'front';
          const canvas = await renderer.renderToCanvas(item.card, cardFace);
          const column = item.sheetCardIndex % sheet.grid.columns;
          const row = Math.floor(item.sheetCardIndex / sheet.grid.columns);
          context.drawImage(canvas, column * cardWidthPx, row * cardHeightPx, cardWidthPx, cardHeightPx);
        }

        const blob = await new Promise<Blob | null>((resolve) => sheetCanvas.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error('Tabletop Simulator spritesheet did not produce a PNG blob.');
        folder.file(getTabletopSimulatorSheetFileName(sheet, face), blob);
        completed += 1;
        setZipProgress({ done: completed, total: totalRenderJobs });
      };

      try {
        for (const sheet of sheets) {
          await renderSheet(sheet, 'front');
          if (sheet.hasBacks) {
            await renderSheet(sheet, 'back');
          }
        }
      } finally {
        renderer.cleanup();
      }

      folder.file(
        'tabletop-simulator-manifest.json',
        JSON.stringify(createTabletopSimulatorManifest(sheets, cardWidthPx, cardHeightPx), null, 2)
      );
      folder.file(
        'README.txt',
        [
          'CardForge Tabletop Simulator spritesheets',
          '',
          'Use each front PNG as a Custom Deck face sheet in Tabletop Simulator.',
          'Set Width to 10 and Height to 7. Each sheet contains at most 69 playable cards.',
          'If a matching back PNG exists, use it as the custom deck back image for that sheet.',
          'The JSON manifest lists card numbers and source CardForge output ids.',
        ].join('\n')
      );

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'cardforge-tabletop-simulator-spritesheets.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({
        title: 'Tabletop Simulator ZIP exported',
        description: `${sheets.length} spritesheet${sheets.length === 1 ? '' : 's'} saved with a manifest. Upload the sheet images where Tabletop Simulator can access them, then create a custom deck with 10 columns and 7 rows.`,
      });
    } catch (err) {
      toast({ title: 'Tabletop Simulator export failed', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setIsZipExporting(false);
      setZipProgress(null);
    }
  }, [canExportClean, exportDpi, exportGateMessage, generatedDisplayCards, toast]);

  return {
    handleExportAllAsZip,
    handleExportTabletopSimulatorSpritesheets,
    isZipExporting,
    zipProgress,
  };
}
