
"use client";

import { useState, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import jsPDF from 'jspdf';
import { toCanvas } from 'html-to-image';
import type { DisplayCard, PaperSize } from '@/types';
import { Button } from '@/components/ui/button';
import { Loader2, FileDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { TCG_ASPECT_RATIO } from '@/lib/constants';
import { CardPreview } from './CardPreview';
import { getExportProfile, validateCardExportQuality, type ExportMode } from '@/lib/printValidation';

interface SaveAsPdfButtonProps {
  generatedDisplayCards: DisplayCard[];
  selectedPaperSize: PaperSize;
  pdfMarginMm: number;
  pdfCardSpacingMm: number;
  pdfIncludeCutLines: boolean;
  exportMode: ExportMode;
  exportDpi: number;
  disabled?: boolean;
  templateName?: string;
}

export function SaveAsPdfButton({
  generatedDisplayCards,
  selectedPaperSize,
  pdfMarginMm,
  pdfCardSpacingMm,
  pdfIncludeCutLines,
  exportMode,
  exportDpi,
  disabled = false,
  templateName,
}: SaveAsPdfButtonProps) {
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const { toast } = useToast();

  const renderCardForCanvas = async (
    card: DisplayCard,
    renderContainer: HTMLDivElement,
    mountedRoots: Root[],
    targetWidthPx: number
  ): Promise<HTMLDivElement | null> => {
    const templateToRender = card.template;
    
    if (!templateToRender) return null;

    const cardSpecificContainer = document.createElement('div');
    cardSpecificContainer.id = `pdf-render-card-${card.uniqueId}-${Date.now()}`;
    renderContainer.appendChild(cardSpecificContainer);

    const previewElement = createElement(CardPreview, {
      key: `pdf-preview-${card.uniqueId}`, 
      card: card,
      isPrintMode: true,
      targetWidthPx,
      className: `pdf-render-card`
    });
    
    return new Promise((resolve) => {
      const root = createRoot(cardSpecificContainer);
      mountedRoots.push(root);
      root.render(previewElement);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const cardElement = cardSpecificContainer.firstChild as HTMLDivElement | null;
          if (cardElement) {
            resolve(cardElement);
          } else {
            console.error(`Failed to get cardElement for ${card.uniqueId}`);
            resolve(null);
          }
        });
      });
    });
  };


  const handleSaveAsPdf = async () => {
    if (generatedDisplayCards.length === 0) {
      toast({ title: "Nothing to Save", description: "Generate some cards first.", variant: "default" });
      return;
    }
    setIsLoadingPdf(true);

    const exportProfile = getExportProfile(exportMode, exportDpi);
    const criticalIssues = new Set<string>();
    const warningIssues = new Set<string>();

    generatedDisplayCards.forEach((card) => {
      const validation = validateCardExportQuality(card, exportMode);
      validation.critical.forEach((issue) => criticalIssues.add(issue));
      validation.warnings.forEach((issue) => warningIssues.add(issue));
    });

    if (criticalIssues.size > 0) {
      toast({
        title: "Export Blocked by Quality Checks",
        description: Array.from(criticalIssues).slice(0, 2).join(' '),
        variant: "destructive",
      });
      setIsLoadingPdf(false);
      return;
    }

    if (warningIssues.size > 0) {
      toast({
        title: "Export Quality Warnings",
        description: Array.from(warningIssues).slice(0, 2).join(' '),
        duration: 7000,
      });
    }

    toast({
      title: "Generating PDF...",
      description: `Using ${exportProfile.label} profile (${exportProfile.dpi} DPI target).`,
    });

    const tempRenderContainer = document.createElement('div');
    tempRenderContainer.style.position = 'absolute';
    tempRenderContainer.style.left = '-99999px';
    tempRenderContainer.style.top = '-99999px';
    tempRenderContainer.id = 'pdf-temp-render-container';
    document.body.appendChild(tempRenderContainer);
    const mountedRoots: Root[] = [];
    
    try {
      const pdf = new jsPDF({
        orientation: selectedPaperSize.widthMm < selectedPaperSize.heightMm ? 'p' : 'l',
        unit: 'mm',
        format: [selectedPaperSize.widthMm, selectedPaperSize.heightMm],
      });

      const effectivePrintableWidthMm = selectedPaperSize.widthMm - 2 * pdfMarginMm;
      const effectivePrintableHeightMm = selectedPaperSize.heightMm - 2 * pdfMarginMm;
      
      let cardsOnCurrentPage: { card: DisplayCard, x: number, y: number, w: number, h: number }[] = [];
      let currentX = pdfMarginMm;
      let currentY = pdfMarginMm;
      let currentRowMaxHeightMm = 0;
      
      for (let i = 0; i < generatedDisplayCards.length; i++) {
        const cardItem = generatedDisplayCards[i];
        const aspectRatioString = cardItem.template.aspectRatio || TCG_ASPECT_RATIO;
        const ratioParts = aspectRatioString.split(':').map(Number);
        const ratioW = ratioParts[0] || 63;
        const ratioH = ratioParts[1] || 88;

        // Derive physical card size in mm.
        // If both ratio values are >= 20, they represent actual mm dimensions (e.g. 63:88).
        // If they're small integers (e.g. 5:7, 16:9) treat as a pure proportion and
        // normalise to the standard 88mm card height.
        const STANDARD_CARD_HEIGHT_MM = 88;
        let cardWidthMm: number;
        let cardHeightMm: number;
        if (ratioW >= 20 && ratioH >= 20) {
          cardWidthMm = ratioW;
          cardHeightMm = ratioH;
        } else {
          cardHeightMm = STANDARD_CARD_HEIGHT_MM;
          cardWidthMm = (ratioW / ratioH) * STANDARD_CARD_HEIGHT_MM;
        }

        // Scale down proportionally if the card is larger than the printable area.
        if (cardWidthMm > effectivePrintableWidthMm || cardHeightMm > effectivePrintableHeightMm) {
          const scale = Math.min(
            effectivePrintableWidthMm / cardWidthMm,
            effectivePrintableHeightMm / cardHeightMm
          );
          cardWidthMm = Math.round(cardWidthMm * scale * 1000) / 1000;
          cardHeightMm = Math.round(cardHeightMm * scale * 1000) / 1000;
        }

        if (currentX + cardWidthMm > effectivePrintableWidthMm + pdfMarginMm - (pdfCardSpacingMm > 0 ? 0 : pdfCardSpacingMm) && cardsOnCurrentPage.length > 0) {
          currentX = pdfMarginMm;
          currentY += currentRowMaxHeightMm + pdfCardSpacingMm;
          currentRowMaxHeightMm = 0;
        }
        if (currentY + cardHeightMm > effectivePrintableHeightMm + pdfMarginMm - (pdfCardSpacingMm > 0 ? 0 : pdfCardSpacingMm) && cardsOnCurrentPage.length > 0) {
          await processPage(pdf, cardsOnCurrentPage, tempRenderContainer, mountedRoots, exportProfile.renderWidthPx, exportProfile.canvasPixelRatio);
          cardsOnCurrentPage = []; 
          pdf.addPage();
          currentX = pdfMarginMm;
          currentY = pdfMarginMm;
          currentRowMaxHeightMm = 0;
        }
        cardsOnCurrentPage.push({ card: cardItem, x: currentX, y: currentY, w: cardWidthMm, h: cardHeightMm });
        currentRowMaxHeightMm = Math.max(currentRowMaxHeightMm, cardHeightMm);
        currentX += cardWidthMm + pdfCardSpacingMm;
      }

      if (cardsOnCurrentPage.length > 0) {
        await processPage(pdf, cardsOnCurrentPage, tempRenderContainer, mountedRoots, exportProfile.renderWidthPx, exportProfile.canvasPixelRatio);
      }

      const safeName = (templateName || generatedDisplayCards[0]?.template?.name || 'tcg-cards')
        .replace(/[^a-zA-Z0-9_\- ]/g, '')
        .trim()
        .replace(/\s+/g, '-') || 'tcg-cards';
      const timestamp = new Date().toISOString().slice(0, 10);
      pdf.save(`${safeName}-${timestamp}.pdf`);
      toast({ title: "PDF Saved", description: `${safeName}-${timestamp}.pdf has been downloaded.` });

    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({ title: "PDF Generation Failed", description: `An error occurred: ${(error as Error).message}`, variant: "destructive" });
    } finally {
      setIsLoadingPdf(false);
      mountedRoots.splice(0).forEach((root) => root.unmount());
      if (document.body.contains(tempRenderContainer)) {
        document.body.removeChild(tempRenderContainer);
      }
    }
  };

  async function processPage(
    pdf: jsPDF, 
    pageCards: { card: DisplayCard, x: number, y: number, w: number, h: number }[],
    renderContainer: HTMLDivElement,
    mountedRoots: Root[],
    targetWidthPx: number,
    canvasPixelRatio: number
  ) {
    mountedRoots.splice(0).forEach((root) => root.unmount());
    while (renderContainer.firstChild) {
        renderContainer.removeChild(renderContainer.firstChild);
    }

    for (const { card, x, y, w, h } of pageCards) {
      const cardElement = await renderCardForCanvas(card, renderContainer, mountedRoots, targetWidthPx);
      if (cardElement) {
        try {
            const canvas = await toCanvas(cardElement, { pixelRatio: canvasPixelRatio, skipFonts: false, fetchRequestInit: { mode: 'cors' } });
            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, w, h);
            if(pdfIncludeCutLines) drawCutLines(pdf,x,y,w,h);
        } catch (e) {
            console.error("Error processing card for PDF:", card.uniqueId, e);
            pdf.text(`Error rendering: ${card.uniqueId.substring(0,5)}`, x, y + h/2);
        }
      } else {
         pdf.text(`Missing render: ${card.uniqueId.substring(0,5)}`, x, y + h/2);
      }
    }
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
