import { describe, expect, it } from 'vitest';

import {
  DEFAULT_DEVELOPER_PROGRAM_SETTINGS,
  type DeveloperProgramSettings,
} from '@/features/developer-assets/lib/developerAssets';
import {
  buildDeveloperAssetProgramView,
  mapDeveloperAssetSubmissionRow,
  mapDeveloperProgramSettingsRow,
  normalizeDeveloperProfileOverrideInput,
  normalizeDeveloperAssetSubmissionEditInput,
  normalizeDeveloperAssetSubmissionInput,
  projectDeveloperAssetProgramForViewer,
  resolveDeveloperAssetSourcePayload,
  type DeveloperAssetSubmission,
} from '@/features/developer-assets/lib/developerAssetProgram';

const settings: DeveloperProgramSettings = {
  ...DEFAULT_DEVELOPER_PROGRAM_SETTINGS,
  monthlySubmissionLimit: 3,
  monthlyPublishedRequirement: 2,
};

const submission = (
  input: Partial<DeveloperAssetSubmission> & Pick<DeveloperAssetSubmission, 'id' | 'developerId' | 'name'>,
): DeveloperAssetSubmission => ({
  developerEmail: `${input.developerId}@example.test`,
  developerFirstName: null,
  developerLastName: null,
  developerDisplayName: input.developerId,
  assetType: 'icons',
  requestedStudioDestination: null,
  description: '',
  previewUrl: '',
  sourceUrl: null,
  sourceFileSizeBytes: null,
  sourceMimeType: null,
  sourceStorageBucket: null,
  sourceStoragePath: null,
  registryAssetId: null,
  status: 'voting',
  automatedStatus: 'voting',
  ownerStatusOverride: null,
  calculatedAccessTier: 'developer',
  automatedAccessTier: 'developer',
  ownerAccessTierOverride: null,
  qualityScore: 0,
  tierDecisionReason: 'needs_more_votes',
  ownerNote: null,
  decisionReason: 'needs_more_votes',
  positiveVotes: 0,
  negativeVotes: 0,
  currentUserVote: null,
  sourcePayload: null,
  targetRegistryAssetId: null,
  baseRevisionNumber: null,
  revisionNumber: null,
  publishedAt: null,
  purgeState: null,
  submittedAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-01T00:00:00.000Z',
  ...input,
});

describe('developer asset store helpers', () => {
  it('uses authoritative registry content only when a submission has no proposed payload', () => {
    const proposed = { id: 'proposed-recipe' };
    const registry = { id: 'published-recipe' };

    expect(resolveDeveloperAssetSourcePayload(proposed, registry)).toBe(proposed);
    expect(resolveDeveloperAssetSourcePayload(null, registry)).toBe(registry);
    expect(resolveDeveloperAssetSourcePayload(null)).toBeNull();
  });

  it('maps database settings into the compact automatic-pipeline contract', () => {
    expect(mapDeveloperProgramSettingsRow({
      max_active_developers: 25,
      monthly_submission_limit: 25,
      monthly_published_requirement: 5,
      minimum_votes_for_grading: 6,
      free_asset_minimum_positive_vote_percent: 60,
      paid_asset_minimum_positive_vote_percent: 82,
      allow_contributor_self_voting: false,
      owner_vote_weight: 2,
      tier_caps_by_type: { templates: { free: 10, paid: 4 } },
    })).toMatchObject({
      maxActiveDevelopers: 25,
      monthlySubmissionLimit: 25,
      monthlyPublishedRequirement: 5,
      minimumVotesForGrading: 6,
      freeAssetMinimumPositiveVotePercent: 60,
      paidAssetMinimumPositiveVotePercent: 82,
      allowContributorSelfVoting: false,
      ownerVoteWeight: 2,
      publishCapsByType: {
        templates: 14,
      },
      tierCapsByType: {
        templates: { free: 10, paid: 4 },
      },
    });
  });

  it('normalizes developer contract overrides', () => {
    expect(normalizeDeveloperProfileOverrideInput({
      monthlySubmissionLimitOverride: 100,
      monthlyPublishedRequirementOverride: 0,
      ownerNote: '',
    })).toMatchObject({
      monthly_submission_limit_override: 100,
      monthly_published_requirement_override: 0,
      owner_note: '',
    });
  });

  it('normalizes submission input and rejects unsupported assets', () => {
    expect(normalizeDeveloperAssetSubmissionInput({
      assetType: 'icons',
      studioDestination: 'element.icon',
      name: '  Moon Sigil  ',
      description: '  clean vector icon  ',
      previewUrl: '  https://example.test/moon.svg  ',
      sourceUrl: '  https://storage.example.test/moon.svg  ',
      sourceFileSizeBytes: '2048',
      sourceMimeType: ' image/svg+xml ',
      sourceStorageBucket: ' cardforge-developer-assets ',
      sourceStoragePath: ' dev-1/icons/moon.svg ',
    })).toMatchObject({
      ok: true,
      value: {
        name: 'Moon Sigil',
        sourceStoragePath: 'dev-1/icons/moon.svg',
      },
    });
    expect(normalizeDeveloperAssetSubmissionInput({ assetType: 'tsx', name: 'Executable' }))
      .toEqual({ ok: false, message: 'Choose a supported asset type.' });
  });

  it('normalizes contributor-owned detail edits', () => {
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
  });

  it('maps automatic, override, publication, and revision state from the database', () => {
    expect(mapDeveloperAssetSubmissionRow({
      id: 'asset-1',
      developer_id: 'dev-1',
      developer_email: 'dev@example.test',
      asset_type: 'templates',
      requested_studio_destination: 'template.front',
      name: 'Moon Layout',
      description: 'Layout',
      preview_url: '/api/templates#moon-layout',
      source_url: '/api/templates#moon-layout',
      source_file_size_bytes: 2048,
      source_mime_type: 'application/json',
      source_storage_bucket: null,
      source_storage_path: null,
      registry_asset_id: 'moon-layout',
      status: 'published',
      automated_status: 'voting',
      owner_status_override: 'published',
      calculated_access_tier: 'free',
      automated_access_tier: 'developer',
      owner_access_tier_override: 'free',
      quality_score: 80,
      tier_decision_reason: 'owner_forced_free',
      owner_note: 'Keep as a built-in.',
      decision_reason: 'owner_status_override',
      positive_votes: 4,
      negative_votes: 1,
      source_payload: { id: 'moon-layout', name: 'Moon Layout', aspectRatio: '63:88' },
      target_registry_asset_id: 'moon-layout',
      base_revision_number: 1,
      revision_number: 2,
      published_at: '2026-05-12T00:00:00.000Z',
      purge_state: null,
      submitted_at: '2026-04-01T00:00:00.000Z',
      updated_at: '2026-05-12T00:00:00.000Z',
    }, { 'asset-1': 'positive' })).toMatchObject({
      status: 'published',
      automatedStatus: 'voting',
      ownerStatusOverride: 'published',
      calculatedAccessTier: 'free',
      automatedAccessTier: 'developer',
      ownerAccessTierOverride: 'free',
      currentUserVote: 'positive',
      targetRegistryAssetId: 'moon-layout',
      revisionNumber: 2,
      publishedAt: '2026-05-12T00:00:00.000Z',
    });
  });

  it('uses actual publication time for contributor monthly results', () => {
    const view = buildDeveloperAssetProgramView({
      configured: true,
      settings,
      currentUserId: 'dev-1',
      submissions: [
        submission({ id: 'own-1', developerId: 'dev-1', name: 'Submitted this month' }),
        submission({
          id: 'own-2',
          developerId: 'dev-1',
          name: 'Published this month',
          status: 'published',
          automatedStatus: 'published',
          calculatedAccessTier: 'paid',
          automatedAccessTier: 'paid',
          submittedAt: '2026-04-02T00:00:00.000Z',
          publishedAt: '2026-05-02T00:00:00.000Z',
        }),
      ],
      now: new Date('2026-05-23T00:00:00.000Z'),
    });

    expect(view.developerStats).toEqual({ submitted: 1, published: 1, archived: 0, rejected: 0 });
    expect(view.remainingSubmissions).toBe(2);
  });

  it('keeps peer review useful while removing peer email and storage metadata', () => {
    const full = buildDeveloperAssetProgramView({
      configured: true,
      settings,
      currentUserId: 'dev-1',
      submissions: [
        submission({
          id: 'own-1',
          developerId: 'dev-1',
          name: 'Mine',
          sourceUrl: 'https://storage.example.test/mine.svg',
          sourceStorageBucket: 'cardforge-developer-assets',
          sourceStoragePath: 'dev-1/icons/mine.svg',
        }),
        submission({
          id: 'peer-1',
          developerId: 'dev-2',
          developerEmail: 'peer@example.test',
          developerDisplayName: 'Peer Maker',
          name: 'Peer',
          previewUrl: 'https://storage.example.test/peer.svg',
          sourceUrl: 'https://storage.example.test/peer.svg',
          sourceStorageBucket: 'cardforge-developer-assets',
          sourceStoragePath: 'dev-2/icons/peer.svg',
        }),
      ],
    });
    const projected = projectDeveloperAssetProgramForViewer(full, { currentUserId: 'dev-1', isOwner: false });

    expect(projected.submissions[0]).toMatchObject({
      developerEmail: 'dev-1@example.test',
      sourceStoragePath: 'dev-1/icons/mine.svg',
    });
    expect(projected.submissions[1]).toMatchObject({
      developerEmail: null,
      developerDisplayName: 'Peer Maker',
      previewUrl: 'https://storage.example.test/peer.svg',
      sourceUrl: null,
      sourceStorageBucket: null,
      sourceStoragePath: null,
    });
    expect(projectDeveloperAssetProgramForViewer(full, { currentUserId: 'owner-1', isOwner: true }))
      .toBe(full);
  });

  it('preserves inactive contributors with production history but omits empty inactive profiles', () => {
    const view = buildDeveloperAssetProgramView({
      configured: true,
      settings,
      currentUserId: 'owner-1',
      submissions: [submission({
        id: 'inactive-asset-1',
        developerId: 'inactive-with-history',
        name: 'History Icon',
        status: 'published',
        automatedStatus: 'published',
        calculatedAccessTier: 'free',
        automatedAccessTier: 'free',
        publishedAt: '2026-05-02T00:00:00.000Z',
      })],
      profiles: [
        { clerk_user_id: 'stale-no-history', email: 'stale@example.test', status: 'inactive' },
        { clerk_user_id: 'inactive-with-history', email: 'history@example.test', status: 'inactive' },
      ],
      now: new Date('2026-05-23T00:00:00.000Z'),
    });

    expect(view.developerContributions.some((item) => item.developerId === 'stale-no-history')).toBe(false);
    expect(view.developerContributions.find((item) => item.developerId === 'inactive-with-history'))
      .toMatchObject({ profileStatus: 'inactive', published: 1 });
  });
});
