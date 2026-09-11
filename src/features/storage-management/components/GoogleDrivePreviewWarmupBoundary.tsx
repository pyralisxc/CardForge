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

const MAX_AUTOMATIC_PREVIEW_PROJECTS = 6;
const MAX_AUTOMATIC_PREVIEW_PACKAGE_BYTES = 32 * 1024 * 1024;
const PREVIEW_WORKERS = 2;

const base64UrlPngToDataUrl = (value: string): string => {
  const base64 = value.replace(/-/gu, '+').replace(/_/gu, '/');
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  return `data:image/png;base64,${base64}${padding}`;
};

const loadTemporaryPreviewDocument = async (project: GoogleDriveProjectSummary) => {
  const response = await fetch(`/api/project-sources/google-drive/${encodeURIComponent(project.fileId)}`, {
    cache: 'no-store',
  });
  if (!response.ok) return null;

  const responseRevision = response.headers.get('X-CardForge-Project-Revision');
  if (project.projectRevision && responseRevision && responseRevision !== project.projectRevision) return null;

  const snapshot = await decodeCardForgeProjectPackage(await response.blob());
  if (project.projectRevision && snapshot.manifest.projectRevision !== project.projectRevision) return null;

  const urls = new Map<string, string>();
  try {
    for (const descriptor of snapshot.manifest.assets) {
      const source = snapshot.assets.get(descriptor.id);
      if (!source) return null;
      const bytes = source instanceof Uint8Array ? source : await source.load();
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      urls.set(descriptor.id, URL.createObjectURL(new Blob([copy.buffer], { type: descriptor.mimeType })));
    }
    return {
      document: referenceCardForgeProjectSnapshotAssets(snapshot, (descriptor) => urls.get(descriptor.id) ?? ''),
      release: () => urls.forEach((url) => URL.revokeObjectURL(url)),
    };
  } catch (error) {
    urls.forEach((url) => URL.revokeObjectURL(url));
    throw error;
  }
};

const createCompatibilityPreview = async (project: GoogleDriveProjectSummary): Promise<string | null> => {
  const temporary = await loadTemporaryPreviewDocument(project);
  if (!temporary) return null;
  try {
    const encoded = await createGoogleDriveProjectThumbnail(temporary.document);
    return encoded ? base64UrlPngToDataUrl(encoded) : null;
  } finally {
    temporary.release();
  }
};

const warmMissingPreviews = async (): Promise<boolean> => {
  const library = await loadGoogleDriveProjectLibrary();
  if (!library.connection.connected) return false;

  const candidates = library.projects
    .filter((project) => !project.thumbnailLink
      && project.capabilities?.canDownload !== false
      && project.size > 0
      && project.size <= MAX_AUTOMATIC_PREVIEW_PACKAGE_BYTES)
    .slice(0, MAX_AUTOMATIC_PREVIEW_PROJECTS);
  if (!candidates.length) return false;

  let nextIndex = 0;
  let changed = false;
  const worker = async () => {
    while (nextIndex < candidates.length) {
      const project = candidates[nextIndex++];
      if (!project) continue;
      try {
        const dataUrl = await createCompatibilityPreview(project);
        if (!dataUrl) continue;
        cacheGoogleDriveProjectPreview(project, dataUrl);
        changed = true;
      } catch (error) {
        // Preview compatibility must never turn a readable Drive source into a
        // failed source. The native provider fallback remains available.
        console.info('CardForge could not prepare a compatibility Drive preview:', error);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(PREVIEW_WORKERS, candidates.length) }, () => worker()));
  return changed;
};

/**
 * Older CardForge Drive files may predate native contentHints thumbnails.
 * Warm a small bounded visual cache in the background, then reuse the existing
 * project-Library refresh signal so Desk and Library repaint without importing
 * those files into editable browser work or blocking the workspace.
 */
export function GoogleDrivePreviewWarmupBoundary({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  useEffect(() => {
    let cancelled = false;
    if (!enabled) return () => { cancelled = true; };
    void warmMissingPreviews().then((changed) => {
      if (!cancelled && changed) window.dispatchEvent(new Event(PROJECT_LIBRARY_CHANGE_EVENT));
    });
    return () => { cancelled = true; };
  }, [enabled]);

  return children;
}
