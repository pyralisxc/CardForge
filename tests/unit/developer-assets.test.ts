import { describe, expect, it } from 'vitest';

import {
  DEFAULT_DEVELOPER_PROGRAM_SETTINGS,
  buildDeveloperVotingPresetSettings,
  countDeveloperMonthlyStats,
  estimateDeveloperAssetStorage,
  evaluateDeveloperAssetDecision,
  evaluateDeveloperAssetDecisionForType,
  evaluateDeveloperAssetAccessTier,
  getVisibleArchivedSubmissions,
  normalizeDeveloperProgramSettingsInput,
} from '@/lib/developerAssets';
import {
  getReviewProgressLabel,
  getReviewProgressPercent,
  getSubmissionNextStep,
} from '@/features/developer-assets/components/DeveloperAssetHubModel';
import type { DeveloperAssetSubmission } from '@/features/developer-assets/components/DeveloperAssetHubModel';

const baseSubmission: DeveloperAssetSubmission = {
  id: 'asset-1',
  developerId: 'dev-1',
  developerEmail: 'dev@example.test',
  developerFirstName: null,
  developerLastName: null,
  developerDisplayName: 'Dev Example',
  assetType: 'icons',
  name: 'Smoke Icon',
  description: '',
  previewUrl: '',
  sourceUrl: null,
  sourceFileSizeBytes: null,
  sourceMimeType: null,
  sourceStorageBucket: null,
  sourceStoragePath: null,
  registryAssetId: null,
  status: 'voting',
  calculatedAccessTier: 'developer',
  ownerAccessTierOverride: null,
  qualityScore: 0,
  tierDecisionReason: 'needs_more_votes',
  ownerNote: null,
  decisionReason: 'needs_more_votes',
  positiveVotes: 0,
  negativeVotes: 0,
  currentUserVote: null,
  submittedAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-01T00:00:00.000Z',
};

describe('developer asset program rules', () => {
  it('normalizes owner settings with launch defaults and guardrails', () => {
    const settings = normalizeDeveloperProgramSettingsInput({
      maxActiveDevelopers: '200',
      monthlySubmissionLimit: '-2',
      monthlyPublishedRequirement: '7',
      minimumVotesForGrading: '3',
      minimumPositiveVotePercent: '88',
      freeAssetMinimumPositiveVotePercent: '60',
      paidAssetMinimumPositiveVotePercent: '80',
      minimumVotesForTierAssignment: '5',
      showPaidPreviewToFreeUsers: true,
      allowPaidEarlyAccessToCandidates: true,
      allowContributorSelfVoting: false,
      ownerVoteWeight: '3',
      archiveVisibleLimit: '1000',
      profitSharePoolPercent: '15',
      publishCapsByType: { templates: '4', icons: -1 },
      tierCapsByType: { templates: { free: '12', paid: '6' }, icons: { free: -1, paid: 'abc' } },
    });

    expect(settings.maxActiveDevelopers).toBe(100);
    expect(settings.monthlySubmissionLimit).toBe(DEFAULT_DEVELOPER_PROGRAM_SETTINGS.monthlySubmissionLimit);
    expect(settings.monthlyPublishedRequirement).toBe(7);
    expect(settings.minimumVotesForGrading).toBe(3);
    expect(settings.minimumPositiveVotePercent).toBe(88);
    expect(settings.freeAssetMinimumPositiveVotePercent).toBe(60);
    expect(settings.paidAssetMinimumPositiveVotePercent).toBe(80);
    expect(settings.minimumVotesForTierAssignment).toBe(5);
    expect(settings.showPaidPreviewToFreeUsers).toBe(true);
    expect(settings.allowPaidEarlyAccessToCandidates).toBe(true);
    expect(settings.allowContributorSelfVoting).toBe(false);
    expect(settings.ownerVoteWeight).toBe(3);
    expect(settings.archiveVisibleLimit).toBe(500);
    expect(settings.profitSharePoolPercent).toBe(15);
    expect(settings.tierCapsByType.templates).toEqual({ free: 12, paid: 6 });
    expect(settings.tierCapsByType.icons).toEqual(DEFAULT_DEVELOPER_PROGRAM_SETTINGS.tierCapsByType.icons);
    expect(settings.publishCapsByType.templates).toBe(18);
    expect(settings.publishCapsByType.icons).toBe(
      settings.tierCapsByType.icons.free + settings.tierCapsByType.icons.paid
    );
  });

  it('keeps owner vote weight inside the supported impact range', () => {
    expect(normalizeDeveloperProgramSettingsInput({
      ownerVoteWeight: 99,
    }).ownerVoteWeight).toBe(3);

    expect(normalizeDeveloperProgramSettingsInput({
      ownerVoteWeight: 2,
    }).ownerVoteWeight).toBe(2);
  });

  it('derives publish caps from Starter plus Creator Pass caps', () => {
    const settings = normalizeDeveloperProgramSettingsInput({
      publishCapsByType: { icons: 999 },
      tierCapsByType: {
        icons: { free: 21, paid: 13 },
        templates: { free: 4, paid: 2 },
      },
    });

    expect(settings.publishCapsByType.icons).toBe(34);
    expect(settings.publishCapsByType.templates).toBe(6);
    expect(settings.publishCapsByType.textures).toBe(
      settings.tierCapsByType.textures.free + settings.tierCapsByType.textures.paid
    );
  });

  it('keeps assets in voting until the minimum vote count is reached', () => {
    expect(evaluateDeveloperAssetDecision({
      settings: DEFAULT_DEVELOPER_PROGRAM_SETTINGS,
      positiveVotes: 4,
      negativeVotes: 0,
      publishedThisPeriodForType: 0,
      ownerFinalReviewRequired: false,
    })).toMatchObject({ nextStatus: 'voting', reason: 'needs_more_votes' });
  });

  it('archives assets with enough votes and more negative than positive votes', () => {
    expect(evaluateDeveloperAssetDecision({
      settings: DEFAULT_DEVELOPER_PROGRAM_SETTINGS,
      positiveVotes: 2,
      negativeVotes: 4,
      publishedThisPeriodForType: 0,
      ownerFinalReviewRequired: false,
    })).toMatchObject({ nextStatus: 'archived', reason: 'negative_vote_balance' });
  });

  it('promotes strong assets to publish candidates until type caps are reached', () => {
    expect(evaluateDeveloperAssetDecision({
      settings: {
        ...DEFAULT_DEVELOPER_PROGRAM_SETTINGS,
        minimumPositiveVotePercent: 70,
        publishCapsByType: { ...DEFAULT_DEVELOPER_PROGRAM_SETTINGS.publishCapsByType, icons: 2 },
      },
      positiveVotes: 7,
      negativeVotes: 1,
      publishedThisPeriodForType: 1,
      ownerFinalReviewRequired: false,
    })).toMatchObject({ nextStatus: 'publish_candidate', reason: 'passes_vote_threshold' });
  });

  it('keeps otherwise passing assets in voting when the type cap is full', () => {
    expect(evaluateDeveloperAssetDecisionForType({
      settings: {
        ...DEFAULT_DEVELOPER_PROGRAM_SETTINGS,
        minimumPositiveVotePercent: 70,
        publishCapsByType: { ...DEFAULT_DEVELOPER_PROGRAM_SETTINGS.publishCapsByType, icons: 2 },
      },
      assetType: 'icons',
      positiveVotes: 7,
      negativeVotes: 1,
      publishedThisPeriodForType: 2,
      ownerFinalReviewRequired: false,
    })).toMatchObject({ nextStatus: 'voting', reason: 'publish_cap_full' });
  });

  it('shows only the latest archive window by timeline', () => {
    const archived = Array.from({ length: 103 }, (_, index) => ({
      id: `asset-${index}`,
      status: 'archived' as const,
      submittedAt: `2026-05-${String((index % 28) + 1).padStart(2, '0')}T00:00:00.000Z`,
      updatedAt: `2026-06-${String((index % 28) + 1).padStart(2, '0')}T00:00:00.000Z`,
    }));

    expect(getVisibleArchivedSubmissions(archived, 100)).toHaveLength(100);
  });

  it('counts monthly developer stats by submitted, published, archived, and rejected states', () => {
    const stats = countDeveloperMonthlyStats([
      { status: 'submitted', submittedAt: '2026-05-01T00:00:00.000Z' },
      { status: 'published', submittedAt: '2026-05-02T00:00:00.000Z' },
      { status: 'archived', submittedAt: '2026-05-03T00:00:00.000Z' },
      { status: 'rejected', submittedAt: '2026-05-04T00:00:00.000Z' },
      { status: 'published', submittedAt: '2026-04-04T00:00:00.000Z' },
    ], new Date('2026-05-23T00:00:00.000Z'));

    expect(stats).toEqual({ submitted: 4, published: 1, archived: 1, rejected: 1 });
  });

  it('keeps assets below the tier vote minimum in developer review', () => {
    expect(evaluateDeveloperAssetAccessTier({
      settings: DEFAULT_DEVELOPER_PROGRAM_SETTINGS,
      status: 'voting',
      assetType: 'icons',
      positiveVotes: 4,
      negativeVotes: 0,
      tieredThisPeriodForType: 0,
    })).toMatchObject({
      accessTier: 'developer',
      reason: 'needs_more_votes',
      qualityScore: 100,
    });
  });

  it('assigns the starter library tier for assets meeting the free threshold', () => {
    expect(evaluateDeveloperAssetAccessTier({
      settings: DEFAULT_DEVELOPER_PROGRAM_SETTINGS,
      status: 'published',
      assetType: 'icons',
      positiveVotes: 3,
      negativeVotes: 2,
      tieredThisPeriodForType: 0,
    })).toMatchObject({
      accessTier: 'free',
      reason: 'free_candidate',
      qualityScore: 60,
    });
  });

  it('assigns the Creator Pass tier for assets meeting the paid threshold', () => {
    expect(evaluateDeveloperAssetAccessTier({
      settings: DEFAULT_DEVELOPER_PROGRAM_SETTINGS,
      status: 'published',
      assetType: 'icons',
      positiveVotes: 4,
      negativeVotes: 1,
      tieredThisPeriodForType: 0,
    })).toMatchObject({
      accessTier: 'paid',
      reason: 'paid_candidate',
      qualityScore: 80,
    });
  });

  it('hides assets below the starter threshold after enough votes', () => {
    expect(evaluateDeveloperAssetAccessTier({
      settings: DEFAULT_DEVELOPER_PROGRAM_SETTINGS,
      status: 'published',
      assetType: 'icons',
      positiveVotes: 2,
      negativeVotes: 3,
      tieredThisPeriodForType: 0,
    })).toMatchObject({
      accessTier: 'hidden',
      reason: 'below_free_threshold',
      qualityScore: 40,
    });
  });

  it('lets owner tier overrides force visibility independent of votes', () => {
    expect(evaluateDeveloperAssetAccessTier({
      settings: DEFAULT_DEVELOPER_PROGRAM_SETTINGS,
      status: 'archived',
      assetType: 'icons',
      positiveVotes: 0,
      negativeVotes: 5,
      tieredThisPeriodForType: 0,
      ownerAccessTierOverride: 'free',
    })).toMatchObject({
      accessTier: 'free',
      reason: 'owner_forced_free',
    });
  });

  it('uses the paid tier cap only for Creator Pass candidates', () => {
    expect(evaluateDeveloperAssetAccessTier({
      settings: {
        ...DEFAULT_DEVELOPER_PROGRAM_SETTINGS,
        tierCapsByType: {
          ...DEFAULT_DEVELOPER_PROGRAM_SETTINGS.tierCapsByType,
          icons: { free: 10, paid: 1 },
        },
      },
      status: 'published',
      assetType: 'icons',
      positiveVotes: 4,
      negativeVotes: 1,
      freeTieredThisPeriodForType: 0,
      paidTieredThisPeriodForType: 1,
    })).toMatchObject({
      accessTier: 'developer',
      reason: 'tier_cap_full',
      qualityScore: 80,
    });
  });

  it('can ignore tier caps when refreshing already-published assets', () => {
    expect(evaluateDeveloperAssetAccessTier({
      settings: {
        ...DEFAULT_DEVELOPER_PROGRAM_SETTINGS,
        tierCapsByType: {
          ...DEFAULT_DEVELOPER_PROGRAM_SETTINGS.tierCapsByType,
          icons: { free: 10, paid: 1 },
        },
      },
      status: 'published',
      assetType: 'icons',
      positiveVotes: 4,
      negativeVotes: 1,
      paidTieredThisPeriodForType: 12,
      ignoreTierCaps: true,
    })).toMatchObject({
      accessTier: 'paid',
      reason: 'paid_candidate',
      qualityScore: 80,
    });
  });

  it('uses the free tier cap only for Starter Library candidates', () => {
    expect(evaluateDeveloperAssetAccessTier({
      settings: {
        ...DEFAULT_DEVELOPER_PROGRAM_SETTINGS,
        tierCapsByType: {
          ...DEFAULT_DEVELOPER_PROGRAM_SETTINGS.tierCapsByType,
          icons: { free: 1, paid: 10 },
        },
      },
      status: 'published',
      assetType: 'icons',
      positiveVotes: 3,
      negativeVotes: 2,
      freeTieredThisPeriodForType: 1,
      paidTieredThisPeriodForType: 0,
    })).toMatchObject({
      accessTier: 'developer',
      reason: 'tier_cap_full',
      qualityScore: 60,
    });
  });

  it('builds voting presets that scale from solo testing to larger developer review', () => {
    const solo = buildDeveloperVotingPresetSettings(DEFAULT_DEVELOPER_PROGRAM_SETTINGS, 'solo', 1);
    const currentRoster = buildDeveloperVotingPresetSettings(DEFAULT_DEVELOPER_PROGRAM_SETTINGS, 'currentRoster', 7);
    const fullCouncil = buildDeveloperVotingPresetSettings(DEFAULT_DEVELOPER_PROGRAM_SETTINGS, 'fullCouncil', 25);

    expect(solo.minimumVotesForGrading).toBe(1);
    expect(solo.minimumVotesForTierAssignment).toBe(1);
    expect(currentRoster.minimumVotesForGrading).toBe(5);
    expect(currentRoster.minimumVotesForTierAssignment).toBe(5);
    expect(fullCouncil.minimumVotesForGrading).toBe(9);
    expect(fullCouncil.minimumVotesForTierAssignment).toBe(9);
  });

  it('summarizes developer review progress for pipeline cards', () => {
    expect(getReviewProgressLabel({ positiveVotes: 2, negativeVotes: 1 }, 5)).toBe('2 more votes needed');
    expect(getReviewProgressPercent({ positiveVotes: 2, negativeVotes: 1 }, 5)).toBe(60);
    expect(getReviewProgressLabel({ positiveVotes: 5, negativeVotes: 1 }, 5)).toBe('6/5 votes ready');
  });

  it('explains the next developer-facing pipeline step', () => {
    expect(getSubmissionNextStep({
      ...baseSubmission,
      positiveVotes: 1,
      negativeVotes: 0,
    }, { settings: DEFAULT_DEVELOPER_PROGRAM_SETTINGS })).toContain('Needs more developer signal');

    expect(getSubmissionNextStep({
      ...baseSubmission,
      status: 'published',
      calculatedAccessTier: 'free',
      positiveVotes: 5,
      negativeVotes: 0,
    }, { settings: DEFAULT_DEVELOPER_PROGRAM_SETTINGS })).toContain('Live in the shared library');

    expect(getSubmissionNextStep({
      ...baseSubmission,
      status: 'archived',
      calculatedAccessTier: 'hidden',
    }, { settings: DEFAULT_DEVELOPER_PROGRAM_SETTINGS })).toContain('recovery voting');
  });

  it('estimates managed asset storage from publish, voting, and archive limits', () => {
    const forecast = estimateDeveloperAssetStorage({
      ...DEFAULT_DEVELOPER_PROGRAM_SETTINGS,
      monthlySubmissionLimit: 10,
      archiveVisibleLimit: 20,
      tierCapsByType: {
        ...DEFAULT_DEVELOPER_PROGRAM_SETTINGS.tierCapsByType,
        icons: { free: 2, paid: 1 },
      },
      publishCapsByType: {
        ...DEFAULT_DEVELOPER_PROGRAM_SETTINGS.publishCapsByType,
        icons: 3,
      },
    }, 5);

    expect(forecast.publishSlotCount).toBeGreaterThan(0);
    expect(forecast.monthlyVotingSlotCount).toBe(50);
    expect(forecast.archiveSlotCount).toBe(20);
    expect(forecast.estimatedMaximumManagedBytes).toBe(
      forecast.estimatedPublishedBytes + forecast.estimatedMonthlyVotingBytes + forecast.estimatedArchiveBytes
    );
  });
});
