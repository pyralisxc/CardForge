"use client";

import { useMemo } from 'react';
import { formatContentTaxonomyTag, getSemanticRoleLabel } from '@/features/pipeline/client';

import { getLibraryScopeStatus, type LibraryScope } from '../model/libraryScopes';
import { accountLibraryKindLabels } from '../components/AccountLibraryItemRow';
import { getPersonalLibraryStatus, type LibraryViewItem } from '../components/LibraryObjectPresentation';
import { useAccountLibraryProjection } from './useAccountLibraryProjection';
import { useLibrarySharedProjection } from './useLibrarySharedProjection';

/** Search/filter metadata without rewriting the creator-authored description. */
const semanticFacetLabels = (item: LibraryViewItem): string[] => {
  const metadata = item.scope === 'published'
    ? item.published
    : item.scope === 'pipeline'
      ? item.pipeline.submission
      : null;
  if (!metadata) return [];
  return [
    ...(metadata.semanticRole ? [`Role: ${getSemanticRoleLabel(metadata.semanticRole)}`] : []),
    ...(metadata.visualFamily ? [`Family: ${metadata.visualFamily}`] : []),
    ...(metadata.variantKind && metadata.variantKind !== 'base'
      ? [`Variant: ${formatContentTaxonomyTag(metadata.variantKind)}`]
      : []),
    ...((metadata.compatibilityTags ?? []).map((tag) => `Compatible: ${formatContentTaxonomyTag(tag)}`)),
  ];
};

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
      id: item.id, scope: 'personal', name: item.name, kindLabel: item.localResource
        ? item.localResource.kind.charAt(0).toUpperCase() + item.localResource.kind.slice(1)
        : accountLibraryKindLabels[item.kind].replace(/s$/u, ''),
      sourceLabel: item.locations.map((location) => location.label).join(' + '), statusLabel: status.label,
      summary: [
        item.details.join(' · ') || 'Ready to inspect.',
        item.organization.type ? `Type: ${item.organization.type}` : null,
        item.organization.tags.length ? `Tags: ${item.organization.tags.join(' · ')}` : null,
      ].filter(Boolean).join(' · '), updatedAt: item.updatedAt ?? item.expiresAt,
      sizeBytes: item.sizeBytes, previewUrl: null, fontFamily: null, personal: item,
    };
  }), [projection.visibleItems]);
  const publishedItems = useMemo<LibraryViewItem[]>(() => shared.publishedItems.map((item) => ({
    id: item.id, scope: 'published', name: item.name, kindLabel: item.kindLabel, sourceLabel: item.sourceLabel,
    statusLabel: item.accessLabel, summary: item.description || `${item.kindLabel} from the current ${item.accessLabel}.`, updatedAt: null,
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
    if (activeScope !== 'personal' && sharedType !== 'all' && item.kindLabel !== sharedType && item.statusLabel !== sharedType && !semanticFacetLabels(item).includes(sharedType)) return false;
    const tags = item.scope === 'published'
      ? [
          ...item.published.specialtyTags, ...item.published.useCaseTags,
          item.published.semanticRole, item.published.visualFamily,
          item.published.variantKind, item.published.variantLabel,
          ...(item.published.compatibilityTags ?? []),
        ]
      : item.scope === 'pipeline'
        ? [
            ...item.pipeline.submission.specialtyTags, ...item.pipeline.submission.useCaseTags,
            item.pipeline.submission.semanticRole, item.pipeline.submission.visualFamily,
            item.pipeline.submission.variantKind, item.pipeline.submission.variantLabel,
            ...item.pipeline.submission.compatibilityTags,
          ]
        : [];
    const searchTags = tags.filter((tag): tag is string => typeof tag === 'string' && tag.length > 0);
    return !normalizedQuery || [
      item.name, item.kindLabel, item.sourceLabel, item.statusLabel, item.summary,
      ...searchTags, ...searchTags.map(formatContentTaxonomyTag), ...semanticFacetLabels(item),
    ].join(' ').toLocaleLowerCase().includes(normalizedQuery);
  }).toSorted((left, right) => projection.sort === 'name'
    ? left.name.localeCompare(right.name)
    : projection.sort === 'kind'
      ? left.kindLabel.localeCompare(right.kindLabel) || left.name.localeCompare(right.name)
      : (Date.parse(right.updatedAt ?? '') || 0) - (Date.parse(left.updatedAt ?? '') || 0) || left.name.localeCompare(right.name)),
  [activeScope, normalizedQuery, projection.sort, scopeItems, sharedType]);
  const sharedTypes = useMemo(() => [...new Set(scopeItems.flatMap((item) => [
    item.kindLabel,
    ...(activeScope === 'pipeline' ? [item.statusLabel] : []),
    ...semanticFacetLabels(item),
  ]))].toSorted(), [activeScope, scopeItems]);
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
          || (!shared.program && !shared.pipelineFailure)
          || (!shared.catalog && !shared.catalogFailure)
        : shared.catalogLoading || (!shared.catalog && !shared.catalogFailure);
  const unfilteredScopeItemCount = activeScope === 'personal' ? projection.items.length : scopeItems.length;
  const activeStatus = activeScope === 'campaigns'
    ? { kind: 'ready' as const, label: 'Workspace' }
    : getLibraryScopeStatus({ loading: activeLoading, itemCount: unfilteredScopeItemCount, failure: activeFailure?.message ?? null });

  return { activeFailure, activeLoading, activeStatus, itemMap, scopeItems, sharedTypes, unfilteredScopeItemCount, viewItems };
}
