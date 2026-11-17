"use client";

import { requireOkResponse } from '@/infrastructure/http/clientResponses';

import type {
  CardForgeCatalogManifest,
  CardForgeStudioAssetManifest,
  CardForgeStudioBootstrapManifest,
} from '@/features/pipeline/lib/catalogManifest';

let catalogPromise: Promise<CardForgeCatalogManifest> | null = null;
let studioBootstrapPromise: Promise<CardForgeStudioBootstrapManifest> | null = null;
let studioAssetPromise: Promise<CardForgeStudioAssetManifest> | null = null;
export const PUBLISHED_FONTS_OBSERVED_EVENT = 'cardforge:published-fonts-observed';

const loadJson = <T>(url: string, label: string, signal?: AbortSignal): Promise<T> => (
  fetch(url, { cache: 'no-store', signal })
    .then(async (response) => {
      await requireOkResponse(response, `Unable to load ${label}.`);
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

export const loadCardForgeStudioBootstrap = (options: { fresh?: boolean; signal?: AbortSignal } = {}): Promise<CardForgeStudioBootstrapManifest> => {
  if (options.fresh || options.signal) return loadJson<CardForgeStudioBootstrapManifest>('/api/catalog/studio-bootstrap', 'CardForge Studio bootstrap', options.signal);
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
