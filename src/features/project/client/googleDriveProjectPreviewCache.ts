"use client";

import type { GoogleDriveProjectSummary } from '../model/googleDriveProject';

type CachedDrivePreview = {
  projectRevision: string | null;
  providerRevision: string;
  dataUrl: string;
};

const previewByFileId = new Map<string, CachedDrivePreview>();

const matchesSummary = (cached: CachedDrivePreview, summary: Pick<GoogleDriveProjectSummary, 'projectRevision' | 'providerRevision'>) => (
  cached.projectRevision === summary.projectRevision
  && cached.providerRevision === summary.providerRevision
);

/**
 * Browser-only visual cache for a Drive project that predates CardForge's
 * native Drive thumbnail metadata. This never represents editable work and
 * never becomes a second project/storage owner.
 */
export const cacheGoogleDriveProjectPreview = (
  summary: Pick<GoogleDriveProjectSummary, 'fileId' | 'projectRevision' | 'providerRevision'>,
  dataUrl: string,
): void => {
  if (!dataUrl.startsWith('data:image/png;base64,')) return;
  previewByFileId.set(summary.fileId, {
    projectRevision: summary.projectRevision,
    providerRevision: summary.providerRevision,
    dataUrl,
  });
};

export const getCachedGoogleDriveProjectPreview = (
  summary: Pick<GoogleDriveProjectSummary, 'fileId' | 'projectRevision' | 'providerRevision'>,
): string | null => {
  const cached = previewByFileId.get(summary.fileId);
  if (!cached || !matchesSummary(cached, summary)) return null;
  return cached.dataUrl;
};

export const clearCachedGoogleDriveProjectPreviews = (): void => {
  previewByFileId.clear();
};
