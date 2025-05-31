
"use client";

import { useState } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { DisplayCard, PaperSize } from '@/types';
import { Button } from '@/components/ui/button';
import { Loader2, FileDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { TCG_ASPECT_RATIO } from '@/lib/constants'; // Import default aspect ratio

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

  const handleSaveAsPdf = async () => {
    if (generatedDisplayCards.length === 0) {
      toast({ title: "Nothing to Save", description: "Generate some cards first.", variant: "default" });
      return;
    }
    setIsLoadingPdf(true);
    toast({ title: "Generating PDF...", description: "This may take a moment for many cards." });

    try {
      const pdf = new jsPDF({
        orientation: selectedPaperSize.widthMm < selectedPaperSize.heightMm ? 'p' : 'l',
        unit: 'mm',
        format: [selectedPaperSize.widthMm, selectedPaperSize.heightMm],
      });

      // Standard TCG card width for printing. Height will be derived from aspect ratio.
      const standardPrintCardWidthMm = 63;

      const effectivePrintableWidthMm = selectedPaperSize.widthMm - 2 * pdfMarginMm;
      const effectivePrintableHeightMm = selectedPaperSize.heightMm - 2 * pdfMarginMm;

      // Initial calculation based on default card size to see if ANY card can fit.
      // This will be refined per card later.
      const initialApproxCardHeightMm = (standardPrintCardWidthMm / parseInt(TCG_ASPECT_RATIO.split(':')[0])) * parseInt(TCG_ASPECT_RATIO.split(':')[1]);
      
      const cardsPerRowInitially = Math.max(1, Math.floor((effectivePrintableWidthMm + pdfCardSpacingMm) / (standardPrintCardWidthMm + pdfCardSpacingMm)));
      const rowsPerPageInitially = Math.max(1, Math.floor((effectivePrintableHeightMm + pdfCardSpacingMm) / (initialApproxCardHeightMm + pdfCardSpacingMm)));
      
      if (cardsPerRowInitially === 0 || rowsPerPageInitially === 0 || standardPrintCardWidthMm > effectivePrintableWidthMm || initialApproxCardHeightMm > effectivePrintableHeightMm) {
        toast({
          title: "Layout Error",
          description: `Paper size or margins too small for cards. Standard Width: ${standardPrintCardWidthMm}mm, Approx Height: ${initialApproxCardHeightMm.toFixed(1)}mm. Printable Area: ${effectivePrintableWidthMm.toFixed(1)}x${effectivePrintableHeightMm.toFixed(1)}mm (with ${pdfMarginMm}mm margins). Spacing: ${pdfCardSpacingMm}mm.`,
          variant: "destructive",
          duration: 8000,
        });
        setIsLoadingPdf(false);
        return;
      }


      let cardCountOnCurrentPage = 0;
      let currentX = pdfMarginMm;
      let currentY = pdfMarginMm;
      let pageNumber = 1;

      for (let i = 0; i < generatedDisplayCards.length; i++) {
        const cardItem = generatedDisplayCards[i];
        const cardElementId = `card-preview-${cardItem.uniqueId}`;
        const cardElement = document.getElementById(cardElementId);

        if (!cardElement) {
            console.warn(`Card element not found for ID: ${cardElementId}. Skipping.`);
            toast({
                title: "Render Warning",
                description: `Could not find card element for "${cardItem.data?.cardName || cardItem.uniqueId.substring(0,6)}" to render to PDF. It might have been removed or hidden.`,
                variant: "default"
            });
            continue;
        }

        // Determine actual card dimensions for print based on aspect ratio
        const aspectRatioString = cardItem.template.aspectRatio || TCG_ASPECT_RATIO;
        const ratioParts = aspectRatioString.split(':').map(Number);
        let cardWidthMm = standardPrintCardWidthMm;
        let cardHeightMm;

        if (ratioParts.length === 2 && ratioParts[0] > 0 && ratioParts[1] > 0) {
          cardHeightMm = (standardPrintCardWidthMm / ratioParts[0]) * ratioParts[1];
        } else {
          // Fallback to default TCG proportions if aspect ratio is invalid
          cardHeightMm = (standardPrintCardWidthMm / 63) * 88;
        }
        
        // Recalculate cards per row and rows per page if current card's height makes a difference
        // This is a simplification; true heterogeneous layout is much harder.
        // For now, we assume all cards on a page can fit based on the current card's dimensions.
        const cardsPerRow = Math.max(1, Math.floor((effectivePrintableWidthMm + pdfCardSpacingMm) / (cardWidthMm + pdfCardSpacingMm)));
        const rowsPerPage = Math.max(1, Math.floor((effectivePrintableHeightMm + pdfCardSpacingMm) / (cardHeightMm + pdfCardSpacingMm)));
        const cardsPerPage = cardsPerRow * rowsPerPage;

        if (cardCountOnCurrentPage > 0 && cardCountOnCurrentPage % cardsPerPage === 0) {
          pdf.addPage();
          pageNumber++;
          cardCountOnCurrentPage = 0;
          currentX = pdfMarginMm;
          currentY = pdfMarginMm;
        } else if (currentX + cardWidthMm > selectedPaperSize.widthMm - pdfMarginMm) { // Check if card fits in current row
          currentX = pdfMarginMm; // Move to next row
          currentY += cardHeightMm + pdfCardSpacingMm;
           if (currentY + cardHeightMm > selectedPaperSize.heightMm - pdfMarginMm) { // Check if card fits on current page
             pdf.addPage();
             pageNumber++;
             cardCountOnCurrentPage = 0;
             currentX = pdfMarginMm;
             currentY = pdfMarginMm;
           }
        }
        
        const canvas = await html2canvas(cardElement, {
          scale: 3, // Increased scale for better PDF quality
          useCORS: true,
          logging: false,
          backgroundColor: null, // Ensure transparency is handled if card backgrounds are transparent
          ignoreElements: (element) => {
            return element.getAttribute('data-html2canvas-ignore') === 'true';
          },
        });
        const imgData = canvas.toDataURL('image/png');

        pdf.addImage(imgData, 'PNG', currentX, currentY, cardWidthMm, cardHeightMm);

        if (pdfIncludeCutLines) {
          pdf.setDrawColor(180, 180, 180); 
          pdf.setLineWidth(0.1);
          // Draw slightly outset cut lines if spacing is 0, or around the card if spacing > 0
          const cutOffset = pdfCardSpacingMm > 0 ? 0 : -0.5; // small outset if no spacing
          const cutLength = 3; // length of the cut marks in mm

          // Top-left
          pdf.line(currentX + cutOffset - cutLength, currentY + cutOffset, currentX + cutOffset, currentY + cutOffset);
          pdf.line(currentX + cutOffset, currentY + cutOffset - cutLength, currentX + cutOffset, currentY + cutOffset);
          // Top-right
          pdf.line(currentX + cardWidthMm - cutOffset + cutLength, currentY + cutOffset, currentX + cardWidthMm - cutOffset, currentY + cutOffset);
          pdf.line(currentX + cardWidthMm - cutOffset, currentY + cutOffset - cutLength, currentX + cardWidthMm - cutOffset, currentY + cutOffset);
          // Bottom-left
          pdf.line(currentX + cutOffset - cutLength, currentY + cardHeightMm - cutOffset, currentX + cutOffset, currentY + cardHeightMm - cutOffset);
          pdf.line(currentX + cutOffset, currentY + cardHeightMm - cutOffset + cutLength, currentX + cutOffset, currentY + cardHeightMm - cutOffset);
          // Bottom-right
          pdf.line(currentX + cardWidthMm - cutOffset + cutLength, currentY + cardHeightMm - cutOffset, currentX + cardWidthMm - cutOffset, currentY + cardHeightMm - cutOffset);
          pdf.line(currentX + cardWidthMm - cutOffset, currentY + cardHeightMm - cutOffset + cutLength, currentX + cardWidthMm - cutOffset, currentY + cardHeightMm - cutOffset);

          // If no spacing, also draw the box for clarity of card edge, otherwise assume spacing provides visual separation.
          if (pdfCardSpacingMm === 0) {
             pdf.rect(currentX, currentY, cardWidthMm, cardHeightMm);
          }
        }
        
        cardCountOnCurrentPage++;
        currentX += cardWidthMm + pdfCardSpacingMm;
      }
      pdf.save('tcg-cards.pdf');
      toast({ title: "PDF Saved", description: "tcg-cards.pdf has been downloaded." });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({ title: "PDF Generation Failed", description: `An error occurred: ${(error as Error).message}`, variant: "destructive" });
    } finally {
      setIsLoadingPdf(false);
    }
  };

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
