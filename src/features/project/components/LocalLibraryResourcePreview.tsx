"use client";

import { useEffect, useState } from 'react';
import { createScopedProjectBinaryAssetResolver } from '@/features/project/client/persistence-binaries';
import { getProjectPersistenceScope } from '@/features/project/client/persistence-workspace';
import type { LocalLibraryResource } from '../model/localLibraryResources';

export function LocalLibraryResourcePreview({ resource, className }: { resource: LocalLibraryResource; className?: string }) {
  const scope = getProjectPersistenceScope();
  const source = resource.kind === 'font' ? resource.source : resource.previewSource;
  const key = `${scope}:${resource.id}:${resource.status}:${source}`;
  const [preview, setPreview] = useState<{ key: string; url?: string; family?: string; error?: string } | null>(null);

  useEffect(() => {
    if (resource.status !== 'available' || !source) return;
    const resolver = createScopedProjectBinaryAssetResolver(scope);
    let cancelled = false;
    let release: () => void = () => undefined;
    let face: FontFace | null = null;
    void resolver.acquire(source).then(async (handle) => {
      if (cancelled) { handle.release(); return; }
      release = handle.release;
      if (resource.kind === 'font') {
        const family = `cf-library-${resource.objectId.replace(/[^a-zA-Z0-9_-]/gu, '-')}`;
        face = new FontFace(family, `url(${JSON.stringify(handle.url)})`);
        await face.load();
        if (cancelled) return;
        document.fonts.add(face);
        setPreview({ key, family });
      } else setPreview({ key, url: handle.url });
    }).catch((error: unknown) => {
      if (!cancelled) setPreview({ key, error: error instanceof Error ? error.message : 'The resource preview is unavailable.' });
    });
    return () => {
      cancelled = true;
      if (face) document.fonts.delete(face);
      release();
    };
  }, [key, resource.kind, resource.objectId, resource.status, scope, source]);

  const current = preview?.key === key ? preview : null;
  if (resource.status !== 'available' || current?.error) return <span className={className} role="status">{resource.status === 'missing-source' ? 'Source missing. Restore a backup.' : current?.error ?? 'Resource unavailable. Retry the Library source.'}</span>;
  if (current?.family) return <span className={className} style={{ fontFamily: current.family }} aria-label={`${resource.name} font preview`}>Aa Bb 123</span>;
  if (current?.url) return <img className={className} src={current.url} alt={`${resource.name} preview`} onError={() => setPreview({ key, error: 'Preview unavailable. The saved resource has not been changed.' })} />;
  return <span className={className} role="status">Loading preview…</span>;
}
