import { Uint8ArrayReader, Uint8ArrayWriter, ZipWriter } from '@zip.js/zip.js';
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib';

import { getExportProfile } from '@/lib/printValidation';
import {
  createPdfPlacementPages,
  getPdfModeSlug,
  getPdfSafeName,
  MM_TO_POINTS,
  type PdfCardPlacement,
} from '@/lib/pdfExportLayout';
import { renderCardFaceToPng } from '@/lib/server/serverCardRenderer';
import { exportJobStore, type ExportJobStore } from '@/lib/server/exportJobStore';
import { createZipExportManifest, getZipExportLabels } from '@/lib/zipExportLayout';
import type { CardFace, DisplayCard } from '@/types';
import type { ExportJobRecord } from '@/lib/exportJobTypes';

interface ProcessExportJobOptions {
  store?: ExportJobStore;
}

export async function processNextExportJob(options: ProcessExportJobOptions = {}): Promise<ExportJobRecord | null> {
  const store = options.store || exportJobStore;
  const [job] = await store.listQueued();
  if (!job) return null;
  return processExportJob(job.id, { store });
}

export async function processExportJob(
  jobId: string,
  options: ProcessExportJobOptions = {}
): Promise<ExportJobRecord> {
  const store = options.store || exportJobStore;
  const running = await store.markRunning(jobId);
  if (!running) {
    const existing = await store.get(jobId);
    if (!existing) throw new Error(`Export job ${jobId} was not found.`);
    return existing;
  }

  try {
    const cancelled = await store.cancelIfRequested(jobId);
    if (cancelled?.status === 'cancelled') return cancelled;

    const completed = running.artifactType === 'zip'
      ? await processZipJob(running, store)
      : await processPdfJob(running, store);
    return completed;
  } catch (error) {
    const failed = await store.fail(jobId, (error as Error).message);
    if (!failed) throw error;
    return failed;
  }
}

async function processZipJob(job: ExportJobRecord, store: ExportJobStore): Promise<ExportJobRecord> {
  const exportItems = createZipExportManifest(job.cards, job.exportMode);
  const labels = getZipExportLabels(job.exportMode);
  const zip = new ZipWriter(new Uint8ArrayWriter(), { bufferedWrite: true });

  await store.updateProgress(job.id, { done: 0, total: exportItems.length, label: 'Rendering PNG faces' });

  for (let index = 0; index < exportItems.length; index++) {
    const cancel = await store.cancelIfRequested(job.id);
    if (cancel?.status === 'cancelled') return cancel;

    const { card, face, path } = exportItems[index];
    const rendered = await renderCardFaceToPng(card, face, job.exportDpi);
    await zip.add(path, new Uint8ArrayReader(rendered.bytes));
    await store.updateProgress(job.id, {
      done: index + 1,
      total: exportItems.length,
      label: `Rendered ${face} face for ${card.data.cardName || card.uniqueId}`,
    });
  }

  const bytes = await zip.close();
  return store.complete(
    job.id,
    {
      fileName: labels.fileName,
      contentType: 'application/zip',
    },
    bytes
  );
}

async function processPdfJob(job: ExportJobRecord, store: ExportJobStore): Promise<ExportJobRecord> {
  const pdfBytes = await buildWorkerPdf(job, store);
  const safeName = getPdfSafeName(job.cards[0]?.template?.name || 'tcg-cards');
  const modeSlug = getPdfModeSlug(job.exportMode, job.pdfDuplexLayout);
  const timestamp = new Date().toISOString().slice(0, 10);

  return store.complete(
    job.id,
    {
      fileName: `${safeName}-${modeSlug}-${timestamp}.pdf`,
      contentType: 'application/pdf',
    },
    pdfBytes
  );
}

async function buildWorkerPdf(job: ExportJobRecord, store: ExportJobStore): Promise<Uint8Array> {
  const pageSizePt: [number, number] = [
    job.paperSize.widthMm * MM_TO_POINTS,
    job.paperSize.heightMm * MM_TO_POINTS,
  ];
  const pdf = await PDFDocument.create();
  const errorFont = await pdf.embedFont(StandardFonts.Helvetica);
  const placementOptions = {
    printableWidthMm: job.paperSize.widthMm - 2 * job.pdfMarginMm,
    printableHeightMm: job.paperSize.heightMm - 2 * job.pdfMarginMm,
    marginMm: job.pdfMarginMm,
    spacingMm: job.pdfCardSpacingMm,
  };
  const pages = createPdfPages(job.cards, job.exportMode, job.pdfDuplexLayout, placementOptions);
  const totalFaces = pages.reduce((count, page) => count + page.length, 0);
  let completedFaces = 0;

  await store.updateProgress(job.id, { done: 0, total: totalFaces, label: 'Building PDF pages' });

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    const cancel = await store.cancelIfRequested(job.id);
    if (cancel?.status === 'cancelled') throw new Error('Export job was cancelled.');

    const page = pdf.addPage(pageSizePt);
    const pageCards = pages[pageIndex];
    for (const placement of pageCards) {
      await drawPlacement(pdf, page, placement, job, errorFont);
      completedFaces += 1;
      await store.updateProgress(job.id, {
        done: completedFaces,
        total: totalFaces,
        label: `Rendered PDF page ${pageIndex + 1} of ${pages.length}`,
      });
    }
  }

  return pdf.save();
}

function createPdfPages(
  cards: DisplayCard[],
  exportMode: ExportJobRecord['exportMode'],
  pdfDuplexLayout: ExportJobRecord['pdfDuplexLayout'],
  placementOptions: {
    printableWidthMm: number;
    printableHeightMm: number;
    marginMm: number;
    spacingMm: number;
  }
): PdfCardPlacement[][] {
  if (exportMode === 'physical' && pdfDuplexLayout === 'separate-pages') {
    const frontPages = createPdfPlacementPages(cards, { ...placementOptions, forcedFace: 'front' });
    return frontPages.flatMap((frontPage) => {
      const backPage = frontPage
        .filter((placement) => placement.card.template.backCanvas)
        .map((placement) => ({ ...placement, face: 'back' as CardFace }));
      return backPage.length > 0 ? [frontPage, backPage] : [frontPage];
    });
  }

  const faceItems = cards.flatMap((card) => (
    card.template.backCanvas
      ? [{ card, face: 'front' as CardFace }, { card, face: 'back' as CardFace }]
      : [{ card, face: 'front' as CardFace }]
  ));
  return createPdfPlacementPages(faceItems, placementOptions);
}

async function drawPlacement(
  pdf: PDFDocument,
  page: PDFPage,
  placement: PdfCardPlacement,
  job: ExportJobRecord,
  errorFont: PDFFont
) {
  try {
    const profile = getExportProfile(job.exportMode, job.exportDpi);
    const rendered = await renderCardFaceToPng(placement.card, placement.face, profile.dpi);
    const image = await pdf.embedPng(rendered.bytes);
    page.drawImage(image, {
      x: toPt(placement.x),
      y: toPdfY(page, placement.y, placement.h),
      width: toPt(placement.w),
      height: toPt(placement.h),
    });
    if (job.pdfIncludeCutLines) drawCutLines(page, placement, job);
  } catch (error) {
    page.drawText(`Render error: ${placement.card.uniqueId.slice(0, 8)}`, {
      x: toPt(placement.x),
      y: toPdfY(page, placement.y + placement.h / 2, 4),
      size: 8,
      font: errorFont,
      color: rgb(0.8, 0.1, 0.1),
    });
  }
}

function drawCutLines(page: PDFPage, placement: PdfCardPlacement, job: ExportJobRecord) {
  const { x, y, w, h } = placement;
  const cutOffset = job.pdfCardSpacingMm === 0 ? 0.2 : 0;
  const cutLength = job.pdfCardSpacingMm === 0 ? 2 : 3;
  const lineColor = rgb(180 / 255, 180 / 255, 180 / 255);
  const lineWidth = toPt(0.1);

  drawPdfLine(page, x - cutLength + cutOffset, y + cutOffset, x + cutOffset, y + cutOffset, lineColor, lineWidth);
  drawPdfLine(page, x + cutOffset, y - cutLength + cutOffset, x + cutOffset, y + cutOffset, lineColor, lineWidth);
  drawPdfLine(page, x + w + cutLength - cutOffset, y + cutOffset, x + w - cutOffset, y + cutOffset, lineColor, lineWidth);
  drawPdfLine(page, x + w - cutOffset, y - cutLength + cutOffset, x + w - cutOffset, y + cutOffset, lineColor, lineWidth);
  drawPdfLine(page, x - cutLength + cutOffset, y + h - cutOffset, x + cutOffset, y + h - cutOffset, lineColor, lineWidth);
  drawPdfLine(page, x + cutOffset, y + h + cutLength - cutOffset, x + cutOffset, y + h - cutOffset, lineColor, lineWidth);
  drawPdfLine(page, x + w + cutLength - cutOffset, y + h - cutOffset, x + w - cutOffset, y + h - cutOffset, lineColor, lineWidth);
  drawPdfLine(page, x + w - cutOffset, y + h + cutLength - cutOffset, x + w - cutOffset, y + h - cutOffset, lineColor, lineWidth);
}

function toPt(valueMm: number) {
  return valueMm * MM_TO_POINTS;
}

function toPdfY(page: PDFPage, topYmm: number, heightMm: number) {
  return page.getHeight() - toPt(topYmm + heightMm);
}

function drawPdfLine(
  page: PDFPage,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: ReturnType<typeof rgb>,
  thickness: number
) {
  page.drawLine({
    start: { x: toPt(x1), y: page.getHeight() - toPt(y1) },
    end: { x: toPt(x2), y: page.getHeight() - toPt(y2) },
    color,
    thickness,
  });
}
