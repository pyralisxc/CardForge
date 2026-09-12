"use client";

import { useEffect, type ReactNode } from 'react';

import { createGoogleDriveProjectThumbnail } from '@/features/card-generator/client';
import { PROJECT_LIBRARY_CHANGE_EVENT } from '@/features/project/client/assets';
import {
  cacheGoogleDriveProjectPreview,
  loadGoogleDriveProjectLibrary,
  type GoogleDriveProjectSummary,
} from '@/features/project/client/provider-google-drive';
import {
  decodeCardForgeProjectPackage,
  referenceCardForgeProjectSnapshotAssets,
} from '@/features/project/client/package-core';

const MAX_AUTOMATIC_PREVIEW_PROJECTS = 3;
const MAX_AUTOMATIC_PREVIEW_PACKAGE_BYTES = 12 * 1024 * 1024;
const MAX_AUTOMATIC_PREVIEW_TOTAL_BYTES = 24 * 1024 * 1024;

const base64UrlPngToDataUrl = (value: string): string => {
  const base64 = value.replace(/-/gu, '+').replace(/_/gu, '/');
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  return `data:image/png;base64,${base64}${padding}`;
};

const loadTemporaryPreviewDocument = async (project: GoogleDriveProjectSummary, signal: AbortSignal) => {
  const response = await fetch(`/api/project-sources/google-drive/${encodeURIComponent(project.fileId)}`, {
    cache: 'no-store',
    signal,
  });
  if (!response.ok || signal.aborted) return null;

  const responseRevision = response.headers.get('X-CardForge-Project-Revision');
  if (project.projectRevision && responseRevision && responseRevision !== project.projectRevision) return null;

  const snapshot = await decodeCardForgeProjectPackage(await response.blob());
  if (signal.aborted || (project.projectRevision && snapshot.manifest.projectRevision !== project.projectRevision)) return null;

  const urls = new Map<string, string>();
  const release = () => urls.forEach((url) => URL.revokeObjectURL(url));
  try {
    for (const descriptor of snapshot.manifest.assets) {
      if (signal.aborted) {
        release();
        return null;
      }
      const source = snapshot.assets.get(descriptor.id);
      if (!source) {
        release();
        return null;
      }
      const bytes = source instanceof Uint8Array ? source : await source.load();
      if (signal.aborted) {
        release();
        return null;
      }
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      urls.set(descriptor.id, URL.createObjectURL(new Blob([copy.buffer], { type: descriptor.mimeType })));
    }
    return {
      document: referenceCardForgeProjectSnapshotAssets(snapshot, (descriptor) => urls.get(descriptor.id) ?? ''),
      release,
    };
  } catch (error) {
    release();
    throw error;
  }
};

const createCompatibilityPreview = async (project: GoogleDriveProjectSummary, signal: AbortSignal): Promise<string | null> => {
  const temporary = await loadTemporaryPreviewDocument(project, signal);
  if (!temporary) return null;
  try {
    if (signal.aborted) return null;
    const encoded = await createGoogleDriveProjectThumbnail(temporary.document);
    return !signal.aborted && encoded ? base64UrlPngToDataUrl(encoded) : null;
  } finally {
    temporary.release();
  }
};

const automaticPreviewCandidates = (projects: readonly GoogleDriveProjectSummary[]): GoogleDriveProjectSummary[] => {
  const candidates: GoogleDriveProjectSummary[] = [];
  let totalBytes = 0;
  for (const project of projects) {
    if (project.thumbnailLink
      || project.capabilities?.canDownload === false
      || project.size <= 0
      || project.size > MAX_AUTOMATIC_PREVIEW_PACKAGE_BYTES
      || totalBytes + project.size > MAX_AUTOMATIC_PREVIEW_TOTAL_BYTES) continue;
    candidates.push(project);
    totalBytes += project.size;
    if (candidates.length >= MAX_AUTOMATIC_PREVIEW_PROJECTS) break;
  }
  return candidates;
};

const shouldWarmCompatibilityPreviews = (): boolean => {
  if (document.visibilityState === 'hidden') return false;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return connection?.saveData !== true;
};

const warmMissingPreviews = async (signal: AbortSignal): Promise<boolean> => {
  if (signal.aborted || !shouldWarmCompatibilityPreviews()) return false;
  const library = await loadGoogleDriveProjectLibrary();
  if (signal.aborted || !library.connection.connected) return false;

  const candidates = automaticPreviewCandidates(library.projects);
  if (!candidates.length) return false;

  let changed = false;
  // Serialize package reads. Native Drive thumbnails remain the fast path; this
  // compatibility work must stay gentle enough for a phone or metered network.
  for (const project of candidates) {
    if (signal.aborted) break;
    try {
      const dataUrl = await createCompatibilityPreview(project, signal);
      if (!dataUrl || signal.aborted) continue;
      cacheGoogleDriveProjectPreview(project, dataUrl);
      changed = true;
    } catch (error) {
      if (signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) break;
      // Preview compatibility must never turn a readable Drive source into a
      // failed source. The native provider fallback remains available.
      console.info('CardForge could not prepare a compatibility Drive preview:', error);
    }
  }
  return changed;
};

/**
 * Older CardForge Drive files may predate native contentHints thumbnails.
 * Warm a small revision-keyed visual cache in the background, then reuse the
 * established project-Library refresh signal so Desk and Library repaint
 * without importing those files into editable browser work or blocking the
 * workspace. Concurrent list consumers are coalesced at the provider client.
 * Data-saver/hidden pages skip this optional compatibility read entirely, and
 * leaving the workspace aborts any optional package download still in flight.
 */
export function GoogleDrivePreviewWarmupBoundary({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  useEffect(() => {
    const controller = new AbortController();
    if (!enabled) return () => controller.abort();
    void warmMissingPreviews(controller.signal)
      .then((changed) => {
        if (!controller.signal.aborted && changed) window.dispatchEvent(new Event(PROJECT_LIBRARY_CHANGE_EVENT));
      })
      .catch((error) => {
        if (controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) return;
        // Compatibility preview work is optional. The normal Drive projection
        // owns provider availability and will surface its own source status.
        console.info('CardForge skipped optional Drive preview warming:', error);
      });
    return () => controller.abort();
  }, [enabled]);

  return children;
}
