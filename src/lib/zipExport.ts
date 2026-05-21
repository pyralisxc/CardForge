"use client";

import { downloadBlob } from '@/lib/browserDownload';
import { createCardFaceExportRenderer } from '@/lib/cardPreviewExport';
import { getExportProfile, type ExportMode } from '@/lib/printValidation';
import { createBlobZipArchive } from '@/lib/zipArchive';
import { createZipExportManifest, getZipExportLabels } from '@/lib/zipExportLayout';
import type { DisplayCard } from '@/types';

export interface ZipExportOptions {
  generatedDisplayCards: DisplayCard[];
  exportMode: ExportMode;
  exportDpi: number;
  onProgress?: (progress: { done: number; total: number }) => void;
}

export interface ZipExportResult {
  fileName: string;
  outputLabel: string;
  totalFaces: number;
}

export async function exportGeneratedCardsToZip({
  generatedDisplayCards,
  exportMode,
  exportDpi,
  onProgress,
}: ZipExportOptions): Promise<ZipExportResult> {
  const exportItems = createZipExportManifest(generatedDisplayCards, exportMode);
  const exportProfile = getExportProfile(exportMode, exportDpi);
  const { fileName, outputLabel } = getZipExportLabels(exportMode);
  const zip = createBlobZipArchive();
  const renderer = createCardFaceExportRenderer(exportProfile);

  onProgress?.({ done: 0, total: exportItems.length });

  try {
    for (let index = 0; index < exportItems.length; index++) {
      const { card, face, path } = exportItems[index];
      const blob = await renderer.renderToBlob(card, face);
      await zip.addBlob(path, blob);
      onProgress?.({ done: index + 1, total: exportItems.length });
    }
  } finally {
    renderer.cleanup();
  }

  const content = await zip.close();
  downloadBlob(content, fileName);

  return {
    fileName,
    outputLabel,
    totalFaces: exportItems.length,
  };
}
