"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { AppearanceStylePreset, CardAssetOption, TCGCardTemplate } from '@/domain/templates';
import {
  getAssetKindLabel,
  getPipelineStatusLabel,
  getPipelineTypeLabel,
  getPipelineImagePreviewUrl,
  isRepositoryStyle,
  isRepositoryTemplate,
  projectPipelineLibrary,
  type CardForgeCatalogManifest,
  type PipelineProgramView,
  type PipelineLibraryItem,
  type PipelineSubmission,
} from '@/features/pipeline/client';
import { readApiError } from '@/infrastructure/http/clientResponses';
import { shouldLoadLibraryPipelineProgram, type LibraryScope } from '../model/libraryScopes';

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
  lineageId: string | null;
}

export interface PipelineLibraryObject {
  submission: PipelineSubmission;
  revisions: PipelineSubmission[];
  currentPublishedSubmission: PipelineSubmission | null;
  kindLabel: string;
  statusLabel: string;
  ownership: PipelineLibraryItem['ownership'];
  reviewState: PipelineLibraryItem['reviewState'];
  previewUrl: string | null;
  fontFamily: string | null;
  template: TCGCardTemplate | null;
  style: AppearanceStylePreset | null;
}

interface LibrarySharedFailure {
  message: string;
  retryable: boolean;
  nextAction?: string;
}

const publishedAssets = (catalog: CardForgeCatalogManifest): PublishedLibraryObject[] => {
  const pipelineByAssetId = new Map((catalog.pipeline?.items ?? []).map((item) => [item.id, item]));
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
    sourceLabel: asset.librarySource === 'contributor' ? 'Community' : 'CardForge',
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
    lineageId: pipelineByAssetId.get(asset.id)?.lineageId ?? null,
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
    lineageId: pipelineByAssetId.get(font.value)?.lineageId ?? null,
  }));
  const sets = (catalog.sets?.items ?? []).map((set): PublishedLibraryObject => ({
    id: `published:set:${set.id}`,
    name: set.name,
    kind: 'set',
    kindLabel: 'Set',
    sourceLabel: set.source === 'contributor' ? 'Community' : 'CardForge',
    accessLabel: set.access === 'paid' ? 'Creator Pass' : 'Starter Library',
    previewUrl: set.previewUrl,
    sizeBytes: set.fileSizeBytes,
    fontFamily: null,
    template: null,
    style: null,
    packageUrl: set.packageUrl,
    revision: set.revision,
    lineageId: pipelineByAssetId.get(set.id)?.lineageId ?? null,
  }));
  return [...sets, ...assets, ...fonts].toSorted((left, right) => left.name.localeCompare(right.name));
};

interface CatalogLibraryVisual {
  previewUrl: string | null;
  fontFamily: string | null;
  template: TCGCardTemplate | null;
  style: AppearanceStylePreset | null;
}

const EMPTY_CATALOG_VISUAL: CatalogLibraryVisual = {
  previewUrl: null,
  fontFamily: null,
  template: null,
  style: null,
};

const catalogNameKey = (name: string): string => `name:${name.trim().toLocaleLowerCase()}`;

const registerCatalogVisual = (
  visuals: Map<string, CatalogLibraryVisual>,
  identity: string,
  name: string,
  visual: CatalogLibraryVisual,
) => {
  visuals.set(identity, visual);
  visuals.set(catalogNameKey(name), visual);
};

const catalogLibraryVisuals = (catalog: CardForgeCatalogManifest | null): Map<string, CatalogLibraryVisual> => {
  const visuals = new Map<string, CatalogLibraryVisual>();
  if (!catalog) return visuals;

  const templateByIdentity = new Map<string, TCGCardTemplate>();
  catalog.templates.defaults.forEach((template) => {
    if (template.id) templateByIdentity.set(template.id, template);
    templateByIdentity.set(template.name, template);
  });
  const styleByIdentity = new Map<string, AppearanceStylePreset>();
  catalog.styles.styles.forEach((style) => {
    styleByIdentity.set(style.id, style);
    styleByIdentity.set(style.name, style);
  });

  [
    ...catalog.assets.templates,
    ...catalog.assets.imageAssets,
    ...catalog.assets.textures,
    ...catalog.assets.dividers,
    ...catalog.assets.icons,
    ...catalog.assets.elementPresets,
  ].forEach((asset) => {
    const previewUrl = asset.previewUrl
      || (asset.kind === 'image' || asset.kind === 'texture' || asset.kind === 'divider' || asset.kind === 'icon' ? asset.url : null);
    registerCatalogVisual(visuals, asset.id, asset.name, {
      previewUrl,
      fontFamily: null,
      template: asset.kind === 'template' ? templateByIdentity.get(asset.id) ?? templateByIdentity.get(asset.name) ?? null : null,
      style: asset.style ?? styleByIdentity.get(asset.id) ?? styleByIdentity.get(asset.name) ?? null,
    });
  });
  catalog.fonts.fonts.forEach((font) => registerCatalogVisual(visuals, font.value, font.name, {
    previewUrl: null,
    fontFamily: font.cssFamily,
    template: null,
    style: null,
  }));
  catalog.sets.items.forEach((set) => registerCatalogVisual(visuals, set.id, set.name, {
    previewUrl: set.previewUrl,
    fontFamily: null,
    template: null,
    style: null,
  }));
  return visuals;
};

export const projectPipelineLibraryObjects = (
  program: Pick<PipelineProgramView, 'submissions' | 'votingQueue' | 'currentContributorIds' | 'settings'>,
  catalog: CardForgeCatalogManifest | null,
): PipelineLibraryObject[] => {
  const visuals = catalogLibraryVisuals(catalog);
  return (
  projectPipelineLibrary(program).map((item): PipelineLibraryObject => {
    const sourcePayload = item.submission.sourcePayload;
    const lineageVisual = [item.submission.targetRegistryAssetId, item.submission.registryAssetId, catalogNameKey(item.submission.name)]
      .flatMap((identity) => identity ? [visuals.get(identity)] : [])
      .find((visual): visual is CatalogLibraryVisual => Boolean(visual))
      ?? EMPTY_CATALOG_VISUAL;
    return {
      submission: item.submission,
      revisions: item.revisions,
      currentPublishedSubmission: item.currentPublishedSubmission,
      kindLabel: getPipelineTypeLabel(item.submission.assetType, { plural: false }),
      statusLabel: getPipelineStatusLabel(item.submission.status),
      ownership: item.ownership,
      reviewState: item.reviewState,
      previewUrl: getPipelineImagePreviewUrl(item.submission) ?? lineageVisual.previewUrl,
      fontFamily: lineageVisual.fontFamily,
      template: isRepositoryTemplate(sourcePayload) ? sourcePayload : lineageVisual.template,
      style: isRepositoryStyle(sourcePayload) ? sourcePayload : lineageVisual.style,
    };
  })
  );
};

export function useLibrarySharedProjection({ pipelineEnabled, activeScope }: { pipelineEnabled: boolean; activeScope: LibraryScope }) {
  const [catalog, setCatalog] = useState<CardForgeCatalogManifest | null>(null);
  const [program, setProgram] = useState<PipelineProgramView | null>(null);
  const [catalogFailure, setCatalogFailure] = useState<LibrarySharedFailure | null>(null);
  const [pipelineFailure, setPipelineFailure] = useState<LibrarySharedFailure | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const pipelineEnabledRef = useRef(pipelineEnabled);
  pipelineEnabledRef.current = pipelineEnabled;

  useEffect(() => {
    if (pipelineEnabled) return;
    setProgram(null);
    setPipelineFailure(null);
    setPipelineLoading(false);
  }, [pipelineEnabled]);

  const refresh = useCallback(async () => {
    const needsPipelineProgram = shouldLoadLibraryPipelineProgram(activeScope, pipelineEnabled);
    if (activeScope === 'published' || activeScope === 'pipeline') {
      setCatalogLoading(true);
      setCatalogFailure(null);
    }
    if (needsPipelineProgram) {
      setPipelineLoading(true);
      setPipelineFailure(null);
    }
    const catalogRequest = activeScope === 'published' || activeScope === 'pipeline' ? fetch('/api/catalog', { cache: 'no-store' })
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
    const pipelineRequest = needsPipelineProgram
      ? fetch('/api/pipeline/library', { cache: 'no-store' })
          .then(async (response) => {
            if (!response.ok) throw await readApiError(response, 'Forge Review is unavailable.');
            return response.json() as Promise<{ program: PipelineProgramView }>;
          })
          .then((payload) => {
            if (pipelineEnabledRef.current) setProgram(payload.program);
          })
          .catch((error: unknown) => {
            if (pipelineEnabledRef.current) setPipelineFailure({
              message: error instanceof Error ? error.message : 'Forge Review is unavailable.',
              retryable: typeof error === 'object' && error !== null && 'retryable' in error ? Boolean(error.retryable) : true,
              ...(typeof error === 'object' && error !== null && 'nextAction' in error && typeof error.nextAction === 'string' ? { nextAction: error.nextAction } : {}),
            });
          })
          .finally(() => {
            if (pipelineEnabledRef.current) setPipelineLoading(false);
          })
      : Promise.resolve();
    await Promise.all([catalogRequest, pipelineRequest]);
  }, [activeScope, pipelineEnabled]);

  useEffect(() => { void refresh(); }, [refresh]);

  return {
    publishedItems: useMemo(() => catalog ? publishedAssets(catalog) : [], [catalog]),
    pipelineItems: useMemo(() => pipelineEnabled && program ? projectPipelineLibraryObjects(program, catalog) : [], [catalog, pipelineEnabled, program]),
    program: pipelineEnabled ? program : null,
    catalogFailure,
    pipelineFailure: pipelineEnabled ? pipelineFailure : null,
    catalogLoading,
    pipelineLoading: pipelineEnabled && pipelineLoading,
    refresh,
  };
}
