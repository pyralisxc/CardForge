import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

import { renderCardToCanvasWithProfile } from '@/lib/cardPreviewExport';
import { downloadBytes } from '@/lib/browserDownload';
import { getExportProfile, type ExportMode, type ExportProfile } from '@/lib/printValidation';
import type { CardFace, DisplayCard, PaperSize, PdfDuplexLayout } from '@/types';
import {
  createPdfPlacementPages,
  getPdfModeSlug,
  getPdfSafeName,
  getPdfTotalChunks,
  MAX_PDF_CARDS_PER_FILE,
  MM_TO_POINTS,
  type PdfCardPlacement,
} from '@/lib/pdfExportLayout';

export interface PdfExportOptions {
  generatedDisplayCards: DisplayCard[];
  selectedPaperSize: PaperSize;
  pdfMarginMm: number;
  pdfCardSpacingMm: number;
  pdfIncludeCutLines: boolean;
  pdfDuplexLayout: PdfDuplexLayout;
  exportMode: ExportMode;
  exportDpi: number;
  templateName?: string;
  onChunkStart?: (chunk: {
    chunkIndex: number;
    totalChunks: number;
    chunkStart: number;
    chunkEnd: number;
  }) => void;
}

export interface PdfExportResult {
  fileNames: string[];
  pdfModeSlug: string;
  safeName: string;
  timestamp: string;
  totalChunks: number;
}

export async function exportGeneratedCardsToPdf(options: PdfExportOptions): Promise<PdfExportResult> {
  const totalChunks = getPdfTotalChunks(options.generatedDisplayCards.length);
  const safeName = getPdfSafeName(
    options.templateName,
    options.generatedDisplayCards[0]?.template?.name || 'tcg-cards'
  );
  const pdfModeSlug = getPdfModeSlug(options.exportMode, options.pdfDuplexLayout);
  const timestamp = new Date().toISOString().slice(0, 10);
  const exportProfile = getExportProfile(options.exportMode, options.exportDpi);
  const fileNames: string[] = [];

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const chunkStart = chunkIndex * MAX_PDF_CARDS_PER_FILE;
    const chunkEnd = Math.min(chunkStart + MAX_PDF_CARDS_PER_FILE, options.generatedDisplayCards.length);
    const chunkCards = options.generatedDisplayCards.slice(chunkStart, chunkEnd);
    options.onChunkStart?.({ chunkIndex, totalChunks, chunkStart, chunkEnd });

    const pdfBytes = await buildPdfChunk(chunkCards, exportProfile, options);
    const chunkSuffix = totalChunks > 1 ? `-part-${chunkIndex + 1}-of-${totalChunks}` : '';
    const fileName = `${safeName}-${pdfModeSlug}-${timestamp}${chunkSuffix}.pdf`;
    downloadBytes(pdfBytes, fileName, 'application/pdf');
    fileNames.push(fileName);

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }

  return { fileNames, pdfModeSlug, safeName, timestamp, totalChunks };
}

async function buildPdfChunk(
  cards: DisplayCard[],
  exportProfile: ExportProfile,
  options: PdfExportOptions
) {
  const pageSizePt: [number, number] = [
    options.selectedPaperSize.widthMm * MM_TO_POINTS,
    options.selectedPaperSize.heightMm * MM_TO_POINTS,
  ];
  const pdf = await PDFDocument.create();
  const errorFont = await pdf.embedFont(StandardFonts.Helvetica);
  let pdfPage = pdf.addPage(pageSizePt);

  const effectivePrintableWidthMm = options.selectedPaperSize.widthMm - 2 * options.pdfMarginMm;
  const effectivePrintableHeightMm = options.selectedPaperSize.heightMm - 2 * options.pdfMarginMm;
  const placementOptions = {
    printableWidthMm: effectivePrintableWidthMm,
    printableHeightMm: effectivePrintableHeightMm,
    marginMm: options.pdfMarginMm,
    spacingMm: options.pdfCardSpacingMm,
  };

  if (options.exportMode === 'physical' && options.pdfDuplexLayout === 'separate-pages') {
    const frontPages = createPdfPlacementPages(cards, { ...placementOptions, forcedFace: 'front' });
    for (let pageIndex = 0; pageIndex < frontPages.length; pageIndex++) {
      if (pageIndex > 0) pdfPage = pdf.addPage(pageSizePt);
      await processPage(pdf, pdfPage, frontPages[pageIndex], exportProfile, errorFont, options);

      const backPage = frontPages[pageIndex]
        .filter((placement) => placement.card.template.backCanvas)
        .map((placement) => ({ ...placement, face: 'back' as const }));
      if (backPage.length > 0) {
        pdfPage = pdf.addPage(pageSizePt);
        await processPage(pdf, pdfPage, backPage, exportProfile, errorFont, options);
      }
    }
  } else {
    const faceItems = cards.flatMap((cardItem) => (
      cardItem.template.backCanvas
        ? [{ card: cardItem, face: 'front' as const }, { card: cardItem, face: 'back' as const }]
        : [{ card: cardItem, face: 'front' as const }]
    ));
    const facePages = createPdfPlacementPages(faceItems, placementOptions);
    for (let pageIndex = 0; pageIndex < facePages.length; pageIndex++) {
      if (pageIndex > 0) pdfPage = pdf.addPage(pageSizePt);
      await processPage(pdf, pdfPage, facePages[pageIndex], exportProfile, errorFont, options);
    }
  }

  return pdf.save();
}

async function processPage(
  pdf: PDFDocument,
  pdfPage: PDFPage,
  pageCards: PdfCardPlacement[],
  exportProfile: ExportProfile,
  errorFont: PDFFont,
  options: PdfExportOptions
) {
  let renderErrorCount = 0;

  for (const { card, face, x, y, w, h } of pageCards) {
    try {
      const canvas = await renderCardToCanvasWithProfile(card, exportProfile, face);
      const pngBytes = await canvasToPngBytes(canvas);
      const embeddedImage = await pdf.embedPng(pngBytes);
      pdfPage.drawImage(embeddedImage, {
        x: toPt(x),
        y: toPdfY(pdfPage, y, h),
        width: toPt(w),
        height: toPt(h),
      });
      if (options.pdfIncludeCutLines) drawCutLines(pdfPage, x, y, w, h, options);
    } catch (error) {
      renderErrorCount += 1;
      if (renderErrorCount <= 5) {
        console.warn('Error processing card for PDF:', card.uniqueId, error);
      }
      pdfPage.drawText(`Error rendering: ${card.uniqueId.substring(0, 5)}`, {
        x: toPt(x),
        y: toPdfY(pdfPage, y + h / 2, 4),
        size: 8,
        font: errorFont,
        color: rgb(0.8, 0.1, 0.1),
      });
    }
  }

  if (renderErrorCount > 0) {
    console.warn(`PDF page completed with ${renderErrorCount} render error(s).`);
  }
}

function drawCutLines(
  pdfPage: PDFPage,
  x: number,
  y: number,
  w: number,
  h: number,
  options: PdfExportOptions
) {
  const cutOffset = options.pdfCardSpacingMm === 0 ? 0.2 : 0;
  const cutLength = options.pdfCardSpacingMm === 0 ? 2 : 3;
  const lineColor = rgb(180 / 255, 180 / 255, 180 / 255);
  const lineWidth = toPt(0.1);

  drawPdfLine(pdfPage, x - cutLength + cutOffset, y + cutOffset, x + cutOffset, y + cutOffset, lineColor, lineWidth);
  drawPdfLine(pdfPage, x + cutOffset, y - cutLength + cutOffset, x + cutOffset, y + cutOffset, lineColor, lineWidth);
  drawPdfLine(pdfPage, x + w + cutLength - cutOffset, y + cutOffset, x + w - cutOffset, y + cutOffset, lineColor, lineWidth);
  drawPdfLine(pdfPage, x + w - cutOffset, y - cutLength + cutOffset, x + w - cutOffset, y + cutOffset, lineColor, lineWidth);
  drawPdfLine(pdfPage, x - cutLength + cutOffset, y + h - cutOffset, x + cutOffset, y + h - cutOffset, lineColor, lineWidth);
  drawPdfLine(pdfPage, x + cutOffset, y + h + cutLength - cutOffset, x + cutOffset, y + h - cutOffset, lineColor, lineWidth);
  drawPdfLine(pdfPage, x + w + cutLength - cutOffset, y + h - cutOffset, x + w - cutOffset, y + h - cutOffset, lineColor, lineWidth);
  drawPdfLine(pdfPage, x + w - cutOffset, y + h + cutLength - cutOffset, x + w - cutOffset, y + h - cutOffset, lineColor, lineWidth);

  if (options.pdfCardSpacingMm === 0 && options.pdfIncludeCutLines) {
    pdfPage.drawRectangle({
      x: toPt(x),
      y: toPdfY(pdfPage, y, h),
      width: toPt(w),
      height: toPt(h),
      borderColor: rgb(200 / 255, 200 / 255, 200 / 255),
      borderWidth: toPt(0.1),
    });
  }
}

function toPt(valueMm: number) {
  return valueMm * MM_TO_POINTS;
}

function toPdfY(pdfPage: PDFPage, topYmm: number, heightMm: number) {
  return pdfPage.getHeight() - toPt(topYmm + heightMm);
}

function drawPdfLine(
  pdfPage: PDFPage,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: ReturnType<typeof rgb>,
  thickness: number
) {
  pdfPage.drawLine({
    start: { x: toPt(x1), y: pdfPage.getHeight() - toPt(y1) },
    end: { x: toPt(x2), y: pdfPage.getHeight() - toPt(y2) },
    color,
    thickness,
  });
}

async function canvasToPngBytes(canvas: HTMLCanvasElement) {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Card canvas did not produce a PNG for PDF export.');
  return new Uint8Array(await blob.arrayBuffer());
}
