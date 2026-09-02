"use client";

import { useMemo } from 'react';

import { getLibraryScopeStatus, type LibraryScope } from '../model/libraryScopes';
import { accountLibraryKindLabels } from '../components/AccountLibraryItemRow';
import { getPersonalLibraryStatus, type LibraryViewItem } from '../components/LibraryObjectPresentation';
import { useAccountLibraryProjection } from './useAccountLibraryProjection';
import { useLibrarySharedProjection } from './useLibrarySharedProjection';

export function useUnifiedLibraryView({
  activeScope,
  pipelineAccess,
  projection,
  shared,
  sharedType,
}: {
  activeScope: LibraryScope;
  pipelineAccess: boolean;
  projection: ReturnType<typeof useAccountLibraryProjection>;
  shared: ReturnType<typeof useLibrarySharedProjection>;
  sharedType: string;
}) {
  const personalItems = useMemo<LibraryViewItem[]>(() => projection.visibleItems.map((item) => {
    const status = getPersonalLibraryStatus(item);
    return {
      id: item.id, scope: 'personal', name: item.name, kindLabel: accountLibraryKindLabels[item.kind].replace(/s$/u, ''),
      sourceLabel: item.locations.map((location) => location.label).join(' + '), statusLabel: status.label,
      summary: item.details.join(' · ') || 'Ready to inspect.', updatedAt: item.updatedAt ?? item.expiresAt,
      sizeBytes: item.sizeBytes, previewUrl: null, fontFamily: null, personal: item,
    };
  }), [projection.visibleItems]);
  const publishedItems = useMemo<LibraryViewItem[]>(() => shared.publishedItems.map((item) => ({
    id: item.id, scope: 'published', name: item.name, kindLabel: item.kindLabel, sourceLabel: item.sourceLabel,
    statusLabel: item.accessLabel, summary: `${item.kindLabel} from the current ${item.accessLabel}.`, updatedAt: null,
    sizeBytes: item.sizeBytes, previewUrl: item.previewUrl, fontFamily: item.fontFamily, published: item,
  })), [shared.publishedItems]);
  const pipelineItems = useMemo<LibraryViewItem[]>(() => shared.pipelineItems.map((item) => ({
    id: `pipeline:${item.submission.targetRegistryAssetId ?? item.submission.registryAssetId ?? item.submission.id}`,
    scope: 'pipeline', name: item.submission.name, kindLabel: item.kindLabel,
    sourceLabel: item.ownership === 'mine' ? 'Your contribution' : item.submission.contributorDisplayName ?? 'Shared Pipeline',
    statusLabel: item.statusLabel, summary: item.submission.description || `${item.kindLabel} in Forge Review.`,
    updatedAt: item.submission.updatedAt ?? item.submission.submittedAt, sizeBytes: item.submission.sourceFileSizeBytes,
    previewUrl: item.previewUrl, fontFamily: item.fontFamily, pipeline: item,
  })), [shared.pipelineItems]);

  const contributorPublishedItems = useMemo(() => pipelineItems.filter((item) => (
    item.scope === 'pipeline' && item.pipeline.ownership === 'mine' && item.pipeline.submission.status === 'published'
  )), [pipelineItems]);
  const contributorPipelineItems = useMemo(() => {
    const programLineages = new Set(pipelineItems.flatMap((item) => item.scope === 'pipeline' && item.pipeline.submission.lineageId
      ? [item.pipeline.submission.lineageId]
      : []));
    return [
      ...pipelineItems,
      ...publishedItems.filter((item) => item.scope === 'published' && (!item.published.lineageId || !programLineages.has(item.published.lineageId))),
    ];
  }, [pipelineItems, publishedItems]);
  const scopeItems = useMemo(() => activeScope === 'personal'
    ? personalItems
    : activeScope === 'published'
      ? contributorPublishedItems
      : activeScope === 'campaigns'
        ? []
        : pipelineAccess
          ? contributorPipelineItems
          : publishedItems,
  [activeScope, contributorPipelineItems, contributorPublishedItems, personalItems, pipelineAccess, publishedItems]);
  const normalizedQuery = projection.query.trim().toLocaleLowerCase();
  const viewItems = useMemo(() => scopeItems.filter((item) => {
    if (activeScope !== 'personal' && sharedType !== 'all' && item.kindLabel !== sharedType && item.statusLabel !== sharedType) return false;
    return !normalizedQuery || [item.name, item.kindLabel, item.sourceLabel, item.statusLabel, item.summary].join(' ').toLocaleLowerCase().includes(normalizedQuery);
  }).toSorted((left, right) => projection.sort === 'name'
    ? left.name.localeCompare(right.name)
    : projection.sort === 'kind'
      ? left.kindLabel.localeCompare(right.kindLabel) || left.name.localeCompare(right.name)
      : (Date.parse(right.updatedAt ?? '') || 0) - (Date.parse(left.updatedAt ?? '') || 0) || left.name.localeCompare(right.name)),
  [activeScope, normalizedQuery, projection.sort, scopeItems, sharedType]);
  const sharedTypes = useMemo(() => [...new Set(scopeItems.flatMap((item) => activeScope === 'pipeline'
    ? [item.kindLabel, item.statusLabel]
    : [item.kindLabel]))].toSorted(), [activeScope, scopeItems]);
  const itemMap = useMemo(() => new Map([...personalItems, ...publishedItems, ...pipelineItems].map((item) => [item.id, item])), [personalItems, pipelineItems, publishedItems]);
  const activeFailure = activeScope === 'campaigns'
    ? null
    : activeScope === 'personal'
      ? projection.failures[0] ?? null
      : activeScope === 'pipeline' && pipelineAccess
        ? shared.pipelineFailure ?? shared.catalogFailure
        : shared.catalogFailure;
  const activeLoading = activeScope === 'campaigns'
    ? false
    : activeScope === 'personal'
      ? projection.isLoading
      : activeScope === 'pipeline' && pipelineAccess
        ? shared.pipelineLoading || shared.catalogLoading
        : shared.catalogLoading;
  const activeStatus = activeScope === 'campaigns'
    ? { kind: 'ready' as const, label: 'Workspace' }
    : getLibraryScopeStatus({ loading: activeLoading, itemCount: scopeItems.length, failure: activeFailure?.message ?? null });

  return { activeFailure, activeLoading, activeStatus, itemMap, scopeItems, sharedTypes, viewItems };
}
