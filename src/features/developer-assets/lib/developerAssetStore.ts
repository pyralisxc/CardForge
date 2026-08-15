import {
  DEVELOPER_ASSET_STATUSES,
  DEVELOPER_ASSET_TYPES,
  DEFAULT_DEVELOPER_PROGRAM_SETTINGS,
  isDeveloperAssetAccessTier,
  isDeveloperAssetAccessTierOverride,
  isDeveloperAssetStatus,
  isDeveloperAssetType,
  normalizeDeveloperProgramSettingsInput,
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
  castDeveloperAssetVote,
  DeveloperAssetRegistryCommandError,
  purgeDeveloperAssetSubmission,
  saveDeveloperProgramSettings,
  setDeveloperAssetOwnerOverride,
} from '@/features/developer-assets/lib/developerAssetRegistryCommands';
import { isRepositoryStyle } from '@/features/developer-assets/lib/registryContentValidation';
import { getSupabaseServerClient, getSupabaseServerConfigStatus } from '@/infrastructure/database/supabaseServer';
import {
  buildDeveloperAssetProgramView,
  mapDeveloperAssetSubmissionRow,
  mapDeveloperProgramSettingsRow,
  normalizeDeveloperAssetLongText,
  normalizeDeveloperAssetShortText,
  normalizeDeveloperAssetSubmissionEditInput,
  normalizeDeveloperAssetSubmissionInput,
  normalizeDeveloperProfileOverrideInput,
  type DeveloperAssetProgramView,
  type DeveloperAssetProgramAggregate,
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

const runRegistryCommand = async (command: () => Promise<void>): Promise<void> => {
  try {
    await command();
  } catch (error) {
    if (error instanceof DeveloperAssetRegistryCommandError) {
      throw new DeveloperAssetStoreError(error.message, error.status);
    }
    throw error;
  }
};

const PROGRAM_SETTINGS_ID = 'default';
const SUBMISSION_COLUMNS = 'id,developer_id,developer_email,asset_type,name,description,preview_url,source_url,source_file_size_bytes,source_mime_type,source_storage_bucket,source_storage_path,registry_asset_id,status,automated_status,owner_status_override,calculated_access_tier,automated_access_tier,owner_access_tier_override,quality_score,tier_decision_reason,owner_note,decision_reason,positive_votes,negative_votes,source_payload,target_registry_asset_id,base_revision_number,revision_number,published_at,purge_state,submitted_at,updated_at';

export type DeveloperAssetListScope = 'all' | 'own' | 'review';
export type DeveloperAssetVoteFilter = 'all' | 'unvoted' | 'upvoted' | 'downvoted';

export interface DeveloperAssetListQuery {
  scope: DeveloperAssetListScope;
  query?: string;
  assetType?: string;
  status?: string;
  tier?: string;
  voteFilter?: string;
  page?: number;
  pageSize?: number;
}

interface DeveloperAssetProgramSummaryRow {
  total_submission_count?: unknown;
  total_voteable_count?: unknown;
  managed_file_count?: unknown;
  managed_storage_bytes?: unknown;
  status_counts?: unknown;
  review_status_counts?: unknown;
  asset_type_counts?: unknown;
  monthly_counts_by_developer?: unknown;
}

const asCount = (value: unknown): number => {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
};

const asRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
);

const fetchDeveloperSettings = async (): Promise<{ configured: boolean; settings: DeveloperProgramSettings }> => {
  const supabase = getSupabaseServerClient();
  if (!getSupabaseServerConfigStatus().configured || !supabase) {
    return { configured: false, settings: DEFAULT_DEVELOPER_PROGRAM_SETTINGS };
  }

  const settingsColumns = 'max_active_developers,monthly_submission_limit,monthly_published_requirement,minimum_votes_for_grading,free_asset_minimum_positive_vote_percent,paid_asset_minimum_positive_vote_percent,allow_contributor_self_voting,owner_vote_weight,tier_caps_by_type';
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
  submissionIds: string[],
  profileRows: DeveloperProfileRow[] = [],
  includeRegistryRecipePayloads = false,
): Promise<DeveloperAssetSubmission[]> => {
  const supabase = getSupabaseServerClient();
  if (!supabase || submissionIds.length === 0) return [];

  const [
    { data: rows, error: rowsError },
    { data: voteRows, error: votesError },
  ] = await Promise.all([
    supabase
      .from('cardforge_developer_asset_submissions')
      .select(SUBMISSION_COLUMNS)
      .in('id', submissionIds),
    supabase
      .from('cardforge_developer_asset_votes')
      .select('submission_id,vote_value')
      .eq('developer_id', currentUserId)
      .in('submission_id', submissionIds),
  ]);

  if (rowsError || votesError) {
    console.error('Failed to load developer asset submissions:', rowsError ?? votesError);
    return [];
  }

  const submissionRows = (rows ?? []) as DeveloperAssetSubmissionRow[];
  const registryStylesById = new Map<string, unknown>();
  if (includeRegistryRecipePayloads) {
    const recipeAssetIds = [...new Set(submissionRows.flatMap((row) => {
      if (row.asset_type !== 'elementPresets') return [];
      const assetId = row.registry_asset_id ?? row.target_registry_asset_id;
      return assetId ? [assetId] : [];
    }))];

    if (recipeAssetIds.length > 0) {
      const { data: registryRows, error: registryRowsError } = await supabase
        .from('cardforge_asset_registry')
        .select('asset_id,style:metadata->style')
        .eq('asset_type', 'elementPreset')
        .in('asset_id', recipeAssetIds);

      if (registryRowsError) {
        console.error('Failed to load Pipeline recipe content for owner previews:', registryRowsError);
      } else {
        (registryRows ?? []).forEach((row) => {
          const registryRow = row as { asset_id?: unknown; style?: unknown };
          if (typeof registryRow.asset_id === 'string' && isRepositoryStyle(registryRow.style)) {
            registryStylesById.set(registryRow.asset_id, registryRow.style);
          }
        });
      }
    }
  }

  const currentUserVotes = Object.fromEntries((voteRows ?? []).map((row) => [
    String((row as { submission_id: string }).submission_id),
    (row as { vote_value: DeveloperVoteValue }).vote_value,
  ]));
  const profilesById = new Map(profileRows.map((row) => [
    String((row as DeveloperProfileRow).clerk_user_id),
    row as DeveloperProfileRow,
  ]));

  const submissionsById = new Map(submissionRows.map((submissionRow) => {
    const registryAssetId = submissionRow.registry_asset_id ?? submissionRow.target_registry_asset_id;
    return [submissionRow.id, mapDeveloperAssetSubmissionRow(
      submissionRow,
      currentUserVotes,
      profilesById.get(submissionRow.developer_id),
      registryAssetId ? registryStylesById.get(registryAssetId) : undefined,
    )] as const;
  }));
  return submissionIds.flatMap((submissionId) => {
    const submission = submissionsById.get(submissionId);
    return submission ? [submission] : [];
  });
};

const fetchDeveloperAssetProgramAggregate = async (
  currentUserId: string,
  allowSelfVoting: boolean,
): Promise<DeveloperAssetProgramAggregate> => {
  const supabase = getSupabaseServerClient();
  const empty: DeveloperAssetProgramAggregate = {
    totalSubmissionCount: 0,
    totalVoteableCount: 0,
    submissionStatusCounts: {},
    reviewStatusCounts: {},
    submissionTypeCounts: {},
    managedFileCount: 0,
    managedStorageBytes: 0,
    assetTypeMetrics: {},
    monthlyStatsByDeveloper: {},
  };
  if (!supabase) return empty;

  const { data, error } = await supabase.rpc('cardforge_get_developer_asset_program_summary', {
    p_current_user_id: currentUserId,
    p_allow_self_voting: allowSelfVoting,
  });
  if (error) {
    console.error('Failed to load developer asset program summary:', error);
    throw new DeveloperAssetStoreError('Unable to load developer asset program summary.', 500);
  }

  const row = (data?.[0] ?? {}) as DeveloperAssetProgramSummaryRow;
  const statusCounts = asRecord(row.status_counts);
  const reviewStatusCounts = asRecord(row.review_status_counts);
  const typeCounts = asRecord(row.asset_type_counts);
  const monthlyCounts = asRecord(row.monthly_counts_by_developer);
  const aggregate: DeveloperAssetProgramAggregate = {
    totalSubmissionCount: asCount(row.total_submission_count),
    totalVoteableCount: asCount(row.total_voteable_count),
    managedFileCount: asCount(row.managed_file_count),
    managedStorageBytes: asCount(row.managed_storage_bytes),
    submissionStatusCounts: {},
    reviewStatusCounts: {},
    submissionTypeCounts: {},
    assetTypeMetrics: {},
    monthlyStatsByDeveloper: {},
  };
  for (const status of DEVELOPER_ASSET_STATUSES) {
    aggregate.submissionStatusCounts[status] = asCount(statusCounts[status]);
    aggregate.reviewStatusCounts[status] = asCount(reviewStatusCounts[status]);
  }
  for (const assetType of DEVELOPER_ASSET_TYPES) {
    const metrics = asRecord(typeCounts[assetType]);
    aggregate.submissionTypeCounts[assetType] = asCount(metrics.total);
    aggregate.assetTypeMetrics[assetType] = {
      published: asCount(metrics.published),
      starter: asCount(metrics.starter),
      creatorPass: asCount(metrics.creatorPass),
      candidate: asCount(metrics.candidate),
      archived: asCount(metrics.archived),
    };
  }
  for (const [developerId, value] of Object.entries(monthlyCounts)) {
    const metrics = asRecord(value);
    aggregate.monthlyStatsByDeveloper[developerId] = {
      submitted: asCount(metrics.submitted),
      published: asCount(metrics.published),
      archived: asCount(metrics.archived),
      rejected: asCount(metrics.rejected),
      total: asCount(metrics.total),
    };
  }
  return aggregate;
};

const normalizeListQuery = (query: DeveloperAssetListQuery): Required<DeveloperAssetListQuery> => ({
  scope: query.scope,
  query: typeof query.query === 'string' ? query.query.trim().slice(0, 120) : '',
  assetType: query.assetType && isDeveloperAssetType(query.assetType) ? query.assetType : 'all',
  status: query.status && isDeveloperAssetStatus(query.status) ? query.status : 'all',
  tier: query.tier && isDeveloperAssetAccessTier(query.tier) ? query.tier : 'all',
  voteFilter: query.voteFilter === 'unvoted' || query.voteFilter === 'upvoted' || query.voteFilter === 'downvoted'
    ? query.voteFilter
    : 'all',
  page: Math.max(1, Math.floor(query.page ?? 1)),
  pageSize: Math.min(50, Math.max(1, Math.floor(query.pageSize ?? 12))),
});

const fetchDeveloperAssetSubmissionPage = async ({
  currentUserId,
  profiles,
  includeRegistryRecipePayloads,
  allowSelfVoting,
  query,
}: {
  currentUserId: string;
  profiles: DeveloperProfileRow[];
  includeRegistryRecipePayloads: boolean;
  allowSelfVoting: boolean;
  query: DeveloperAssetListQuery;
}): Promise<{ submissions: DeveloperAssetSubmission[]; total: number; page: number; pageSize: number }> => {
  const supabase = getSupabaseServerClient();
  const normalized = normalizeListQuery(query);
  if (!supabase) return { submissions: [], total: 0, page: normalized.page, pageSize: normalized.pageSize };

  const { data, error } = await supabase.rpc('cardforge_list_developer_asset_submission_ids', {
    p_current_user_id: currentUserId,
    p_scope: normalized.scope,
    p_query: normalized.query,
    p_asset_type: normalized.assetType === 'all' ? null : normalized.assetType,
    p_status: normalized.status === 'all' ? null : normalized.status,
    p_tier: normalized.tier === 'all' ? null : normalized.tier,
    p_vote_filter: normalized.voteFilter,
    p_allow_self_voting: allowSelfVoting,
    p_page: normalized.page,
    p_page_size: normalized.pageSize,
  });
  if (error) {
    console.error('Failed to load developer asset submission page:', error);
    throw new DeveloperAssetStoreError('Unable to load developer asset submissions.', 500);
  }

  const rows = (data ?? []) as Array<{ submission_id?: unknown; total_count?: unknown }>;
  const ids = rows.flatMap((row) => typeof row.submission_id === 'string' ? [row.submission_id] : []);
  return {
    submissions: await fetchSubmissionRows(currentUserId, ids, profiles, includeRegistryRecipePayloads),
    total: rows.length > 0 ? asCount(rows[0].total_count) : 0,
    page: normalized.page,
    pageSize: normalized.pageSize,
  };
};

export const getDeveloperAssetProgramView = async (
  currentUserId: string,
  currentContributorIds: string[] = [currentUserId],
  {
    includeRegistryRecipePayloads = false,
    submissionQuery,
    votingQuery,
  }: {
    includeRegistryRecipePayloads?: boolean;
    submissionQuery?: DeveloperAssetListQuery;
    votingQuery?: DeveloperAssetListQuery;
  } = {},
): Promise<DeveloperAssetProgramView> => {
  const { configured, settings } = await fetchDeveloperSettings();
  const [profiles, activeDeveloperCount, aggregate] = await Promise.all([
    fetchDeveloperProfileRows(),
    countActiveDevelopers(),
    fetchDeveloperAssetProgramAggregate(currentUserId, settings.allowContributorSelfVoting),
  ]);
  const [submissionPage, votingPage] = await Promise.all([
    fetchDeveloperAssetSubmissionPage({
      currentUserId,
      profiles,
      includeRegistryRecipePayloads,
      allowSelfVoting: settings.allowContributorSelfVoting,
      query: submissionQuery ?? {
        scope: includeRegistryRecipePayloads ? 'all' : 'own',
        page: 1,
        pageSize: 12,
      },
    }),
    fetchDeveloperAssetSubmissionPage({
      currentUserId,
      profiles,
      includeRegistryRecipePayloads,
      allowSelfVoting: settings.allowContributorSelfVoting,
      query: votingQuery ?? { scope: 'review', page: 1, pageSize: 10 },
    }),
  ]);
  return buildDeveloperAssetProgramView({
    configured,
    settings,
    currentUserId,
    currentContributorIds,
    submissions: submissionPage.submissions,
    votingQueue: votingPage.submissions,
    submissionPage,
    votingPage,
    aggregate,
    profiles,
    activeDeveloperCount,
  });
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

  return getDeveloperAssetProgramView(currentUserId, currentContributorIds, { includeRegistryRecipePayloads: true });
};

export const updateDeveloperProgramSettings = async (
  input: Partial<Record<keyof DeveloperProgramSettings, unknown>>,
  currentUserId = '',
  currentContributorIds: string[] = currentUserId ? [currentUserId] : [],
): Promise<DeveloperAssetProgramView> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new DeveloperAssetStoreError('Developer asset database is not configured yet.', 503);

  const normalized = normalizeDeveloperProgramSettingsInput(input);
  if (!currentUserId) throw new DeveloperAssetStoreError('Owner identity is required to update pipeline rules.', 403);
  await runRegistryCommand(() => saveDeveloperProgramSettings(normalized, currentUserId));
  return getDeveloperAssetProgramView(currentUserId, currentContributorIds, { includeRegistryRecipePayloads: true });
};

export const createDeveloperAssetSubmission = async ({
  developerId,
  developerEmail,
  input,
  currentContributorIds = [developerId],
  includeRegistryRecipePayloads = false,
}: {
  developerId: string;
  developerEmail: string | null;
  currentContributorIds?: string[];
  includeRegistryRecipePayloads?: boolean;
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

  const view = await getDeveloperAssetProgramView(developerId, currentContributorIds, { includeRegistryRecipePayloads });
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
      automated_status: 'voting',
      owner_status_override: null,
      calculated_access_tier: 'developer',
      automated_access_tier: 'developer',
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
    return await getDeveloperAssetProgramView(developerId, currentContributorIds, { includeRegistryRecipePayloads });
  } catch (error) {
    console.error('Developer asset was submitted, but the refreshed program view was unavailable:', error);
    return view;
  }
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
  if (voteValue !== 'positive' && voteValue !== 'negative') {
    throw new DeveloperAssetStoreError('Choose a supported vote value.', 400);
  }
  await runRegistryCommand(() => castDeveloperAssetVote({
    submissionId,
    developerId,
    voteValue,
    ownerDeveloperId,
  }));
  return getDeveloperAssetProgramView(developerId, currentContributorIds, {
    includeRegistryRecipePayloads: Boolean(ownerDeveloperId),
  });
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

  return getDeveloperAssetProgramView(developerId, currentContributorIds, {
    includeRegistryRecipePayloads: allowOwnerEdit,
  });
};

export const updateDeveloperAssetSubmissionStatus = async ({
  submissionId,
  ownerStatusOverride,
  ownerNote,
  ownerAccessTierOverride,
  currentUserId = '',
  currentContributorIds = currentUserId ? [currentUserId] : [],
}: {
  submissionId: string;
  ownerStatusOverride?: unknown;
  ownerNote?: unknown;
  ownerAccessTierOverride?: unknown;
  currentUserId?: string;
  currentContributorIds?: string[];
}): Promise<DeveloperAssetProgramView> => {
  if (!currentUserId) throw new DeveloperAssetStoreError('Owner identity is required to override an asset.', 403);
  const normalizedStatusOverride = ownerStatusOverride === null || ownerStatusOverride === ''
    ? null
    : isDeveloperAssetStatus(ownerStatusOverride)
      ? ownerStatusOverride
      : undefined;
  if (ownerStatusOverride !== undefined && normalizedStatusOverride === undefined) {
    throw new DeveloperAssetStoreError('Choose a supported submission status override.', 400);
  }
  const normalizedTierOverride = ownerAccessTierOverride === null || ownerAccessTierOverride === ''
    ? null
    : isDeveloperAssetAccessTierOverride(ownerAccessTierOverride)
      ? ownerAccessTierOverride
      : undefined;
  if (ownerAccessTierOverride !== undefined && normalizedTierOverride === undefined) {
    throw new DeveloperAssetStoreError('Choose a supported asset access override.', 400);
  }
  await runRegistryCommand(() => setDeveloperAssetOwnerOverride({
    submissionId,
    ownerNote: normalizeDeveloperAssetLongText(ownerNote, 280),
    ownerDeveloperId: currentUserId,
    ...(ownerStatusOverride !== undefined ? { ownerStatusOverride: normalizedStatusOverride ?? null } : {}),
    ...(ownerAccessTierOverride !== undefined ? { ownerAccessTierOverride: normalizedTierOverride ?? null } : {}),
  }));

  return getDeveloperAssetProgramView(currentUserId, currentContributorIds, { includeRegistryRecipePayloads: true });
};

export const permanentlyDeleteDeveloperAssetSubmission = async ({
  submissionId,
  confirmationName,
  currentUserId,
  currentContributorIds = [currentUserId],
}: {
  submissionId: string;
  confirmationName: unknown;
  currentUserId: string;
  currentContributorIds?: string[];
}): Promise<DeveloperAssetProgramView> => {
  if (!currentUserId) throw new DeveloperAssetStoreError('Owner identity is required to delete an asset.', 403);
  const normalizedConfirmation = normalizeDeveloperAssetShortText(confirmationName, 160);
  if (!normalizedConfirmation) {
    throw new DeveloperAssetStoreError('Type the exact asset name to confirm permanent deletion.', 400);
  }
  await runRegistryCommand(() => purgeDeveloperAssetSubmission({
    submissionId,
    confirmationName: normalizedConfirmation,
  }));
  return getDeveloperAssetProgramView(currentUserId, currentContributorIds, { includeRegistryRecipePayloads: true });
};
