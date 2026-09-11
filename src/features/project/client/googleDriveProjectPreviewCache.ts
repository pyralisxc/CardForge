"use client";

import type { GoogleDriveProjectSummary } from '../model/googleDriveProject';

type CachedDrivePreview = {
  projectRevision: string | null;
  providerRevision: string;
  dataUrl: string;
};

const MAX_CACHED_DRIVE_PREVIEWS = 12;
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
  // Refresh insertion order so the small memory cache behaves like an LRU.
  previewByFileId.delete(summary.fileId);
  previewByFileId.set(summary.fileId, {
    projectRevision: summary.projectRevision,
    providerRevision: summary.providerRevision,
    dataUrl,
  });
  while (previewByFileId.size > MAX_CACHED_DRIVE_PREVIEWS) {
    const oldest = previewByFileId.keys().next().value;
    if (typeof oldest !== 'string') break;
    previewByFileId.delete(oldest);
  }
};

export const getCachedGoogleDriveProjectPreview = (
  summary: Pick<GoogleDriveProjectSummary, 'fileId' | 'projectRevision' | 'providerRevision'>,
): string | null => {
  const cached = previewByFileId.get(summary.fileId);
  if (!cached) return null;
  if (!matchesSummary(cached, summary)) {
    // Revision changes make compatibility pixels stale by definition.
    previewByFileId.delete(summary.fileId);
    return null;
  }
  previewByFileId.delete(summary.fileId);
  previewByFileId.set(summary.fileId, cached);
  return cached.dataUrl;
};

export const clearCachedGoogleDriveProjectPreviews = (): void => {
  previewByFileId.clear();
};
