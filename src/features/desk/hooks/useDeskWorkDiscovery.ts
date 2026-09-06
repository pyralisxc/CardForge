"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { AccountExperienceProjection } from '@/features/account/client/experience';
import { loadCampaignDeskProjection, type MarketingContentPackage } from '@/features/marketing-content/client';
import { getPipelineTypeLabel, loadOwnPublishedPipelineSubmissions, type PipelineSubmission } from '@/features/pipeline/client';
import type { ProjectPersistenceScope } from '@/features/project/client/persistence-workspace';
import type { AccountLibraryItem } from '@/features/storage-management/client';
import { describeAgentBoundaryFailure } from '@/shared/boundaryFailure';

type DeskDiscoverySource = 'campaigns' | 'my-published';

export interface DeskDiscoveryFailure {
  id: DeskDiscoverySource;
  message: string;
  kind: ReturnType<typeof describeAgentBoundaryFailure>['kind'];
  retryable: boolean;
}

interface ScopedDeskDiscovery<Value> {
  scope: ProjectPersistenceScope;
  value: Value;
}

const campaignItem = (campaign: MarketingContentPackage): AccountLibraryItem => ({
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
});

const publishedItem = (submission: PipelineSubmission): AccountLibraryItem => {
  const isSet = submission.assetType === 'sets';
  const lineageId = submission.lineageId ?? submission.id;
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
    webViewLink: submission.previewUrl || null,
    references: { pipelineLineageId: lineageId },
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
  const [failures, setFailures] = useState<DeskDiscoveryFailure[]>([]);
  const [loading, setLoading] = useState(false);
  const generationRef = useRef(0);
  const canLoadCampaigns = experience.signedIn && (experience.owner || experience.contributor.canDraftCampaigns);
  const canLoadPublished = experience.signedIn && (experience.owner || experience.contributor.canSubmit);

  const refresh = useCallback(async () => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    const nextFailures: DeskDiscoveryFailure[] = [];
    setLoading(canLoadCampaigns || canLoadPublished);

    const campaignResult = canLoadCampaigns
      ? loadCampaignDeskProjection().then((result) => result.campaigns.map(campaignItem)).catch((error) => {
        nextFailures.push(sourceFailure('campaigns', error, 'Campaign work is unavailable.'));
        return undefined;
      })
      : Promise.resolve(null);
    const publishedResult = canLoadPublished
      ? loadOwnPublishedPipelineSubmissions().then((result) => result.map(publishedItem)).catch((error) => {
        nextFailures.push(sourceFailure('my-published', error, 'Your published Pipeline work is unavailable.'));
        return undefined;
      })
      : Promise.resolve(null);
    const [nextCampaigns, nextPublished] = await Promise.all([campaignResult, publishedResult]);
    if (generation !== generationRef.current) return;

    // `null` is an intentional clearing result (signed out or no authorized
    // capability); `undefined` is an error and preserves the same-scope data.
    setCampaigns((current) => nextCampaigns === undefined
      ? current?.scope === persistenceScope ? current : null
      : nextCampaigns === null ? null : { scope: persistenceScope, value: nextCampaigns });
    setPublished((current) => nextPublished === undefined
      ? current?.scope === persistenceScope ? current : null
      : nextPublished === null ? null : { scope: persistenceScope, value: nextPublished });
    setFailures(nextFailures);
    setLoading(false);
  }, [canLoadCampaigns, canLoadPublished, persistenceScope]);

  useEffect(() => {
    // Clear synchronously when an account scope or authorization changes;
    // async results are also protected by the scope check above.
    if (!canLoadCampaigns) setCampaigns(null);
    if (!canLoadPublished) setPublished(null);
    setFailures([]);
    void refresh();
  }, [canLoadCampaigns, canLoadPublished, persistenceScope, refresh]);

  const items = useMemo(() => [
    ...(campaigns?.scope === persistenceScope ? campaigns.value : []),
    ...(published?.scope === persistenceScope ? published.value : []),
  ], [campaigns, persistenceScope, published]);

  return { items, failures, loading, refresh, canLoadCampaigns, canLoadPublished };
}
