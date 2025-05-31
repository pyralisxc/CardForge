
"use client";

import { useState } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { DisplayCard, PaperSize } from '@/types';
import { Button } from '@/components/ui/button';
import { Loader2, FileDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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

      const cardWidthMm = 63;
      const cardHeightMm = 88;

      const effectivePrintableWidthMm = selectedPaperSize.widthMm - 2 * pdfMarginMm;
      const effectivePrintableHeightMm = selectedPaperSize.heightMm - 2 * pdfMarginMm;

      // Adjust for card spacing when calculating cards per row/page
      const cardsPerRow = Math.max(1, Math.floor((effectivePrintableWidthMm + pdfCardSpacingMm) / (cardWidthMm + pdfCardSpacingMm)));
      const rowsPerPage = Math.max(1, Math.floor((effectivePrintableHeightMm + pdfCardSpacingMm) / (cardHeightMm + pdfCardSpacingMm)));
      const cardsPerPage = cardsPerRow * rowsPerPage;


      if (cardsPerPage === 0 || cardWidthMm > effectivePrintableWidthMm || cardHeightMm > effectivePrintableHeightMm) {
        toast({
          title: "Layout Error",
          description: `Paper size or margins too small for cards. Card: ${cardWidthMm}x${cardHeightMm}mm, Printable: ${effectivePrintableWidthMm.toFixed(1)}x${effectivePrintableHeightMm.toFixed(1)}mm (with ${pdfMarginMm}mm margins). Spacing: ${pdfCardSpacingMm}mm.`,
          variant: "destructive",
          duration: 7000,
        });
        setIsLoadingPdf(false);
        return;
      }

      let cardCountOnCurrentPage = 0;
      let currentX = pdfMarginMm;
      let currentY = pdfMarginMm;

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
        
        if (cardCountOnCurrentPage > 0 && cardCountOnCurrentPage % cardsPerPage === 0) {
          pdf.addPage();
          cardCountOnCurrentPage = 0;
          currentX = pdfMarginMm;
          currentY = pdfMarginMm;
        } else if (cardCountOnCurrentPage > 0 && cardCountOnCurrentPage % cardsPerRow === 0) {
          // New row on the same page
          currentX = pdfMarginMm;
          currentY += cardHeightMm + pdfCardSpacingMm;
           // Check if new row overflows page
           if (currentY + cardHeightMm > selectedPaperSize.heightMm - pdfMarginMm) {
             pdf.addPage();
             cardCountOnCurrentPage = 0;
             currentX = pdfMarginMm;
             currentY = pdfMarginMm;
           }
        }


        const canvas = await html2canvas(cardElement, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: null,
        });
        const imgData = canvas.toDataURL('image/png');

        pdf.addImage(imgData, 'PNG', currentX, currentY, cardWidthMm, cardHeightMm);

        if (pdfIncludeCutLines) {
          pdf.setDrawColor(180, 180, 180); // Light grey for cut lines
          pdf.setLineWidth(0.1);
          // Outer box exactly around the card
          pdf.rect(currentX, currentY, cardWidthMm, cardHeightMm);
        }
        
        cardCountOnCurrentPage++;
        if (i < generatedDisplayCards.length - 1) { // Don't advance cursor if it's the last card
            if (cardCountOnCurrentPage % cardsPerRow !== 0) { // More cards in this row
                 currentX += cardWidthMm + pdfCardSpacingMm;
            }
            // Logic for moving to next row or page is handled at the start of the loop for the *next* card
        }
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
