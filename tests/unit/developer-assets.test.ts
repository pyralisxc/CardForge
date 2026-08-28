import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_DEVELOPER_PROGRAM_SETTINGS,
  DEVELOPER_UPLOAD_ASSET_TYPES,
  buildDeveloperVotingPresetSettings,
  countDeveloperMonthlyStats,
  normalizeDeveloperProgramSettingsInput,
} from '@/features/developer-assets/lib/developerAssets';
import {
  developerAssetSubmissionGuidance,
  deduplicatePersonalLibraryItems,
  getCandidateBrowseLabel,
  getCandidateSourceEmptyMessage,
  getReviewProgressLabel,
  getReviewProgressPercent,
  getSubmissionNextStep,
} from '@/features/developer-assets/components/DeveloperAssetHubModel';
import type { DeveloperAssetSubmission } from '@/features/developer-assets/lib/developerAssetProgram';

const baseSubmission: DeveloperAssetSubmission = {
  id: 'asset-1',
  developerId: 'dev-1',
  developerEmail: 'dev@example.test',
  developerFirstName: null,
  developerLastName: null,
  developerDisplayName: 'Dev Example',
  assetType: 'icons',
  requestedStudioDestination: null,
  specialtyTags: [],
  useCaseTags: [],
  sourceNotes: '',
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
};

describe('developer asset program rules', () => {
  it('defines submission guidance for every supported asset family', () => {
    for (const assetType of DEVELOPER_UPLOAD_ASSET_TYPES) {
      const guidance = developerAssetSubmissionGuidance[assetType];
      expect(guidance.destination).toBeTruthy();
      expect(guidance.sourceLabel).toBeTruthy();
      expect(guidance.accept).toBeTruthy();
      expect(guidance.notesHelp).toBeTruthy();
      expect(guidance.checklist).toHaveLength(3);
    }

    expect(developerAssetSubmissionGuidance.icons.accept).toContain('image/svg+xml');
    expect(developerAssetSubmissionGuidance.fonts.accept).toContain('font/woff2');
    expect(developerAssetSubmissionGuidance.sets.accept).toContain('.cardforge');
  });

  it('routes Sets through the portable package lane instead of Studio asset placement', () => {
    expect(getCandidateBrowseLabel('sets')).toContain('.cardforge');
    expect(getCandidateSourceEmptyMessage('sets')).toContain('Home or in Studio');
    expect(DEFAULT_DEVELOPER_PROGRAM_SETTINGS.tierCapsByType.sets).toEqual({ free: 4, paid: 2 });
  });

  it('gives font submissions a visible file-source affordance', () => {
    expect(getCandidateBrowseLabel('fonts')).toBe('Drop or browse a font file');
    expect(getCandidateSourceEmptyMessage('fonts')).toContain('local font file');
    expect(getCandidateSourceEmptyMessage('fonts')).toContain('WOFF2');
  });

  it('shows one stable personal-library candidate per asset identity', () => {
    const createFile = async () => new File([], 'asset.svg');
    const first = {
      id: 'icon-shared',
      name: 'First copy',
      sourceLabel: 'Local icon',
      assetType: 'icons' as const,
      fileName: 'first.svg',
      helperText: '',
      createFile,
    };
    expect(deduplicatePersonalLibraryItems([
      first,
      { ...first, name: 'Duplicate copy' },
      { ...first, assetType: 'dividers', name: 'Different family' },
    ]).map((item) => item.name)).toEqual(['First copy', 'Different family']);
  });

  it('normalizes the compact automatic-pipeline settings with guardrails', () => {
    const settings = normalizeDeveloperProgramSettingsInput({
      maxActiveDevelopers: '200',
      monthlySubmissionLimit: '-2',
      maxSubmissionFileSizeMb: '100',
      monthlyPublishedRequirement: '7',
      minimumVotesForGrading: '3',
      freeAssetMinimumPositiveVotePercent: '60',
      paidAssetMinimumPositiveVotePercent: '80',
      allowContributorSelfVoting: false,
      ownerVoteWeight: '3',
      tierCapsByType: { templates: { free: '12', paid: '6' }, icons: { free: -1, paid: 'abc' } },
    });

    expect(settings.maxActiveDevelopers).toBe(100);
    expect(settings.monthlySubmissionLimit).toBe(DEFAULT_DEVELOPER_PROGRAM_SETTINGS.monthlySubmissionLimit);
    expect(settings.maxSubmissionFileSizeMb).toBe(50);
    expect(settings.monthlyPublishedRequirement).toBe(7);
    expect(settings.minimumVotesForGrading).toBe(3);
    expect(settings.freeAssetMinimumPositiveVotePercent).toBe(60);
    expect(settings.paidAssetMinimumPositiveVotePercent).toBe(80);
    expect(settings.allowContributorSelfVoting).toBe(false);
    expect(settings.ownerVoteWeight).toBe(3);
    expect(settings.tierCapsByType.templates).toEqual({ free: 12, paid: 6 });
    expect(settings.tierCapsByType.icons).toEqual(DEFAULT_DEVELOPER_PROGRAM_SETTINGS.tierCapsByType.icons);
    expect(settings.publishCapsByType.templates).toBe(18);
  });

  it('keeps the retired Creator Pool outside the live pipeline contract', () => {
    const migration = readFileSync(
      join(process.cwd(), 'supabase/migrations/20260814153745_complete_owner_site_content_and_brand_media.sql'),
      'utf8',
    );

    expect(DEFAULT_DEVELOPER_PROGRAM_SETTINGS).not.toHaveProperty('profitSharePoolPercent');
    expect(migration).toContain('set profit_share_pool_percent = 0');
    expect(migration).toContain('set eligible_for_profit_share = false');
    expect(migration).toContain('alter column profit_share_pool_percent set default 0');
    expect(migration).toContain('alter column eligible_for_profit_share set default false');
    expect(migration).toContain('cardforge_freeze_archived_creator_pool_fields');
    expect(migration).not.toContain("profit_share_pool_percent = (p_settings ->> 'profitSharePoolPercent')");
  });

  it('keeps the upload-ceiling migration compatible with the previous owner payload', () => {
    const migration = readFileSync(
      join(process.cwd(), 'supabase/migrations/20260822213000_owner_controlled_developer_upload_ceiling.sql'),
      'utf8',
    );

    expect(migration).toContain("(p_settings ->> 'maxSubmissionFileSizeMb')::integer");
    expect(migration).toMatch(/max_submission_file_size_mb = coalesce\([\s\S]*max_submission_file_size_mb[\s\S]*\)/u);
  });

  it('derives publish capacity from Starter plus Creator Pass capacity', () => {
    const settings = normalizeDeveloperProgramSettingsInput({
      tierCapsByType: {
        icons: { free: 21, paid: 13 },
        templates: { free: 4, paid: 2 },
      },
    });
    expect(settings.publishCapsByType.icons).toBe(34);
    expect(settings.publishCapsByType.templates).toBe(6);
  });

  it('builds one vote threshold for every roster preset', () => {
    const solo = buildDeveloperVotingPresetSettings(DEFAULT_DEVELOPER_PROGRAM_SETTINGS, 'solo', 1);
    const currentRoster = buildDeveloperVotingPresetSettings(DEFAULT_DEVELOPER_PROGRAM_SETTINGS, 'currentRoster', 7);
    const fullCouncil = buildDeveloperVotingPresetSettings(DEFAULT_DEVELOPER_PROGRAM_SETTINGS, 'fullCouncil', 25);

    expect(solo.minimumVotesForGrading).toBe(1);
    expect(currentRoster.minimumVotesForGrading).toBe(5);
    expect(fullCouncil.minimumVotesForGrading).toBe(9);
  });

  it('counts publication in the month it actually happened', () => {
    const stats = countDeveloperMonthlyStats([
      { status: 'submitted', submittedAt: '2026-05-01T00:00:00.000Z', publishedAt: null },
      { status: 'published', submittedAt: '2026-04-02T00:00:00.000Z', publishedAt: '2026-05-10T00:00:00.000Z' },
      { status: 'archived', submittedAt: '2026-05-03T00:00:00.000Z', publishedAt: null },
      { status: 'rejected', submittedAt: '2026-05-04T00:00:00.000Z', publishedAt: null },
      { status: 'published', submittedAt: '2026-05-05T00:00:00.000Z', publishedAt: '2026-06-01T00:00:00.000Z' },
    ], new Date('2026-05-23T00:00:00.000Z'));

    expect(stats).toEqual({ submitted: 4, published: 1, archived: 1, rejected: 1 });
  });

  it('summarizes review progress using the single decision threshold', () => {
    expect(getReviewProgressLabel({ positiveVotes: 2, negativeVotes: 1 }, 5)).toBe('2 more votes needed');
    expect(getReviewProgressPercent({ positiveVotes: 2, negativeVotes: 1 }, 5)).toBe(60);
    expect(getReviewProgressLabel({ positiveVotes: 5, negativeVotes: 1 }, 5)).toBe('6/5 votes ready');
  });

  it('explains automatic results and persistent owner overrides honestly', () => {
    expect(getSubmissionNextStep({ ...baseSubmission, positiveVotes: 1 }, { settings: DEFAULT_DEVELOPER_PROGRAM_SETTINGS }))
      .toContain('Needs more developer signal');
    expect(getSubmissionNextStep({
      ...baseSubmission,
      status: 'published',
      automatedStatus: 'published',
      calculatedAccessTier: 'free',
    }, { settings: DEFAULT_DEVELOPER_PROGRAM_SETTINGS })).toContain('automatic ranking');
    expect(getSubmissionNextStep({
      ...baseSubmission,
      status: 'published',
      automatedStatus: 'voting',
      ownerStatusOverride: 'published',
      calculatedAccessTier: 'free',
    }, { settings: DEFAULT_DEVELOPER_PROGRAM_SETTINGS })).toContain('owner override');
    expect(getSubmissionNextStep({
      ...baseSubmission,
      assetType: 'templates',
      status: 'submitted',
      revisionNumber: 2,
    }, { settings: DEFAULT_DEVELOPER_PROGRAM_SETTINGS })).toContain('owner to compare and approve');
  });
});
