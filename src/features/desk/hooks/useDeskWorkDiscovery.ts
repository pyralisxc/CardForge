"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';

import type { AccountExperienceProjection } from '@/features/account/client/experience';
import { getCampaignMediaPreviewUrl, loadCampaignDeskProjection, type MarketingContentPackage } from '@/features/marketing-content/client';
import { getPipelineImagePreviewUrl, getPipelineTypeLabel, loadOwnPublishedPipelineSubmissions, type PipelineSubmission } from '@/features/pipeline/client';
import type { ProjectPersistenceScope } from '@/features/project/client/persistence-workspace';
import type { AccountLibraryItem } from '@/features/storage-management/client';
import { describeAgentBoundaryFailure } from '@/shared/boundaryFailure';
import {
  beginScopedSource,
  settleScopedSourceFailure,
  settleScopedSourceValue,
  type ScopedSourcePhase,
  type ScopedSourceSnapshot,
} from '@/shared/scopedSource';

type DeskDiscoverySource = 'campaigns' | 'my-published';

export interface DeskDiscoveryFailure {
  id: DeskDiscoverySource;
  message: string;
  kind: ReturnType<typeof describeAgentBoundaryFailure>['kind'];
  retryable: boolean;
  code: string;
  correlationId: string | null;
  nextAction?: string;
}

export interface DeskDiscoverySourceStatus {
  id: DeskDiscoverySource;
  label: string;
  phase: ScopedSourcePhase;
  failure: DeskDiscoveryFailure | null;
}

type ScopedDeskDiscovery<Value> = ScopedSourceSnapshot<ProjectPersistenceScope, Value, DeskDiscoveryFailure>;

export const toCampaignDeskItem = (campaign: MarketingContentPackage): AccountLibraryItem => {
  const previewUrl = getCampaignMediaPreviewUrl(campaign);
  return {
  id: `campaign:${campaign.id}`,
  kind: 'campaign',
  name: campaign.title,
  locations: [{ source: 'campaign', kind: 'work-source', status: 'available', label: 'Marketing workspace' }],
  details: [
    `${campaign.variants.length} channel variant${campaign.variants.length === 1 ? '' : 's'}`,
    campaign.status.replace(/_/gu, ' '),
  ],
  sizeBytes: null,
  revision: String(campaign.version),
  updatedAt: campaign.updatedAt,
  expiresAt: null,
  workPreview: previewUrl
    ? { kind: 'image', url: previewUrl }
    : { kind: 'fallback', reason: 'no-media' },
  webViewLink: null,
  references: { campaignId: campaign.id },
  // The Campaign record keeps its own campaign fields and permissions. This
  // descriptive type is never consulted for authorization.
  organization: {
    workflow: 'campaign',
    type: campaign.contentKind.replace(/_/gu, ' '),
    tags: [],
    source: 'none',
    publicationState: 'campaign',
  },
  };
};

export const toPublishedDeskItem = (submission: PipelineSubmission): AccountLibraryItem => {
  const isSet = submission.assetType === 'sets';
  const lineageId = submission.lineageId ?? submission.id;
  const previewUrl = getPipelineImagePreviewUrl(submission);
  return {
    id: `pipeline:${lineageId}`,
    kind: isSet ? 'set' : 'published-resource',
    name: submission.name,
    locations: [{ source: 'pipeline', kind: 'work-source', status: 'available', label: 'CardForge Pipeline' }],
    details: [
      `Published ${getPipelineTypeLabel(submission.assetType, { plural: false })}`,
      submission.revisionNumber ? `Revision ${submission.revisionNumber}` : 'Immutable publication',
    ],
    sizeBytes: submission.sourceFileSizeBytes,
    revision: submission.revisionNumber ? String(submission.revisionNumber) : null,
    updatedAt: submission.publishedAt ?? submission.updatedAt ?? submission.submittedAt,
    expiresAt: null,
    workPreview: previewUrl
      ? { kind: 'image', url: previewUrl }
      : { kind: 'fallback', reason: 'no-media' },
    webViewLink: submission.previewUrl || null,
    references: {
      pipelineLineageId: lineageId,
      pipelineAssetType: submission.assetType,
      ...(submission.sourceUrl ? { pipelineSourceUrl: submission.sourceUrl } : {}),
      ...(submission.sourceNotes ? { pipelineSourceNotes: submission.sourceNotes } : {}),
    },
    // A Set remains a true published Set; other Pipeline resources retain
    // their resource identity instead of being wrapped in a fake container.
    organization: {
      workflow: 'published-resource',
      type: getPipelineTypeLabel(submission.assetType, { plural: false }),
      tags: [],
      source: 'none',
      publicationState: 'published',
    },
  };
};

const sourceFailure = (
  id: DeskDiscoverySource,
  error: unknown,
  fallback: string,
): DeskDiscoveryFailure => {
  const boundary = describeAgentBoundaryFailure(error);
  return {
    id,
    message: error instanceof Error && error.message ? error.message : fallback,
    kind: boundary.kind,
    retryable: boundary.retryable,
    code: typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
      ? error.code
      : `${id}_unavailable`,
    correlationId: typeof error === 'object' && error !== null && 'correlationId' in error && (typeof error.correlationId === 'string' || error.correlationId === null)
      ? error.correlationId
      : null,
    ...(boundary.nextAction ? { nextAction: boundary.nextAction } : {}),
  };
};

/**
 * Loads protected Desk projections independently. Values are retained only
 * inside their current browser-workspace scope, so account changes and lost
 * permissions never leave another account's work on screen.
 */
export function useDeskWorkDiscovery({
  persistenceScope,
  experience,
}: {
  persistenceScope: ProjectPersistenceScope;
  experience: AccountExperienceProjection;
}) {
  const [campaigns, setCampaigns] = useState<ScopedDeskDiscovery<AccountLibraryItem[]> | null>(null);
  const [published, setPublished] = useState<ScopedDeskDiscovery<AccountLibraryItem[]> | null>(null);
  const generationRef = useRef(0);
  const canLoadCampaigns = experience.signedIn && (experience.owner || experience.contributor.canDraftCampaigns);
  const canLoadPublished = experience.signedIn && (experience.owner || experience.contributor.canSubmit);

  const refresh = useCallback(async () => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    const refreshSource = async <Value,>(
      allowed: boolean,
      id: DeskDiscoverySource,
      setSource: Dispatch<SetStateAction<ScopedDeskDiscovery<Value> | null>>,
      load: () => Promise<Value>,
      fallback: string,
      isEmpty: (value: Value) => boolean,
    ) => {
      if (!allowed) {
        setSource(null);
        return;
      }
      setSource((current) => beginScopedSource(current, persistenceScope));
      try {
        const value = await load();
        if (generation !== generationRef.current) return;
        setSource(settleScopedSourceValue(persistenceScope, value, { empty: isEmpty(value) }));
      } catch (error) {
        if (generation !== generationRef.current) return;
        const failure = sourceFailure(id, error, fallback);
        setSource((current) => settleScopedSourceFailure(current, persistenceScope, failure));
      }
    };

    // The requests begin together, but each completion changes only its own
    // source. A slow publication query must never hide ready campaign work.
    await Promise.all([
      refreshSource(
        canLoadCampaigns,
        'campaigns',
        setCampaigns,
        async () => (await loadCampaignDeskProjection()).campaigns.map(toCampaignDeskItem),
        'Campaign work is unavailable.',
        (items) => items.length === 0,
      ),
      refreshSource(
        canLoadPublished,
        'my-published',
        setPublished,
        async () => (await loadOwnPublishedPipelineSubmissions()).map(toPublishedDeskItem),
        'Your published Pipeline work is unavailable.',
        (items) => items.length === 0,
      ),
    ]);
  }, [canLoadCampaigns, canLoadPublished, persistenceScope]);

  useEffect(() => {
    // Clear synchronously when an account scope or authorization changes;
    // async results are also protected by the scope check above.
    if (!canLoadCampaigns) setCampaigns(null);
    if (!canLoadPublished) setPublished(null);
    void refresh();
  }, [canLoadCampaigns, canLoadPublished, persistenceScope, refresh]);

  const items = useMemo(() => [
    ...(campaigns?.scope === persistenceScope ? campaigns.value ?? [] : []),
    ...(published?.scope === persistenceScope ? published.value ?? [] : []),
  ], [campaigns, persistenceScope, published]);

  const failures = useMemo(() => [campaigns, published].flatMap((source) => (
    source?.scope === persistenceScope && source.failure ? [source.failure] : []
  )), [campaigns, persistenceScope, published]);
  const loading = [campaigns, published].some((source) => source?.scope === persistenceScope && source.phase === 'loading');
  const sourceStatuses = useMemo<DeskDiscoverySourceStatus[]>(() => [
    ...(canLoadCampaigns ? [{
      id: 'campaigns' as const,
      label: 'Campaign work',
      phase: campaigns?.scope === persistenceScope ? campaigns.phase : 'loading' as const,
      failure: campaigns?.scope === persistenceScope ? campaigns.failure : null,
    }] : []),
    ...(canLoadPublished ? [{
      id: 'my-published' as const,
      label: 'My published work',
      phase: published?.scope === persistenceScope ? published.phase : 'loading' as const,
      failure: published?.scope === persistenceScope ? published.failure : null,
    }] : []),
  ], [campaigns, canLoadCampaigns, canLoadPublished, persistenceScope, published]);

  return { items, failures, loading, sourceStatuses, refresh, canLoadCampaigns, canLoadPublished };
}
