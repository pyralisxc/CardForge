
"use client";

import { useState, createElement, Fragment } from 'react';
import ReactDOM from 'react-dom';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { DisplayCard, PaperSize, TCGCardTemplate } from '@/types';
import { Button } from '@/components/ui/button';
import { Loader2, FileDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { TCG_ASPECT_RATIO } from '@/lib/constants';
import { CardPreview } from './CardPreview';

interface SaveAsPdfButtonProps {
  generatedDisplayCards: DisplayCard[];
  selectedPaperSize: PaperSize;
  pdfMarginMm: number;
  pdfCardSpacingMm: number;
  pdfIncludeCutLines: boolean;
  disabled?: boolean;
}

export function SaveAsPdfButton({
  generatedDisplayCards,
  selectedPaperSize,
  pdfMarginMm,
  pdfCardSpacingMm,
  pdfIncludeCutLines,
  disabled = false,
}: SaveAsPdfButtonProps) {
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const { toast } = useToast();

  const renderCardForCanvas = async (card: DisplayCard, renderContainer: HTMLDivElement): Promise<HTMLDivElement | null> => {
    const templateToRender = card.template;
    
    if (!templateToRender) return null;

    const cardSpecificContainer = document.createElement('div');
    cardSpecificContainer.id = `pdf-render-card-${card.uniqueId}-${Date.now()}`;
    renderContainer.appendChild(cardSpecificContainer);

    const previewElement = createElement(CardPreview, {
      key: `pdf-preview-${card.uniqueId}`, 
      card: card,
      isPrintMode: true,
      targetWidthPx: 300, 
      className: `pdf-render-card`
    });
    
    return new Promise((resolve) => {
      ReactDOM.render(previewElement, cardSpecificContainer, () => {
        setTimeout(() => { 
          const cardElement = cardSpecificContainer.firstChild as HTMLDivElement | null;
          if (cardElement) {
            resolve(cardElement);
          } else {
            console.error(`Failed to get cardElement for ${card.uniqueId}`);
            resolve(null);
          }
        }, 100); 
      });
    });
  };


  const handleSaveAsPdf = async () => {
    if (generatedDisplayCards.length === 0) {
      toast({ title: "Nothing to Save", description: "Generate some cards first.", variant: "default" });
      return;
    }
    setIsLoadingPdf(true);
    toast({ title: "Generating PDF...", description: "This may take a moment for many cards." });

    const tempRenderContainer = document.createElement('div');
    tempRenderContainer.style.position = 'absolute';
    tempRenderContainer.style.left = '-99999px';
    tempRenderContainer.style.top = '-99999px';
    tempRenderContainer.id = 'pdf-temp-render-container';
    document.body.appendChild(tempRenderContainer);
    
    try {
      const pdf = new jsPDF({
        orientation: selectedPaperSize.widthMm < selectedPaperSize.heightMm ? 'p' : 'l',
        unit: 'mm',
        format: [selectedPaperSize.widthMm, selectedPaperSize.heightMm],
      });

      const standardPrintCardWidthMm = 63;
      const effectivePrintableWidthMm = selectedPaperSize.widthMm - 2 * pdfMarginMm;
      const effectivePrintableHeightMm = selectedPaperSize.heightMm - 2 * pdfMarginMm;
      
      let cardsOnCurrentPage: { card: DisplayCard, x: number, y: number, w: number, h: number }[] = [];
      let currentX = pdfMarginMm;
      let currentY = pdfMarginMm;
      
      for (let i = 0; i < generatedDisplayCards.length; i++) {
        const cardItem = generatedDisplayCards[i];
        const aspectRatioString = cardItem.template.aspectRatio || TCG_ASPECT_RATIO;
        const ratioParts = aspectRatioString.split(':').map(Number);
        let cardWidthMm = standardPrintCardWidthMm;
        let cardHeightMm = (cardWidthMm / (ratioParts[0] || 63)) * (ratioParts[1] || 88);

        if (currentX + cardWidthMm > effectivePrintableWidthMm + pdfMarginMm - (pdfCardSpacingMm > 0 ? 0 : pdfCardSpacingMm) && cardsOnCurrentPage.length > 0) {
          currentX = pdfMarginMm;
          currentY += cardsOnCurrentPage[0].h + pdfCardSpacingMm;
        }
        if (currentY + cardHeightMm > effectivePrintableHeightMm + pdfMarginMm - (pdfCardSpacingMm > 0 ? 0 : pdfCardSpacingMm) && cardsOnCurrentPage.length > 0) {
          await processPage(pdf, cardsOnCurrentPage, tempRenderContainer);
          cardsOnCurrentPage = []; 
          pdf.addPage();
          currentX = pdfMarginMm;
          currentY = pdfMarginMm;
        }
        cardsOnCurrentPage.push({ card: cardItem, x: currentX, y: currentY, w: cardWidthMm, h: cardHeightMm });
        currentX += cardWidthMm + pdfCardSpacingMm;
      }

      if (cardsOnCurrentPage.length > 0) {
        await processPage(pdf, cardsOnCurrentPage, tempRenderContainer);
      }

      pdf.save('tcg-cards.pdf'); // Simplified filename
      toast({ title: "PDF Saved", description: "tcg-cards.pdf has been downloaded." });

    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({ title: "PDF Generation Failed", description: `An error occurred: ${(error as Error).message}`, variant: "destructive" });
    } finally {
      setIsLoadingPdf(false);
      ReactDOM.unmountComponentAtNode(tempRenderContainer);
      if (document.body.contains(tempRenderContainer)) {
        document.body.removeChild(tempRenderContainer);
      }
    }
  };

  async function processPage(
    pdf: jsPDF, 
    pageCards: { card: DisplayCard, x: number, y: number, w: number, h: number }[],
    renderContainer: HTMLDivElement
  ) {
    while (renderContainer.firstChild) {
        ReactDOM.unmountComponentAtNode(renderContainer.firstChild as Element); 
        renderContainer.removeChild(renderContainer.firstChild);
    }

    for (const { card, x, y, w, h } of pageCards) {
      const cardElement = await renderCardForCanvas(card, renderContainer);
      if (cardElement) {
        try {
            const canvas = await html2canvas(cardElement, { scale: 2, useCORS: true, logging: false, backgroundColor: null });
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
