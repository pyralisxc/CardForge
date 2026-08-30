import { describe, expect, it } from 'vitest';

import type { PipelineSubmission } from '@/features/pipeline/lib/pipelineProgram';
import { buildOwnerAssetLibraryPage } from '@/features/pipeline/lib/ownerAssetLibrary';

const submission = (
  id: string,
  assetType: PipelineSubmission['assetType'],
  status: PipelineSubmission['status'],
  name = id,
): PipelineSubmission => ({
  id,
  contributorId: `developer-${id}`,
  contributorEmail: `${id}@example.com`,
  contributorDisplayName: `Maker ${id}`,
  assetType,
  requestedStudioDestination: null,
  specialtyTags: [],
  useCaseTags: [],
  sourceNotes: '',
  name,
  description: `Description for ${name}`,
  previewUrl: '',
  sourceUrl: null,
  sourceFileSizeBytes: null,
  sourceMimeType: null,
  sourceStorageBucket: null,
  sourceStoragePath: null,
  registryAssetId: null,
  status,
  automatedStatus: status === 'published' || status === 'archived' || status === 'publish_candidate' ? status : 'voting',
  ownerStatusOverride: null,
  calculatedAccessTier: 'developer',
  automatedAccessTier: 'developer',
  ownerAccessTierOverride: null,
  qualityScore: 0,
  tierDecisionReason: null,
  ownerNote: null,
  decisionReason: null,
  positiveVotes: 0,
  negativeVotes: 0,
  currentUserVote: null,
  sourcePayload: null,
  targetRegistryAssetId: null,
  baseRevisionNumber: null,
  revisionNumber: null,
  publishedAt: status === 'published' ? '2026-08-12T01:00:00.000Z' : null,
  purgeState: null,
  submittedAt: '2026-08-12T00:00:00.000Z',
  updatedAt: null,
});

describe('owner asset library', () => {
  const submissions = [
    ...Array.from({ length: 13 }, (_, index) => submission(`template-${index + 1}`, 'templates', 'published')),
    submission('font-1', 'fonts', 'voting', 'Aurora Display'),
    submission('icon-1', 'icons', 'published', 'Moon Crest'),
  ];

  it('filters by asset type and status before paging', () => {
    const page = buildOwnerAssetLibraryPage(submissions, {
      assetType: 'templates',
      status: 'published',
      page: 2,
      pageSize: 12,
    });

    expect(page.totalItems).toBe(13);
    expect(page.totalPages).toBe(2);
    expect(page.firstItemNumber).toBe(13);
    expect(page.lastItemNumber).toBe(13);
    expect(page.items.map((item) => item.id)).toEqual(['template-13']);
  });

  it('searches asset and contributor details and clamps invalid pages', () => {
    const page = buildOwnerAssetLibraryPage(submissions, {
      assetType: 'all',
      status: 'all',
      query: 'aurora',
      page: 99,
    });

    expect(page.page).toBe(1);
    expect(page.totalItems).toBe(1);
    expect(page.items[0]?.id).toBe('font-1');
  });
});
