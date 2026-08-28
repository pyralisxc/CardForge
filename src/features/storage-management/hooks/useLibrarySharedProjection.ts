"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { AppearanceStylePreset, CardAssetOption, TCGCardTemplate } from '@/domain/templates';
import {
  getAssetKindLabel,
  getDeveloperAssetStatusLabel,
  getDeveloperAssetTypeLabel,
  getDeveloperAssetImagePreviewUrl,
  isRepositoryStyle,
  isRepositoryTemplate,
  projectDeveloperPipelineLibrary,
  type CardForgeCatalogManifest,
  type DeveloperAssetProgramView,
  type DeveloperPipelineLibraryItem,
  type DeveloperAssetSubmission,
} from '@/features/developer-assets/client';
import { readApiError } from '@/infrastructure/http/clientResponses';
import type { LibraryScope } from '../model/libraryScopes';

export interface PublishedLibraryObject {
  id: string;
  name: string;
  kind: CardAssetOption['kind'] | 'font' | 'set';
  kindLabel: string;
  sourceLabel: string;
  accessLabel: string;
  previewUrl: string | null;
  sizeBytes: number | null;
  fontFamily: string | null;
  template: TCGCardTemplate | null;
  style: AppearanceStylePreset | null;
  packageUrl: string | null;
  revision: number | null;
}

export interface PipelineLibraryObject {
  submission: DeveloperAssetSubmission;
  revisions: DeveloperAssetSubmission[];
  currentPublishedSubmission: DeveloperAssetSubmission | null;
  kindLabel: string;
  statusLabel: string;
  ownership: DeveloperPipelineLibraryItem['ownership'];
  reviewState: DeveloperPipelineLibraryItem['reviewState'];
  previewUrl: string | null;
  template: TCGCardTemplate | null;
  style: AppearanceStylePreset | null;
}

interface LibrarySharedFailure {
  message: string;
  retryable: boolean;
  nextAction?: string;
}

const publishedAssets = (catalog: CardForgeCatalogManifest): PublishedLibraryObject[] => {
  const templateByIdentity = new Map<string, TCGCardTemplate>();
  catalog.templates.defaults.forEach((template) => {
    if (template.id) templateByIdentity.set(template.id, template);
    templateByIdentity.set(template.name, template);
  });
  const assets = [
    ...catalog.assets.templates,
    ...catalog.assets.imageAssets,
    ...catalog.assets.textures,
    ...catalog.assets.dividers,
    ...catalog.assets.icons,
    ...catalog.assets.elementPresets,
  ].map((asset): PublishedLibraryObject => ({
    id: `published:${asset.kind}:${asset.id}`,
    name: asset.name,
    kind: asset.kind,
    kindLabel: getAssetKindLabel(asset.kind),
    sourceLabel: asset.librarySource === 'developer' ? 'Community' : 'CardForge',
    accessLabel: asset.accessTier === 'paid' ? 'Creator Pass' : 'Starter Library',
    previewUrl: asset.previewUrl
      || (asset.kind === 'image' || asset.kind === 'texture' || asset.kind === 'divider' || asset.kind === 'icon' ? asset.url : null),
    sizeBytes: asset.fileSizeBytes ?? null,
    fontFamily: null,
    template: asset.kind === 'template'
      ? templateByIdentity.get(asset.id) ?? templateByIdentity.get(asset.name) ?? null
      : null,
    style: asset.style ?? null,
    packageUrl: null,
    revision: null,
  }));
  const fonts = catalog.fonts.fonts.map((font): PublishedLibraryObject => ({
    id: `published:font:${font.value}`,
    name: font.name,
    kind: 'font',
    kindLabel: 'Font',
    sourceLabel: 'CardForge',
    accessLabel: catalog.access === 'paid' ? 'Creator Pass' : 'Starter Library',
    previewUrl: null,
    sizeBytes: null,
    fontFamily: font.cssFamily,
    template: null,
    style: null,
    packageUrl: null,
    revision: null,
  }));
  const sets = (catalog.sets?.items ?? []).map((set): PublishedLibraryObject => ({
    id: `published:set:${set.id}`,
    name: set.name,
    kind: 'set',
    kindLabel: 'Set',
    sourceLabel: set.source === 'developer' ? 'Community' : 'CardForge',
    accessLabel: set.access === 'paid' ? 'Creator Pass' : 'Starter Library',
    previewUrl: set.previewUrl,
    sizeBytes: set.fileSizeBytes,
    fontFamily: null,
    template: null,
    style: null,
    packageUrl: set.packageUrl,
    revision: set.revision,
  }));
  return [...sets, ...assets, ...fonts].toSorted((left, right) => left.name.localeCompare(right.name));
};

const pipelineObjects = (program: DeveloperAssetProgramView): PipelineLibraryObject[] => (
  projectDeveloperPipelineLibrary(program).map((item): PipelineLibraryObject => {
    const sourcePayload = item.submission.sourcePayload;
    return {
      submission: item.submission,
      revisions: item.revisions,
      currentPublishedSubmission: item.currentPublishedSubmission,
      kindLabel: getDeveloperAssetTypeLabel(item.submission.assetType, { plural: false }),
      statusLabel: getDeveloperAssetStatusLabel(item.submission.status),
      ownership: item.ownership,
      reviewState: item.reviewState,
      previewUrl: getDeveloperAssetImagePreviewUrl(item.submission),
      template: isRepositoryTemplate(sourcePayload) ? sourcePayload : null,
      style: isRepositoryStyle(sourcePayload) ? sourcePayload : null,
    };
  })
);

export function useLibrarySharedProjection({ pipelineEnabled, activeScope }: { pipelineEnabled: boolean; activeScope: LibraryScope }) {
  const [catalog, setCatalog] = useState<CardForgeCatalogManifest | null>(null);
  const [program, setProgram] = useState<DeveloperAssetProgramView | null>(null);
  const [catalogFailure, setCatalogFailure] = useState<LibrarySharedFailure | null>(null);
  const [pipelineFailure, setPipelineFailure] = useState<LibrarySharedFailure | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [pipelineLoading, setPipelineLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (activeScope === 'published') {
      setCatalogLoading(true);
      setCatalogFailure(null);
    } else if (activeScope === 'pipeline' && pipelineEnabled) {
      setPipelineLoading(true);
      setPipelineFailure(null);
    }
    const catalogRequest = activeScope === 'published' ? fetch('/api/catalog', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw await readApiError(response, 'The published Library is unavailable.');
        return response.json() as Promise<CardForgeCatalogManifest>;
      })
      .then(setCatalog)
      .catch((error: unknown) => setCatalogFailure({
        message: error instanceof Error ? error.message : 'The published Library is unavailable.',
        retryable: typeof error === 'object' && error !== null && 'retryable' in error ? Boolean(error.retryable) : true,
        ...(typeof error === 'object' && error !== null && 'nextAction' in error && typeof error.nextAction === 'string' ? { nextAction: error.nextAction } : {}),
      }))
      .finally(() => setCatalogLoading(false)) : Promise.resolve();
    const pipelineRequest = activeScope === 'pipeline' && pipelineEnabled
      ? fetch('/api/developer-assets/library', { cache: 'no-store' })
          .then(async (response) => {
            if (!response.ok) throw await readApiError(response, 'Forge Review is unavailable.');
            return response.json() as Promise<{ program: DeveloperAssetProgramView }>;
          })
          .then((payload) => setProgram(payload.program))
          .catch((error: unknown) => setPipelineFailure({
            message: error instanceof Error ? error.message : 'Forge Review is unavailable.',
            retryable: typeof error === 'object' && error !== null && 'retryable' in error ? Boolean(error.retryable) : true,
            ...(typeof error === 'object' && error !== null && 'nextAction' in error && typeof error.nextAction === 'string' ? { nextAction: error.nextAction } : {}),
          }))
          .finally(() => setPipelineLoading(false))
      : Promise.resolve();
    await Promise.all([catalogRequest, pipelineRequest]);
  }, [activeScope, pipelineEnabled]);

  useEffect(() => { void refresh(); }, [refresh]);

  return {
    publishedItems: useMemo(() => catalog ? publishedAssets(catalog) : [], [catalog]),
    pipelineItems: useMemo(() => program ? pipelineObjects(program) : [], [program]),
    program,
    catalogFailure,
    pipelineFailure,
    catalogLoading,
    pipelineLoading,
    refresh,
  };
}
