
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

  const renderCardForCanvas = async (card: DisplayCard, side: 'front' | 'back', renderContainer: HTMLDivElement): Promise<HTMLDivElement | null> => {
    const templateToRender = side === 'back' ? card.backTemplate : card.frontTemplate;
    
    if (!templateToRender && side === 'back' && !card.backTemplate) {
        const aspectRatioString = card.frontTemplate.aspectRatio || TCG_ASPECT_RATIO;
        const ratioParts = aspectRatioString.split(':').map(Number);
        const cardWidthMm = 63;
        let cardHeightMm = (cardWidthMm / (ratioParts[0] || 63)) * (ratioParts[1] || 88);

        const tempDiv = document.createElement('div');
        tempDiv.style.width = `${cardWidthMm * 3.7795275591}px`;
        tempDiv.style.height = `${cardHeightMm * 3.7795275591}px`;
        tempDiv.style.backgroundColor = '#FFFFFF'; 
        tempDiv.style.border = '1px solid #DDDDDD';
        tempDiv.style.display = 'flex';
        tempDiv.style.alignItems = 'center';
        tempDiv.style.justifyContent = 'center';
        // Ensure this div is appended to the renderContainer for html2canvas to find it
        renderContainer.appendChild(tempDiv);
        return tempDiv;
    }
    if (!templateToRender) return null;

    // Create a dedicated child div within renderContainer for each card to avoid conflicts
    const cardSpecificContainer = document.createElement('div');
    cardSpecificContainer.id = `pdf-render-card-${card.uniqueId}-${side}-${Date.now()}`;
    renderContainer.appendChild(cardSpecificContainer);

    const previewElement = createElement(CardPreview, {
      key: `pdf-preview-${card.uniqueId}-${side}`, // Unique key for React
      card: card,
      isPrintMode: true,
      forceRenderSide: side,
      targetWidthPx: 300, 
      className: `pdf-render-card-${side}`
    });
    
    return new Promise((resolve) => {
      ReactDOM.render(previewElement, cardSpecificContainer, () => {
        setTimeout(() => { // Allow browser to paint
          const cardElement = cardSpecificContainer.firstChild as HTMLDivElement | null;
          if (cardElement) {
            resolve(cardElement);
          } else {
            console.error(`Failed to get cardElement for ${card.uniqueId}-${side}`);
            resolve(null);
          }
          // Do not unmount/remove here, parent loop will clean up the main renderContainer
        }, 100); // Increased timeout slightly
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
      
      let cardsOnCurrentFrontPage: { card: DisplayCard, x: number, y: number, w: number, h: number }[] = [];
      let currentX = pdfMarginMm;
      let currentY = pdfMarginMm;
      
      for (let i = 0; i < generatedDisplayCards.length; i++) {
        const cardItem = generatedDisplayCards[i];
        const aspectRatioString = cardItem.frontTemplate.aspectRatio || TCG_ASPECT_RATIO;
        const ratioParts = aspectRatioString.split(':').map(Number);
        let cardWidthMm = standardPrintCardWidthMm;
        let cardHeightMm = (cardWidthMm / (ratioParts[0] || 63)) * (ratioParts[1] || 88);

        if (currentX + cardWidthMm > effectivePrintableWidthMm + pdfMarginMm - (pdfCardSpacingMm > 0 ? 0 : pdfCardSpacingMm) && cardsOnCurrentFrontPage.length > 0) {
          currentX = pdfMarginMm;
          currentY += cardsOnCurrentFrontPage[0].h + pdfCardSpacingMm;
        }
        if (currentY + cardHeightMm > effectivePrintableHeightMm + pdfMarginMm - (pdfCardSpacingMm > 0 ? 0 : pdfCardSpacingMm) && cardsOnCurrentFrontPage.length > 0) {
          await processPage(pdf, cardsOnCurrentFrontPage, tempRenderContainer);
          cardsOnCurrentFrontPage = []; // Reset for next page
          pdf.addPage();
          currentX = pdfMarginMm;
          currentY = pdfMarginMm;
        }
        cardsOnCurrentFrontPage.push({ card: cardItem, x: currentX, y: currentY, w: cardWidthMm, h: cardHeightMm });
        currentX += cardWidthMm + pdfCardSpacingMm;
      }

      if (cardsOnCurrentFrontPage.length > 0) {
        await processPage(pdf, cardsOnCurrentFrontPage, tempRenderContainer);
      }

      pdf.save('tcg-cards-duplex.pdf');
      toast({ title: "PDF Saved", description: "tcg-cards-duplex.pdf has been downloaded." });

    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({ title: "PDF Generation Failed", description: `An error occurred: ${(error as Error).message}`, variant: "destructive" });
    } finally {
      setIsLoadingPdf(false);
      // Clean up: Unmount all rendered components and remove the container
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
    // Clear previous renderContainer children before rendering new set
    while (renderContainer.firstChild) {
        ReactDOM.unmountComponentAtNode(renderContainer.firstChild as Element); // Unmount React component if it's a root
        renderContainer.removeChild(renderContainer.firstChild);
    }

    // Render and add all fronts for this page
    for (const { card, x, y, w, h } of pageCards) {
      const cardElement = await renderCardForCanvas(card, 'front', renderContainer);
      if (cardElement) {
        try {
            const canvas = await html2canvas(cardElement, { scale: 2, useCORS: true, logging: false, backgroundColor: null });
            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, w, h);
            if(pdfIncludeCutLines) drawCutLines(pdf,x,y,w,h);
        } catch (e) {
            console.error("Error processing front of card for PDF:", card.uniqueId, e);
            pdf.text(`Error rendering front: ${card.uniqueId.substring(0,5)}`, x, y + h/2);
        }
      } else {
         pdf.text(`Missing front render: ${card.uniqueId.substring(0,5)}`, x, y + h/2);
      }
    }

    const hasAnyBacksOnThisPage = pageCards.some(c => c.card.backTemplate);
    if (hasAnyBacksOnThisPage) {
      pdf.addPage();
      // Clear renderContainer again for back sides
      while (renderContainer.firstChild) {
          ReactDOM.unmountComponentAtNode(renderContainer.firstChild as Element);
          renderContainer.removeChild(renderContainer.firstChild);
      }

      for (const { card, x, y, w, h } of pageCards) {
        const backElement = await renderCardForCanvas(card, 'back', renderContainer);
        if (backElement) {
          try {
            const canvas = await html2canvas(backElement, { scale: 2, useCORS: true, logging: false, backgroundColor: null });
            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, w, h); // Position backs at the same (mirrored) location
            if(pdfIncludeCutLines) drawCutLines(pdf,x,y,w,h);
          } catch (e) {
            console.error("Error processing back of card for PDF:", card.uniqueId, e);
            pdf.text(`Error rendering back: ${card.uniqueId.substring(0,5)}`, x, y + h/2);
          }
        } else if (card.backTemplate) { // It was supposed to have a back, but rendering failed
             pdf.text(`Missing back render: ${card.uniqueId.substring(0,5)}`, x, y + h/2);
        } else { // No back template, draw a simple placeholder if needed for alignment (already handled by renderCardForCanvas for blank backs)
            // The renderCardForCanvas already handles creating a blank div for no-back scenarios.
            // If that itself returned null, it's an issue. For now, if backElement is null and no backTemplate, it means it's a blank.
        }
      }
    }
  }
  
  function drawCutLines(pdf: jsPDF, x: number, y: number, w: number, h: number) {
      pdf.setDrawColor(180, 180, 180); 
      pdf.setLineWidth(0.1);
      // Adjust cut lines if spacing is zero to avoid overlap, draw inside slightly
      const cutOffset = pdfCardSpacingMm === 0 ? 0.2 : 0; 
      const cutLength = pdfCardSpacingMm === 0 ? 2 : 3;

      // Top-left
      pdf.line(x - cutLength + cutOffset, y + cutOffset, x + cutOffset, y + cutOffset);
      pdf.line(x + cutOffset, y - cutLength + cutOffset, x + cutOffset, y + cutOffset);
      // Top-right
      pdf.line(x + w + cutLength - cutOffset, y + cutOffset, x + w - cutOffset, y + cutOffset);
      pdf.line(x + w - cutOffset, y - cutLength + cutOffset, x + w - cutOffset, y + cutOffset);
      // Bottom-left
      pdf.line(x - cutLength + cutOffset, y + h - cutOffset, x + cutOffset, y + h - cutOffset);
      pdf.line(x + cutOffset, y + h + cutLength - cutOffset, x + cutOffset, y + h - cutOffset);
      // Bottom-right
      pdf.line(x + w + cutLength - cutOffset, y + h - cutOffset, x + w - cutOffset, y + h - cutOffset);
      pdf.line(x + w - cutOffset, y + h + cutLength - cutOffset, x + w - cutOffset, y + h - cutOffset);
      
      // If no spacing, explicitly draw the card border to make cutting easier
      if (pdfCardSpacingMm === 0 && pdfIncludeCutLines) {
          pdf.setDrawColor(200, 200, 200); // Lighter color for the box itself
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
          Save as PDF (Duplex Ready)
        </>
      )}
    </Button>
  );
}
