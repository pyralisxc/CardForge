import {
  DEFAULT_DEVELOPER_PROGRAM_SETTINGS,
  DEVELOPER_ASSET_TYPES,
  countDeveloperMonthlyStats,
  evaluateDeveloperAssetAccessTier,
  evaluateDeveloperAssetDecisionForType,
  isDeveloperAssetAccessTier,
  isDeveloperAssetAccessTierOverride,
  isDeveloperAssetStatus,
  isDeveloperAssetType,
  normalizeDeveloperProgramSettingsInput,
  type DeveloperAssetAccessTier,
  type DeveloperAssetAccessTierOverride,
  type DeveloperAssetTypePipelineSummary,
  type DeveloperContributionSummary,
  type DeveloperAssetMonthlyStats,
  type DeveloperAssetStatus,
  type DeveloperAssetType,
  type DeveloperProgramSettings,
  type DeveloperVoteValue,
} from '@/lib/developerAssets';
import { getSupabaseServerClient, getSupabaseServerConfigStatus } from '@/lib/supabaseServer';

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

export interface DeveloperProfileRow {
  clerk_user_id: string;
  email: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

export class DeveloperAssetStoreError extends Error {
  constructor(
    message: string,
    public readonly status = 500
  ) {
    super(message);
  }
}

const PROGRAM_SETTINGS_ID = 'default';

const isMissingDeveloperAssetTableError = (error: unknown): boolean =>
  typeof error === 'object'
  && error !== null
  && 'code' in error
  && (error as { code?: string }).code === 'PGRST205';

const normalizeShortText = (value: unknown, maxLength: number): string =>
  typeof value === 'string' ? value.trim().replace(/[ \t]+/g, ' ').slice(0, maxLength) : '';

const normalizeLongText = (value: unknown, maxLength: number): string =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, maxLength) : '';

const normalizeUrl = (value: unknown, maxLength = 2048): string =>
  typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

const normalizeOptionalInteger = (value: unknown, min: number, max: number): number | null => {
  const numeric = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  if (!Number.isFinite(numeric)) return null;
  const rounded = Math.round(numeric);
  if (rounded < min || rounded > max) return null;
  return rounded;
};

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

  const name = normalizeShortText(value.name, 96);
  if (!name) return { ok: false, message: 'Asset name is required.' };

  const previewUrl = normalizeUrl(value.previewUrl);
  const sourceUrl = normalizeUrl(value.sourceUrl);
  if (!sourceUrl) return { ok: false, message: 'Upload a source file before submitting this asset.' };

  return {
    ok: true,
    value: {
      assetType: value.assetType,
      name,
      description: normalizeLongText(value.description, 280),
      previewUrl: previewUrl || sourceUrl,
      sourceUrl,
      sourceFileSizeBytes: normalizeOptionalInteger(value.sourceFileSizeBytes, 1, 50 * 1024 * 1024),
      sourceMimeType: normalizeShortText(value.sourceMimeType, 120) || null,
      sourceStorageBucket: normalizeShortText(value.sourceStorageBucket, 80) || null,
      sourceStoragePath: normalizeUrl(value.sourceStoragePath) || null,
    },
  };
};

export const normalizeDeveloperAssetSubmissionEditInput = (value: {
  name?: unknown;
  description?: unknown;
  previewUrl?: unknown;
}): DeveloperAssetSubmissionEditInputResult => {
  const name = normalizeShortText(value.name, 96);
  if (!name) return { ok: false, message: 'Asset name is required.' };

  return {
    ok: true,
    value: {
      name,
      description: normalizeLongText(value.description, 280),
      previewUrl: normalizeUrl(value.previewUrl),
    },
  };
};

export const mapDeveloperProgramSettingsRow = (
  row: DeveloperProgramSettingsRow | null | undefined
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
  profile?: DeveloperProfileRow | null,
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
  now = new Date(),
}: {
  configured: boolean;
  settings: DeveloperProgramSettings;
  currentUserId: string;
  currentContributorIds?: string[];
  activeDeveloperCount?: number;
  submissions: DeveloperAssetSubmission[];
  now?: Date;
}): DeveloperAssetProgramView => {
  const currentContributorIdSet = new Set(currentContributorIds.length > 0 ? currentContributorIds : [currentUserId]);
  const ownSubmissions = submissions.filter((submission) => currentContributorIdSet.has(submission.developerId));
  const developerStats = countDeveloperMonthlyStats(ownSubmissions, now);
  const remainingSubmissions = Math.max(0, settings.monthlySubmissionLimit - developerStats.submitted);
  const activeReviewStatuses = new Set(['draft', 'submitted', 'voting', 'publish_candidate', 'published']);
  const assetTypeSummaries = DEVELOPER_ASSET_TYPES.map((assetType) => {
    const byType = submissions.filter((submission) => submission.assetType === assetType);
    const published = byType.filter((submission) => submission.status === 'published');
    const starterCount = published.filter((submission) => submission.calculatedAccessTier === 'free').length;
    const creatorPassCount = published.filter((submission) => submission.calculatedAccessTier === 'paid').length;
    const officialCount = published.filter((submission) => submission.calculatedAccessTier === 'official').length;
    const publishCap = settings.publishCapsByType[assetType];
    const starterCap = settings.tierCapsByType[assetType].free;
    const creatorPassCap = settings.tierCapsByType[assetType].paid;

    return {
      assetType,
      publishedCount: published.length,
      officialCount,
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
    if (!contributionMap.has(submission.developerId)) contributionMap.set(submission.developerId, []);
    contributionMap.get(submission.developerId)?.push(submission);
  });
  const developerContributions = Array.from(contributionMap.entries())
    .map(([developerId, developerSubmissions]) => {
      const stats = countDeveloperMonthlyStats(developerSubmissions, now);
      const developerEmail = developerSubmissions.find((submission) => submission.developerEmail)?.developerEmail ?? null;
      const namedSubmission = developerSubmissions.find((submission) => submission.developerDisplayName);

      return {
        developerId,
        developerEmail,
        developerName: developerId === 'cardforge-official'
          ? 'CardForge Owner'
          : namedSubmission?.developerDisplayName ?? developerEmail,
        submitted: stats.submitted,
        published: stats.published,
        archived: stats.archived,
        rejected: stats.rejected,
        remainingSubmissions: Math.max(0, settings.monthlySubmissionLimit - stats.submitted),
        requiredPublished: settings.monthlyPublishedRequirement,
        missingPublished: Math.max(0, settings.monthlyPublishedRequirement - stats.published),
        isOwnerDefaultContributor: developerId === 'cardforge-official',
      };
    })
    .sort((a, b) => (
      Number(b.isOwnerDefaultContributor) - Number(a.isOwnerDefaultContributor)
      || b.submitted - a.submitted
      || a.developerId.localeCompare(b.developerId)
    ));

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
    remainingSubmissions,
  };
};

const countActiveDevelopers = async (): Promise<number> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) return 1;

  const { count, error } = await supabase
    .from('cardforge_developer_profiles')
    .select('clerk_user_id', { count: 'exact', head: true })
    .eq('status', 'active');

  if (error) {
    if (!isMissingDeveloperAssetTableError(error)) {
      console.error('Failed to count active developers:', error);
    }
    return 1;
  }

  return Math.max(1, count ?? 0);
};

const fetchDeveloperSettings = async (): Promise<{ configured: boolean; settings: DeveloperProgramSettings }> => {
  const supabase = getSupabaseServerClient();
  if (!getSupabaseServerConfigStatus().configured || !supabase) {
    return { configured: false, settings: DEFAULT_DEVELOPER_PROGRAM_SETTINGS };
  }

  const { data, error } = await supabase
    .from('cardforge_developer_program_settings')
    .select('max_active_developers,monthly_submission_limit,monthly_published_requirement,minimum_votes_for_grading,minimum_positive_vote_percent,free_asset_minimum_positive_vote_percent,paid_asset_minimum_positive_vote_percent,minimum_votes_for_tier_assignment,show_paid_preview_to_free_users,allow_paid_early_access_to_candidates,allow_contributor_self_voting,archive_visible_limit,profit_share_pool_percent,owner_final_review_required,publish_caps_by_type,tier_caps_by_type')
    .eq('id', PROGRAM_SETTINGS_ID)
    .limit(1);

  if (error) {
    if (!isMissingDeveloperAssetTableError(error)) {
      console.error('Failed to load developer asset program settings:', error);
    }
    return { configured: false, settings: DEFAULT_DEVELOPER_PROGRAM_SETTINGS };
  }

  return {
    configured: true,
    settings: mapDeveloperProgramSettingsRow(data?.[0] as DeveloperProgramSettingsRow | undefined),
  };
};

const fetchSubmissionRows = async (currentUserId: string): Promise<DeveloperAssetSubmission[]> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];

  const [{ data: rows, error: rowsError }, { data: voteRows, error: votesError }, { data: profileRows, error: profilesError }] = await Promise.all([
    supabase
      .from('cardforge_developer_asset_submissions')
      .select('id,developer_id,developer_email,asset_type,name,description,preview_url,source_url,source_file_size_bytes,source_mime_type,source_storage_bucket,source_storage_path,registry_asset_id,status,calculated_access_tier,owner_access_tier_override,quality_score,tier_decision_reason,owner_note,decision_reason,positive_votes,negative_votes,submitted_at,updated_at')
      .order('submitted_at', { ascending: false }),
    supabase
      .from('cardforge_developer_asset_votes')
      .select('submission_id,vote_value')
      .eq('developer_id', currentUserId),
    supabase
      .from('cardforge_developer_profiles')
      .select('clerk_user_id,email,first_name,last_name'),
  ]);

  if (rowsError || votesError || profilesError) {
    if (!isMissingDeveloperAssetTableError(rowsError) && !isMissingDeveloperAssetTableError(votesError) && !isMissingDeveloperAssetTableError(profilesError)) {
      console.error('Failed to load developer asset submissions:', rowsError ?? votesError ?? profilesError);
    }
    return [];
  }

  const currentUserVotes = Object.fromEntries((voteRows ?? []).map((row) => [
    String((row as { submission_id: string }).submission_id),
    (row as { vote_value: DeveloperVoteValue }).vote_value,
  ]));
  const profilesById = new Map((profileRows ?? []).map((row) => [
    String((row as DeveloperProfileRow).clerk_user_id),
    row as DeveloperProfileRow,
  ]));

  return (rows ?? []).map((row) => {
    const submissionRow = row as DeveloperAssetSubmissionRow;
    return mapDeveloperAssetSubmissionRow(submissionRow, currentUserVotes, profilesById.get(submissionRow.developer_id));
  });
};

const getVoteQuality = (submission: Pick<DeveloperAssetSubmission, 'positiveVotes' | 'negativeVotes'>) => {
  const totalVotes = Math.max(0, submission.positiveVotes) + Math.max(0, submission.negativeVotes);
  const qualityScore = totalVotes === 0 ? 0 : Math.round((Math.max(0, submission.positiveVotes) / totalVotes) * 100);
  return { totalVotes, qualityScore };
};

const rankPipelineAsset = (submission: DeveloperAssetSubmission) => {
  const { totalVotes, qualityScore } = getVoteQuality(submission);
  return {
    qualityScore,
    totalVotes,
    timestamp: new Date(submission.updatedAt ?? submission.submittedAt).getTime() || 0,
  };
};

const rebalanceDeveloperAssetPipeline = async (settings: DeveloperProgramSettings): Promise<void> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;

  const submissions = await fetchSubmissionRows('');
  const activeSubmissions = submissions.filter((submission) => submission.status !== 'rejected');
  const updates: Array<{ submission: DeveloperAssetSubmission; status: DeveloperAssetStatus; accessTier: DeveloperAssetAccessTier; qualityScore: number; reason: string; tierReason: string }> = [];

  DEVELOPER_ASSET_TYPES.forEach((assetType) => {
    const byType = activeSubmissions.filter((submission) => submission.assetType === assetType);
    const failingIds = new Set<string>();
    const liveCandidates: DeveloperAssetSubmission[] = [];

    byType.forEach((submission) => {
      const { totalVotes, qualityScore } = getVoteQuality(submission);
      if (totalVotes >= settings.minimumVotesForGrading) {
        if (submission.negativeVotes > submission.positiveVotes || qualityScore < settings.minimumPositiveVotePercent) {
          failingIds.add(submission.id);
          return;
        }
      }

      if (submission.status === 'published' || totalVotes >= settings.minimumVotesForGrading) {
        liveCandidates.push(submission);
      }
    });

    const publishedIds = new Set(liveCandidates
      .sort((a, b) => {
        const rankB = rankPipelineAsset(b);
        const rankA = rankPipelineAsset(a);
        return rankB.qualityScore - rankA.qualityScore
          || rankB.totalVotes - rankA.totalVotes
          || rankB.timestamp - rankA.timestamp;
      })
      .slice(0, settings.publishCapsByType[assetType])
      .map((submission) => submission.id));

    byType.forEach((submission) => {
      const { totalVotes, qualityScore } = getVoteQuality(submission);
      const nextStatus: DeveloperAssetStatus = failingIds.has(submission.id)
        ? 'archived'
        : publishedIds.has(submission.id)
          ? 'published'
          : totalVotes >= settings.minimumVotesForGrading
            ? 'publish_candidate'
            : submission.status === 'published'
              ? 'publish_candidate'
              : 'voting';
      const tierDecision = evaluateDeveloperAssetAccessTier({
        settings,
        assetType,
        status: nextStatus,
        positiveVotes: submission.positiveVotes,
        negativeVotes: submission.negativeVotes,
        ownerAccessTierOverride: submission.ownerAccessTierOverride,
        ignoreTierCaps: nextStatus === 'published',
      });

      if (
        submission.status !== nextStatus
        || submission.calculatedAccessTier !== tierDecision.accessTier
        || submission.qualityScore !== tierDecision.qualityScore
        || submission.tierDecisionReason !== tierDecision.reason
      ) {
        updates.push({
          submission,
          status: nextStatus,
          accessTier: tierDecision.accessTier,
          qualityScore: tierDecision.qualityScore,
          reason: nextStatus,
          tierReason: tierDecision.reason,
        });
      }
    });
  });

  await Promise.all(updates.map(async (update) => {
    const { error } = await supabase
      .from('cardforge_developer_asset_submissions')
      .update({
        status: update.status,
        calculated_access_tier: update.accessTier,
        quality_score: update.qualityScore,
        decision_reason: update.reason,
        tier_decision_reason: update.tierReason,
      })
      .eq('id', update.submission.id);

    if (!error) {
      await syncPublishedSubmissionToAssetRegistry({
        submissionId: update.submission.id,
        status: update.status,
        calculatedAccessTier: update.accessTier,
      });
    }
  }));
};

export const getDeveloperAssetProgramView = async (
  currentUserId: string,
  currentContributorIds: string[] = [currentUserId],
): Promise<DeveloperAssetProgramView> => {
  const { configured, settings } = await fetchDeveloperSettings();
  const [submissions, activeDeveloperCount] = await Promise.all([
    fetchSubmissionRows(currentUserId),
    countActiveDevelopers(),
  ]);
  return buildDeveloperAssetProgramView({ configured, settings, currentUserId, currentContributorIds, submissions, activeDeveloperCount });
};

export const upsertDeveloperProfile = async ({
  developerId,
  email,
  firstName,
  lastName,
}: {
  developerId: string;
  email: string | null;
  firstName?: string | null;
  lastName?: string | null;
}): Promise<void> => {
  const supabase = getSupabaseServerClient();
  if (!supabase || !developerId) return;

  const { error } = await supabase
    .from('cardforge_developer_profiles')
    .upsert({
      clerk_user_id: developerId,
      email,
      first_name: normalizeShortText(firstName, 80) || null,
      last_name: normalizeShortText(lastName, 80) || null,
      status: 'active',
    }, { onConflict: 'clerk_user_id' });

  if (error && !isMissingDeveloperAssetTableError(error)) {
    console.error('Failed to upsert developer profile:', error);
  }
};

export const updateDeveloperProgramSettings = async (
  input: Partial<Record<keyof DeveloperProgramSettings, unknown>>,
  currentUserId = '',
  currentContributorIds: string[] = currentUserId ? [currentUserId] : [],
): Promise<DeveloperAssetProgramView> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new DeveloperAssetStoreError('Developer asset database is not configured yet.', 503);

  const normalized = normalizeDeveloperProgramSettingsInput(input);
  const { error } = await supabase
    .from('cardforge_developer_program_settings')
    .upsert({
      id: PROGRAM_SETTINGS_ID,
      max_active_developers: normalized.maxActiveDevelopers,
      monthly_submission_limit: normalized.monthlySubmissionLimit,
      monthly_published_requirement: normalized.monthlyPublishedRequirement,
      minimum_votes_for_grading: normalized.minimumVotesForGrading,
      minimum_positive_vote_percent: normalized.minimumPositiveVotePercent,
      free_asset_minimum_positive_vote_percent: normalized.freeAssetMinimumPositiveVotePercent,
      paid_asset_minimum_positive_vote_percent: normalized.paidAssetMinimumPositiveVotePercent,
      minimum_votes_for_tier_assignment: normalized.minimumVotesForTierAssignment,
      show_paid_preview_to_free_users: normalized.showPaidPreviewToFreeUsers,
      allow_paid_early_access_to_candidates: normalized.allowPaidEarlyAccessToCandidates,
      allow_contributor_self_voting: normalized.allowContributorSelfVoting,
      archive_visible_limit: normalized.archiveVisibleLimit,
      profit_share_pool_percent: normalized.profitSharePoolPercent,
      owner_final_review_required: normalized.ownerFinalReviewRequired,
      publish_caps_by_type: normalized.publishCapsByType,
      tier_caps_by_type: normalized.tierCapsByType,
    }, { onConflict: 'id' });

  if (error) {
    console.error('Failed to update developer program settings:', error);
    throw new DeveloperAssetStoreError('Unable to update developer program settings.', 500);
  }

  await rebalanceDeveloperAssetPipeline(normalized);
  return getDeveloperAssetProgramView(currentUserId, currentContributorIds);
};

export const createDeveloperAssetSubmission = async ({
  developerId,
  developerEmail,
  input,
  currentContributorIds = [developerId],
}: {
  developerId: string;
  developerEmail: string | null;
  currentContributorIds?: string[];
  input: {
    assetType?: unknown;
    name?: unknown;
    description?: unknown;
    previewUrl?: unknown;
    sourceUrl?: unknown;
    sourceFileSizeBytes?: unknown;
    sourceMimeType?: unknown;
    sourceStorageBucket?: unknown;
    sourceStoragePath?: unknown;
  };
}): Promise<DeveloperAssetProgramView> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new DeveloperAssetStoreError('Developer asset database is not configured yet.', 503);

  const view = await getDeveloperAssetProgramView(developerId, currentContributorIds);
  if (view.remainingSubmissions <= 0) {
    throw new DeveloperAssetStoreError('This developer has reached the monthly submission limit.', 400);
  }

  const normalized = normalizeDeveloperAssetSubmissionInput(input);
  if (!normalized.ok) throw new DeveloperAssetStoreError(normalized.message, 400);

  const { error } = await supabase
    .from('cardforge_developer_asset_submissions')
    .insert({
      developer_id: developerId,
      developer_email: developerEmail,
      asset_type: normalized.value.assetType,
      name: normalized.value.name,
      description: normalized.value.description,
      preview_url: normalized.value.previewUrl,
      source_url: normalized.value.sourceUrl,
      source_file_size_bytes: normalized.value.sourceFileSizeBytes,
      source_mime_type: normalized.value.sourceMimeType,
      source_storage_bucket: normalized.value.sourceStorageBucket,
      source_storage_path: normalized.value.sourceStoragePath,
      status: 'voting',
      calculated_access_tier: 'developer',
      owner_access_tier_override: null,
      quality_score: 0,
      tier_decision_reason: 'needs_more_votes',
      positive_votes: 0,
      negative_votes: 0,
    });

  if (error) {
    console.error('Failed to create developer asset submission:', error);
    throw new DeveloperAssetStoreError('Unable to submit developer asset.', 500);
  }

  return getDeveloperAssetProgramView(developerId, currentContributorIds);
};

const countPublishedThisPeriodForType = async (assetType: DeveloperAssetType): Promise<number> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) return 0;

  const { count, error } = await supabase
    .from('cardforge_developer_asset_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('asset_type', assetType)
    .eq('status', 'published');

  if (error) {
    console.error('Failed to count published developer assets:', error);
    return 0;
  }

  return count ?? 0;
};

const countTieredThisPeriodForType = async (
  assetType: DeveloperAssetType,
  accessTier: DeveloperAssetAccessTier
): Promise<number> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) return 0;

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const { count, error } = await supabase
    .from('cardforge_developer_asset_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('asset_type', assetType)
    .eq('calculated_access_tier', accessTier)
    .gte('updated_at', monthStart);

  if (error) {
    console.error('Failed to count tiered developer assets:', error);
    return 0;
  }

  return count ?? 0;
};

const developerAssetTypeToRegistryType = (assetType: DeveloperAssetType) => {
  if (assetType === 'templates') return 'template';
  if (assetType === 'elementPresets') return 'elementPreset';
  if (assetType === 'textures') return 'texture';
  if (assetType === 'dividers') return 'divider';
  if (assetType === 'icons') return 'icon';
  if (assetType === 'imageAssets') return 'image';
  return 'part';
};

const getRegistryMetadataForSubmission = (submission: {
  asset_type: DeveloperAssetType;
  source_mime_type?: string | null;
  developer_id?: string | null;
  developer_email?: string | null;
}) => {
  const base = {
    developerId: submission.developer_id,
    developerEmail: submission.developer_email,
    sourceMimeType: submission.source_mime_type,
  };

  if (submission.asset_type === 'textures') {
    return {
      ...base,
      tileMode: 'repeat',
      seamless: true,
      allowedTargets: ['text', 'shape', 'template'],
      defaultBlendMode: 'multiply',
      defaultOpacity: 42,
      defaultScale: 160,
    };
  }

  if (submission.asset_type === 'dividers') {
    return {
      ...base,
      tileMode: 'stretch',
      seamless: false,
      allowedTargets: ['divider'],
      defaultBlendMode: 'normal',
      defaultOpacity: 100,
      defaultScale: 100,
    };
  }

  if (submission.asset_type === 'icons') {
    return {
      ...base,
      tileMode: 'contain',
      seamless: false,
      allowedTargets: ['icon'],
      defaultBlendMode: 'normal',
      defaultOpacity: 100,
      defaultScale: 100,
      defaultWidth: 64,
      defaultHeight: 64,
    };
  }

  if (submission.asset_type === 'imageAssets') {
    return {
      ...base,
      tileMode: 'contain',
      seamless: false,
      allowedTargets: ['image', 'imageFrame', 'template'],
      defaultBlendMode: 'normal',
      defaultOpacity: 100,
      defaultScale: 100,
      defaultWidth: 300,
      defaultHeight: 180,
    };
  }

  if (submission.asset_type === 'parts') {
    return {
      ...base,
      tileMode: 'contain',
      seamless: false,
      allowedTargets: ['imageFrame', 'shape', 'template'],
      defaultBlendMode: 'normal',
      defaultOpacity: 100,
      defaultScale: 100,
      partRole: 'ornament',
      defaultWidth: 220,
      defaultHeight: 120,
    };
  }

  return base;
};

const getRegistryAccessTierForPublishedSubmission = (
  accessTier: DeveloperAssetAccessTier
): Extract<DeveloperAssetAccessTier, 'official' | 'free' | 'paid' | 'hidden'> => {
  if (accessTier === 'official' || accessTier === 'paid' || accessTier === 'free') return accessTier;
  return 'hidden';
};

const syncPublishedSubmissionToAssetRegistry = async ({
  submissionId,
  status,
  calculatedAccessTier,
}: {
  submissionId: string;
  status: DeveloperAssetStatus;
  calculatedAccessTier: DeveloperAssetAccessTier;
}) => {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;

  const { data: rows, error } = await supabase
    .from('cardforge_developer_asset_submissions')
    .select('id,developer_id,developer_email,asset_type,name,description,preview_url,source_url,source_file_size_bytes,source_mime_type,source_storage_bucket,source_storage_path,registry_asset_id')
    .eq('id', submissionId)
    .limit(1);

  if (error || !rows?.[0]) {
    if (error) console.error('Failed to load submission for asset registry sync:', error);
    return;
  }

  const submission = rows[0] as {
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
  };
  if (!isDeveloperAssetType(submission.asset_type)) return;

  const registryAssetId = submission.registry_asset_id || `developer-${submission.asset_type}-${submission.id}`;

  if (status === 'archived' || status === 'rejected') {
    await supabase
      .from('cardforge_asset_registry')
      .update({ status, access_tier: 'hidden' })
      .eq('asset_id', registryAssetId);
    return;
  }

  if (status !== 'published') {
    await supabase
      .from('cardforge_asset_registry')
      .update({
        status,
        access_tier: calculatedAccessTier === 'hidden' ? 'hidden' : 'developer',
      })
      .eq('asset_id', registryAssetId);
    return;
  }
  if (!submission.source_url) {
    throw new DeveloperAssetStoreError('A source file is required before this asset can publish into the live library.', 400);
  }

  const { error: upsertError } = await supabase
    .from('cardforge_asset_registry')
    .upsert({
      asset_id: registryAssetId,
      name: submission.name,
      asset_type: developerAssetTypeToRegistryType(submission.asset_type),
      url: submission.source_url,
      preview_url: submission.preview_url || submission.source_url,
      status: 'published',
      access_tier: getRegistryAccessTierForPublishedSubmission(calculatedAccessTier),
      library_source: 'developer',
      developer_submission_id: submission.id,
      storage_bucket: submission.source_storage_bucket,
      storage_path: submission.source_storage_path,
      file_size_bytes: submission.source_file_size_bytes,
      metadata: getRegistryMetadataForSubmission({
        asset_type: submission.asset_type,
        source_mime_type: submission.source_mime_type,
        developer_id: submission.developer_id,
        developer_email: submission.developer_email,
      }),
    }, { onConflict: 'asset_id' });

  if (upsertError) {
    console.error('Failed to publish submission into asset registry:', upsertError);
    throw new DeveloperAssetStoreError('Unable to publish this asset into the live library.', 500);
  }

  await supabase
    .from('cardforge_developer_asset_submissions')
    .update({ registry_asset_id: registryAssetId })
    .eq('id', submission.id);
};

const refreshSubmissionVoteDecision = async (submissionId: string): Promise<void> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;

  const { data: submissionRows, error: submissionError } = await supabase
    .from('cardforge_developer_asset_submissions')
    .select('asset_type,positive_votes,negative_votes,status,calculated_access_tier,owner_access_tier_override')
    .eq('id', submissionId)
    .limit(1);

  if (submissionError || !submissionRows?.[0]) return;
  const submission = submissionRows[0] as {
    asset_type: unknown;
    positive_votes: number | null;
    negative_votes: number | null;
    status: unknown;
    calculated_access_tier: unknown;
    owner_access_tier_override: unknown;
  };
  if (!isDeveloperAssetType(submission.asset_type) || submission.status === 'rejected') return;

  const { settings } = await fetchDeveloperSettings();
  const totalVotes = (submission.positive_votes ?? 0) + (submission.negative_votes ?? 0);
  const publishedThisPeriodForType = await countPublishedThisPeriodForType(submission.asset_type);
  const currentStatus = isDeveloperAssetStatus(submission.status) ? submission.status : 'voting';
  const decision = currentStatus === 'published' && totalVotes < settings.minimumVotesForGrading
    ? {
        nextStatus: 'published' as const,
        reason: 'needs_more_votes' as const,
        positiveVotePercent: 0,
        totalVotes,
      }
    : evaluateDeveloperAssetDecisionForType({
        assetType: submission.asset_type,
        settings,
        positiveVotes: submission.positive_votes ?? 0,
        negativeVotes: submission.negative_votes ?? 0,
        publishedThisPeriodForType,
      });
  const paidTieredThisPeriodForType = await countTieredThisPeriodForType(submission.asset_type, 'paid');
  const freeTieredThisPeriodForType = await countTieredThisPeriodForType(submission.asset_type, 'free');
  const tierDecision = evaluateDeveloperAssetAccessTier({
    assetType: submission.asset_type,
    settings,
    status: decision.nextStatus,
    positiveVotes: submission.positive_votes ?? 0,
    negativeVotes: submission.negative_votes ?? 0,
    ownerAccessTierOverride: isDeveloperAssetAccessTierOverride(submission.owner_access_tier_override)
      ? submission.owner_access_tier_override
      : null,
    freeTieredThisPeriodForType,
    paidTieredThisPeriodForType,
    ignoreTierCaps: currentStatus === 'published',
  });

  const { error: updateError } = await supabase
    .from('cardforge_developer_asset_submissions')
    .update({
      status: decision.nextStatus,
      decision_reason: decision.reason,
      calculated_access_tier: tierDecision.accessTier,
      quality_score: tierDecision.qualityScore,
      tier_decision_reason: tierDecision.reason,
    })
    .eq('id', submissionId);

  if (!updateError) {
    await syncPublishedSubmissionToAssetRegistry({
      submissionId,
      status: decision.nextStatus,
      calculatedAccessTier: tierDecision.accessTier,
    });
  }
};

export const voteOnDeveloperAssetSubmission = async ({
  submissionId,
  developerId,
  voteValue,
  currentContributorIds = [developerId],
}: {
  submissionId: string;
  developerId: string;
  voteValue: unknown;
  currentContributorIds?: string[];
}): Promise<DeveloperAssetProgramView> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new DeveloperAssetStoreError('Developer asset database is not configured yet.', 503);
  if (voteValue !== 'positive' && voteValue !== 'negative') {
    throw new DeveloperAssetStoreError('Choose a supported vote value.', 400);
  }

  const { error: voteError } = await supabase
    .from('cardforge_developer_asset_votes')
    .upsert({
      submission_id: submissionId,
      developer_id: developerId,
      vote_value: voteValue,
    }, { onConflict: 'submission_id,developer_id' });

  if (voteError) {
    console.error('Failed to submit developer asset vote:', voteError);
    throw new DeveloperAssetStoreError('Unable to submit vote.', 500);
  }

  const { data: voteRows, error: countError } = await supabase
    .from('cardforge_developer_asset_votes')
    .select('vote_value')
    .eq('submission_id', submissionId);

  if (!countError) {
    const positiveVotes = (voteRows ?? []).filter((row) => (row as { vote_value: string }).vote_value === 'positive').length;
    const negativeVotes = (voteRows ?? []).filter((row) => (row as { vote_value: string }).vote_value === 'negative').length;
    await supabase
      .from('cardforge_developer_asset_submissions')
      .update({ positive_votes: positiveVotes, negative_votes: negativeVotes })
      .eq('id', submissionId);
  }

  await refreshSubmissionVoteDecision(submissionId);
  return getDeveloperAssetProgramView(developerId, currentContributorIds);
};

export const updateDeveloperAssetSubmissionDetails = async ({
  submissionId,
  developerId,
  input,
  allowOwnerEdit = false,
  currentContributorIds = [developerId],
}: {
  submissionId: string;
  developerId: string;
  input: {
    name?: unknown;
    description?: unknown;
    previewUrl?: unknown;
  };
  allowOwnerEdit?: boolean;
  currentContributorIds?: string[];
}): Promise<DeveloperAssetProgramView> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new DeveloperAssetStoreError('Developer asset database is not configured yet.', 503);

  const normalized = normalizeDeveloperAssetSubmissionEditInput(input);
  if (!normalized.ok) throw new DeveloperAssetStoreError(normalized.message, 400);

  const { data: rows, error: loadError } = await supabase
    .from('cardforge_developer_asset_submissions')
    .select('developer_id,status,source_url')
    .eq('id', submissionId)
    .limit(1);

  if (loadError) {
    console.error('Failed to load editable developer asset submission:', loadError);
    throw new DeveloperAssetStoreError('Unable to load developer asset submission.', 500);
  }

  const row = rows?.[0] as { developer_id?: string; status?: unknown; source_url?: string | null } | undefined;
  if (!row) throw new DeveloperAssetStoreError('Developer asset submission was not found.', 404);
  if (!allowOwnerEdit && row.developer_id !== developerId) {
    throw new DeveloperAssetStoreError('Only the uploader can edit this asset.', 403);
  }
  if (row.status === 'published' || row.status === 'rejected') {
    throw new DeveloperAssetStoreError('Published or rejected assets cannot be edited from the developer hub.', 400);
  }

  const previewUrl = normalized.value.previewUrl || row.source_url || '';
  const { error } = await supabase
    .from('cardforge_developer_asset_submissions')
    .update({
      name: normalized.value.name,
      description: normalized.value.description,
      preview_url: previewUrl,
    })
    .eq('id', submissionId);

  if (error) {
    console.error('Failed to edit developer asset submission:', error);
    throw new DeveloperAssetStoreError('Unable to edit developer asset submission.', 500);
  }

  return getDeveloperAssetProgramView(developerId, currentContributorIds);
};

export const updateDeveloperAssetSubmissionStatus = async ({
  submissionId,
  status,
  ownerNote,
  ownerAccessTierOverride,
  currentUserId = '',
  currentContributorIds = currentUserId ? [currentUserId] : [],
}: {
  submissionId: string;
  status: unknown;
  ownerNote?: unknown;
  ownerAccessTierOverride?: unknown;
  currentUserId?: string;
  currentContributorIds?: string[];
}): Promise<DeveloperAssetProgramView> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new DeveloperAssetStoreError('Developer asset database is not configured yet.', 503);
  if (!isDeveloperAssetStatus(status)) throw new DeveloperAssetStoreError('Choose a supported submission status.', 400);
  const normalizedTierOverride = ownerAccessTierOverride === null || ownerAccessTierOverride === ''
    ? null
    : isDeveloperAssetAccessTierOverride(ownerAccessTierOverride)
      ? ownerAccessTierOverride
      : undefined;
  if (ownerAccessTierOverride !== undefined && normalizedTierOverride === undefined) {
    throw new DeveloperAssetStoreError('Choose a supported asset access override.', 400);
  }

  const { data: rows } = await supabase
    .from('cardforge_developer_asset_submissions')
    .select('asset_type,positive_votes,negative_votes')
    .eq('id', submissionId)
    .limit(1);
  const row = rows?.[0] as { asset_type?: unknown; positive_votes?: number | null; negative_votes?: number | null } | undefined;
  const assetType = isDeveloperAssetType(row?.asset_type) ? row.asset_type : 'imageAssets';
  const { settings } = await fetchDeveloperSettings();
  const [freeTieredThisPeriodForType, paidTieredThisPeriodForType] = await Promise.all([
    countTieredThisPeriodForType(assetType, 'free'),
    countTieredThisPeriodForType(assetType, 'paid'),
  ]);
  const tierDecision = evaluateDeveloperAssetAccessTier({
    assetType,
    settings,
    status,
    positiveVotes: row?.positive_votes ?? 0,
    negativeVotes: row?.negative_votes ?? 0,
    freeTieredThisPeriodForType,
    paidTieredThisPeriodForType,
    ownerAccessTierOverride: normalizedTierOverride ?? null,
  });

  const { error } = await supabase
    .from('cardforge_developer_asset_submissions')
    .update({
      status,
      owner_note: normalizeLongText(ownerNote, 280),
      ...(ownerAccessTierOverride !== undefined ? { owner_access_tier_override: normalizedTierOverride } : {}),
      calculated_access_tier: tierDecision.accessTier,
      quality_score: tierDecision.qualityScore,
      tier_decision_reason: tierDecision.reason,
      decision_reason: status,
    })
    .eq('id', submissionId);

  if (error) {
    console.error('Failed to update developer asset status:', error);
    throw new DeveloperAssetStoreError('Unable to update developer asset status.', 500);
  }

  await syncPublishedSubmissionToAssetRegistry({
    submissionId,
    status,
    calculatedAccessTier: tierDecision.accessTier,
  });

  return getDeveloperAssetProgramView(currentUserId, currentContributorIds);
};
