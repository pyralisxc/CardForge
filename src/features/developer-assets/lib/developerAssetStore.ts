import {
  DEFAULT_DEVELOPER_PROGRAM_SETTINGS,
  DEVELOPER_ASSET_TYPES,
  evaluateDeveloperAssetAccessTier,
  evaluateDeveloperAssetDecisionForType,
  isDeveloperAssetAccessTierOverride,
  isDeveloperAssetStatus,
  isDeveloperAssetType,
  normalizeDeveloperProgramSettingsInput,
  type DeveloperAssetAccessTier,
  type DeveloperAssetStatus,
  type DeveloperAssetType,
  type DeveloperProgramSettings,
  type DeveloperVoteValue,
} from '@/features/developer-assets/lib/developerAssets';
import {
  countActiveDevelopers,
  DeveloperAccessStoreError,
  fetchDeveloperProfileRows,
  updateDeveloperAssetProfileRules,
  type DeveloperProfileRow,
} from '@/features/developer-access/server';
import {
  DeveloperAssetRegistryCommandError,
  transitionDeveloperAssetStatus,
} from '@/features/developer-assets/lib/developerAssetRegistryCommands';
import { getSupabaseServerClient, getSupabaseServerConfigStatus } from '@/infrastructure/database/supabaseServer';
import {
  buildDeveloperAssetProgramView,
  calculateDeveloperAssetVoteTotals,
  mapDeveloperAssetSubmissionRow,
  mapDeveloperProgramSettingsRow,
  normalizeDeveloperAssetLongText,
  normalizeDeveloperAssetShortText,
  normalizeDeveloperAssetSubmissionEditInput,
  normalizeDeveloperAssetSubmissionInput,
  normalizeDeveloperProfileOverrideInput,
  type DeveloperAssetProgramView,
  type DeveloperAssetSubmission,
  type DeveloperAssetSubmissionRow,
  type DeveloperProgramSettingsRow,
  type DeveloperProfileOverrideInput,
} from './developerAssetProgram';

export class DeveloperAssetStoreError extends Error {
  constructor(
    message: string,
    public readonly status = 500
  ) {
    super(message);
  }
}

const runDeveloperAssetTransition = async (
  input: Parameters<typeof transitionDeveloperAssetStatus>[0],
): Promise<void> => {
  try {
    await transitionDeveloperAssetStatus(input);
  } catch (error) {
    if (error instanceof DeveloperAssetRegistryCommandError) {
      throw new DeveloperAssetStoreError(error.message, error.status);
    }
    throw error;
  }
};

const PROGRAM_SETTINGS_ID = 'default';

const fetchDeveloperSettings = async (): Promise<{ configured: boolean; settings: DeveloperProgramSettings }> => {
  const supabase = getSupabaseServerClient();
  if (!getSupabaseServerConfigStatus().configured || !supabase) {
    return { configured: false, settings: DEFAULT_DEVELOPER_PROGRAM_SETTINGS };
  }

  const settingsColumns = 'max_active_developers,monthly_submission_limit,monthly_published_requirement,minimum_votes_for_grading,minimum_positive_vote_percent,free_asset_minimum_positive_vote_percent,paid_asset_minimum_positive_vote_percent,minimum_votes_for_tier_assignment,show_paid_preview_to_free_users,allow_paid_early_access_to_candidates,allow_contributor_self_voting,owner_vote_weight,archive_visible_limit,profit_share_pool_percent,owner_final_review_required,publish_caps_by_type,tier_caps_by_type';
  const { data, error } = await supabase
    .from('cardforge_developer_program_settings')
    .select(settingsColumns)
    .eq('id', PROGRAM_SETTINGS_ID)
    .limit(1);

  if (error) {
    console.error('Failed to load developer asset program settings:', error);
    return { configured: false, settings: DEFAULT_DEVELOPER_PROGRAM_SETTINGS };
  }

  return {
    configured: true,
    settings: mapDeveloperProgramSettingsRow(data?.[0] as DeveloperProgramSettingsRow | undefined),
  };
};

const fetchSubmissionRows = async (
  currentUserId: string,
  profileRows: DeveloperProfileRow[] = [],
): Promise<DeveloperAssetSubmission[]> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];

  const [{ data: rows, error: rowsError }, { data: voteRows, error: votesError }] = await Promise.all([
    supabase
      .from('cardforge_developer_asset_submissions')
      .select('id,developer_id,developer_email,asset_type,name,description,preview_url,source_url,source_file_size_bytes,source_mime_type,source_storage_bucket,source_storage_path,registry_asset_id,status,calculated_access_tier,owner_access_tier_override,quality_score,tier_decision_reason,owner_note,decision_reason,positive_votes,negative_votes,submitted_at,updated_at')
      .order('submitted_at', { ascending: false }),
    supabase
      .from('cardforge_developer_asset_votes')
      .select('submission_id,vote_value')
      .eq('developer_id', currentUserId),
  ]);

  if (rowsError || votesError) {
    console.error('Failed to load developer asset submissions:', rowsError ?? votesError);
    return [];
  }

  const currentUserVotes = Object.fromEntries((voteRows ?? []).map((row) => [
    String((row as { submission_id: string }).submission_id),
    (row as { vote_value: DeveloperVoteValue }).vote_value,
  ]));
  const profilesById = new Map(profileRows.map((row) => [
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

  const profiles = await fetchDeveloperProfileRows();
  const submissions = await fetchSubmissionRows('', profiles);
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
      const { totalVotes } = getVoteQuality(submission);
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

  await Promise.all(updates.map((update) => runDeveloperAssetTransition({
    submissionId: update.submission.id,
    status: update.status,
    ownerNote: update.submission.ownerNote ?? '',
    ownerAccessTierOverride: update.submission.ownerAccessTierOverride,
    ownerAccessTierOverrideProvided: false,
    calculatedAccessTier: update.accessTier,
    qualityScore: update.qualityScore,
    tierDecisionReason: update.tierReason,
    registryMetadata: getRegistryMetadataForSubmission({
      asset_type: update.submission.assetType,
      source_mime_type: update.submission.sourceMimeType,
      developer_id: update.submission.developerId,
      developer_email: update.submission.developerEmail,
    }),
  })));
};

export const getDeveloperAssetProgramView = async (
  currentUserId: string,
  currentContributorIds: string[] = [currentUserId],
): Promise<DeveloperAssetProgramView> => {
  const { configured, settings } = await fetchDeveloperSettings();
  const [profiles, activeDeveloperCount] = await Promise.all([
    fetchDeveloperProfileRows(),
    countActiveDevelopers(),
  ]);
  const submissions = await fetchSubmissionRows(currentUserId, profiles);
  return buildDeveloperAssetProgramView({ configured, settings, currentUserId, currentContributorIds, submissions, profiles, activeDeveloperCount });
};

export const getDeveloperAssetVotePolicy = async (
  submissionId: string,
): Promise<{ allowContributorSelfVoting: boolean; submissionDeveloperId: string | null }> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new DeveloperAssetStoreError('Developer asset database is not configured yet.', 503);

  const [{ settings }, { data, error }] = await Promise.all([
    fetchDeveloperSettings(),
    supabase
      .from('cardforge_developer_asset_submissions')
      .select('developer_id')
      .eq('id', submissionId)
      .limit(1),
  ]);

  if (error) {
    console.error('Failed to load developer asset vote policy:', error);
    throw new DeveloperAssetStoreError('Unable to load vote rules for this submission.', 500);
  }

  const row = data?.[0] as { developer_id?: string | null } | undefined;
  return {
    allowContributorSelfVoting: settings.allowContributorSelfVoting,
    submissionDeveloperId: row?.developer_id ?? null,
  };
};

export const updateDeveloperProfileOverrides = async ({
  developerId,
  input,
  currentUserId = '',
  currentContributorIds = currentUserId ? [currentUserId] : [],
}: {
  developerId: string;
  input: DeveloperProfileOverrideInput;
  currentUserId?: string;
  currentContributorIds?: string[];
}): Promise<DeveloperAssetProgramView> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new DeveloperAssetStoreError('Developer asset database is not configured yet.', 503);
  const normalizedDeveloperId = normalizeDeveloperAssetShortText(developerId, 160);
  if (!normalizedDeveloperId) throw new DeveloperAssetStoreError('Choose a developer profile to update.', 400);

  const normalized = normalizeDeveloperProfileOverrideInput(input);
  const updateRow = {
    monthly_submission_limit_override: normalized.monthly_submission_limit_override,
    monthly_published_requirement_override: normalized.monthly_published_requirement_override,
    eligible_for_profit_share: normalized.eligible_for_profit_share,
    owner_note: normalized.owner_note,
    ...(normalized.status ? { status: normalized.status } : {}),
  };
  try {
    await updateDeveloperAssetProfileRules({
      developerId: normalizedDeveloperId,
      rules: updateRow,
    });
  } catch (error) {
    if (error instanceof DeveloperAccessStoreError) {
      throw new DeveloperAssetStoreError(error.message, error.status);
    }
    throw error;
  }

  return getDeveloperAssetProgramView(currentUserId, currentContributorIds);
};

export const updateDeveloperProgramSettings = async (
  input: Partial<Record<keyof DeveloperProgramSettings, unknown>>,
  currentUserId = '',
  currentContributorIds: string[] = currentUserId ? [currentUserId] : [],
): Promise<DeveloperAssetProgramView> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new DeveloperAssetStoreError('Developer asset database is not configured yet.', 503);

  const normalized = normalizeDeveloperProgramSettingsInput(input);
  const settingsUpsertRow = {
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
    owner_vote_weight: normalized.ownerVoteWeight,
    archive_visible_limit: normalized.archiveVisibleLimit,
    profit_share_pool_percent: normalized.profitSharePoolPercent,
    owner_final_review_required: normalized.ownerFinalReviewRequired,
    publish_caps_by_type: normalized.publishCapsByType,
    tier_caps_by_type: normalized.tierCapsByType,
  };
  const { error } = await supabase
    .from('cardforge_developer_program_settings')
    .upsert(settingsUpsertRow, { onConflict: 'id' });

  if (error) {
    console.error('Failed to update developer program settings:', error);
    throw new DeveloperAssetStoreError('Unable to update developer program settings.', 500);
  }

  await refreshAllSubmissionVoteTotals(normalized, currentUserId);
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

  try {
    return await getDeveloperAssetProgramView(developerId, currentContributorIds);
  } catch (error) {
    console.error('Developer asset was submitted, but the refreshed program view was unavailable:', error);
    return view;
  }
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

  if (submission.asset_type === 'fonts') {
    return {
      ...base,
      category: 'Utility',
      fallback: 'serif',
      fontDisplay: 'swap',
    };
  }

  return base;
};

export const getRegistryAccessTierForPublishedSubmission = (
  accessTier: DeveloperAssetAccessTier
): Extract<DeveloperAssetAccessTier, 'free' | 'paid' | 'developer' | 'hidden'> => {
  if (accessTier === 'paid' || accessTier === 'free' || accessTier === 'developer') return accessTier;
  return 'hidden';
};

export const mergeRegistryMetadataForSubmission = (
  existingMetadata: unknown,
  submissionMetadata: ReturnType<typeof getRegistryMetadataForSubmission>,
) => {
  const existing = existingMetadata && typeof existingMetadata === 'object' && !Array.isArray(existingMetadata)
    ? existingMetadata as Record<string, unknown>
    : {};

  return {
    ...existing,
    ...submissionMetadata,
  };
};

const refreshSubmissionVoteDecision = async (submissionId: string): Promise<void> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;

  const { data: submissionRows, error: submissionError } = await supabase
    .from('cardforge_developer_asset_submissions')
    .select('developer_id,developer_email,asset_type,source_mime_type,positive_votes,negative_votes,status,calculated_access_tier,owner_access_tier_override,owner_note')
    .eq('id', submissionId)
    .limit(1);

  if (submissionError || !submissionRows?.[0]) return;
  const submission = submissionRows[0] as {
    developer_id: string;
    developer_email: string | null;
    asset_type: unknown;
    source_mime_type: string | null;
    positive_votes: number | null;
    negative_votes: number | null;
    status: unknown;
    calculated_access_tier: unknown;
    owner_access_tier_override: unknown;
    owner_note: string | null;
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

  await runDeveloperAssetTransition({
    submissionId,
    status: decision.nextStatus,
    ownerNote: submission.owner_note ?? '',
    ownerAccessTierOverride: isDeveloperAssetAccessTierOverride(submission.owner_access_tier_override)
      ? submission.owner_access_tier_override
      : null,
    ownerAccessTierOverrideProvided: false,
    calculatedAccessTier: tierDecision.accessTier,
    qualityScore: tierDecision.qualityScore,
    tierDecisionReason: tierDecision.reason,
    registryMetadata: getRegistryMetadataForSubmission({
      asset_type: submission.asset_type,
      source_mime_type: submission.source_mime_type,
      developer_id: submission.developer_id,
      developer_email: submission.developer_email,
    }),
  });
};

const refreshSubmissionVoteTotals = async (
  submissionId: string,
  settings: DeveloperProgramSettings,
  ownerDeveloperId?: string | null,
): Promise<void> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;

  const { data: voteRows, error: countError } = await supabase
    .from('cardforge_developer_asset_votes')
    .select('developer_id,vote_value,vote_weight')
    .eq('submission_id', submissionId);

  if (countError) {
    console.error('Failed to recalculate developer asset vote totals:', countError);
    throw new DeveloperAssetStoreError('Unable to recalculate developer asset vote totals.', 500);
  }

  const { positiveVotes, negativeVotes } = calculateDeveloperAssetVoteTotals(
    (voteRows ?? []) as Array<{ developer_id?: string | null; vote_value?: string | null; vote_weight?: number | null }>,
    {
      ownerDeveloperId,
      ownerVoteWeight: settings.ownerVoteWeight,
    }
  );

  const { error: updateError } = await supabase
    .from('cardforge_developer_asset_submissions')
    .update({ positive_votes: positiveVotes, negative_votes: negativeVotes })
    .eq('id', submissionId);
  if (updateError) {
    console.error('Failed to save recalculated developer asset vote totals:', updateError);
    throw new DeveloperAssetStoreError('Unable to save developer asset vote totals.', 500);
  }
};

const refreshAllSubmissionVoteTotals = async (
  settings: DeveloperProgramSettings,
  ownerDeveloperId?: string | null,
): Promise<void> => {
  const supabase = getSupabaseServerClient();
  if (!supabase || !ownerDeveloperId) return;

  const { error: voteWeightError } = await supabase
    .from('cardforge_developer_asset_votes')
    .update({ vote_weight: settings.ownerVoteWeight })
    .eq('developer_id', ownerDeveloperId);
  if (voteWeightError) {
    console.error('Failed to update owner vote weights:', voteWeightError);
  }

  const { data: submissionRows, error } = await supabase
    .from('cardforge_developer_asset_submissions')
    .select('id')
    .neq('status', 'rejected');

  if (error) {
    console.error('Failed to load submissions for vote reweighting:', error);
    return;
  }

  await Promise.all((submissionRows ?? []).map((row) => (
    refreshSubmissionVoteTotals(String((row as { id: string }).id), settings, ownerDeveloperId)
  )));
};

export const voteOnDeveloperAssetSubmission = async ({
  submissionId,
  developerId,
  voteValue,
  currentContributorIds = [developerId],
  ownerDeveloperId,
}: {
  submissionId: string;
  developerId: string;
  voteValue: unknown;
  currentContributorIds?: string[];
  ownerDeveloperId?: string | null;
}): Promise<DeveloperAssetProgramView> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new DeveloperAssetStoreError('Developer asset database is not configured yet.', 503);
  if (voteValue !== 'positive' && voteValue !== 'negative') {
    throw new DeveloperAssetStoreError('Choose a supported vote value.', 400);
  }
  const { settings } = await fetchDeveloperSettings();
  const voteWeight = ownerDeveloperId && developerId === ownerDeveloperId ? settings.ownerVoteWeight : 1;

  const voteRow = {
    submission_id: submissionId,
    developer_id: developerId,
    vote_value: voteValue,
    vote_weight: voteWeight,
  };
  const { error: voteError } = await supabase
    .from('cardforge_developer_asset_votes')
    .upsert(voteRow, { onConflict: 'submission_id,developer_id' });

  if (voteError) {
    console.error('Failed to submit developer asset vote:', voteError);
    throw new DeveloperAssetStoreError('Unable to submit vote.', 500);
  }

  await refreshSubmissionVoteTotals(submissionId, settings, ownerDeveloperId);

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

  const { data: rows, error: loadError } = await supabase
    .from('cardforge_developer_asset_submissions')
    .select('developer_id,developer_email,asset_type,source_mime_type,positive_votes,negative_votes')
    .eq('id', submissionId)
    .limit(1);
  if (loadError) {
    console.error('Failed to load developer asset status target:', loadError);
    throw new DeveloperAssetStoreError('Unable to load developer asset submission.', 500);
  }
  const row = rows?.[0] as {
    developer_id?: string;
    developer_email?: string | null;
    asset_type?: unknown;
    source_mime_type?: string | null;
    positive_votes?: number | null;
    negative_votes?: number | null;
  } | undefined;
  if (!row || !isDeveloperAssetType(row.asset_type)) {
    throw new DeveloperAssetStoreError('Developer asset submission was not found.', 404);
  }
  const assetType = row.asset_type;
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

  await runDeveloperAssetTransition({
    submissionId,
    status,
    ownerNote: normalizeDeveloperAssetLongText(ownerNote, 280),
    ownerAccessTierOverride: normalizedTierOverride ?? null,
    ownerAccessTierOverrideProvided: ownerAccessTierOverride !== undefined,
    calculatedAccessTier: tierDecision.accessTier,
    qualityScore: tierDecision.qualityScore,
    tierDecisionReason: tierDecision.reason,
    registryMetadata: getRegistryMetadataForSubmission({
      asset_type: assetType,
      source_mime_type: row.source_mime_type ?? null,
      developer_id: row.developer_id ?? '',
      developer_email: row.developer_email ?? null,
    }),
  });

  return getDeveloperAssetProgramView(currentUserId, currentContributorIds);
};
