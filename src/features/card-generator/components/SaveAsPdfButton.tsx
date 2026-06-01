
"use client";

import { useState } from 'react';
import jsPDF from 'jspdf';
import type { CardFace, DisplayCard, PaperSize, PdfDuplexLayout } from '@/types';
import { Button } from '@/components/ui/button';
import { Loader2, FileDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getExportProfile, validateCardExportQuality, type ExportMode } from '@/lib/printValidation';
import { extractErrorMessage, withNextStep } from '@/lib/userFacingErrors';
import { ERROR_COPY } from '@/lib/errorCopy';
import { getCardPhysicalSizeMm } from '@/lib/cardExportGeometry';
import { renderCardToCanvasWithProfile } from '@/lib/cardPreviewExport';

const MAX_PDF_CARDS_PER_FILE = 500;
const MAX_TOTAL_PDF_EXPORT_CARDS = 10000;

interface PdfCardPlacement {
  card: DisplayCard;
  face: CardFace;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface SaveAsPdfButtonProps {
  generatedDisplayCards: DisplayCard[];
  selectedPaperSize: PaperSize;
  pdfMarginMm: number;
  pdfCardSpacingMm: number;
  pdfIncludeCutLines: boolean;
  pdfDuplexLayout: PdfDuplexLayout;
  exportMode: ExportMode;
  exportDpi: number;
  disabled?: boolean;
  gateMessage?: string | null;
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
  disabled = false,
  gateMessage,
  templateName,
}: SaveAsPdfButtonProps) {
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const { toast } = useToast();

  const handleSaveAsPdf = async () => {
    if (gateMessage) {
      toast({
        title: 'Clean export locked',
        description: withNextStep(gateMessage, 'Use Creator Pass or dev access when auth is enabled, or use dev mode for local validation.'),
        variant: 'default',
      });
      return;
    }

    if (generatedDisplayCards.length === 0) {
      toast({
        title: ERROR_COPY.pdfNoCards.title,
        description: withNextStep('PDF export requires at least one generated output.', 'Generate an output first, then try Save as PDF again.'),
        variant: "default",
      });
      return;
    }

    if (generatedDisplayCards.length > MAX_TOTAL_PDF_EXPORT_CARDS) {
      toast({
        title: 'PDF export size limit reached',
        description: withNextStep(
          `PDF export is limited to ${MAX_TOTAL_PDF_EXPORT_CARDS} outputs per run (current: ${generatedDisplayCards.length}).`,
          'Reduce the batch size and export again in multiple runs.'
        ),
        variant: 'destructive',
      });
      return;
    }

    setIsLoadingPdf(true);

    const exportProfile = getExportProfile(exportMode, exportDpi);
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
        description: withNextStep(Array.from(criticalIssues).slice(0, 2).join(' '), 'Fix these output issues in the generator or template, then export again.'),
        variant: "destructive",
      });
      setIsLoadingPdf(false);
      return;
    }

    if (warningIssues.size > 0) {
      toast({
        title: ERROR_COPY.exportWarnings.title,
        description: withNextStep(Array.from(warningIssues).slice(0, 2).join(' '), 'You can continue, but review output quality before sending to print.'),
        duration: 7000,
      });
    }

    const totalChunks = Math.ceil(generatedDisplayCards.length / MAX_PDF_CARDS_PER_FILE);
    const safeName = (templateName || generatedDisplayCards[0]?.template?.name || 'cardforge-outputs')
      .replace(/[^a-zA-Z0-9_\- ]/g, '')
      .trim()
      .replace(/\s+/g, '-') || 'cardforge-outputs';
    const pdfModeSlug = exportMode === 'physical'
      ? (pdfDuplexLayout === 'same-page' ? 'print-same-sheet' : 'print-duplex-sheets')
      : 'digital-sheet';
    const timestamp = new Date().toISOString().slice(0, 10);

    toast({
      title: totalChunks > 1 ? 'Generating chunked PDFs...' : 'Generating PDF...',
      description:
        totalChunks > 1
          ? `Using ${exportProfile.label} profile (${exportProfile.dpi} DPI target). This export will generate ${totalChunks} files.`
          : `Using ${exportProfile.label} profile (${exportProfile.dpi} DPI target).`,
    });

    try {
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const chunkStart = chunkIndex * MAX_PDF_CARDS_PER_FILE;
        const chunkEnd = Math.min(chunkStart + MAX_PDF_CARDS_PER_FILE, generatedDisplayCards.length);
        const chunkCards = generatedDisplayCards.slice(chunkStart, chunkEnd);

        if (totalChunks > 1) {
          toast({
            title: `Generating PDF chunk ${chunkIndex + 1}/${totalChunks}`,
            description: `Outputs ${chunkStart + 1}-${chunkEnd} of ${generatedDisplayCards.length}.`,
          });
        }

        const pdf = new jsPDF({
          orientation: selectedPaperSize.widthMm < selectedPaperSize.heightMm ? 'p' : 'l',
          unit: 'mm',
          format: [selectedPaperSize.widthMm, selectedPaperSize.heightMm],
        });

        const effectivePrintableWidthMm = selectedPaperSize.widthMm - 2 * pdfMarginMm;
        const effectivePrintableHeightMm = selectedPaperSize.heightMm - 2 * pdfMarginMm;

        if (exportMode === 'physical' && pdfDuplexLayout === 'separate-pages') {
          const frontPages = createPdfPlacementPages(chunkCards, 'front', effectivePrintableWidthMm, effectivePrintableHeightMm);
          for (let pageIndex = 0; pageIndex < frontPages.length; pageIndex++) {
            if (pageIndex > 0) pdf.addPage();
            await processPage(pdf, frontPages[pageIndex], exportProfile);

            const backPage = frontPages[pageIndex]
              .filter((placement) => placement.card.template.backCanvas)
              .map((placement) => ({ ...placement, face: 'back' as const }));
            if (backPage.length > 0) {
              pdf.addPage();
              await processPage(pdf, backPage, exportProfile);
            }
          }
        } else {
          const faceItems = chunkCards.flatMap((cardItem) => (
            cardItem.template.backCanvas
              ? [{ card: cardItem, face: 'front' as const }, { card: cardItem, face: 'back' as const }]
              : [{ card: cardItem, face: 'front' as const }]
          ));
          const facePages = createPdfPlacementPages(faceItems, undefined, effectivePrintableWidthMm, effectivePrintableHeightMm);
          for (let pageIndex = 0; pageIndex < facePages.length; pageIndex++) {
            if (pageIndex > 0) pdf.addPage();
            await processPage(pdf, facePages[pageIndex], exportProfile);
          }
        }

        const chunkSuffix = totalChunks > 1 ? `-part-${chunkIndex + 1}-of-${totalChunks}` : '';
        pdf.save(`${safeName}-${pdfModeSlug}-${timestamp}${chunkSuffix}.pdf`);

        // Yield to the browser between chunk downloads to reduce UI stalls.
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve());
        });
      }

      if (totalChunks > 1) {
        toast({
          title: 'Chunked PDF export complete',
          description: `${totalChunks} PDF files downloaded. Next step: merge files if you need a single document.`,
        });
      } else {
        toast({
          title: 'PDF saved',
          description: `${safeName}-${pdfModeSlug}-${timestamp}.pdf downloaded. Next step: inspect print margins and image quality before production use.`,
        });
      }

    } catch (error) {
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
    exportProfile: ReturnType<typeof getExportProfile>
  ) {
    let renderErrorCount = 0;

    for (const { card, face, x, y, w, h } of pageCards) {
      try {
          const canvas = await renderCardToCanvasWithProfile(card, exportProfile, face);
          pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, w, h);
          if(pdfIncludeCutLines) drawCutLines(pdf,x,y,w,h);
      } catch (e) {
          renderErrorCount += 1;
          if (renderErrorCount <= 5) {
            console.warn('Error processing card for PDF:', card.uniqueId, e);
          }
          pdf.text(`Error rendering: ${card.uniqueId.substring(0,5)}`, x, y + h/2);
      }
    }

    if (renderErrorCount > 0) {
      console.warn(`PDF page completed with ${renderErrorCount} render error(s).`);
    }
  }

  function createPdfPlacementPages(
    items: DisplayCard[] | Array<{ card: DisplayCard; face: CardFace }>,
    forcedFace: CardFace | undefined,
    effectivePrintableWidthMm: number,
    effectivePrintableHeightMm: number
  ): PdfCardPlacement[][] {
    const pages: PdfCardPlacement[][] = [];
    let currentPage: PdfCardPlacement[] = [];
    let currentX = pdfMarginMm;
    let currentY = pdfMarginMm;
    let currentRowMaxHeightMm = 0;

    for (const item of items) {
      const cardItem = 'card' in item ? item.card : item;
      const face = forcedFace ?? ('face' in item ? item.face : 'front');
      const { widthMm: cardWidthMm, heightMm: cardHeightMm } = getCardPhysicalSizeMm(
        cardItem,
        effectivePrintableWidthMm,
        effectivePrintableHeightMm
      );

      if (currentX + cardWidthMm > effectivePrintableWidthMm + pdfMarginMm && currentPage.length > 0) {
        currentX = pdfMarginMm;
        currentY += currentRowMaxHeightMm + pdfCardSpacingMm;
        currentRowMaxHeightMm = 0;
      }
      if (currentY + cardHeightMm > effectivePrintableHeightMm + pdfMarginMm && currentPage.length > 0) {
        pages.push(currentPage);
        currentPage = [];
        currentX = pdfMarginMm;
        currentY = pdfMarginMm;
        currentRowMaxHeightMm = 0;
      }
      currentPage.push({ card: cardItem, face, x: currentX, y: currentY, w: cardWidthMm, h: cardHeightMm });
      currentRowMaxHeightMm = Math.max(currentRowMaxHeightMm, cardHeightMm);
      currentX += cardWidthMm + pdfCardSpacingMm;
    }

    if (currentPage.length > 0) pages.push(currentPage);
    return pages;
  }
  
  function drawCutLines(pdf: jsPDF, x: number, y: number, w: number, h: number) {
      pdf.setDrawColor(180, 180, 180); 
      pdf.setLineWidth(0.1);
      const cutOffset = pdfCardSpacingMm === 0 ? 0.2 : 0; 
      const cutLength = pdfCardSpacingMm === 0 ? 2 : 3;

      pdf.line(x - cutLength + cutOffset, y + cutOffset, x + cutOffset, y + cutOffset);
      pdf.line(x + cutOffset, y - cutLength + cutOffset, x + cutOffset, y + cutOffset);
      pdf.line(x + w + cutLength - cutOffset, y + cutOffset, x + w - cutOffset, y + cutOffset);
      pdf.line(x + w - cutOffset, y - cutLength + cutOffset, x + w - cutOffset, y + cutOffset);
      pdf.line(x - cutLength + cutOffset, y + h - cutOffset, x + cutOffset, y + h - cutOffset);
      pdf.line(x + cutOffset, y + h + cutLength - cutOffset, x + cutOffset, y + h - cutOffset);
      pdf.line(x + w + cutLength - cutOffset, y + h - cutOffset, x + w - cutOffset, y + h - cutOffset);
      pdf.line(x + w - cutOffset, y + h + cutLength - cutOffset, x + w - cutOffset, y + h - cutOffset);
      
      if (pdfCardSpacingMm === 0 && pdfIncludeCutLines) {
          pdf.setDrawColor(200, 200, 200); 
          pdf.rect(x, y, w, h);
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
