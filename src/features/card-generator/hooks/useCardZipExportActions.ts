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
  createDigitalImageManifest,
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
import { getCardFaceTemplate, getTemplateProductionGeometryMm, hasCardBacking } from '@/domain/rendering';
import type { DisplayCard } from '@/domain/rendering';
import { trackExportCompleted, trackExportFailed, trackExportStarted } from '@/features/analytics/client/tracking';
import { useBrandPresentation } from '@/features/brand-presentation/client';
import { resolveCardExportWatermark } from '@/features/card-generator/lib/cardPreviewExport';
import { createPrintProductionPreflight } from '@/features/card-generator/lib/printProductionPreflight';

type ToastFn = ReturnType<typeof useToast>['toast'];
export type ZipExportKind = 'png-set' | 'print-png-set' | 'print-pdfx-set' | 'tabletop-simulator';
export interface PdfXExportOptions { iccFile?: File; condition?: string; }

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
    const exportCopy = createZipExportCopy('virtual', exportItems.length);
    setZipExportKind('png-set');
    setIsZipExporting(true);
    setZipProgress({ done: 0, total: exportItems.length });
    trackExportStarted('png_set', generatedDisplayCards.length);

    try {
      const exportProfile = getExportProfile('virtual', exportDpi);
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

      folder.file('cardforge-digital-images-manifest.json', JSON.stringify(createDigitalImageManifest(exportItems, exportProfile), null, 2));
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
  }, [canExportClean, exportDpi, exportWatermark, generatedDisplayCards, richTextHighlightColor, toast]);

  const handleExportPrintPackage = useCallback(async (pdfxOptions?: PdfXExportOptions) => {
    if (generatedDisplayCards.length === 0) return;
    let preflight = createPrintProductionPreflight(generatedDisplayCards, exportDpi);
    if (!preflight.productionPrepared) {
      const firstBlocker = preflight.issues.find((issue) => issue.severity === 'blocker');
      toast({
        title: 'Print production preflight blocked',
        description: firstBlocker?.message ?? 'Resolve the print production blockers before exporting.',
        variant: 'destructive',
      });
      return;
    }
    const exportItems = createCardZipExportItems(generatedDisplayCards);
    setZipExportKind(pdfxOptions ? 'print-pdfx-set' : 'print-png-set');
    setIsZipExporting(true);
    setZipProgress({ done: 0, total: exportItems.length });
    trackExportStarted('print_png_set', generatedDisplayCards.length);

    try {
      const exportProfile = getExportProfile('physical', exportDpi);
      const JSZip = (await import('jszip')).default;
      const { createCardFaceExportRenderer } = await import('@/features/card-generator/lib/cardPreviewExport');
      const zip = new JSZip();
      const folder = zip.folder(pdfxOptions ? 'print-production-pdfx-candidates' : 'print-production-png-faces')!;
      const pdfx = pdfxOptions ? await import('@/features/card-generator/lib/pdfxProduction') : null;
      let colorIntent: { condition: string; sha256: string } | undefined;
      let iccBytes: Uint8Array<ArrayBuffer> | undefined;
      if (pdfx) {
        if (pdfxOptions?.iccFile && pdfxOptions.iccFile.size > pdfx.MAX_PRINT_ICC_BYTES) throw new Error('Choose a printing ICC profile up to 8 MB.');
        if (pdfxOptions?.iccFile) iccBytes = new Uint8Array(await pdfxOptions.iccFile.arrayBuffer());
        else {
          const response = await fetch(pdfx.GRACOL_PROFILE.path);
          if (!response.ok) throw new Error('The reference ICC profile is unavailable. Retry when the profile can be loaded.');
          iccBytes = new Uint8Array(await response.arrayBuffer());
        }
        pdfx.validatePrintIcc(iccBytes);
        const sha256 = await pdfx.sha256Hex(iccBytes);
        if (!pdfxOptions?.iccFile && sha256 !== pdfx.GRACOL_PROFILE.sha256) throw new Error('The reference ICC profile failed its integrity check.');
        const condition = pdfxOptions?.iccFile ? pdfxOptions.condition?.trim() : pdfx.GRACOL_PROFILE.condition;
        if (!condition) throw new Error('Name the printing condition for the supplied ICC profile.');
        colorIntent = { condition, sha256 };
      }
      const creationDate = new Date();
      const pdfFaces: Array<{ file: string; cardIndex: number; uniqueId: string; face: string; sha256: string; structuralValidation: { valid: boolean; warnings: readonly string[] } }> = [];
      const renderer = createCardFaceExportRenderer(exportProfile, richTextHighlightColor, exportWatermark);

      try {
        for (let i = 0; i < exportItems.length; i++) {
          const exportItem = exportItems[i];
          const blob = await renderer.renderProductionToBlob(exportItem.card, exportItem.face);
          if (pdfx && iccBytes && colorIntent) {
            const geometry = getTemplateProductionGeometryMm(getCardFaceTemplate(exportItem.card, exportItem.face));
            const result = await pdfx.buildPdfXFace(new Uint8Array(await blob.arrayBuffer()), geometry, iccBytes, colorIntent.condition, creationDate);
            const file = getPrintProductionFileName(exportItem).replace(/\.png$/u, '.pdf');
            folder.file(file, result.bytes);
            pdfFaces.push({ file, cardIndex: exportItem.cardIndex, uniqueId: exportItem.card.uniqueId, face: exportItem.face, sha256: await pdfx.sha256Hex(new Uint8Array(result.bytes)), structuralValidation: { valid: true, warnings: result.validation.warnings } });
          } else folder.file(getPrintProductionFileName(exportItem), blob);
          setZipProgress({ done: i + 1, total: exportItems.length });
        }
        preflight = createPrintProductionPreflight(generatedDisplayCards, exportDpi, renderer.getSourceImageDetails(), colorIntent);
      } finally {
        renderer.cleanup();
      }

      folder.file(
        'cardforge-print-production-manifest.json',
        JSON.stringify(pdfx ? {
          ...createPrintProductionManifest(exportItems, preflight), format: 'cardforge-pdfx-candidates-v1',
          outputIntent: colorIntent, createdAt: creationDate.toISOString(),
          structuralValidator: 'pdfnative@1.8.0', standardsValidated: false, destinationChecked: false,
          notes: ['One PDF/X-4 candidate per face preserves mixed physical sizes.', 'Canonical sRGB raster artwork is described by calibrated DefaultRGB; no CMYK conversion was performed.', 'Generator structural validation is not independent PDF/X preflight or printer acceptance.', 'Bleed is edge-extended; inspect every edge before production.'],
          faces: pdfFaces.map((face, index) => ({ ...createPrintProductionManifest([exportItems[index]], preflight).faces[0], ...face })),
        } : createPrintProductionManifest(exportItems, preflight), null, 2),
      );
      folder.file(
        'cardforge-print-preflight.json',
        JSON.stringify(preflight, null, 2),
      );
      folder.file(
        'README.txt',
        [
          pdfx ? 'CardForge PDF/X-4 candidate faces' : 'CardForge print production PNG faces',
          '',
          'Each face keeps the authored trim composition and adds the CardForge format bleed outside the trim edge.',
          'The bleed is edge-extended from the trim render so the authored card is not scaled or shifted.',
          'Use cardforge-print-production-manifest.json for exact trim, bleed, safe-margin, and production dimensions.',
          'Use cardforge-print-preflight.json for deterministic production-prepared and press-ready status.',
          `Production prepared: ${preflight.productionPrepared ? 'yes' : 'no'}.`,
          `Press ready: ${preflight.pressReady ? 'yes' : 'no'}.`,
          'Inspect full-bleed artwork before professional production.',
          pdfx ? 'Each PDF/X-4 candidate embeds the identified CMYK printing-condition ICC profile and calibrated RGB raster artwork. No CMYK conversion was performed. Generator structural checks passed; independent standards validation and printer acceptance have not been performed.' : 'These files are RGB raster PNGs, not a PDF/X color-output contract.',
          ...(canExportClean ? [] : ['This Free export includes the CardForge watermark.']),
        ].join('\n'),
      );

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      const fileName = `cardforge-print-production-${pdfx ? 'pdfx-candidates' : 'png-faces'}${canExportClean ? '' : '-watermarked'}.zip`;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      trackExportCompleted('print_png_set', generatedDisplayCards.length);
      toast({
        title: 'Print production package exported',
        description: `${exportItems.length} ${pdfx ? 'PDF/X-4 candidate' : 'bleed-bearing'} face${exportItems.length === 1 ? '' : 's'} saved with geometry and preflight reports. Production prepared: yes. Press ready: ${preflight.pressReady ? 'yes' : 'not yet'}${canExportClean ? '' : ' · CardForge watermark included'}.`,
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
    handleExportPrintPngSet: () => handleExportPrintPackage(),
    handleExportPrintPdfX: (options: PdfXExportOptions) => handleExportPrintPackage(options),
    handleExportTabletopSimulatorSpritesheets,
    isZipExporting,
    zipExportKind,
    zipProgress,
  };
}
