import {
  DEVELOPER_ASSET_STATUSES,
  DEVELOPER_ASSET_TYPES,
  isDeveloperAssetAccessTier,
  isDeveloperAssetStatus,
  isDeveloperAssetType,
  type DeveloperVoteValue,
} from './developerAssets';
import {
  mapDeveloperAssetSubmissionRow,
  type DeveloperAssetProgramAggregate,
  type DeveloperAssetSubmission,
  type DeveloperAssetSubmissionRow,
} from './developerAssetProgram';
import { DeveloperAssetStoreError } from './developerAssetStoreError';
import { isRepositoryStyle } from './registryContentValidation';
import type { DeveloperProfileRow } from '@/features/developer-access/server';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';

const SUBMISSION_COLUMNS = 'id,developer_id,developer_email,asset_type,requested_studio_destination,specialty_tags,use_case_tags,source_notes,name,description,preview_url,source_url,source_file_size_bytes,source_mime_type,source_storage_bucket,source_storage_path,registry_asset_id,status,automated_status,owner_status_override,calculated_access_tier,automated_access_tier,owner_access_tier_override,quality_score,tier_decision_reason,owner_note,decision_reason,positive_votes,negative_votes,source_payload,target_registry_asset_id,base_revision_number,revision_number,published_at,purge_state,submitted_at,updated_at';

export type DeveloperAssetListScope = 'all' | 'own' | 'review';

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

const fetchSubmissionRows = async (
  currentUserId: string,
  submissionIds: string[],
  profileRows: DeveloperProfileRow[],
  includeRegistryRecipePayloads: boolean,
): Promise<DeveloperAssetSubmission[]> => {
  const supabase = getSupabaseServerClient();
  if (!supabase || submissionIds.length === 0) return [];
  const [{ data: rows, error: rowsError }, { data: voteRows, error: votesError }] = await Promise.all([
    supabase.from('cardforge_developer_asset_submissions').select(SUBMISSION_COLUMNS).in('id', submissionIds),
    supabase.from('cardforge_developer_asset_votes').select('submission_id,vote_value')
      .eq('developer_id', currentUserId).in('submission_id', submissionIds),
  ]);
  if (rowsError || votesError) {
    console.error('Failed to load developer asset submissions:', rowsError ?? votesError);
    throw new DeveloperAssetStoreError('Unable to load developer asset submissions.', 500);
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
      const { data: registryRows, error } = await supabase.from('cardforge_asset_registry')
        .select('asset_id,style:metadata->style').eq('asset_type', 'elementPreset').in('asset_id', recipeAssetIds);
      if (error) throw new DeveloperAssetStoreError('Unable to load Pipeline recipe previews.', 500);
      (registryRows ?? []).forEach((row) => {
        const registryRow = row as { asset_id?: unknown; style?: unknown };
        if (typeof registryRow.asset_id === 'string' && isRepositoryStyle(registryRow.style)) {
          registryStylesById.set(registryRow.asset_id, registryRow.style);
        }
      });
    }
  }

  const currentUserVotes = Object.fromEntries((voteRows ?? []).map((row) => [
    String((row as { submission_id: string }).submission_id),
    (row as { vote_value: DeveloperVoteValue }).vote_value,
  ]));
  const profilesById = new Map(profileRows.map((row) => [row.clerk_user_id, row]));
  const submissionsById = new Map(submissionRows.map((row) => {
    const registryAssetId = row.registry_asset_id ?? row.target_registry_asset_id;
    return [row.id, mapDeveloperAssetSubmissionRow(
      row,
      currentUserVotes,
      profilesById.get(row.developer_id),
      registryAssetId ? registryStylesById.get(registryAssetId) : undefined,
    )] as const;
  }));
  return submissionIds.flatMap((id) => submissionsById.has(id) ? [submissionsById.get(id)!] : []);
};

export const fetchDeveloperAssetProgramAggregate = async (
  currentUserId: string,
  allowSelfVoting: boolean,
): Promise<DeveloperAssetProgramAggregate> => {
  const supabase = getSupabaseServerClient();
  const aggregate: DeveloperAssetProgramAggregate = {
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
  if (!supabase) return aggregate;
  const { data, error } = await supabase.rpc('cardforge_get_developer_asset_program_summary', {
    p_current_user_id: currentUserId,
    p_allow_self_voting: allowSelfVoting,
  });
  if (error) throw new DeveloperAssetStoreError('Unable to load developer asset program summary.', 500);
  const row = (data?.[0] ?? {}) as DeveloperAssetProgramSummaryRow;
  const statusCounts = asRecord(row.status_counts);
  const reviewStatusCounts = asRecord(row.review_status_counts);
  const typeCounts = asRecord(row.asset_type_counts);
  aggregate.totalSubmissionCount = asCount(row.total_submission_count);
  aggregate.totalVoteableCount = asCount(row.total_voteable_count);
  aggregate.managedFileCount = asCount(row.managed_file_count);
  aggregate.managedStorageBytes = asCount(row.managed_storage_bytes);
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
  for (const [developerId, value] of Object.entries(asRecord(row.monthly_counts_by_developer))) {
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
  voteFilter: ['unvoted', 'upvoted', 'downvoted'].includes(query.voteFilter ?? '') ? query.voteFilter! : 'all',
  page: Math.max(1, Math.floor(query.page ?? 1)),
  pageSize: Math.min(50, Math.max(1, Math.floor(query.pageSize ?? 12))),
});

export const fetchDeveloperAssetSubmissionPage = async ({
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
  if (error) throw new DeveloperAssetStoreError('Unable to load developer asset submissions.', 500);
  const rows = (data ?? []) as Array<{ submission_id?: unknown; total_count?: unknown }>;
  const ids = rows.flatMap((row) => typeof row.submission_id === 'string' ? [row.submission_id] : []);
  return {
    submissions: await fetchSubmissionRows(currentUserId, ids, profiles, includeRegistryRecipePayloads),
    total: rows.length > 0 ? asCount(rows[0].total_count) : 0,
    page: normalized.page,
    pageSize: normalized.pageSize,
  };
};
