"use client";

import { useState } from 'react';
import jsPDF from 'jspdf';
import type { DisplayCard, PaperSize, PdfDuplexLayout } from '@/domain/rendering';
import { Button } from '@/components/ui/button';
import { Loader2, FileDown } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import {
  getExportProfile,
  getRasterExportDimensionsPx,
  getRasterExportQualityOption,
  validateCardExportQuality,
  type ExportMode,
} from '@/features/card-generator/lib/printValidation';
import { extractErrorMessage, withNextStep } from '@/shared/userFacingErrors';
import { ERROR_COPY } from '@/features/card-generator/lib/errorCopy';
import {
  createCardFaceExportRenderer,
  resolveCardExportWatermark,
  type CardFaceExportRenderer,
} from '@/features/card-generator/lib/cardPreviewExport';
import {
  createPdfDuplexBackPage,
  createPdfPlacementPages,
  createScreenPdfPages,
  getPdfCropMarkSegments,
  packPdfPageGroups,
  type ScreenPdfPage,
  type PdfCardPlacement,
} from '@/features/card-generator/lib/pdfProductionLayout';
import { createPrintProductionPreflight } from '@/features/card-generator/lib/printProductionPreflight';
import { hasCardBacking } from '@/domain/rendering';
import { trackExportCompleted, trackExportFailed, trackExportStarted } from '@/features/analytics/client/tracking';
import { useBrandPresentation } from '@/features/brand-presentation/client';
import { MAX_PDF_PAGES_PER_FILE, MAX_TOTAL_PDF_EXPORT_CARDS } from '../lib/pdfExportLimits';
import { requestOutputDownload, useOutputActivity } from './OutputActivity';
import { createOutputStage, type OutputStage } from '../lib/outputReadyStorage';
import { publishReadyOutput } from '../lib/outputReadyHandoff';
import { getProjectPersistenceScope } from '@/features/project/client/persistence-workspace';
import { validateCleanOutputAccess } from '../lib/outputCleanAccess';

interface SaveAsPdfButtonProps {
  buttonLabel?: string;
  setName?: string;
  generatedDisplayCards: DisplayCard[];
  selectedPaperSize: PaperSize;
  pdfMarginMm: number;
  pdfCardSpacingMm: number;
  pdfIncludeCutLines: boolean;
  pdfDuplexLayout: PdfDuplexLayout;
  exportMode: ExportMode;
  pdfProfile?: 'sheet' | 'screen';
  exportDpi: number;
  richTextHighlightColor: string;
  canExportClean: boolean;
  disabled?: boolean;
  templateName?: string;
  beforeExport?: () => Promise<void>;
}

export function SaveAsPdfButton({
  buttonLabel,
  setName,
  generatedDisplayCards,
  selectedPaperSize,
  pdfMarginMm,
  pdfCardSpacingMm,
  pdfIncludeCutLines,
  pdfDuplexLayout,
  exportMode,
  pdfProfile = 'sheet',
  exportDpi,
  richTextHighlightColor,
  canExportClean,
  disabled = false,
  templateName,
  beforeExport,
}: SaveAsPdfButtonProps) {
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const outputActivity = useOutputActivity();
  const { toast } = useToast();
  const brand = useBrandPresentation();

  const handleSaveAsPdf = async (direct = false) => {
    if (generatedDisplayCards.length === 0) {
      toast({
        title: ERROR_COPY.pdfNoCards.title,
        description: withNextStep('PDF export requires at least one card.', 'Add a card to your set, then try downloading the PDF again.'),
        variant: "default",
      });
      return;
    }

    if (generatedDisplayCards.length > MAX_TOTAL_PDF_EXPORT_CARDS) {
      toast({
        title: 'PDF export size limit reached',
        description: withNextStep(
          `PDF export is limited to ${MAX_TOTAL_PDF_EXPORT_CARDS} cards per download (current: ${generatedDisplayCards.length}).`,
          'Reduce the batch size and export again in multiple runs.'
        ),
        variant: 'destructive',
      });
      return;
    }

    setIsLoadingPdf(true);

    const isScreenPdf = pdfProfile === 'screen';
    const activeMode: ExportMode = isScreenPdf ? 'virtual' : exportMode;
    const activeDpi = exportDpi;
    const exportProfile = getExportProfile(activeMode, activeDpi);
    const rasterQuality = getRasterExportQualityOption(activeDpi);
    const firstCardDimensions = generatedDisplayCards[0]
      ? getRasterExportDimensionsPx(generatedDisplayCards[0], activeMode, activeDpi)
      : null;
    const criticalIssues = new Set<string>();
    const warningIssues = new Set<string>();

    generatedDisplayCards.forEach((card) => {
      const validation = validateCardExportQuality(card, activeMode, activeDpi);
      validation.critical.forEach((issue) => criticalIssues.add(issue));
      validation.warnings.forEach((issue) => warningIssues.add(issue));
    });

    if (criticalIssues.size > 0) {
      toast({
        title: "Export Blocked by Quality Checks",
        description: withNextStep(Array.from(criticalIssues).slice(0, 2).join(' '), 'Fix these card issues in Generate or the Template tool, then download again.'),
        variant: "destructive",
      });
      setIsLoadingPdf(false);
      return;
    }

    if (warningIssues.size > 0) {
      toast({
        title: ERROR_COPY.exportWarnings.title,
        description: withNextStep(Array.from(warningIssues).slice(0, 2).join(' '), 'You can continue, but review card quality before sending to print.'),
        duration: 7000,
      });
    }

    type PlannedPage = { kind: 'screen'; screen: ScreenPdfPage } | { kind: 'sheet'; placements: PdfCardPlacement[] };
    let parts: PlannedPage[][];
    try {
      let groups: PlannedPage[][];
      if (isScreenPdf) {
        groups = generatedDisplayCards.map((card) => createScreenPdfPages([card]).map((screen) => ({ kind: 'screen' as const, screen })));
      } else {
        const printableWidthMm = selectedPaperSize.widthMm - 2 * pdfMarginMm;
        const printableHeightMm = selectedPaperSize.heightMm - 2 * pdfMarginMm;
        const duplex = exportMode === 'physical' && pdfDuplexLayout !== 'same-page';
        const items = duplex ? generatedDisplayCards : generatedDisplayCards.flatMap((card) => hasCardBacking(card)
          ? [{ card, face: 'front' as const }, { card, face: 'back' as const }]
          : [{ card, face: 'front' as const }]);
        const pages = createPdfPlacementPages({ items, forcedFace: duplex ? 'front' : undefined,
          printableWidthMm, printableHeightMm, marginMm: pdfMarginMm, spacingMm: pdfCardSpacingMm,
          physical: exportMode === 'physical', includeCutLines: exportMode === 'physical' && pdfIncludeCutLines });
        const hasBacks = duplex && generatedDisplayCards.some(hasCardBacking);
        groups = pages.map((placements) => {
          const front: PlannedPage = { kind: 'sheet', placements };
          if (!hasBacks) return [front];
          const back = createPdfDuplexBackPage(placements, { widthMm: selectedPaperSize.widthMm, heightMm: selectedPaperSize.heightMm,
            flip: pdfDuplexLayout === 'separate-pages-short-edge' ? 'short-edge' : 'long-edge' });
          return [front, { kind: 'sheet', placements: back }];
        });
      }
      parts = packPdfPageGroups(groups, MAX_PDF_PAGES_PER_FILE);
    } catch (error) {
      toast({ title: 'PDF layout could not be prepared', description: extractErrorMessage(error), variant: 'destructive' });
      setIsLoadingPdf(false);
      return;
    }
    const totalChunks = parts.length;
    const safeName = (templateName || generatedDisplayCards[0]?.template?.name || 'cardforge-cards')
      .replace(/[^a-zA-Z0-9_\- ]/g, '')
      .trim()
      .replace(/\s+/g, '-') || 'cardforge-cards';
    const pdfModeSlug = isScreenPdf
      ? 'digital-cards'
      : exportMode === 'physical'
        ? (pdfDuplexLayout === 'same-page' ? 'print-same-sheet' : (pdfDuplexLayout === 'separate-pages-short-edge' ? 'print-duplex-short-edge' : 'print-duplex-long-edge'))
        : 'digital-sheet';
    const timestamp = new Date().toISOString().slice(0, 10);
    const watermarkSuffix = canExportClean ? '' : '-watermarked';

    toast({
      title: totalChunks > 1 ? 'Generating chunked PDFs...' : 'Generating PDF...',
      description:
        totalChunks > 1
          ? `Using ${rasterQuality.label.toLowerCase()} raster quality${firstCardDimensions ? ` (${firstCardDimensions.widthPx} × ${firstCardDimensions.heightPx}px for the first template)` : ''}. ${totalChunks} numbered PDFs will be packaged in one ZIP.`
          : `Using ${rasterQuality.label.toLowerCase()} raster quality${firstCardDimensions ? ` (${firstCardDimensions.widthPx} × ${firstCardDimensions.heightPx}px for the first template)` : ''}.`,
    });

    const activity = outputActivity?.begin(`${isScreenPdf ? 'Digital PDF' : 'PDF'}${setName ? ` · ${setName}` : ''}`, { retained: !direct });
    if (outputActivity && !activity) { setIsLoadingPdf(false); return; }
    const totalFaces = generatedDisplayCards.reduce((count, card) => count + 1 + (hasCardBacking(card) ? 1 : 0), 0);
    let completedFaces = 0;
    const reportFace = async () => {
      activity?.progress(++completedFaces, totalFaces, 'faces');
      await new Promise<void>((resolve) => { setTimeout(resolve, 0); });
    };
    const reportStage = async (detail: string) => {
      activity?.stage(detail);
      await new Promise<void>((resolve) => { setTimeout(resolve, 0); });
    };
    activity?.progress(0, totalFaces, 'faces');
    trackExportStarted('pdf', generatedDisplayCards.length);
    const baseName = `${safeName}-${pdfModeSlug}-${timestamp}${watermarkSuffix}`;
    const fileName = `${baseName}.${totalChunks > 1 ? 'zip' : 'pdf'}`;
    const startScope = getProjectPersistenceScope();
    let stage: OutputStage | null = null;
    let directWriter: FileSystemWritableFileStream | null = null;
    let directFileName = fileName;
    let published = false;
    let retentionUnavailable = false;
    try {
      if (direct) {
        const picker = (window as Window & { showSaveFilePicker?: (options: { suggestedName: string }) => Promise<FileSystemFileHandle> }).showSaveFilePicker;
        if (!picker) throw new Error('This browser cannot choose a file for direct saving. Use Save as PDF or browser print instead.');
        const handle = await picker.call(window, { suggestedName: fileName });
        directFileName = handle.name || fileName;
        directWriter = await handle.createWritable();
      }
      await beforeExport?.();
      if (activity && (getProjectPersistenceScope() !== startScope || !activity.isCurrent())) throw new Error('The active workspace changed. Start the export again.');
      if (activity && !direct) {
        try { stage = await createOutputStage(startScope, `${isScreenPdf ? 'Digital PDF' : 'PDF'}${setName ? ` · ${setName}` : ''}`, fileName, Boolean(beforeExport), activity.isCurrent, canExportClean); }
        catch (error) {
          if (!activity.isCurrent() || totalChunks > 1) throw error;
          retentionUnavailable = true;
        }
      }
      const zipModule = totalChunks > 1 ? await import('@zip.js/zip.js') : null;
      const blobWriter = !stage && !directWriter && zipModule ? new zipModule.BlobWriter('application/zip') : null;
      const directSink = directWriter ? new WritableStream<Uint8Array>({ write: chunk => directWriter!.write(new Uint8Array(chunk).buffer), close: () => {}, abort: reason => directWriter!.abort(reason) }) : null;
      const zip = zipModule ? new zipModule.ZipWriter(directSink ?? stage?.writable ?? blobWriter!) : null;
      let singleBlob: Blob | null = null;
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const partPages = parts[chunkIndex];
        const chunkCards = [...new Set(partPages.flatMap((page) => page.kind === 'screen' ? [page.screen.card] : page.placements.map((placement) => placement.card)))];
        if (totalChunks > 1) {
          toast({ title: `Generating PDF part ${chunkIndex + 1}/${totalChunks}`, description: `${partPages.length} pages in this part.` });
        }
        const firstPage = partPages[0];
        const pageWidthMm = firstPage.kind === 'screen' ? firstPage.screen.widthMm : selectedPaperSize.widthMm;
        const pageHeightMm = firstPage.kind === 'screen' ? firstPage.screen.heightMm : selectedPaperSize.heightMm;
        const pdf = new jsPDF({ compress: true, orientation: pageWidthMm <= pageHeightMm ? 'p' : 'l',
          unit: 'mm', format: [pageWidthMm, pageHeightMm] });

        const renderer = createCardFaceExportRenderer(
          exportProfile,
          richTextHighlightColor,
          resolveCardExportWatermark(canExportClean, brand),
        );
        try {
          for (const [pageIndex, page] of partPages.entries()) {
            const widthMm = page.kind === 'screen' ? page.screen.widthMm : selectedPaperSize.widthMm;
            const heightMm = page.kind === 'screen' ? page.screen.heightMm : selectedPaperSize.heightMm;
            if (pageIndex > 0) pdf.addPage([widthMm, heightMm], widthMm <= heightMm ? 'p' : 'l');
            if (page.kind === 'screen') {
              const canvas = await renderer.renderToCanvas(page.screen.card, page.screen.face);
              try { pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, widthMm, heightMm); }
              finally { canvas.width = 0; canvas.height = 0; }
              await reportFace();
            } else {
              await processPage(pdf, page.placements, renderer, reportFace);
            }
          }
          if (isScreenPdf) pdf.setProperties({ subject: 'CardForge RGB screen copy; one trimmed card face per page. Visual PDF, not an editable project or tagged accessible text.' });
          if (!isScreenPdf && exportMode === 'physical') {
            const preflight = createPrintProductionPreflight(chunkCards, exportDpi, renderer.getSourceImageDetails());
            pdf.setProperties({ subject: 'CardForge RGB production preparation; not certified PDF/X. Duplex: ' + pdfDuplexLayout });
            const lowDetail = preflight.issues.filter((issue) => issue.code === 'resolution.source_below_300_ppi');
            if (lowDetail.length) toast({ title: 'Review original artwork detail', description: `${lowDetail.length} placed image(s) are below 300 source PPI. A denser PDF does not restore missing original detail.`, duration: 7000 });
          }
        } finally {
          renderer.cleanup();
        }

        await reportStage(totalChunks > 1 ? `Finishing PDF part ${chunkIndex + 1} of ${totalChunks}` : 'Finishing PDF');
        const blob = pdf.output('blob');
        if (zip && zipModule) {
          await reportStage(`Packaging PDF part ${chunkIndex + 1} of ${totalChunks}`);
          const digits = Math.max(3, String(totalChunks).length);
          await zip.add(`${baseName}-part-${String(chunkIndex + 1).padStart(digits, '0')}-of-${String(totalChunks).padStart(digits, '0')}.pdf`, new zipModule.BlobReader(blob), { level: 0 });
        } else singleBlob = blob;
        // Release each part before rendering the next one.
        await new Promise<void>((resolve) => { requestAnimationFrame(() => resolve()); });
      }

      let fallbackBlob: Blob | null = null;
      if (zip) {
        await reportStage('Finishing PDF ZIP');
        const result = await zip.close();
        if (!stage && !directWriter) fallbackBlob = result as Blob;
      } else if (directWriter && singleBlob) {
        await singleBlob.stream().pipeTo(directSink!);
      } else if (stage && singleBlob) {
        const writer = stage.writable.getWriter();
        try { await singleBlob.stream().pipeTo(new WritableStream({ write: chunk => writer.write(chunk), close: () => writer.close(), abort: reason => writer.abort(reason) })); }
        catch (error) {
          if (!activity?.isCurrent()) throw error;
          retentionUnavailable = true;
          fallbackBlob = singleBlob;
        } finally { writer.releaseLock(); }
        if (retentionUnavailable) { await stage.abort(); stage = null; }
      } else fallbackBlob = singleBlob;
      await reportStage(direct ? 'Finishing selected file' : 'Preparing download');
      await beforeExport?.(); // Revalidate externally pinned specimens before delivery.
      if (directWriter) {
        if (getProjectPersistenceScope() !== startScope || (activity && !activity.isCurrent())) throw new Error('The active workspace changed. Start the export again.');
        if (canExportClean) await validateCleanOutputAccess(startScope);
        if (getProjectPersistenceScope() !== startScope || (activity && !activity.isCurrent())) throw new Error('The active workspace changed. Start the export again.');
        await directWriter.close();
        directWriter = null;
        activity?.finish('saved', `${directFileName} was saved to the selected location.`);
        trackExportCompleted('pdf', generatedDisplayCards.length);
        toast({ title: 'PDF saved', description: `${directFileName} was saved to the selected location.` });
        return;
      } else if (stage && activity) {
        if (getProjectPersistenceScope() !== startScope || !activity.isCurrent()) throw new Error('The active workspace changed. Start the export again.');
        try {
          const result = await publishReadyOutput(stage, activity.isCurrent, beforeExport); published = true;
          if (!result.ok) {
            activity.hold(result.output, 'The source could not be revalidated. Remove this prepared copy before trying again.');
            throw result.error;
          }
          if (!activity.complete(result.output, beforeExport)) {
            toast({ title: 'Download not requested', description: 'Try Save again from the export status.', variant: 'destructive' });
            return;
          }
        } catch (error) {
          if (published || !singleBlob || !activity.isCurrent()) throw error;
          await stage.abort(); stage = null;
          await beforeExport?.();
          if (!activity.isCurrent()) throw new Error('The active workspace changed. Start the export again.');
          requestOutputDownload(singleBlob, fileName);
          retentionUnavailable = true;
          activity.finish('requested', 'Check your browser downloads. A prepared copy could not be retained on this device.');
        }
      } else if (fallbackBlob) {
        if (activity && !activity.isCurrent()) throw new Error('The active workspace changed. Start the export again.');
        requestOutputDownload(fallbackBlob, fileName);
        activity?.finish('requested', retentionUnavailable ? 'Check your browser downloads. A prepared copy could not be retained on this device.' : undefined);
      }
      else throw new Error('The PDF output was incomplete.');
      trackExportCompleted('pdf', generatedDisplayCards.length);
      toast({ title: 'PDF download requested', description: `${fileName} requested. Check your browser downloads to confirm the file.${retentionUnavailable ? ' A prepared copy could not be retained on this device.' : ''}${isScreenPdf ? ' Each card face is a separate trimmed page, without print bleed or crop marks.' : exportMode === 'physical' ? ' This remains RGB raster PDF output, not PDF/X or a printer-specific ICC contract.' : ''}` });
    } catch (error) {
      if (direct && error instanceof DOMException && error.name === 'AbortError' && !directWriter) {
        activity?.finish('cancelled');
        return;
      }
      trackExportFailed('pdf', 'render_or_download', generatedDisplayCards.length);
      const message = error instanceof DOMException && error.name === 'QuotaExceededError'
        ? 'Browser storage is full or unavailable. Try saving to a chosen file or use browser print. Your Set is unchanged.'
        : direct && error instanceof DOMException && error.name === 'NotAllowedError'
          ? 'The browser did not allow access to that file. Use Save as PDF or browser print instead. Your Set is unchanged.'
          : extractErrorMessage(error);
      if (!published) activity?.finish('failed', message);
      console.error('Error generating PDF:', error);
      toast({ title: 'PDF export failed', description: message, variant: 'destructive' });
    } finally {
      if (directWriter) await directWriter.abort().catch(() => undefined);
      if (stage && !published) await stage.abort();
      setIsLoadingPdf(false);
    }
  };

  async function processPage(
    pdf: jsPDF,
    pageCards: PdfCardPlacement[],
    renderer: CardFaceExportRenderer,
    reportFace: () => Promise<void>,
  ) {
    for (const placement of pageCards) {
      const canvas = exportMode === 'physical'
        ? await renderer.renderProductionToCanvas(placement.card, placement.face)
        : await renderer.renderToCanvas(placement.card, placement.face);
      try {
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', placement.imageX, placement.imageY, placement.imageWidth, placement.imageHeight);
      } finally { canvas.width = 0; canvas.height = 0; }
      if (exportMode === 'physical' && pdfIncludeCutLines) {
        pdf.setDrawColor(180, 180, 180);
        pdf.setLineWidth(0.1);
        getPdfCropMarkSegments(placement).forEach((segment) => {
          pdf.line(segment.x1, segment.y1, segment.x2, segment.y2);
        });
      }
      await reportFace();
    }
  }


  return (
    <div className="space-y-2"><Button onClick={() => void handleSaveAsPdf()} disabled={disabled || isLoadingPdf} variant={pdfProfile === 'screen' || exportMode === 'virtual' ? 'outline' : 'default'} className="w-full">
      {isLoadingPdf ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {pdfProfile === 'screen' ? 'Preparing digital PDF...' : 'Building PDF...'}
        </>
      ) : (
        <>
          <FileDown className="mr-2 h-4 w-4" />
          {buttonLabel ?? (pdfProfile === 'screen' ? 'Download digital PDF' : 'Save as PDF')}
        </>
      )}
    </Button>
    <Button onClick={() => void handleSaveAsPdf(true)} disabled={disabled || isLoadingPdf} variant="outline" className="w-full">Save to chosen file</Button>
    <p className="text-xs text-muted-foreground">Choose a file before building. Availability depends on your browser; this saves directly and does not retain a prepared copy for Save again.</p></div>
  );
}
