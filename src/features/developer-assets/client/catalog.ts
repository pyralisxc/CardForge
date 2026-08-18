"use client";

import type {
  CardForgeCatalogManifest,
  CardForgeStudioAssetManifest,
  CardForgeStudioBootstrapManifest,
} from '@/features/developer-assets/lib/catalogManifest';

let catalogPromise: Promise<CardForgeCatalogManifest> | null = null;
let studioBootstrapPromise: Promise<CardForgeStudioBootstrapManifest> | null = null;
let studioAssetPromise: Promise<CardForgeStudioAssetManifest> | null = null;

const loadJson = <T>(url: string, label: string): Promise<T> => (
  fetch(url, { cache: 'no-store' })
    .then((response) => {
      if (!response.ok) throw new Error(`Failed to load ${label}: ${response.status}`);
      return response.json() as Promise<T>;
    })
);

export const loadCardForgeCatalog = (): Promise<CardForgeCatalogManifest> => {
  catalogPromise ??= loadJson<CardForgeCatalogManifest>('/api/catalog', 'CardForge catalog')
    .catch((error) => {
      catalogPromise = null;
      throw error;
    });
  return catalogPromise;
};

export const loadCardForgeStudioBootstrap = (): Promise<CardForgeStudioBootstrapManifest> => {
  studioBootstrapPromise ??= loadJson<CardForgeStudioBootstrapManifest>(
    '/api/catalog/studio-bootstrap',
    'CardForge Studio bootstrap',
  ).catch((error) => {
    studioBootstrapPromise = null;
    throw error;
  });
  return studioBootstrapPromise;
};

export const loadCardForgeStudioAssets = (): Promise<CardForgeStudioAssetManifest> => {
  studioAssetPromise ??= loadJson<CardForgeStudioAssetManifest>(
    '/api/catalog/studio-assets',
    'CardForge Studio assets',
  ).catch((error) => {
    studioAssetPromise = null;
    throw error;
  });
  return studioAssetPromise;
};
