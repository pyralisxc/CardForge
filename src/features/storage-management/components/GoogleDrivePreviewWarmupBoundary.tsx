"use client";

import { useEffect, useState, type ReactNode } from 'react';

import { createGoogleDriveProjectThumbnail } from '@/features/card-generator/client';
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

const warmMissingPreviews = async (): Promise<void> => {
  const library = await loadGoogleDriveProjectLibrary();
  if (!library.connection.connected) return;

  const candidates = library.projects
    .filter((project) => !project.thumbnailLink
      && project.capabilities?.canDownload !== false
      && project.size > 0
      && project.size <= MAX_AUTOMATIC_PREVIEW_PACKAGE_BYTES)
    .slice(0, MAX_AUTOMATIC_PREVIEW_PROJECTS);
  if (!candidates.length) return;

  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < candidates.length) {
      const project = candidates[nextIndex++];
      if (!project) continue;
      try {
        const dataUrl = await createCompatibilityPreview(project);
        if (dataUrl) cacheGoogleDriveProjectPreview(project, dataUrl);
      } catch (error) {
        // Preview compatibility must never turn a readable Drive source into a
        // failed source. The native provider fallback remains available.
        console.info('CardForge could not prepare a compatibility Drive preview:', error);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(PREVIEW_WORKERS, candidates.length) }, () => worker()));
};

/**
 * Older CardForge Drive files may predate native contentHints thumbnails.
 * Warm a small bounded visual cache before Desk/Library discovery so those
 * files look ready without importing them into editable browser work.
 */
export function GoogleDrivePreviewWarmupBoundary({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  const [ready, setReady] = useState(!enabled);

  useEffect(() => {
    let cancelled = false;
    if (!enabled) {
      setReady(true);
      return () => { cancelled = true; };
    }
    setReady(false);
    void warmMissingPreviews().finally(() => {
      if (!cancelled) setReady(true);
    });
    return () => { cancelled = true; };
  }, [enabled]);

  if (!ready) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--cf-canvas)] px-5 py-12 text-[var(--cf-text)]">
        <div className="cardforge-surface grid min-h-0 w-full max-w-md place-items-center border p-5 text-center text-sm text-[var(--cf-text-muted)]" role="status">
          <p>Preparing your saved project previews before opening the workspace.</p>
        </div>
      </main>
    );
  }

  return children;
}
