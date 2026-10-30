import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PIPELINE_PROGRAM_SETTINGS,
  estimatePipelineCatalogCapacityBytes,
  PIPELINE_ASSET_STORAGE_BUDGET_BYTES,
  CONTRIBUTOR_UPLOAD_ASSET_TYPES,
  buildPipelineVotingPresetSettings,
  countPipelineMonthlyStats,
  normalizePipelineProgramSettingsInput,
} from '@/features/pipeline/lib/pipelineItems';
import {
  pipelineSubmissionGuidance,
  getPipelineSubmissionGuidance,
  deduplicatePersonalLibraryItems,
  getCandidateBrowseLabel,
  getCandidateSourceEmptyMessage,
  getReviewProgressLabel,
  getReviewProgressPercent,
  getSubmissionNextStep,
  buildPipelineTemplateSpecimen,
  getPipelineSubmissionTemplate,
  PIPELINE_TEMPLATE_SPECIMEN_DPI,
} from '@/features/pipeline/components/PipelineContributionModel';
import type { PipelineSubmission } from '@/features/pipeline/lib/pipelineProgram';
import { getPipelineDecisionReasonLabel } from '@/features/pipeline/lib/pipelineAssetTaxonomy';

const baseSubmission: PipelineSubmission = {
  id: 'asset-1',
  contributorId: 'contributor-1',
  contributorEmail: 'contributor@example.test',
  contributorFirstName: null,
  contributorLastName: null,
  contributorDisplayName: 'Dev Example',
  assetType: 'icons',
  requestedStudioDestination: null,
  specialtyTags: [],
  useCaseTags: [],
  semanticRole: 'icon',
  visualFamily: null,
  variantKind: 'base',
  variantLabel: null,
  compatibilityTags: [],
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
  calculatedAccessTier: 'contributor',
  automatedAccessTier: 'contributor',
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

describe('exact Pipeline Template specimen export', () => {
  const candidate = {
    id: 'default-cardforge-studio-back-bridge',
    name: 'Bridge Back',
    aspectRatio: '57:89',
    formatId: 'bridge' as const,
    trimWidthMm: 57,
    trimHeightMm: 89,
    templateUsage: 'back-preset' as const,
    templateRevision: 1,
    templatePreviewData: {},
    freeformCanvas: { width: 570, height: 890, elements: [] },
  };
  const revision: PipelineSubmission = {
    ...baseSubmission,
    id: '12e591bc-c518-4b05-9314-ea0cadc57abb',
    lineageId: 'b270aef3-a92e-4d5c-94b7-0cfd7ab45774',
    assetType: 'templates',
    semanticRole: 'template-back',
    name: 'Bridge Back',
    status: 'submitted',
    sourcePayload: candidate,
    targetRegistryAssetId: 'default-cardforge-studio-back-bridge',
    baseRevisionNumber: 1,
    revisionNumber: 2,
  };

  it('exports the exact persisted candidate as a real-size back specimen with its base pins', () => {
    const parsed = getPipelineSubmissionTemplate(revision);
    const specimen = buildPipelineTemplateSpecimen(revision, 'candidate');

    expect(parsed).toBe(candidate);
    expect(specimen?.card.template).toBe(candidate);
    expect(specimen?.face).toBe('back');
    expect(specimen?.widthPx).toBe(570);
    expect(specimen?.heightPx).toBe(890);
    expect(specimen?.fileName).toContain('candidate-r2-base-r1-submission-12e591bc-c518-4b05-9314-ea0cadc57abb-back.png');
    expect(specimen).toMatchObject({
      submissionId: revision.id,
      lineageId: revision.lineageId,
      revisionNumber: 2,
      baseRevisionNumber: 1,
      targetRegistryAssetId: 'default-cardforge-studio-back-bridge',
    });
    expect(PIPELINE_TEMPLATE_SPECIMEN_DPI).toBe(254);
  });

  it('never falls back to the live catalog template when the exact candidate payload is missing', () => {
    const withoutCandidate = { ...revision, sourcePayload: null };
    expect(buildPipelineTemplateSpecimen(withoutCandidate, 'candidate', { template: candidate, submissionId: 'live-parent', lineageId: revision.lineageId! })).toBeNull();
  });

  it('keeps a live-catalog specimen distinct from the submitted candidate', () => {
    const live = { ...candidate, name: 'Bridge Back Live', templateRevision: 1 };
    const candidateSpecimen = buildPipelineTemplateSpecimen(revision, 'candidate');
    const liveSpecimen = buildPipelineTemplateSpecimen(revision, 'live', { template: live, submissionId: 'live-parent', lineageId: revision.lineageId! });

    expect(candidateSpecimen?.card.template).toBe(candidate);
    expect(liveSpecimen?.card.template).toBe(live);
    expect(candidateSpecimen?.fileName).toContain('-candidate-r2-base-r1-');
    expect(liveSpecimen?.fileName).toContain('-live-r1-base-r1-');
    expect(liveSpecimen?.submissionId).toBe('live-parent');
    expect(liveSpecimen?.fileName).toContain('submission-live-parent');
    expect(buildPipelineTemplateSpecimen(revision, 'live')).toBeNull();
    expect(buildPipelineTemplateSpecimen(revision, 'live', { template: live, submissionId: 'other', lineageId: 'other-lineage' })).toBeNull();
    const historical = buildPipelineTemplateSpecimen({ ...revision, status: 'published', revisionNumber: 1 }, 'submission');
    expect(historical?.submissionId).toBe(revision.id);
    expect(historical?.revisionNumber).toBe(1);
    expect(historical?.card.template).toBe(candidate);
  });
});
describe('contributor asset program rules', () => {
  it('translates Pipeline decision codes into product language', () => {
    expect(getPipelineDecisionReasonLabel('owner_forced_paid')).toBe('The CardForge owner placed this work in Creator Pass.');
    expect(getPipelineDecisionReasonLabel('needs_more_votes')).toBe('Gathering contributor review signal.');
    expect(getPipelineDecisionReasonLabel('unrecognized_internal_code')).toBe('Placement reflects the current Pipeline rules.');
  });

  it('defines submission guidance for every supported asset family', () => {
    for (const assetType of CONTRIBUTOR_UPLOAD_ASSET_TYPES) {
      const guidance = pipelineSubmissionGuidance[assetType];
      expect(guidance.destination).toBeTruthy();
      expect(guidance.sourceLabel).toBeTruthy();
      expect(guidance.accept).toBeTruthy();
      expect(guidance.notesHelp).toBeTruthy();
      expect(guidance.checklist).toHaveLength(3);
    }

    expect(pipelineSubmissionGuidance.icons.accept).toContain('image/svg+xml');
    expect(pipelineSubmissionGuidance.dividers.accept).toContain('image/svg+xml');
    expect(getPipelineSubmissionGuidance('imageAssets', 'image.border.front').accept).toContain('image/svg+xml');
    expect(getPipelineSubmissionGuidance('imageAssets', 'image.picture').accept).not.toContain('image/svg+xml');
    expect(pipelineSubmissionGuidance.fonts.accept).toContain('font/woff2');
    expect(pipelineSubmissionGuidance.sets.accept).toContain('.cardforge');
  });

  it('routes Sets through the portable package lane instead of Studio asset placement', () => {
    expect(getCandidateBrowseLabel('sets')).toContain('.cardforge');
    expect(getCandidateSourceEmptyMessage('sets')).toContain('Desk or in Studio');
    expect(DEFAULT_PIPELINE_PROGRAM_SETTINGS.tierCapsByType.sets).toEqual({ free: 11, paid: 6 });
  });

  it('reserves half of Free Storage while keeping production and staging cap models inside it', () => {
    const oneEnvironment = estimatePipelineCatalogCapacityBytes();
    expect(PIPELINE_ASSET_STORAGE_BUDGET_BYTES).toBe(500_000_000);
    expect(oneEnvironment).toBeLessThan(PIPELINE_ASSET_STORAGE_BUDGET_BYTES / 2);
    expect(oneEnvironment * 2).toBeLessThan(PIPELINE_ASSET_STORAGE_BUDGET_BYTES);
    expect(DEFAULT_PIPELINE_PROGRAM_SETTINGS.tierCapsByType.templates).toEqual({ free: 55, paid: 33 });
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
    const settings = normalizePipelineProgramSettingsInput({
      maxActiveContributors: '200',
      monthlySubmissionLimit: '-2',
      maxSubmissionFileSizeMb: '100',
      monthlyPublishedRequirement: '7',
      minimumVotesForGrading: '3',
      freeAssetMinimumPositiveVotePercent: '60',
      paidAssetMinimumPositiveVotePercent: '80',
      allowContributorSelfVoting: true,
      ownerVoteWeight: '3',
      reviewMinimumAgeDays: '40',
      reviewInactivityDays: '3',
      trashRetentionDays: '120',
      tierCapsByType: { templates: { free: '12', paid: '6' }, icons: { free: -1, paid: 'abc' } },
    });

    expect(settings.maxActiveContributors).toBe(100);
    expect(settings.monthlySubmissionLimit).toBe(DEFAULT_PIPELINE_PROGRAM_SETTINGS.monthlySubmissionLimit);
    expect(settings.maxSubmissionFileSizeMb).toBe(50);
    expect(settings.monthlyPublishedRequirement).toBe(7);
    expect(settings.minimumVotesForGrading).toBe(3);
    expect(settings.freeAssetMinimumPositiveVotePercent).toBe(60);
    expect(settings.paidAssetMinimumPositiveVotePercent).toBe(80);
    expect(settings.allowContributorSelfVoting).toBe(true);
    expect(settings.ownerVoteWeight).toBe(1);
    expect(settings.reviewMinimumAgeDays).toBe(30);
    expect(settings.reviewInactivityDays).toBe(DEFAULT_PIPELINE_PROGRAM_SETTINGS.reviewInactivityDays);
    expect(settings.trashRetentionDays).toBe(90);
    expect(settings.tierCapsByType.templates).toEqual({ free: 12, paid: 6 });
    expect(settings.tierCapsByType.icons).toEqual(DEFAULT_PIPELINE_PROGRAM_SETTINGS.tierCapsByType.icons);
    expect(settings.publishCapsByType.templates).toBe(18);
  });

  it('derives publish capacity from Starter plus Creator Pass capacity', () => {
    const settings = normalizePipelineProgramSettingsInput({
      tierCapsByType: {
        icons: { free: 21, paid: 13 },
        templates: { free: 4, paid: 2 },
      },
    });
    expect(settings.publishCapsByType.icons).toBe(34);
    expect(settings.publishCapsByType.templates).toBe(6);
  });

  it('builds one vote threshold for every roster preset', () => {
    const solo = buildPipelineVotingPresetSettings(DEFAULT_PIPELINE_PROGRAM_SETTINGS, 'solo', 1);
    const currentRoster = buildPipelineVotingPresetSettings(DEFAULT_PIPELINE_PROGRAM_SETTINGS, 'currentRoster', 7);
    const fullCouncil = buildPipelineVotingPresetSettings(DEFAULT_PIPELINE_PROGRAM_SETTINGS, 'fullCouncil', 25);

    expect(solo.minimumVotesForGrading).toBe(1);
    expect(currentRoster.minimumVotesForGrading).toBe(5);
    expect(fullCouncil.minimumVotesForGrading).toBe(9);
  });

  it('counts publication in the month it actually happened', () => {
    const stats = countPipelineMonthlyStats([
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

  it('does not infer live availability from current or historical published status alone', () => {
    for (const revisionNumber of [1, 2, null]) {
      const message = getSubmissionNextStep({ ...baseSubmission, status: 'published', revisionNumber }, { settings: DEFAULT_PIPELINE_PROGRAM_SETTINGS });
      expect(message).toContain('Published through automatic ranking');
      expect(message).toContain('depends on the active publication');
      expect(message).not.toContain('Live in the shared library');
    }
  });

  it('explains automatic results and persistent owner overrides honestly', () => {
    expect(getSubmissionNextStep({ ...baseSubmission, positiveVotes: 1 }, { settings: DEFAULT_PIPELINE_PROGRAM_SETTINGS }))
      .toContain('Needs more Contributor signal');
    expect(getSubmissionNextStep({
      ...baseSubmission,
      status: 'published',
      automatedStatus: 'published',
      calculatedAccessTier: 'free',
    }, { settings: DEFAULT_PIPELINE_PROGRAM_SETTINGS })).toContain('automatic ranking');
    expect(getSubmissionNextStep({
      ...baseSubmission,
      status: 'published',
      automatedStatus: 'voting',
      ownerStatusOverride: 'published',
      calculatedAccessTier: 'free',
    }, { settings: DEFAULT_PIPELINE_PROGRAM_SETTINGS })).toContain('owner override');
    expect(getSubmissionNextStep({
      ...baseSubmission,
      assetType: 'templates',
      status: 'submitted',
      revisionNumber: 2,
    }, { settings: DEFAULT_PIPELINE_PROGRAM_SETTINGS })).toContain('owner to compare and approve');
  });
});