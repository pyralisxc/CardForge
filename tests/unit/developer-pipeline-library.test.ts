import { describe, expect, it } from 'vitest';

import { DEFAULT_DEVELOPER_PROGRAM_SETTINGS } from '@/features/developer-assets/lib/developerAssets';
import {
  getDeveloperAssetImagePreviewUrl,
  isDeveloperPipelineReviewable,
  projectDeveloperPipelineLibrary,
} from '@/features/developer-assets/lib/developerPipelineLibrary';
import type { DeveloperAssetSubmission } from '@/features/developer-assets/lib/developerAssetProgram';

const submission = (
  id: string,
  overrides: Partial<DeveloperAssetSubmission> = {},
): DeveloperAssetSubmission => ({
  id,
  developerId: 'contributor-other',
  developerEmail: null,
  developerDisplayName: 'Other Contributor',
  assetType: 'templates',
  requestedStudioDestination: 'template.front',
  specialtyTags: ['games'],
  useCaseTags: ['playing-cards'],
  sourceNotes: 'Original work cleared for CardForge review.',
  name: 'Classic Front',
  description: 'A readable playing-card face.',
  previewUrl: '/api/templates#classic-front',
  sourceUrl: null,
  sourceFileSizeBytes: 1024,
  sourceMimeType: 'application/json',
  sourceStorageBucket: null,
  sourceStoragePath: null,
  registryAssetId: null,
  status: 'submitted',
  automatedStatus: 'voting',
  ownerStatusOverride: null,
  calculatedAccessTier: 'developer',
  automatedAccessTier: 'developer',
  ownerAccessTierOverride: null,
  qualityScore: 72,
  tierDecisionReason: null,
  decisionReason: null,
  positiveVotes: 2,
  negativeVotes: 0,
  currentUserVote: null,
  sourcePayload: null,
  targetRegistryAssetId: 'classic-front',
  baseRevisionNumber: 0,
  revisionNumber: 1,
  publishedAt: null,
  purgeState: null,
  submittedAt: '2026-08-20T12:00:00.000Z',
  updatedAt: '2026-08-20T12:00:00.000Z',
  ...overrides,
});

const program = (submissions: DeveloperAssetSubmission[]) => ({
  submissions: submissions.filter((item) => item.developerId === 'contributor-current'),
  votingQueue: submissions.filter((item) => item.developerId !== 'contributor-current'),
  currentContributorIds: ['contributor-current'],
  settings: DEFAULT_DEVELOPER_PROGRAM_SETTINGS,
});

describe('Pipeline Library projection', () => {
  it('shows one object per lineage and keeps the current published revision primary', () => {
    const published = submission('published-r2', {
      status: 'published', revisionNumber: 2, publishedAt: '2026-08-22T12:00:00.000Z',
    });
    const candidate = submission('candidate-r3', {
      status: 'publish_candidate', revisionNumber: 3, updatedAt: '2026-08-24T12:00:00.000Z',
    });

    const projected = projectDeveloperPipelineLibrary(program([candidate, published]));

    expect(projected).toHaveLength(1);
    expect(projected[0].submission.id).toBe('published-r2');
    expect(projected[0].currentPublishedSubmission?.id).toBe('published-r2');
    expect(projected[0].revisions.map((item) => item.id)).toEqual(['candidate-r3', 'published-r2']);
    expect(projected[0].reviewState).toBe('closed');
  });

  it('uses the strongest active candidate when a lineage has no published revision', () => {
    const newerDraft = submission('draft-r4', {
      developerId: 'contributor-current', status: 'draft', revisionNumber: 4,
    });
    const candidate = submission('candidate-r3', {
      developerId: 'contributor-current', status: 'publish_candidate', revisionNumber: 3,
    });

    const projected = projectDeveloperPipelineLibrary(program([newerDraft, candidate]));

    expect(projected[0].submission.id).toBe('candidate-r3');
    expect(projected[0].ownership).toBe('mine');
    expect(projected[0].reviewState).toBe('available');
  });

  it('separates lifecycle from voteability', () => {
    expect(isDeveloperPipelineReviewable(submission('submitted'))).toBe(true);
    expect(isDeveloperPipelineReviewable(submission('live', { status: 'published' }))).toBe(false);
    expect(isDeveloperPipelineReviewable(submission('archived', { status: 'archived' }))).toBe(false);
  });

  it('admits only real image previews and rejects packages, fonts, and structured endpoints', () => {
    expect(getDeveloperAssetImagePreviewUrl(submission('image', {
      previewUrl: 'https://storage.example.test/preview.webp',
      sourceMimeType: 'application/vnd.cardforge.project+zip',
    }))).toBe('https://storage.example.test/preview.webp');
    expect(getDeveloperAssetImagePreviewUrl(submission('package', {
      previewUrl: 'https://storage.example.test/deck.cardforge',
      sourceMimeType: 'application/vnd.cardforge.project+zip',
    }))).toBeNull();
    expect(getDeveloperAssetImagePreviewUrl(submission('template', {
      previewUrl: '/api/templates#classic-front',
      sourceMimeType: 'application/json',
    }))).toBeNull();
  });
});
