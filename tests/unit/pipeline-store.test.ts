import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PIPELINE_PROGRAM_SETTINGS,
  type PipelineProgramSettings,
} from '@/features/pipeline/lib/pipelineItems';
import {
  buildPipelineProgramView,
  mapPipelineSubmissionRow,
  mapPipelineProgramSettingsRow,
  normalizeContributorProfileOverrideInput,
  normalizePipelineSubmissionEditInput,
  normalizePipelineSubmissionInput,
  projectPipelineProgramForViewer,
  resolvePipelineSourcePayload,
  type PipelineSubmission,
} from '@/features/pipeline/lib/pipelineProgram';

const settings: PipelineProgramSettings = {
  ...DEFAULT_PIPELINE_PROGRAM_SETTINGS,
  monthlySubmissionLimit: 3,
  monthlyPublishedRequirement: 2,
};

const submission = (
  input: Partial<PipelineSubmission> & Pick<PipelineSubmission, 'id' | 'contributorId' | 'name'>,
): PipelineSubmission => ({
  contributorEmail: `${input.contributorId}@example.test`,
  contributorFirstName: null,
  contributorLastName: null,
  contributorDisplayName: input.contributorId,
  assetType: 'icons',
  requestedStudioDestination: null,
  specialtyTags: [],
  useCaseTags: [],
  sourceNotes: '',
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

    expect(resolvePipelineSourcePayload(proposed, registry)).toBe(proposed);
    expect(resolvePipelineSourcePayload(null, registry)).toBe(registry);
    expect(resolvePipelineSourcePayload(null)).toBeNull();
  });

  it('maps database settings into the compact automatic-pipeline contract', () => {
    expect(mapPipelineProgramSettingsRow({
      max_active_developers: 25,
      monthly_submission_limit: 25,
      max_submission_file_size_mb: 32,
      monthly_published_requirement: 5,
      minimum_votes_for_grading: 6,
      free_asset_minimum_positive_vote_percent: 60,
      paid_asset_minimum_positive_vote_percent: 82,
      allow_contributor_self_voting: false,
      owner_vote_weight: 2,
      tier_caps_by_type: { templates: { free: 10, paid: 4 } },
    })).toMatchObject({
      maxActiveContributors: 25,
      monthlySubmissionLimit: 25,
      maxSubmissionFileSizeMb: 32,
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
    expect(normalizeContributorProfileOverrideInput({
      monthlySubmissionLimitOverride: 100,
      monthlyPublishedRequirementOverride: 0,
      ownerNote: '',
    })).toMatchObject({
      monthly_submission_limit_override: 100,
      monthly_published_requirement_override: 0,
      owner_note: '',
    });
  });

  it('normalizes submission input with canonical taxonomy and rejects unsupported assets', () => {
    expect(normalizePipelineSubmissionInput({
      assetType: 'icons',
      studioDestination: 'element.icon',
      specialtyTags: ['games'],
      useCaseTags: ['tcg'],
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
        specialtyTags: ['games'],
        useCaseTags: ['tcg'],
        name: 'Moon Sigil',
        sourceStoragePath: 'dev-1/icons/moon.svg',
      },
    });
    expect(normalizePipelineSubmissionInput({ assetType: 'tsx', name: 'Executable' }))
      .toEqual({ ok: false, message: 'Choose a supported asset type.' });
  });

  it('does not allow canonical tags to leak into the wrong taxonomy category', () => {
    const base = {
      assetType: 'icons',
      studioDestination: 'element.icon',
      name: 'Moon Sigil',
      sourceUrl: 'https://storage.example.test/moon.svg',
    };

    expect(normalizePipelineSubmissionInput({
      ...base,
      specialtyTags: ['tcg'],
      useCaseTags: ['tcg'],
    })).toEqual({ ok: false, message: 'Choose at least one supported CardForge specialty.' });

    expect(normalizePipelineSubmissionInput({
      ...base,
      specialtyTags: ['games'],
      useCaseTags: ['games'],
    })).toEqual({ ok: false, message: 'Choose at least one supported CardForge use case.' });

    expect(normalizePipelineSubmissionEditInput({
      assetType: 'icons',
      name: 'Moon Sigil',
      specialtyTags: ['games', 'tcg'],
      useCaseTags: ['tcg', 'games'],
    })).toEqual({
      ok: true,
      value: {
        name: 'Moon Sigil',
        description: '',
        previewUrl: '',
        specialtyTags: ['games'],
        useCaseTags: ['tcg'],
      },
    });
  });

  it('normalizes contributor-owned detail edits', () => {
    expect(normalizePipelineSubmissionEditInput({
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

  it('maps automatic, override, publication, revision, and category-safe taxonomy state from the database', () => {
    expect(mapPipelineSubmissionRow({
      id: 'asset-1',
      developer_id: 'dev-1',
      developer_email: 'dev@example.test',
      asset_type: 'templates',
      requested_studio_destination: 'template.front',
      specialty_tags: ['games', 'tcg'],
      use_case_tags: ['tcg', 'games'],
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
      specialtyTags: ['games'],
      useCaseTags: ['tcg'],
      currentUserVote: 'positive',
      targetRegistryAssetId: 'moon-layout',
      revisionNumber: 2,
      publishedAt: '2026-05-12T00:00:00.000Z',
    });
  });

  it('uses actual publication time for contributor monthly results', () => {
    const view = buildPipelineProgramView({
      configured: true,
      settings,
      currentUserId: 'dev-1',
      submissions: [
        submission({ id: 'own-1', contributorId: 'dev-1', name: 'Submitted this month' }),
        submission({
          id: 'own-2',
          contributorId: 'dev-1',
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

    expect(view.contributionStats).toEqual({ submitted: 1, published: 1, archived: 0, rejected: 0 });
    expect(view.remainingSubmissions).toBe(2);
  });

  it('keeps peer review useful while removing peer email and storage metadata', () => {
    const full = buildPipelineProgramView({
      configured: true,
      settings,
      currentUserId: 'dev-1',
      submissions: [
        submission({
          id: 'own-1',
          contributorId: 'dev-1',
          name: 'Mine',
          sourceUrl: 'https://storage.example.test/mine.svg',
          sourceStorageBucket: 'cardforge-developer-assets',
          sourceStoragePath: 'dev-1/icons/mine.svg',
        }),
        submission({
          id: 'peer-1',
          contributorId: 'dev-2',
          contributorEmail: 'peer@example.test',
          contributorDisplayName: 'Peer Maker',
          name: 'Peer',
          previewUrl: 'https://storage.example.test/peer.svg',
          sourceUrl: 'https://storage.example.test/peer.svg',
          sourceStorageBucket: 'cardforge-developer-assets',
          sourceStoragePath: 'dev-2/icons/peer.svg',
        }),
      ],
    });
    const projected = projectPipelineProgramForViewer(full, { currentUserId: 'dev-1', isOwner: false });

    expect(projected.submissions[0]).toMatchObject({
      contributorEmail: 'dev-1@example.test',
      sourceStoragePath: 'dev-1/icons/mine.svg',
    });
    expect(projected.submissions[1]).toMatchObject({
      contributorEmail: null,
      contributorDisplayName: 'Peer Maker',
      previewUrl: 'https://storage.example.test/peer.svg',
      sourceUrl: null,
      sourceStorageBucket: null,
      sourceStoragePath: null,
    });
    expect(projectPipelineProgramForViewer(full, { currentUserId: 'owner-1', isOwner: true }))
      .toBe(full);
  });

  it('preserves inactive contributors with production history but omits empty inactive profiles', () => {
    const view = buildPipelineProgramView({
      configured: true,
      settings,
      currentUserId: 'owner-1',
      submissions: [submission({
        id: 'inactive-asset-1',
        contributorId: 'inactive-with-history',
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

    expect(view.contributions.some((item) => item.contributorId === 'stale-no-history')).toBe(false);
    expect(view.contributions.find((item) => item.contributorId === 'inactive-with-history'))
      .toMatchObject({ profileStatus: 'inactive', published: 1 });
  });
});
