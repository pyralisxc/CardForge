
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
  disabled?: boolean;
}

export function SaveAsPdfButton({
  generatedDisplayCards,
  selectedPaperSize,
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
      const marginMm = 10;

      const printableWidthMm = selectedPaperSize.widthMm - 2 * marginMm;
      const printableHeightMm = selectedPaperSize.heightMm - 2 * marginMm;

      const cardsPerRow = Math.floor(printableWidthMm / cardWidthMm);
      const rowsPerPage = Math.floor(printableHeightMm / cardHeightMm);
      const cardsPerPage = cardsPerRow * rowsPerPage;

      if (cardsPerPage === 0) {
        toast({
          title: "Layout Error",
          description: `Paper size too small for cards with margin ${marginMm}mm. Try a larger paper size.`,
          variant: "destructive",
        });
        setIsLoadingPdf(false);
        return;
      }
      
      let cardCountOnCurrentPage = 0;
      let currentX = marginMm;
      let currentY = marginMm;

      for (let i = 0; i < generatedDisplayCards.length; i++) {
        const cardItem = generatedDisplayCards[i];
        const cardElement = document.getElementById(`card-preview-${cardItem.uniqueId}`);

        if (cardElement) {
          const canvas = await html2canvas(cardElement, {
            scale: 2, // Capture at higher resolution
            useCORS: true,
            logging: false,
            backgroundColor: null, // Attempt to preserve transparency
          });
          const imgData = canvas.toDataURL('image/png');

          if (cardCountOnCurrentPage >= cardsPerPage) {
            pdf.addPage();
            cardCountOnCurrentPage = 0;
            currentX = marginMm;
            currentY = marginMm;
          }
          
          // Check if adding this card would overflow vertically on the current row
          // If so, and it's not the first card in the row, move to next row
          if (currentX + cardWidthMm > selectedPaperSize.widthMm - marginMm && cardCountOnCurrentPage % cardsPerRow !== 0) {
             currentX = marginMm;
             currentY += cardHeightMm;
             // If this new row would also overflow the page, start a new page
             if (currentY + cardHeightMm > selectedPaperSize.heightMm - marginMm) {
                pdf.addPage();
                cardCountOnCurrentPage = 0; // Reset for the new page
                currentX = marginMm;
                currentY = marginMm;
             }
          }


          pdf.addImage(imgData, 'PNG', currentX, currentY, cardWidthMm, cardHeightMm);
          cardCountOnCurrentPage++;

          currentX += cardWidthMm;
          // If current row is full, move to the next row
          if (cardCountOnCurrentPage % cardsPerRow === 0 && cardCountOnCurrentPage > 0) {
            currentX = marginMm;
            currentY += cardHeightMm;
            
            // If starting a new row would overflow page, start a new page instead
            // (but only if there are more cards to print)
            if (currentY + cardHeightMm > selectedPaperSize.heightMm - marginMm && i < generatedDisplayCards.length - 1) {
              pdf.addPage();
              cardCountOnCurrentPage = 0; // Reset for new page
              currentX = marginMm;
              currentY = marginMm;
            }
          }
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
    <Button onClick={handleSaveAsPdf} disabled={disabled || isLoadingPdf} variant="outline">
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
