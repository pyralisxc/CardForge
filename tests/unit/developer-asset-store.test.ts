import { describe, expect, it } from 'vitest';

import {
  DEFAULT_DEVELOPER_PROGRAM_SETTINGS,
  type DeveloperProgramSettings,
} from '@/lib/developerAssets';
import {
  buildDeveloperAssetProgramView,
  calculateDeveloperAssetVoteTotals,
  getRegistryAccessTierForPublishedSubmission,
  mergeRegistryMetadataForSubmission,
  mapDeveloperAssetSubmissionRow,
  mapDeveloperProgramSettingsRow,
  normalizeDeveloperProfileOverrideInput,
  normalizeDeveloperAssetSubmissionEditInput,
  normalizeDeveloperAssetSubmissionInput,
} from '@/lib/developerAssetStore';

const settings: DeveloperProgramSettings = {
  ...DEFAULT_DEVELOPER_PROGRAM_SETTINGS,
  monthlySubmissionLimit: 3,
  monthlyPublishedRequirement: 2,
};

describe('developer asset store helpers', () => {
  it('keeps developer-tier published assets visible in the registry instead of hiding them', () => {
    expect(getRegistryAccessTierForPublishedSubmission('developer')).toBe('developer');
    expect(getRegistryAccessTierForPublishedSubmission('free')).toBe('free');
    expect(getRegistryAccessTierForPublishedSubmission('paid')).toBe('paid');
    expect(getRegistryAccessTierForPublishedSubmission('hidden')).toBe('hidden');
  });

  it('preserves embedded template/style payloads when syncing published submission metadata', () => {
    const metadata = mergeRegistryMetadataForSubmission(
      {
        sourceKind: 'pipeline-owner-import',
        style: { id: 'frame-mtg-rules', name: 'MTG Rules Frame' },
      },
      {
        developerId: 'owner-1',
        developerEmail: 'owner@example.test',
        sourceMimeType: 'application/json',
      },
    );

    expect(metadata).toMatchObject({
      sourceKind: 'pipeline-owner-import',
      style: { id: 'frame-mtg-rules', name: 'MTG Rules Frame' },
      developerId: 'owner-1',
      developerEmail: 'owner@example.test',
      sourceMimeType: 'application/json',
    });
  });

  it('maps database settings rows into normalized program settings', () => {
    expect(mapDeveloperProgramSettingsRow({
      max_active_developers: 25,
      monthly_submission_limit: 25,
      monthly_published_requirement: 5,
      minimum_votes_for_grading: 6,
      minimum_positive_vote_percent: 75,
      free_asset_minimum_positive_vote_percent: 60,
      paid_asset_minimum_positive_vote_percent: 82,
      minimum_votes_for_tier_assignment: 5,
      show_paid_preview_to_free_users: true,
      allow_paid_early_access_to_candidates: true,
      allow_contributor_self_voting: false,
      owner_vote_weight: 2,
      archive_visible_limit: 100,
      profit_share_pool_percent: 10,
      owner_final_review_required: true,
      publish_caps_by_type: { templates: 2, icons: 9 },
      tier_caps_by_type: { templates: { free: 10, paid: 4 } },
    })).toMatchObject({
      maxActiveDevelopers: 25,
      monthlySubmissionLimit: 25,
      monthlyPublishedRequirement: 5,
      minimumVotesForGrading: 6,
      minimumPositiveVotePercent: 75,
      freeAssetMinimumPositiveVotePercent: 60,
      paidAssetMinimumPositiveVotePercent: 82,
      minimumVotesForTierAssignment: 5,
      showPaidPreviewToFreeUsers: true,
      allowPaidEarlyAccessToCandidates: true,
      allowContributorSelfVoting: false,
      ownerVoteWeight: 2,
      publishCapsByType: {
        templates: 14,
        icons: DEFAULT_DEVELOPER_PROGRAM_SETTINGS.tierCapsByType.icons.free
          + DEFAULT_DEVELOPER_PROGRAM_SETTINGS.tierCapsByType.icons.paid,
      },
      tierCapsByType: {
        templates: { free: 10, paid: 4 },
      },
    });
  });

  it('normalizes cleared developer contract notes as blank strings for the database', () => {
    expect(normalizeDeveloperProfileOverrideInput({
      monthlySubmissionLimitOverride: 100,
      monthlyPublishedRequirementOverride: 0,
      profitShareEligible: true,
      ownerNote: '',
    })).toMatchObject({
      monthly_submission_limit_override: 100,
      monthly_published_requirement_override: 0,
      eligible_for_profit_share: true,
      owner_note: '',
    });
  });

  it('weights owner votes while keeping developer votes at one vote each', () => {
    expect(calculateDeveloperAssetVoteTotals([
      { developer_id: 'owner-1', vote_value: 'positive' },
      { developer_id: 'dev-1', vote_value: 'negative' },
      { developer_id: 'dev-2', vote_value: 'positive' },
    ], {
      ownerDeveloperId: 'owner-1',
      ownerVoteWeight: 3,
    })).toEqual({
      positiveVotes: 4,
      negativeVotes: 1,
    });
  });

  it('normalizes developer submission input and rejects unsupported asset types', () => {
    expect(normalizeDeveloperAssetSubmissionInput({
      assetType: 'icons',
      name: '  Moon Sigil  ',
      description: '  clean vector icon  ',
      previewUrl: '  https://example.test/moon.svg  ',
      sourceUrl: '  https://storage.example.test/moon.svg  ',
      sourceFileSizeBytes: '2048',
      sourceMimeType: ' image/svg+xml ',
      sourceStorageBucket: ' cardforge-developer-assets ',
      sourceStoragePath: ' dev-1/icons/moon.svg ',
    })).toEqual({
      ok: true,
      value: {
        assetType: 'icons',
        name: 'Moon Sigil',
        description: 'clean vector icon',
        previewUrl: 'https://example.test/moon.svg',
        sourceUrl: 'https://storage.example.test/moon.svg',
        sourceFileSizeBytes: 2048,
        sourceMimeType: 'image/svg+xml',
        sourceStorageBucket: 'cardforge-developer-assets',
        sourceStoragePath: 'dev-1/icons/moon.svg',
      },
    });

    expect(normalizeDeveloperAssetSubmissionInput({
      assetType: 'icons',
      name: 'Moon Sigil',
    })).toEqual({
      ok: false,
      message: 'Upload a source file before submitting this asset.',
    });

    expect(normalizeDeveloperAssetSubmissionInput({
      assetType: 'tsx',
      name: 'Executable',
    })).toEqual({
      ok: false,
      message: 'Choose a supported asset type.',
    });
  });

  it('normalizes developer-owned submission edits', () => {
    expect(normalizeDeveloperAssetSubmissionEditInput({
      name: '  Moon Sigil v2  ',
      description: '  brighter export preview  ',
      previewUrl: '  https://example.test/moon-v2.svg  ',
    })).toEqual({
      ok: true,
      value: {
        name: 'Moon Sigil v2',
        description: 'brighter export preview',
        previewUrl: 'https://example.test/moon-v2.svg',
      },
    });

    expect(normalizeDeveloperAssetSubmissionEditInput({
      description: 'No name',
    })).toEqual({
      ok: false,
      message: 'Asset name is required.',
    });
  });

  it('maps submission rows with vote counts and current user vote', () => {
    expect(mapDeveloperAssetSubmissionRow({
      id: 'asset-1',
      developer_id: 'dev-1',
      developer_email: 'dev@example.test',
      asset_type: 'icons',
      name: 'Moon Sigil',
      description: 'Icon',
      preview_url: 'https://example.test/moon.svg',
      source_url: 'https://storage.example.test/moon.svg',
      source_file_size_bytes: 2048,
      source_mime_type: 'image/svg+xml',
      source_storage_bucket: 'cardforge-developer-assets',
      source_storage_path: 'dev-1/icons/moon.svg',
      registry_asset_id: 'developer-icons-asset-1',
      status: 'voting',
      owner_note: null,
      decision_reason: 'needs_more_votes',
      calculated_access_tier: 'developer',
      owner_access_tier_override: null,
      quality_score: 80,
      tier_decision_reason: 'needs_more_votes',
      positive_votes: 4,
      negative_votes: 1,
      submitted_at: '2026-05-01T00:00:00.000Z',
      updated_at: '2026-05-02T00:00:00.000Z',
    }, { 'asset-1': 'positive' }, {
      clerk_user_id: 'dev-1',
      email: 'ada@example.test',
      first_name: 'Ada',
      last_name: 'Lovelace',
    })).toMatchObject({
      id: 'asset-1',
      developerId: 'dev-1',
      developerEmail: 'ada@example.test',
      developerFirstName: 'Ada',
      developerLastName: 'Lovelace',
      developerDisplayName: 'Ada Lovelace',
      assetType: 'icons',
      status: 'voting',
      positiveVotes: 4,
      negativeVotes: 1,
      currentUserVote: 'positive',
      calculatedAccessTier: 'developer',
      ownerAccessTierOverride: null,
      qualityScore: 80,
      tierDecisionReason: 'needs_more_votes',
      sourceUrl: 'https://storage.example.test/moon.svg',
      sourceFileSizeBytes: 2048,
      sourceMimeType: 'image/svg+xml',
      sourceStorageBucket: 'cardforge-developer-assets',
      sourceStoragePath: 'dev-1/icons/moon.svg',
      registryAssetId: 'developer-icons-asset-1',
    });
  });

  it('builds developer views with monthly stats, remaining submissions, and continuous peer review queue', () => {
    const submissions = [
      { id: 'own-1', developerId: 'dev-1', developerEmail: 'dev@example.test', assetType: 'icons', name: 'Mine', description: '', previewUrl: '', sourceUrl: null, sourceFileSizeBytes: null, sourceMimeType: null, sourceStorageBucket: null, sourceStoragePath: null, registryAssetId: null, status: 'submitted', calculatedAccessTier: 'developer', ownerAccessTierOverride: null, qualityScore: 0, tierDecisionReason: 'needs_more_votes', positiveVotes: 0, negativeVotes: 0, currentUserVote: null, submittedAt: '2026-05-01T00:00:00.000Z', updatedAt: '2026-05-01T00:00:00.000Z' },
      { id: 'own-2', developerId: 'dev-1', developerEmail: 'dev@example.test', assetType: 'icons', name: 'Mine Published', description: '', previewUrl: '', sourceUrl: null, sourceFileSizeBytes: null, sourceMimeType: null, sourceStorageBucket: null, sourceStoragePath: null, registryAssetId: null, status: 'published', calculatedAccessTier: 'paid', ownerAccessTierOverride: null, qualityScore: 100, tierDecisionReason: 'paid_candidate', positiveVotes: 5, negativeVotes: 0, currentUserVote: null, submittedAt: '2026-05-02T00:00:00.000Z', updatedAt: '2026-05-02T00:00:00.000Z' },
      { id: 'peer-1', developerId: 'dev-2', developerEmail: 'peer@example.test', assetType: 'textures', name: 'Peer', description: '', previewUrl: '', sourceUrl: null, sourceFileSizeBytes: null, sourceMimeType: null, sourceStorageBucket: null, sourceStoragePath: null, registryAssetId: null, status: 'voting', calculatedAccessTier: 'developer', ownerAccessTierOverride: null, qualityScore: 100, tierDecisionReason: 'needs_more_votes', positiveVotes: 1, negativeVotes: 0, currentUserVote: null, submittedAt: '2026-05-03T00:00:00.000Z', updatedAt: '2026-05-03T00:00:00.000Z' },
      { id: 'peer-2', developerId: 'dev-2', developerEmail: 'peer@example.test', assetType: 'icons', name: 'Peer Published', description: '', previewUrl: '', sourceUrl: null, sourceFileSizeBytes: null, sourceMimeType: null, sourceStorageBucket: null, sourceStoragePath: null, registryAssetId: 'developer-icons-peer-2', status: 'published', calculatedAccessTier: 'free', ownerAccessTierOverride: null, qualityScore: 80, tierDecisionReason: 'free_candidate', positiveVotes: 4, negativeVotes: 1, currentUserVote: 'positive', submittedAt: '2026-05-04T00:00:00.000Z', updatedAt: '2026-05-04T00:00:00.000Z' },
      { id: 'starter-1', developerId: 'owner-1', developerEmail: 'owner@example.test', assetType: 'dividers', name: 'Starter Library Divider', description: '', previewUrl: '', sourceUrl: null, sourceFileSizeBytes: null, sourceMimeType: null, sourceStorageBucket: null, sourceStoragePath: null, registryAssetId: 'starter-divider', status: 'published', calculatedAccessTier: 'free', ownerAccessTierOverride: null, qualityScore: 0, tierDecisionReason: 'free_candidate', positiveVotes: 0, negativeVotes: 0, currentUserVote: null, submittedAt: '2026-05-05T00:00:00.000Z', updatedAt: '2026-05-05T00:00:00.000Z' },
      { id: 'archived-1', developerId: 'dev-2', developerEmail: 'peer@example.test', assetType: 'icons', name: 'Archived', description: '', previewUrl: '', sourceUrl: null, sourceFileSizeBytes: null, sourceMimeType: null, sourceStorageBucket: null, sourceStoragePath: null, registryAssetId: null, status: 'archived', calculatedAccessTier: 'hidden', ownerAccessTierOverride: null, qualityScore: 20, tierDecisionReason: 'hidden_status', positiveVotes: 1, negativeVotes: 4, currentUserVote: null, submittedAt: '2026-05-06T00:00:00.000Z', updatedAt: '2026-05-06T00:00:00.000Z' },
    ] as const;

    const view = buildDeveloperAssetProgramView({
      configured: true,
      settings,
      currentUserId: 'dev-1',
      submissions: [...submissions],
      now: new Date('2026-05-23T00:00:00.000Z'),
    });

    expect(view.developerStats).toEqual({ submitted: 2, published: 1, archived: 0, rejected: 0 });
    expect(view.remainingSubmissions).toBe(1);
    expect(view.votingQueue.map((submission) => submission.id)).toEqual(['own-1', 'own-2', 'peer-1', 'peer-2', 'starter-1']);
    expect(view.assetTypeSummaries.find((summary) => summary.assetType === 'icons')).toMatchObject({
      publishedCount: 2,
      officialCount: 0,
      candidateCount: 0,
      archiveCount: 1,
    });
    expect(view.developerContributions.find((contribution) => contribution.developerId === 'dev-1')).toMatchObject({
      submitted: 2,
      published: 1,
      remainingSubmissions: 1,
      requiredPublished: 2,
      missingPublished: 1,
    });
    const ownerView = buildDeveloperAssetProgramView({
      configured: true,
      settings,
      currentUserId: 'owner-1',
      currentContributorIds: ['owner-1'],
      submissions: [...submissions],
      profiles: [{
        clerk_user_id: 'owner-1',
        email: 'owner@example.test',
        first_name: 'Cameron',
        last_name: 'Locke',
      }],
      now: new Date('2026-05-23T00:00:00.000Z'),
    });
    expect(ownerView.currentContributorIds).toEqual(['owner-1']);
    expect(ownerView.developerStats).toEqual({ submitted: 1, published: 1, archived: 0, rejected: 0 });
    expect(ownerView.remainingSubmissions).toBe(settings.monthlySubmissionLimit - 1);
    expect(ownerView.votingQueue.map((submission) => submission.id)).toEqual(['own-1', 'own-2', 'peer-1', 'peer-2', 'starter-1']);
    expect(ownerView.developerContributions.find((contribution) => contribution.developerId === 'owner-1')).toMatchObject({
      developerName: 'Cameron Locke',
      developerEmail: 'owner@example.test',
      isOwnerDefaultContributor: false,
    });

    const peerOnlyView = buildDeveloperAssetProgramView({
      configured: true,
      settings: { ...settings, allowContributorSelfVoting: false },
      currentUserId: 'owner-1',
      currentContributorIds: ['owner-1'],
      submissions: [...submissions],
      now: new Date('2026-05-23T00:00:00.000Z'),
    });
    expect(peerOnlyView.votingQueue.map((submission) => submission.id)).toEqual(['own-1', 'own-2', 'peer-1', 'peer-2']);
  });

  it('keeps departed developer contributions visible even when no live profile row is present', () => {
    const view = buildDeveloperAssetProgramView({
      configured: true,
      settings,
      currentUserId: 'owner-1',
      submissions: [{
        id: 'departed-asset-1',
        developerId: 'deleted-clerk-user',
        developerEmail: 'departed@example.test',
        assetType: 'icons',
        name: 'Departed Contributor Icon',
        description: '',
        previewUrl: 'https://example.test/departed.svg',
        sourceUrl: 'https://example.test/departed.svg',
        sourceFileSizeBytes: 2048,
        sourceMimeType: 'image/svg+xml',
        sourceStorageBucket: 'cardforge-developer-assets',
        sourceStoragePath: 'deleted-clerk-user/icons/departed.svg',
        registryAssetId: 'developer-icons-departed',
        status: 'published',
        calculatedAccessTier: 'free',
        ownerAccessTierOverride: null,
        qualityScore: 75,
        tierDecisionReason: 'free_candidate',
        positiveVotes: 3,
        negativeVotes: 1,
        currentUserVote: null,
        submittedAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-02T00:00:00.000Z',
      }],
      profiles: [],
      now: new Date('2026-05-23T00:00:00.000Z'),
    });

    expect(view.submissions[0]).toMatchObject({
      developerId: 'deleted-clerk-user',
      developerEmail: 'departed@example.test',
      positiveVotes: 3,
      negativeVotes: 1,
      status: 'published',
    });
    expect(view.developerContributions.find((contribution) => contribution.developerId === 'deleted-clerk-user')).toMatchObject({
      developerName: 'departed@example.test',
      developerEmail: 'departed@example.test',
      profileStatus: 'active',
      published: 1,
    });
  });

  it('keeps inactive profile-only rows out of the monthly roster while preserving inactive contributors with assets', () => {
    const view = buildDeveloperAssetProgramView({
      configured: true,
      settings,
      currentUserId: 'owner-1',
      submissions: [{
        id: 'inactive-asset-1',
        developerId: 'inactive-with-history',
        developerEmail: 'history@example.test',
        assetType: 'icons',
        name: 'History Icon',
        description: '',
        previewUrl: '',
        sourceUrl: null,
        sourceFileSizeBytes: null,
        sourceMimeType: null,
        sourceStorageBucket: null,
        sourceStoragePath: null,
        registryAssetId: null,
        status: 'published',
        calculatedAccessTier: 'free',
        ownerAccessTierOverride: null,
        qualityScore: 100,
        tierDecisionReason: 'free_candidate',
        positiveVotes: 4,
        negativeVotes: 0,
        currentUserVote: null,
        submittedAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-01T00:00:00.000Z',
      }],
      profiles: [
        { clerk_user_id: 'stale-no-history', email: 'stale@example.test', status: 'inactive' },
        { clerk_user_id: 'inactive-with-history', email: 'history@example.test', status: 'inactive' },
      ],
      now: new Date('2026-05-23T00:00:00.000Z'),
    });

    expect(view.developerContributions.some((contribution) => contribution.developerId === 'stale-no-history')).toBe(false);
    expect(view.developerContributions.find((contribution) => contribution.developerId === 'inactive-with-history')).toMatchObject({
      profileStatus: 'inactive',
      published: 1,
    });
  });

  it('applies per-developer contract overrides over base program settings', () => {
    const submissions = [
      { id: 'own-1', developerId: 'dev-1', developerEmail: 'dev@example.test', assetType: 'icons', name: 'Mine', description: '', previewUrl: '', sourceUrl: null, sourceFileSizeBytes: null, sourceMimeType: null, sourceStorageBucket: null, sourceStoragePath: null, registryAssetId: null, status: 'submitted', calculatedAccessTier: 'developer', ownerAccessTierOverride: null, qualityScore: 0, tierDecisionReason: 'needs_more_votes', positiveVotes: 0, negativeVotes: 0, currentUserVote: null, submittedAt: '2026-05-01T00:00:00.000Z', updatedAt: '2026-05-01T00:00:00.000Z' },
      { id: 'own-2', developerId: 'dev-1', developerEmail: 'dev@example.test', assetType: 'icons', name: 'Mine 2', description: '', previewUrl: '', sourceUrl: null, sourceFileSizeBytes: null, sourceMimeType: null, sourceStorageBucket: null, sourceStoragePath: null, registryAssetId: null, status: 'submitted', calculatedAccessTier: 'developer', ownerAccessTierOverride: null, qualityScore: 0, tierDecisionReason: 'needs_more_votes', positiveVotes: 0, negativeVotes: 0, currentUserVote: null, submittedAt: '2026-05-02T00:00:00.000Z', updatedAt: '2026-05-02T00:00:00.000Z' },
    ] as const;

    const view = buildDeveloperAssetProgramView({
      configured: true,
      settings,
      currentUserId: 'dev-1',
      submissions: [...submissions],
      profiles: [{
        clerk_user_id: 'dev-1',
        email: 'dev@example.test',
        first_name: 'Ada',
        last_name: 'Lovelace',
        monthly_submission_limit_override: 5,
        monthly_published_requirement_override: 1,
        eligible_for_profit_share: false,
        owner_note: 'Ramp up account.',
      }],
      now: new Date('2026-05-23T00:00:00.000Z'),
    });

    expect(view.effectiveMonthlySubmissionLimit).toBe(5);
    expect(view.effectiveMonthlyPublishedRequirement).toBe(1);
    expect(view.remainingSubmissions).toBe(3);
    expect(view.profitShareEligible).toBe(false);
    expect(view.developerOwnerNote).toBe('Ramp up account.');
    expect(view.developerContributions.find((contribution) => contribution.developerId === 'dev-1')).toMatchObject({
      developerName: 'Ada Lovelace',
      effectiveSubmissionLimit: 5,
      effectivePublishedRequirement: 1,
      submissionLimitOverride: 5,
      publishedRequirementOverride: 1,
      remainingSubmissions: 3,
      requiredPublished: 1,
      missingPublished: 1,
      profitShareEligible: false,
      ownerNote: 'Ramp up account.',
    });
  });
});
