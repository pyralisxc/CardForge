import type { DisplayCard, PaperSize, PdfDuplexLayout } from '@/types';
import type { ExportMode } from '@/lib/printValidation';

export type ExportArtifactType = 'zip' | 'pdf';
export type ExportJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type ExportJobDurationClass = 'short' | 'medium' | 'long' | 'production';

export interface ExportJobWarning {
  code: 'missing-back-face' | 'large-job' | 'high-dpi' | 'pdf-chunking' | 'clipping-risk';
  severity: 'info' | 'warning' | 'critical';
  message: string;
}

export interface ExportJobPreflight {
  cardCount: number;
  faceCount: number;
  dimensionsPx: {
    widthPx: number;
    heightPx: number;
  };
  estimatedBytes: number;
  estimatedSeconds: number;
  durationClass: ExportJobDurationClass;
  warnings: ExportJobWarning[];
  profile: {
    artifactType: ExportArtifactType;
    exportMode: ExportMode;
    exportDpi: number;
    paperSize: PaperSize;
    pdfMarginMm: number;
    pdfCardSpacingMm: number;
    pdfIncludeCutLines: boolean;
    pdfDuplexLayout: PdfDuplexLayout;
  };
}

export interface ExportJobProgress {
  done: number;
  total: number;
  label?: string;
}

export interface ExportJobArtifact {
  fileName: string;
  contentType: string;
  bytes: number;
  path: string;
}

export interface ExportJobRequest {
  cards: DisplayCard[];
  artifactType: ExportArtifactType;
  exportMode: ExportMode;
  exportDpi: number;
  paperSize: PaperSize;
  pdfMarginMm: number;
  pdfCardSpacingMm: number;
  pdfIncludeCutLines: boolean;
  pdfDuplexLayout: PdfDuplexLayout;
}

export interface ExportJobCreateInput extends ExportJobRequest {
  preflight: ExportJobPreflight;
}

export interface ExportJobRecord extends ExportJobCreateInput {
  id: string;
  status: ExportJobStatus;
  progress: ExportJobProgress;
  warnings: ExportJobWarning[];
  artifact?: ExportJobArtifact;
  error?: string;
  cancelRequested?: boolean;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}
