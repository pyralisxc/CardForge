
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
import { CardPreview } from './CardPreview'; // Import CardPreview

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

  const renderCardForCanvas = async (card: DisplayCard, side: 'front' | 'back'): Promise<HTMLDivElement | null> => {
    const templateToRender = side === 'back' ? card.backTemplate : card.frontTemplate;
    if (!templateToRender && side === 'back' && !card.backTemplate) { // If specifically asking for back and no back template
        // Create a dummy div matching front card's aspect ratio for blank back
        const aspectRatioString = card.frontTemplate.aspectRatio || TCG_ASPECT_RATIO;
        const ratioParts = aspectRatioString.split(':').map(Number);
        const cardWidthMm = 63; // Standard print width
        let cardHeightMm = (cardWidthMm / (ratioParts[0] || 63)) * (ratioParts[1] || 88);

        const tempDiv = document.createElement('div');
        tempDiv.style.width = `${cardWidthMm * 3.7795275591}px`; // Convert mm to approx px for canvas
        tempDiv.style.height = `${cardHeightMm * 3.7795275591}px`;
        tempDiv.style.backgroundColor = 'white'; // Or some other indicator of blank
        tempDiv.style.border = '1px solid #ccc';
        tempDiv.style.display = 'flex';
        tempDiv.style.alignItems = 'center';
        tempDiv.style.justifyContent = 'center';
        // tempDiv.innerHTML = '<p style="font-size: 12px; color: #666;">Blank Back</p>'; // Optional text
        return tempDiv; // Return the div itself, html2canvas can take an element
    }
    if(!templateToRender) return null;


    // Create a temporary div to render the CardPreview component
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px'; // Position off-screen
    tempContainer.style.top = '-9999px';
    document.body.appendChild(tempContainer);

    // Use ReactDOM.render to render the component into the div
    // We need a unique key for React reconciliation if we render multiple times
    const previewElement = createElement(CardPreview, {
      card: card,
      isPrintMode: true, // Ensures certain styles/elements are for printing
      forceRenderSide: side,
      // targetWidthPx should match the desired canvas resolution width
      // Standard TCG is ~2.5in wide. At 300DPI, this is 750px. Let's use a smaller consistent size for canvas generation.
      targetWidthPx: 300, // A consistent width for canvas generation
      className: `pdf-render-card-${side}` // Add a class for potential styling
    });
    
    // A way to wait for the component to be rendered and styles applied.
    // This is a common challenge with html2canvas and dynamically rendered React components.
    return new Promise((resolve) => {
      ReactDOM.render(previewElement, tempContainer, () => {
        // Small timeout to allow browser to paint. This is not foolproof.
        setTimeout(() => {
          const cardElement = tempContainer.firstChild as HTMLDivElement;
          resolve(cardElement);
          // Clean up after a delay to ensure canvas is done
          // setTimeout(() => {
          //   ReactDOM.unmountComponentAtNode(tempContainer);
          //   document.body.removeChild(tempContainer);
          // }, 100);
        }, 50); // Adjust delay as needed, or look into MutationObserver
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
      let pageNumber = 1;

      for (let i = 0; i < generatedDisplayCards.length; i++) {
        const cardItem = generatedDisplayCards[i];
        const aspectRatioString = cardItem.frontTemplate.aspectRatio || TCG_ASPECT_RATIO;
        const ratioParts = aspectRatioString.split(':').map(Number);
        let cardWidthMm = standardPrintCardWidthMm;
        let cardHeightMm = (cardWidthMm / (ratioParts[0] || 63)) * (ratioParts[1] || 88);

        if (currentX + cardWidthMm > effectivePrintableWidthMm + pdfCardSpacingMm - (pdfCardSpacingMm > 0 ? pdfCardSpacingMm : 0)  && cardsOnCurrentFrontPage.length > 0) { // card won't fit in row
          currentX = pdfMarginMm;
          currentY += cardsOnCurrentFrontPage[0].h + pdfCardSpacingMm; // Use height of first card in previous row for simplicity
        }
        if (currentY + cardHeightMm > effectivePrintableHeightMm + pdfCardSpacingMm - (pdfCardSpacingMm > 0 ? pdfCardSpacingMm : 0) && cardsOnCurrentFrontPage.length > 0) { // card won't fit on page
           // Process current page's fronts and backs
          await processPage(pdf, cardsOnCurrentFrontPage, tempRenderContainer);
          cardsOnCurrentFrontPage = [];
          pdf.addPage();
          pageNumber++;
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
      ReactDOM.unmountComponentAtNode(tempRenderContainer); // Ensure unmount
      document.body.removeChild(tempRenderContainer); // Clean up container
    }
  };

  async function processPage(
    pdf: jsPDF, 
    pageCards: { card: DisplayCard, x: number, y: number, w: number, h: number }[],
    renderContainer: HTMLDivElement
  ) {
    // Render and add all fronts for this page
    for (const { card, x, y, w, h } of pageCards) {
      const cardElement = await renderCardForCanvas(card, 'front');
      if (cardElement) {
        const canvas = await html2canvas(cardElement, { scale: 2, useCORS: true, logging: false, backgroundColor: null });
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, w, h);
        if(pdfIncludeCutLines) drawCutLines(pdf,x,y,w,h);
      }
    }

    // Check if any card on this page has a back
    const hasAnyBacks = pageCards.some(c => c.card.backTemplate);
    if (hasAnyBacks) {
      pdf.addPage();
      // Render and add all backs for this page
      for (const { card, x, y, w, h } of pageCards) {
        const backElement = await renderCardForCanvas(card, 'back');
        if (backElement) {
          const canvas = await html2canvas(backElement, { scale: 2, useCORS: true, logging: false, backgroundColor: null });
          pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, w, h);
          if(pdfIncludeCutLines) drawCutLines(pdf,x,y,w,h);
        }
      }
    }
  }
  
  function drawCutLines(pdf: jsPDF, x: number, y: number, w: number, h: number) {
      pdf.setDrawColor(180, 180, 180); 
      pdf.setLineWidth(0.1);
      const cutOffset = pdfCardSpacingMm > 0 ? 0 : -0.5; 
      const cutLength = 3; 

      pdf.line(x + cutOffset - cutLength, y + cutOffset, x + cutOffset, y + cutOffset);
      pdf.line(x + cutOffset, y + cutOffset - cutLength, x + cutOffset, y + cutOffset);
      pdf.line(x + w - cutOffset + cutLength, y + cutOffset, x + w - cutOffset, y + cutOffset);
      pdf.line(x + w - cutOffset, y + cutOffset - cutLength, x + w - cutOffset, y + cutOffset);
      pdf.line(x + cutOffset - cutLength, y + h - cutOffset, x + cutOffset, y + h - cutOffset);
      pdf.line(x + cutOffset, y + h - cutOffset + cutLength, x + cutOffset, y + h - cutOffset);
      pdf.line(x + w - cutOffset + cutLength, y + h - cutOffset, x + w - cutOffset, y + h - cutOffset);
      pdf.line(x + w - cutOffset, y + h - cutOffset + cutLength, x + w - cutOffset, y + h - cutOffset);
      if (pdfCardSpacingMm === 0) {
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
