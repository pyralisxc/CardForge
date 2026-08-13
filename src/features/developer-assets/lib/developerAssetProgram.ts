import {
  DEFAULT_DEVELOPER_PROGRAM_SETTINGS,
  DEVELOPER_ASSET_TYPES,
  countDeveloperMonthlyStats,
  isDeveloperAssetAccessTier,
  isDeveloperAssetAccessTierOverride,
  isDeveloperAssetStatus,
  isDeveloperAssetType,
  normalizeDeveloperProgramSettingsInput,
  type DeveloperAssetAccessTier,
  type DeveloperAssetAccessTierOverride,
  type DeveloperAssetMonthlyStats,
  type DeveloperAssetStatus,
  type DeveloperAssetType,
  type DeveloperAssetTypePipelineSummary,
  type DeveloperContributionSummary,
  type DeveloperProgramSettings,
  type DeveloperVoteValue,
} from './developerAssets';

export type DeveloperAssetSubmissionInputResult =
  | { ok: true; value: Pick<DeveloperAssetSubmission, 'assetType' | 'name' | 'description' | 'previewUrl' | 'sourceUrl' | 'sourceFileSizeBytes' | 'sourceMimeType' | 'sourceStorageBucket' | 'sourceStoragePath'> }
  | { ok: false; message: string };

export type DeveloperAssetSubmissionEditInputResult =
  | { ok: true; value: Pick<DeveloperAssetSubmission, 'name' | 'description' | 'previewUrl'> }
  | { ok: false; message: string };

export interface DeveloperAssetSubmission {
  id: string;
  developerId: string;
  developerEmail: string | null;
  developerFirstName?: string | null;
  developerLastName?: string | null;
  developerDisplayName?: string | null;
  assetType: DeveloperAssetType;
  name: string;
  description: string;
  previewUrl: string;
  sourceUrl: string | null;
  sourceFileSizeBytes: number | null;
  sourceMimeType: string | null;
  sourceStorageBucket: string | null;
  sourceStoragePath: string | null;
  registryAssetId: string | null;
  status: DeveloperAssetStatus;
  calculatedAccessTier: DeveloperAssetAccessTier;
  ownerAccessTierOverride: DeveloperAssetAccessTierOverride | null;
  qualityScore: number;
  tierDecisionReason: string | null;
  ownerNote?: string | null;
  decisionReason?: string | null;
  positiveVotes: number;
  negativeVotes: number;
  currentUserVote: DeveloperVoteValue | null;
  submittedAt: string;
  updatedAt: string | null;
}

export interface DeveloperAssetProgramView {
  configured: boolean;
  settings: DeveloperProgramSettings;
  currentUserId: string;
  currentContributorIds: string[];
  activeDeveloperCount: number;
  submissions: DeveloperAssetSubmission[];
  votingQueue: DeveloperAssetSubmission[];
  assetTypeSummaries: DeveloperAssetTypePipelineSummary[];
  developerContributions: DeveloperContributionSummary[];
  developerStats: DeveloperAssetMonthlyStats;
  effectiveMonthlySubmissionLimit: number;
  effectiveMonthlyPublishedRequirement: number;
  profitShareEligible: boolean;
  developerOwnerNote: string | null;
  remainingSubmissions: number;
}

export interface DeveloperProgramSettingsRow {
  max_active_developers?: unknown;
  monthly_submission_limit?: unknown;
  monthly_published_requirement?: unknown;
  minimum_votes_for_grading?: unknown;
  minimum_positive_vote_percent?: unknown;
  free_asset_minimum_positive_vote_percent?: unknown;
  paid_asset_minimum_positive_vote_percent?: unknown;
  minimum_votes_for_tier_assignment?: unknown;
  show_paid_preview_to_free_users?: unknown;
  allow_paid_early_access_to_candidates?: unknown;
  allow_contributor_self_voting?: unknown;
  owner_vote_weight?: unknown;
  archive_visible_limit?: unknown;
  profit_share_pool_percent?: unknown;
  owner_final_review_required?: unknown;
  publish_caps_by_type?: unknown;
  tier_caps_by_type?: unknown;
}

export interface DeveloperAssetSubmissionRow {
  id: string;
  developer_id: string;
  developer_email: string | null;
  asset_type: unknown;
  name: string;
  description: string | null;
  preview_url: string | null;
  source_url: string | null;
  source_file_size_bytes: number | null;
  source_mime_type: string | null;
  source_storage_bucket: string | null;
  source_storage_path: string | null;
  registry_asset_id: string | null;
  status: unknown;
  calculated_access_tier: unknown;
  owner_access_tier_override: unknown;
  quality_score: number | null;
  tier_decision_reason: string | null;
  owner_note: string | null;
  decision_reason: string | null;
  positive_votes: number | null;
  negative_votes: number | null;
  submitted_at: string;
  updated_at: string | null;
}

export interface DeveloperAssetProfile {
  clerk_user_id: string;
  email: string | null;
  status?: 'invited' | 'active' | 'inactive' | 'suspended' | null;
  first_name?: string | null;
  last_name?: string | null;
  monthly_submission_limit_override?: number | null;
  monthly_published_requirement_override?: number | null;
  eligible_for_profit_share?: boolean | null;
  owner_note?: string | null;
}

export interface DeveloperProfileOverrideInput {
  status?: unknown;
  monthlySubmissionLimitOverride?: unknown;
  monthlyPublishedRequirementOverride?: unknown;
  profitShareEligible?: unknown;
  ownerNote?: unknown;
}

export const normalizeDeveloperAssetShortText = (value: unknown, maxLength: number): string =>
  typeof value === 'string' ? value.trim().replace(/[ \t]+/g, ' ').slice(0, maxLength) : '';

export const normalizeDeveloperAssetLongText = (value: unknown, maxLength: number): string =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, maxLength) : '';

const normalizeUrl = (value: unknown, maxLength = 2048): string =>
  typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

const normalizeOptionalInteger = (value: unknown, min: number, max: number): number | null => {
  const numeric = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim() !== ''
      ? Number(value)
      : Number.NaN;
  if (!Number.isFinite(numeric)) return null;
  const rounded = Math.round(numeric);
  return rounded >= min && rounded <= max ? rounded : null;
};

const resolveEffectiveDeveloperRules = (
  settings: DeveloperProgramSettings,
  profile?: DeveloperAssetProfile | null,
) => ({
  effectiveSubmissionLimit: profile?.monthly_submission_limit_override ?? settings.monthlySubmissionLimit,
  effectivePublishedRequirement: profile?.monthly_published_requirement_override ?? settings.monthlyPublishedRequirement,
  submissionLimitOverride: profile?.monthly_submission_limit_override ?? null,
  publishedRequirementOverride: profile?.monthly_published_requirement_override ?? null,
  profitShareEligible: profile?.eligible_for_profit_share ?? true,
  ownerNote: profile?.owner_note ?? null,
});

const getDeveloperProfileDisplayName = (
  developerEmail: string | null,
  profile?: DeveloperAssetProfile | null,
): string | null => {
  const profileName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim();
  return profileName || profile?.email || developerEmail;
};

export const normalizeDeveloperProfileOverrideInput = (
  input: DeveloperProfileOverrideInput,
): {
  status?: 'invited' | 'active' | 'inactive' | 'suspended';
  monthly_submission_limit_override: number | null;
  monthly_published_requirement_override: number | null;
  eligible_for_profit_share: boolean;
  owner_note: string;
} => ({
  status:
    input.status === 'invited'
    || input.status === 'active'
    || input.status === 'inactive'
    || input.status === 'suspended'
      ? input.status
      : undefined,
  monthly_submission_limit_override: normalizeOptionalInteger(input.monthlySubmissionLimitOverride, 1, 250),
  monthly_published_requirement_override: normalizeOptionalInteger(input.monthlyPublishedRequirementOverride, 0, 100),
  eligible_for_profit_share: input.profitShareEligible !== false,
  owner_note: normalizeDeveloperAssetLongText(input.ownerNote, 280),
});

export const calculateDeveloperAssetVoteTotals = (
  voteRows: Array<{
    developer_id?: string | null;
    vote_value?: string | null;
    vote_weight?: number | null;
  }>,
  {
    ownerDeveloperId = '',
    ownerVoteWeight = DEFAULT_DEVELOPER_PROGRAM_SETTINGS.ownerVoteWeight,
  }: {
    ownerDeveloperId?: string | null;
    ownerVoteWeight?: number;
  } = {},
) => voteRows.reduce(
  (totals, row) => {
    if (row.vote_value !== 'positive' && row.vote_value !== 'negative') return totals;
    const weight = row.developer_id && ownerDeveloperId && row.developer_id === ownerDeveloperId
      ? Math.min(3, Math.max(1, Math.round(ownerVoteWeight)))
      : Math.min(3, Math.max(1, Math.round(row.vote_weight ?? 1)));
    if (row.vote_value === 'positive') totals.positiveVotes += weight;
    else totals.negativeVotes += weight;
    return totals;
  },
  { positiveVotes: 0, negativeVotes: 0 },
);

export const normalizeDeveloperAssetSubmissionInput = (value: {
  assetType?: unknown;
  name?: unknown;
  description?: unknown;
  previewUrl?: unknown;
  sourceUrl?: unknown;
  sourceFileSizeBytes?: unknown;
  sourceMimeType?: unknown;
  sourceStorageBucket?: unknown;
  sourceStoragePath?: unknown;
}): DeveloperAssetSubmissionInputResult => {
  if (!isDeveloperAssetType(value.assetType)) {
    return { ok: false, message: 'Choose a supported asset type.' };
  }
  const name = normalizeDeveloperAssetShortText(value.name, 96);
  if (!name) return { ok: false, message: 'Asset name is required.' };
  const previewUrl = normalizeUrl(value.previewUrl);
  const sourceUrl = normalizeUrl(value.sourceUrl);
  if (!sourceUrl) return { ok: false, message: 'Upload a source file before submitting this asset.' };

  return {
    ok: true,
    value: {
      assetType: value.assetType,
      name,
      description: normalizeDeveloperAssetLongText(value.description, 280),
      previewUrl: previewUrl || sourceUrl,
      sourceUrl,
      sourceFileSizeBytes: normalizeOptionalInteger(value.sourceFileSizeBytes, 1, 50 * 1024 * 1024),
      sourceMimeType: normalizeDeveloperAssetShortText(value.sourceMimeType, 120) || null,
      sourceStorageBucket: normalizeDeveloperAssetShortText(value.sourceStorageBucket, 80) || null,
      sourceStoragePath: normalizeUrl(value.sourceStoragePath) || null,
    },
  };
};

export const normalizeDeveloperAssetSubmissionEditInput = (value: {
  name?: unknown;
  description?: unknown;
  previewUrl?: unknown;
}): DeveloperAssetSubmissionEditInputResult => {
  const name = normalizeDeveloperAssetShortText(value.name, 96);
  if (!name) return { ok: false, message: 'Asset name is required.' };
  return {
    ok: true,
    value: {
      name,
      description: normalizeDeveloperAssetLongText(value.description, 280),
      previewUrl: normalizeUrl(value.previewUrl),
    },
  };
};

export const mapDeveloperProgramSettingsRow = (
  row: DeveloperProgramSettingsRow | null | undefined,
): DeveloperProgramSettings => normalizeDeveloperProgramSettingsInput(row
  ? {
      maxActiveDevelopers: row.max_active_developers,
      monthlySubmissionLimit: row.monthly_submission_limit,
      monthlyPublishedRequirement: row.monthly_published_requirement,
      minimumVotesForGrading: row.minimum_votes_for_grading,
      minimumPositiveVotePercent: row.minimum_positive_vote_percent,
      freeAssetMinimumPositiveVotePercent: row.free_asset_minimum_positive_vote_percent,
      paidAssetMinimumPositiveVotePercent: row.paid_asset_minimum_positive_vote_percent,
      minimumVotesForTierAssignment: row.minimum_votes_for_tier_assignment,
      showPaidPreviewToFreeUsers: row.show_paid_preview_to_free_users,
      allowPaidEarlyAccessToCandidates: row.allow_paid_early_access_to_candidates,
      allowContributorSelfVoting: row.allow_contributor_self_voting,
      ownerVoteWeight: row.owner_vote_weight,
      archiveVisibleLimit: row.archive_visible_limit,
      profitSharePoolPercent: row.profit_share_pool_percent,
      ownerFinalReviewRequired: row.owner_final_review_required,
      publishCapsByType: row.publish_caps_by_type,
      tierCapsByType: row.tier_caps_by_type,
    }
  : DEFAULT_DEVELOPER_PROGRAM_SETTINGS);

export const mapDeveloperAssetSubmissionRow = (
  row: DeveloperAssetSubmissionRow,
  currentUserVotes: Record<string, DeveloperVoteValue> = {},
  profile?: DeveloperAssetProfile | null,
): DeveloperAssetSubmission => ({
  id: row.id,
  developerId: row.developer_id,
  developerEmail: profile?.email ?? row.developer_email,
  developerFirstName: profile?.first_name ?? null,
  developerLastName: profile?.last_name ?? null,
  developerDisplayName: [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim() || profile?.email || row.developer_email,
  assetType: isDeveloperAssetType(row.asset_type) ? row.asset_type : 'imageAssets',
  name: row.name,
  description: row.description ?? '',
  previewUrl: row.preview_url ?? '',
  sourceUrl: row.source_url,
  sourceFileSizeBytes: row.source_file_size_bytes,
  sourceMimeType: row.source_mime_type,
  sourceStorageBucket: row.source_storage_bucket,
  sourceStoragePath: row.source_storage_path,
  registryAssetId: row.registry_asset_id,
  status: isDeveloperAssetStatus(row.status) ? row.status : 'submitted',
  calculatedAccessTier: isDeveloperAssetAccessTier(row.calculated_access_tier) ? row.calculated_access_tier : 'developer',
  ownerAccessTierOverride: isDeveloperAssetAccessTierOverride(row.owner_access_tier_override) ? row.owner_access_tier_override : null,
  qualityScore: row.quality_score ?? 0,
  tierDecisionReason: row.tier_decision_reason,
  ownerNote: row.owner_note,
  decisionReason: row.decision_reason,
  positiveVotes: row.positive_votes ?? 0,
  negativeVotes: row.negative_votes ?? 0,
  currentUserVote: currentUserVotes[row.id] ?? null,
  submittedAt: row.submitted_at,
  updatedAt: row.updated_at,
});

export const buildDeveloperAssetProgramView = ({
  configured,
  settings,
  currentUserId,
  currentContributorIds = [currentUserId],
  activeDeveloperCount = 1,
  submissions,
  profiles = [],
  now = new Date(),
}: {
  configured: boolean;
  settings: DeveloperProgramSettings;
  currentUserId: string;
  currentContributorIds?: string[];
  activeDeveloperCount?: number;
  submissions: DeveloperAssetSubmission[];
  profiles?: DeveloperAssetProfile[];
  now?: Date;
}): DeveloperAssetProgramView => {
  const profilesById = new Map(profiles.map((profile) => [profile.clerk_user_id, profile]));
  const currentProfile = profilesById.get(currentUserId);
  const currentContributorIdSet = new Set(currentContributorIds.length > 0 ? currentContributorIds : [currentUserId]);
  const accountSubmissions = submissions.filter((submission) => submission.developerId === currentUserId);
  const currentRules = resolveEffectiveDeveloperRules(settings, currentProfile);
  const developerStats = countDeveloperMonthlyStats(accountSubmissions, now);
  const activeReviewStatuses = new Set(['draft', 'submitted', 'voting', 'publish_candidate', 'published']);
  const assetTypeSummaries = DEVELOPER_ASSET_TYPES.map((assetType) => {
    const byType = submissions.filter((submission) => submission.assetType === assetType);
    const published = byType.filter((submission) => submission.status === 'published');
    const starterCount = published.filter((submission) => submission.calculatedAccessTier === 'free').length;
    const creatorPassCount = published.filter((submission) => submission.calculatedAccessTier === 'paid').length;
    const publishCap = settings.publishCapsByType[assetType];
    const starterCap = settings.tierCapsByType[assetType].free;
    const creatorPassCap = settings.tierCapsByType[assetType].paid;
    return {
      assetType,
      publishedCount: published.length,
      starterCount,
      creatorPassCount,
      candidateCount: byType.filter((submission) => submission.status === 'voting' || submission.status === 'publish_candidate').length,
      archiveCount: byType.filter((submission) => submission.status === 'archived').length,
      publishCap,
      starterCap,
      creatorPassCap,
      openPublishSlots: Math.max(0, publishCap - published.length),
      overPublishCapBy: Math.max(0, published.length - publishCap),
      overStarterCapBy: Math.max(0, starterCount - starterCap),
      overCreatorPassCapBy: Math.max(0, creatorPassCount - creatorPassCap),
    };
  });
  const contributionMap = new Map<string, DeveloperAssetSubmission[]>();
  submissions.forEach((submission) => {
    const current = contributionMap.get(submission.developerId) ?? [];
    current.push(submission);
    contributionMap.set(submission.developerId, current);
  });
  profiles.forEach((profile) => {
    if (profile.status && profile.status !== 'active') return;
    if (!contributionMap.has(profile.clerk_user_id)) contributionMap.set(profile.clerk_user_id, []);
  });
  const developerContributions = Array.from(contributionMap.entries())
    .map(([developerId, developerSubmissions]) => {
      const stats = countDeveloperMonthlyStats(developerSubmissions, now);
      const developerEmail = developerSubmissions.find((submission) => submission.developerEmail)?.developerEmail ?? null;
      const namedSubmission = developerSubmissions.find((submission) => submission.developerDisplayName);
      const profile = profilesById.get(developerId);
      const rules = resolveEffectiveDeveloperRules(settings, profile);
      return {
        developerId,
        developerEmail: profile?.email ?? developerEmail,
        developerName: namedSubmission?.developerDisplayName ?? getDeveloperProfileDisplayName(developerEmail, profile),
        profileStatus: profile?.status ?? 'active',
        submitted: stats.submitted,
        published: stats.published,
        archived: stats.archived,
        rejected: stats.rejected,
        effectiveSubmissionLimit: rules.effectiveSubmissionLimit,
        effectivePublishedRequirement: rules.effectivePublishedRequirement,
        submissionLimitOverride: rules.submissionLimitOverride,
        publishedRequirementOverride: rules.publishedRequirementOverride,
        remainingSubmissions: Math.max(0, rules.effectiveSubmissionLimit - stats.submitted),
        requiredPublished: rules.effectivePublishedRequirement,
        missingPublished: Math.max(0, rules.effectivePublishedRequirement - stats.published),
        profitShareEligible: rules.profitShareEligible,
        ownerNote: rules.ownerNote,
        isOwnerDefaultContributor: false,
      };
    })
    .sort((a, b) => b.submitted - a.submitted || a.developerId.localeCompare(b.developerId));

  return {
    configured,
    settings,
    currentUserId,
    currentContributorIds: Array.from(currentContributorIdSet),
    activeDeveloperCount,
    submissions,
    votingQueue: submissions.filter((submission) => (
      activeReviewStatuses.has(submission.status)
      && (settings.allowContributorSelfVoting || !currentContributorIdSet.has(submission.developerId))
    )),
    assetTypeSummaries,
    developerContributions,
    developerStats,
    effectiveMonthlySubmissionLimit: currentRules.effectiveSubmissionLimit,
    effectiveMonthlyPublishedRequirement: currentRules.effectivePublishedRequirement,
    profitShareEligible: currentRules.profitShareEligible,
    developerOwnerNote: currentRules.ownerNote,
    remainingSubmissions: Math.max(0, currentRules.effectiveSubmissionLimit - developerStats.submitted),
  };
};
