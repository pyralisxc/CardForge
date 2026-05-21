import { getCardExportDimensionsPx } from '@/lib/cardExportGeometry';
import { getPdfTotalChunks } from '@/lib/pdfExportLayout';
import { getZipExportFaceCount } from '@/lib/zipExportLayout';
import type {
  ExportArtifactType,
  ExportJobDurationClass,
  ExportJobPreflight,
  ExportJobRequest,
  ExportJobWarning,
} from '@/lib/exportJobTypes';
import type { DisplayCard } from '@/types';

const BASELINE_PRINT_ZIP_BYTES_PER_FACE_AT_300_DPI = 290_000;
const BASELINE_DIGITAL_BYTES_PER_FACE_AT_300_DPI = 180_000;
const BASELINE_PDF_BYTES_PER_FACE_AT_300_DPI = 230_000;
const WORKER_SECONDS_PER_PRINT_FACE_AT_300_DPI = 0.16;
const WORKER_SECONDS_PER_DIGITAL_FACE_AT_300_DPI = 0.1;
const PRODUCTION_FACE_THRESHOLD = 1_000;

const durationClassForSeconds = (seconds: number, faceCount: number): ExportJobDurationClass => {
  if (faceCount >= 2_000) return 'production';
  if (seconds >= 300) return 'production';
  if (seconds >= 90) return 'long';
  if (seconds >= 25) return 'medium';
  return 'short';
};

const countMissingBackFaces = (cards: DisplayCard[]): number =>
  cards.filter((card) => !card.template.backCanvas).length;

const estimateBytesPerFace = (artifactType: ExportArtifactType, exportMode: ExportJobRequest['exportMode']): number => {
  if (artifactType === 'pdf') return BASELINE_PDF_BYTES_PER_FACE_AT_300_DPI;
  return exportMode === 'physical'
    ? BASELINE_PRINT_ZIP_BYTES_PER_FACE_AT_300_DPI
    : BASELINE_DIGITAL_BYTES_PER_FACE_AT_300_DPI;
};

export function buildExportJobPreflight(request: ExportJobRequest): ExportJobPreflight {
  const firstCard = request.cards[0];
  const dimensionsPx = firstCard
    ? getCardExportDimensionsPx(firstCard, request.exportDpi)
    : { widthPx: 0, heightPx: 0 };
  const faceCount = getZipExportFaceCount(request.cards);
  const dpiScale = Math.max(0.1, (request.exportDpi / 300) ** 2);
  const bytesPerFace = estimateBytesPerFace(request.artifactType, request.exportMode);
  const estimatedBytes = Math.round(faceCount * bytesPerFace * dpiScale);
  const secondsPerFace = request.exportMode === 'physical'
    ? WORKER_SECONDS_PER_PRINT_FACE_AT_300_DPI
    : WORKER_SECONDS_PER_DIGITAL_FACE_AT_300_DPI;
  const estimatedSeconds = Math.max(1, Math.round(faceCount * secondsPerFace * dpiScale));
  const warnings: ExportJobWarning[] = [];
  const missingBackCount = countMissingBackFaces(request.cards);

  if (request.exportMode === 'physical' && missingBackCount > 0) {
    warnings.push({
      code: 'missing-back-face',
      severity: 'warning',
      message: `${missingBackCount} card${missingBackCount === 1 ? '' : 's'} do not have a back face and will export front-only.`,
    });
  }

  if (faceCount >= PRODUCTION_FACE_THRESHOLD) {
    warnings.push({
      code: 'large-job',
      severity: 'info',
      message: `${faceCount} faces will run through the export worker so the browser stays usable.`,
    });
  }

  if (request.exportDpi > 300) {
    warnings.push({
      code: 'high-dpi',
      severity: 'warning',
      message: `${request.exportDpi} DPI greatly increases render time and artifact size. Use 300 DPI unless a printer requests more.`,
    });
  }

  const pdfChunks = request.artifactType === 'pdf' ? getPdfTotalChunks(request.cards.length) : 1;
  if (pdfChunks > 1) {
    warnings.push({
      code: 'pdf-chunking',
      severity: 'info',
      message: `PDF output will be split into ${pdfChunks} production chunks.`,
    });
  }

  return {
    cardCount: request.cards.length,
    faceCount,
    dimensionsPx,
    estimatedBytes,
    estimatedSeconds,
    durationClass: durationClassForSeconds(estimatedSeconds, faceCount),
    warnings,
    profile: {
      artifactType: request.artifactType,
      exportMode: request.exportMode,
      exportDpi: request.exportDpi,
      paperSize: request.paperSize,
      pdfMarginMm: request.pdfMarginMm,
      pdfCardSpacingMm: request.pdfCardSpacingMm,
      pdfIncludeCutLines: request.pdfIncludeCutLines,
      pdfDuplexLayout: request.pdfDuplexLayout,
    },
  };
}
