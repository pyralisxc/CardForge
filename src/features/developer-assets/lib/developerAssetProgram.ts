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
  automatedStatus: Extract<DeveloperAssetStatus, 'voting' | 'publish_candidate' | 'published' | 'archived'>;
  ownerStatusOverride: DeveloperAssetStatus | null;
  calculatedAccessTier: DeveloperAssetAccessTier;
  automatedAccessTier: DeveloperAssetAccessTier;
  ownerAccessTierOverride: DeveloperAssetAccessTierOverride | null;
  qualityScore: number;
  tierDecisionReason: string | null;
  ownerNote?: string | null;
  decisionReason?: string | null;
  positiveVotes: number;
  negativeVotes: number;
  currentUserVote: DeveloperVoteValue | null;
  sourcePayload: unknown | null;
  targetRegistryAssetId: string | null;
  baseRevisionNumber: number | null;
  revisionNumber: number | null;
  publishedAt: string | null;
  purgeState: 'pending' | null;
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
  submissionPage: DeveloperAssetPageSummary;
  votingPage: DeveloperAssetPageSummary;
  totalSubmissionCount: number;
  totalVoteableCount: number;
  submissionStatusCounts: Record<DeveloperAssetStatus, number>;
  reviewStatusCounts: Record<DeveloperAssetStatus, number>;
  submissionTypeCounts: Record<DeveloperAssetType, number>;
  managedFileCount: number;
  managedStorageBytes: number;
  assetTypeSummaries: DeveloperAssetTypePipelineSummary[];
  developerContributions: DeveloperContributionSummary[];
  developerStats: DeveloperAssetMonthlyStats;
  effectiveMonthlySubmissionLimit: number;
  effectiveMonthlyPublishedRequirement: number;
  developerOwnerNote: string | null;
  remainingSubmissions: number;
}

export interface DeveloperAssetPageSummary {
  total: number;
  page: number;
  pageSize: number;
}

export interface DeveloperAssetProgramAggregate {
  totalSubmissionCount: number;
  totalVoteableCount: number;
  submissionStatusCounts: Partial<Record<DeveloperAssetStatus, number>>;
  reviewStatusCounts: Partial<Record<DeveloperAssetStatus, number>>;
  submissionTypeCounts: Partial<Record<DeveloperAssetType, number>>;
  managedFileCount: number;
  managedStorageBytes: number;
  assetTypeMetrics: Partial<Record<DeveloperAssetType, {
    published: number;
    starter: number;
    creatorPass: number;
    candidate: number;
    archived: number;
  }>>;
  monthlyStatsByDeveloper: Record<string, DeveloperAssetMonthlyStats & { total: number }>;
}

export interface DeveloperProgramSettingsRow {
  max_active_developers?: unknown;
  monthly_submission_limit?: unknown;
  monthly_published_requirement?: unknown;
  minimum_votes_for_grading?: unknown;
  free_asset_minimum_positive_vote_percent?: unknown;
  paid_asset_minimum_positive_vote_percent?: unknown;
  allow_contributor_self_voting?: unknown;
  owner_vote_weight?: unknown;
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
  automated_status: unknown;
  owner_status_override: unknown;
  calculated_access_tier: unknown;
  automated_access_tier: unknown;
  owner_access_tier_override: unknown;
  quality_score: number | null;
  tier_decision_reason: string | null;
  owner_note: string | null;
  decision_reason: string | null;
  positive_votes: number | null;
  negative_votes: number | null;
  source_payload: unknown | null;
  target_registry_asset_id: string | null;
  base_revision_number: number | null;
  revision_number: number | null;
  published_at: string | null;
  purge_state: unknown;
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
  owner_note?: string | null;
}

export interface DeveloperProfileOverrideInput {
  status?: unknown;
  monthlySubmissionLimitOverride?: unknown;
  monthlyPublishedRequirementOverride?: unknown;
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
  owner_note: normalizeDeveloperAssetLongText(input.ownerNote, 280),
});

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
      freeAssetMinimumPositiveVotePercent: row.free_asset_minimum_positive_vote_percent,
      paidAssetMinimumPositiveVotePercent: row.paid_asset_minimum_positive_vote_percent,
      allowContributorSelfVoting: row.allow_contributor_self_voting,
      ownerVoteWeight: row.owner_vote_weight,
      tierCapsByType: row.tier_caps_by_type,
    }
  : DEFAULT_DEVELOPER_PROGRAM_SETTINGS);

export const resolveDeveloperAssetSourcePayload = (
  submissionPayload: unknown | null,
  registrySourcePayload?: unknown,
): unknown | null => submissionPayload ?? registrySourcePayload ?? null;

export const mapDeveloperAssetSubmissionRow = (
  row: DeveloperAssetSubmissionRow,
  currentUserVotes: Record<string, DeveloperVoteValue> = {},
  profile?: DeveloperAssetProfile | null,
  registrySourcePayload?: unknown,
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
  automatedStatus: row.automated_status === 'publish_candidate'
    || row.automated_status === 'published'
    || row.automated_status === 'archived'
    ? row.automated_status
    : 'voting',
  ownerStatusOverride: isDeveloperAssetStatus(row.owner_status_override) ? row.owner_status_override : null,
  calculatedAccessTier: isDeveloperAssetAccessTier(row.calculated_access_tier) ? row.calculated_access_tier : 'developer',
  automatedAccessTier: isDeveloperAssetAccessTier(row.automated_access_tier) ? row.automated_access_tier : 'developer',
  ownerAccessTierOverride: isDeveloperAssetAccessTierOverride(row.owner_access_tier_override) ? row.owner_access_tier_override : null,
  qualityScore: row.quality_score ?? 0,
  tierDecisionReason: row.tier_decision_reason,
  ownerNote: row.owner_note,
  decisionReason: row.decision_reason,
  positiveVotes: row.positive_votes ?? 0,
  negativeVotes: row.negative_votes ?? 0,
  currentUserVote: currentUserVotes[row.id] ?? null,
  sourcePayload: resolveDeveloperAssetSourcePayload(row.source_payload, registrySourcePayload),
  targetRegistryAssetId: row.target_registry_asset_id,
  baseRevisionNumber: row.base_revision_number,
  revisionNumber: row.revision_number,
  publishedAt: row.published_at,
  purgeState: row.purge_state === 'pending' ? 'pending' : null,
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
  votingQueue,
  submissionPage,
  votingPage,
  aggregate,
  profiles = [],
  now = new Date(),
}: {
  configured: boolean;
  settings: DeveloperProgramSettings;
  currentUserId: string;
  currentContributorIds?: string[];
  activeDeveloperCount?: number;
  submissions: DeveloperAssetSubmission[];
  votingQueue?: DeveloperAssetSubmission[];
  submissionPage?: DeveloperAssetPageSummary;
  votingPage?: DeveloperAssetPageSummary;
  aggregate?: DeveloperAssetProgramAggregate;
  profiles?: DeveloperAssetProfile[];
  now?: Date;
}): DeveloperAssetProgramView => {
  const profilesById = new Map(profiles.map((profile) => [profile.clerk_user_id, profile]));
  const currentProfile = profilesById.get(currentUserId);
  const currentContributorIdSet = new Set(currentContributorIds.length > 0 ? currentContributorIds : [currentUserId]);
  const accountSubmissions = submissions.filter((submission) => submission.developerId === currentUserId);
  const currentRules = resolveEffectiveDeveloperRules(settings, currentProfile);
  const developerStats = aggregate?.monthlyStatsByDeveloper[currentUserId]
    ?? countDeveloperMonthlyStats(accountSubmissions, now);
  const activeReviewStatuses = new Set(['draft', 'submitted', 'voting', 'publish_candidate', 'published']);
  const assetTypeSummaries = DEVELOPER_ASSET_TYPES.map((assetType) => {
    const byType = submissions.filter((submission) => submission.assetType === assetType);
    const published = byType.filter((submission) => submission.status === 'published');
    const metrics = aggregate?.assetTypeMetrics[assetType];
    const publishedCount = metrics?.published ?? published.length;
    const starterCount = metrics?.starter ?? published.filter((submission) => submission.calculatedAccessTier === 'free').length;
    const creatorPassCount = metrics?.creatorPass ?? published.filter((submission) => submission.calculatedAccessTier === 'paid').length;
    const publishCap = settings.publishCapsByType[assetType];
    const starterCap = settings.tierCapsByType[assetType].free;
    const creatorPassCap = settings.tierCapsByType[assetType].paid;
    return {
      assetType,
      publishedCount,
      starterCount,
      creatorPassCount,
      candidateCount: metrics?.candidate ?? byType.filter((submission) => submission.status === 'voting' || submission.status === 'publish_candidate').length,
      archiveCount: metrics?.archived ?? byType.filter((submission) => submission.status === 'archived').length,
      publishCap,
      starterCap,
      creatorPassCap,
      openPublishSlots: Math.max(0, publishCap - publishedCount),
      overPublishCapBy: Math.max(0, publishedCount - publishCap),
      overStarterCapBy: Math.max(0, starterCount - starterCap),
      overCreatorPassCapBy: Math.max(0, creatorPassCount - creatorPassCap),
    };
  });
  const contributionMap = new Map<string, DeveloperAssetSubmission[]>();
  Object.keys(aggregate?.monthlyStatsByDeveloper ?? {}).forEach((developerId) => {
    contributionMap.set(developerId, []);
  });
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
      const stats = aggregate?.monthlyStatsByDeveloper[developerId]
        ?? countDeveloperMonthlyStats(developerSubmissions, now);
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
    votingQueue: votingQueue ?? submissions.filter((submission) => (
      activeReviewStatuses.has(submission.status)
      && (settings.allowContributorSelfVoting || !currentContributorIdSet.has(submission.developerId))
    )),
    submissionPage: submissionPage ?? { total: submissions.length, page: 1, pageSize: Math.max(1, submissions.length) },
    votingPage: votingPage ?? {
      total: submissions.filter((submission) => (
        activeReviewStatuses.has(submission.status)
        && (settings.allowContributorSelfVoting || !currentContributorIdSet.has(submission.developerId))
      )).length,
      page: 1,
      pageSize: Math.max(1, submissions.length),
    },
    totalSubmissionCount: aggregate?.totalSubmissionCount ?? submissions.length,
    totalVoteableCount: aggregate?.totalVoteableCount ?? submissions.filter((submission) => (
      activeReviewStatuses.has(submission.status)
      && (settings.allowContributorSelfVoting || !currentContributorIdSet.has(submission.developerId))
    )).length,
    submissionStatusCounts: Object.fromEntries([
      'draft', 'submitted', 'voting', 'publish_candidate', 'published', 'archived', 'rejected',
    ].map((status) => [
      status,
      aggregate?.submissionStatusCounts[status as DeveloperAssetStatus]
        ?? submissions.filter((submission) => submission.status === status).length,
    ])) as Record<DeveloperAssetStatus, number>,
    reviewStatusCounts: Object.fromEntries([
      'draft', 'submitted', 'voting', 'publish_candidate', 'published', 'archived', 'rejected',
    ].map((status) => [
      status,
      aggregate?.reviewStatusCounts[status as DeveloperAssetStatus]
        ?? submissions.filter((submission) => (
          submission.status === status
          && status !== 'rejected'
          && (settings.allowContributorSelfVoting || !currentContributorIdSet.has(submission.developerId))
        )).length,
    ])) as Record<DeveloperAssetStatus, number>,
    submissionTypeCounts: Object.fromEntries(DEVELOPER_ASSET_TYPES.map((assetType) => [
      assetType,
      aggregate?.submissionTypeCounts[assetType]
        ?? submissions.filter((submission) => submission.assetType === assetType).length,
    ])) as Record<DeveloperAssetType, number>,
    managedFileCount: aggregate?.managedFileCount ?? submissions.filter((submission) => (
      submission.sourceStorageBucket && submission.sourceStoragePath
    )).length,
    managedStorageBytes: aggregate?.managedStorageBytes ?? submissions.reduce((total, submission) => (
      total + (submission.sourceStorageBucket && submission.sourceStoragePath ? submission.sourceFileSizeBytes ?? 0 : 0)
    ), 0),
    assetTypeSummaries,
    developerContributions,
    developerStats,
    effectiveMonthlySubmissionLimit: currentRules.effectiveSubmissionLimit,
    effectiveMonthlyPublishedRequirement: currentRules.effectivePublishedRequirement,
    developerOwnerNote: currentRules.ownerNote,
    remainingSubmissions: Math.max(0, currentRules.effectiveSubmissionLimit - developerStats.submitted),
  };
};

export const projectDeveloperAssetProgramForViewer = (
  program: DeveloperAssetProgramView,
  {
    currentUserId,
    isOwner,
  }: {
    currentUserId: string;
    isOwner: boolean;
  },
): DeveloperAssetProgramView => {
  if (isOwner) return program;

  const projectedById = new Map([...program.submissions, ...program.votingQueue].map((submission) => {
    const maySeeOwnSource = submission.developerId === currentUserId;
    const projected = maySeeOwnSource ? submission : {
      ...submission,
      developerEmail: null,
      sourceUrl: null,
      sourceStorageBucket: null,
      sourceStoragePath: null,
    };
    return [submission.id, projected] as const;
  }));

  return {
    ...program,
    submissions: program.submissions.map((submission) => projectedById.get(submission.id) ?? submission),
    votingQueue: program.votingQueue.map((submission) => projectedById.get(submission.id) ?? submission),
    developerContributions: program.developerContributions.map((contribution) => ({
      ...contribution,
      developerEmail: contribution.developerId === currentUserId ? contribution.developerEmail : null,
      ownerNote: contribution.developerId === currentUserId ? contribution.ownerNote : null,
    })),
  };
};
