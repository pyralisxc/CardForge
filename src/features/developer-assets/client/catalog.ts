"use client";

import type { CardForgeCatalogManifest } from '@/features/developer-assets/lib/catalogManifest';

let catalogPromise: Promise<CardForgeCatalogManifest> | null = null;

export const loadCardForgeCatalog = (): Promise<CardForgeCatalogManifest> => {
  catalogPromise ??= fetch('/api/catalog', { cache: 'no-store' })
    .then((response) => {
      if (!response.ok) throw new Error(`Failed to load CardForge catalog: ${response.status}`);
      return response.json() as Promise<CardForgeCatalogManifest>;
    })
    .catch((error) => {
      catalogPromise = null;
      throw error;
    });
  return catalogPromise;
};
