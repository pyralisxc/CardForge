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
  getPdfCropMarkSegments,
  type PdfCardPlacement,
} from '@/features/card-generator/lib/pdfProductionLayout';
import { hasCardBacking } from '@/domain/rendering';
import { trackExportCompleted, trackExportFailed, trackExportStarted } from '@/features/analytics/client/tracking';
import { useBrandPresentation } from '@/features/brand-presentation/client';

const MAX_PDF_CARDS_PER_FILE = 500;
const MAX_TOTAL_PDF_EXPORT_CARDS = 10000;

interface SaveAsPdfButtonProps {
  generatedDisplayCards: DisplayCard[];
  selectedPaperSize: PaperSize;
  pdfMarginMm: number;
  pdfCardSpacingMm: number;
  pdfIncludeCutLines: boolean;
  pdfDuplexLayout: PdfDuplexLayout;
  exportMode: ExportMode;
  exportDpi: number;
  richTextHighlightColor: string;
  canExportClean: boolean;
  disabled?: boolean;
  templateName?: string;
}

export function SaveAsPdfButton({
  generatedDisplayCards,
  selectedPaperSize,
  pdfMarginMm,
  pdfCardSpacingMm,
  pdfIncludeCutLines,
  pdfDuplexLayout,
  exportMode,
  exportDpi,
  richTextHighlightColor,
  canExportClean,
  disabled = false,
  templateName,
}: SaveAsPdfButtonProps) {
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const { toast } = useToast();
  const brand = useBrandPresentation();

  const handleSaveAsPdf = async () => {
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

    const exportProfile = getExportProfile(exportMode, exportDpi);
    const rasterQuality = getRasterExportQualityOption(exportDpi);
    const firstCardDimensions = generatedDisplayCards[0]
      ? getRasterExportDimensionsPx(generatedDisplayCards[0], exportMode, exportDpi)
      : null;
    const criticalIssues = new Set<string>();
    const warningIssues = new Set<string>();

    generatedDisplayCards.forEach((card) => {
      const validation = validateCardExportQuality(card, exportMode, exportDpi);
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

    const totalChunks = Math.ceil(generatedDisplayCards.length / MAX_PDF_CARDS_PER_FILE);
    const safeName = (templateName || generatedDisplayCards[0]?.template?.name || 'cardforge-cards')
      .replace(/[^a-zA-Z0-9_\- ]/g, '')
      .trim()
      .replace(/\s+/g, '-') || 'cardforge-cards';
    const pdfModeSlug = exportMode === 'physical'
      ? (pdfDuplexLayout === 'same-page' ? 'print-same-sheet' : 'print-duplex-sheets')
      : 'digital-sheet';
    const timestamp = new Date().toISOString().slice(0, 10);
    const watermarkSuffix = canExportClean ? '' : '-watermarked';

    toast({
      title: totalChunks > 1 ? 'Generating chunked PDFs...' : 'Generating PDF...',
      description:
        totalChunks > 1
          ? `Using ${rasterQuality.label.toLowerCase()} raster quality${firstCardDimensions ? ` (${firstCardDimensions.widthPx} × ${firstCardDimensions.heightPx}px for the first template)` : ''}. This export will generate ${totalChunks} files.`
          : `Using ${rasterQuality.label.toLowerCase()} raster quality${firstCardDimensions ? ` (${firstCardDimensions.widthPx} × ${firstCardDimensions.heightPx}px for the first template)` : ''}.`,
    });

    trackExportStarted('pdf', generatedDisplayCards.length);
    try {
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const chunkStart = chunkIndex * MAX_PDF_CARDS_PER_FILE;
        const chunkEnd = Math.min(chunkStart + MAX_PDF_CARDS_PER_FILE, generatedDisplayCards.length);
        const chunkCards = generatedDisplayCards.slice(chunkStart, chunkEnd);

        if (totalChunks > 1) {
          toast({
            title: `Generating PDF chunk ${chunkIndex + 1}/${totalChunks}`,
            description: `Cards ${chunkStart + 1}-${chunkEnd} of ${generatedDisplayCards.length}.`,
          });
        }

        const pdf = new jsPDF({
          compress: true,
          orientation: selectedPaperSize.widthMm < selectedPaperSize.heightMm ? 'p' : 'l',
          unit: 'mm',
          format: [selectedPaperSize.widthMm, selectedPaperSize.heightMm],
        });

        const effectivePrintableWidthMm = selectedPaperSize.widthMm - 2 * pdfMarginMm;
        const effectivePrintableHeightMm = selectedPaperSize.heightMm - 2 * pdfMarginMm;

        const renderer = createCardFaceExportRenderer(
          exportProfile,
          richTextHighlightColor,
          resolveCardExportWatermark(canExportClean, brand),
        );
        try {
          if (exportMode === 'physical' && pdfDuplexLayout === 'separate-pages') {
            const frontPages = createPdfPlacementPages({
              items: chunkCards,
              forcedFace: 'front',
              printableWidthMm: effectivePrintableWidthMm,
              printableHeightMm: effectivePrintableHeightMm,
              marginMm: pdfMarginMm,
              spacingMm: pdfCardSpacingMm,
              physical: true,
              includeCutLines: pdfIncludeCutLines,
            });
            for (let pageIndex = 0; pageIndex < frontPages.length; pageIndex++) {
              if (pageIndex > 0) pdf.addPage();
              await processPage(pdf, frontPages[pageIndex], renderer);

              const backPage = createPdfDuplexBackPage(frontPages[pageIndex]);
              if (backPage.length > 0) {
                pdf.addPage();
                await processPage(pdf, backPage, renderer);
              }
            }
          } else {
            const faceItems = chunkCards.flatMap((cardItem) => (
              hasCardBacking(cardItem)
                ? [{ card: cardItem, face: 'front' as const }, { card: cardItem, face: 'back' as const }]
                : [{ card: cardItem, face: 'front' as const }]
            ));
            const facePages = createPdfPlacementPages({
              items: faceItems,
              printableWidthMm: effectivePrintableWidthMm,
              printableHeightMm: effectivePrintableHeightMm,
              marginMm: pdfMarginMm,
              spacingMm: pdfCardSpacingMm,
              physical: exportMode === 'physical',
              includeCutLines: exportMode === 'physical' && pdfIncludeCutLines,
            });
            for (let pageIndex = 0; pageIndex < facePages.length; pageIndex++) {
              if (pageIndex > 0) pdf.addPage();
              await processPage(pdf, facePages[pageIndex], renderer);
            }
          }
        } finally {
          renderer.cleanup();
        }

        const chunkSuffix = totalChunks > 1 ? `-part-${chunkIndex + 1}-of-${totalChunks}` : '';
        pdf.save(`${safeName}-${pdfModeSlug}-${timestamp}${watermarkSuffix}${chunkSuffix}.pdf`);

        // Yield to the browser between chunk downloads to reduce UI stalls.
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve());
        });
      }

      trackExportCompleted('pdf', generatedDisplayCards.length);

      if (totalChunks > 1) {
        toast({
          title: 'Chunked PDF export complete',
          description: `${totalChunks} PDF files downloaded. Next step: merge files if you need a single document.`,
        });
      } else {
        toast({
          title: 'PDF saved',
          description: `${safeName}-${pdfModeSlug}-${timestamp}${watermarkSuffix}.pdf downloaded${canExportClean ? '' : ' with the CardForge watermark'}.${exportMode === 'physical' ? ' Physical faces include CardForge format bleed and trim crop marks when enabled; this remains RGB raster PDF output, not PDF/X or a printer-specific ICC contract.' : ''}`,
        });
      }

    } catch (error) {
      trackExportFailed('pdf', 'render_or_download', generatedDisplayCards.length);
      console.error("Error generating PDF:", error);
      toast({
        title: 'PDF export failed',
        description: withNextStep(extractErrorMessage(error), 'Retry export after reviewing card quality warnings and ensuring your browser allows multiple downloads.'),
        variant: "destructive",
      });
    } finally {
      setIsLoadingPdf(false);
    }
  };

  async function processPage(
    pdf: jsPDF,
    pageCards: PdfCardPlacement[],
    renderer: CardFaceExportRenderer,
  ) {
    for (const placement of pageCards) {
      const canvas = exportMode === 'physical'
        ? await renderer.renderProductionToCanvas(placement.card, placement.face)
        : await renderer.renderToCanvas(placement.card, placement.face);
      pdf.addImage(
        canvas.toDataURL('image/png'),
        'PNG',
        placement.imageX,
        placement.imageY,
        placement.imageWidth,
        placement.imageHeight,
      );
      if (exportMode === 'physical' && pdfIncludeCutLines) {
        pdf.setDrawColor(180, 180, 180);
        pdf.setLineWidth(0.1);
        getPdfCropMarkSegments(placement).forEach((segment) => {
          pdf.line(segment.x1, segment.y1, segment.x2, segment.y2);
        });
      }
    }
  }


  return (
    <Button onClick={handleSaveAsPdf} disabled={disabled || isLoadingPdf} variant="outline" className="w-full">
      {isLoadingPdf ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Saving PDF...
        </>
      ) : (
        <>
          <FileDown className="mr-2 h-4 w-4" />
          Save as PDF
        </>
      )}
    </Button>
  );
}