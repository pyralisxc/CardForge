import { z } from 'zod';
import { getPipelineTrashState } from './pipelineTrash';
import { isSharedPipelineTrash } from './pipelineVisibility';
import {
  PIPELINE_STATUSES,
  PIPELINE_TYPES,
  isContributorAssetAccessTier,
  isContributorAssetStatus,
  isContributorAssetType,
  type PipelineVoteValue,
} from './pipelineItems';
import {
  mapPipelineSubmissionRow,
  type PipelineProgramAggregate,
  type SharedPipelineTrashPage,
  type PipelineSubmission,
  type PipelineSubmissionRow,
} from './pipelineProgram';
import { PipelineStoreError } from './pipelineStoreError';
import { isRepositoryStyle } from './registryContentValidation';
import type { ContributorProfileRow } from '@/features/contributor-access/server';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { hydratePipelineTemplateAssetReferences } from './pipelineTemplateAssets';

const SUBMISSION_COLUMNS = 'catalog_trashed_at,catalog_purge_after,catalog_retention_hold,catalog_submission_id,catalog_source_published,id,lineage_id,contributor_id,contributor_email,asset_type,requested_studio_destination,specialty_tags,use_case_tags,semantic_role,visual_family,variant_kind,variant_label,compatibility_tags,source_notes,source_review_evidence,template_review_context,editorial_review_status,editorial_review_note,editorial_reviewed_by,editorial_reviewed_at,name,description,preview_url,source_url,source_file_size_bytes,source_mime_type,source_storage_bucket,source_storage_path,registry_asset_id,status,contributor_lifecycle_state,automated_status,owner_status_override,calculated_access_tier,automated_access_tier,owner_access_tier_override,quality_score,tier_decision_reason,owner_note,decision_reason,positive_votes,negative_votes,media_presentation,source_payload,target_registry_asset_id,base_revision_number,revision_number,published_at,purge_state,trashed_at,purge_after,trash_reason,retention_hold,revision_publication_retained,revision_trash_actor_id,revision_trash_actor_role,revision_trash_previous_status,submitted_at,updated_at';

export type PipelineListScope = 'all' | 'own' | 'review' | 'shared';

export interface PipelineListQuery {
  scope: PipelineListScope;
  query?: string;
  assetType?: string;
  status?: string;
  trash?: string;
  tier?: string;
  voteFilter?: string;
  page?: number;
  pageSize?: number;
}

interface PipelineProgramSummaryRow {
  total_submission_count?: unknown;
  total_voteable_count?: unknown;
  managed_file_count?: unknown;
  managed_storage_bytes?: unknown;
  status_counts?: unknown;
  review_status_counts?: unknown;
  asset_type_counts?: unknown;
  monthly_counts_by_contributor?: unknown;
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
  profileRows: ContributorProfileRow[],
  includeRegistryRecipePayloads: boolean,
): Promise<PipelineSubmission[]> => {
  const supabase = getSupabaseServerClient();
  if (!supabase || submissionIds.length === 0) return [];
  const [{ data: rows, error: rowsError }, { data: voteRows, error: votesError }] = await Promise.all([
    supabase.from('cardforge_pipeline_submission_recovery_projection').select(SUBMISSION_COLUMNS).in('id', submissionIds),
    supabase.from('cardforge_contributor_asset_votes').select('submission_id,vote_value')
      .eq('contributor_id', currentUserId).in('submission_id', submissionIds),
  ]);
  if (rowsError || votesError) {
    console.error('Failed to load Pipeline submissions:', rowsError ?? votesError);
    throw new PipelineStoreError('Unable to load Pipeline submissions.', 500);
  }

  const submissionRows = ((rows ?? []) as PipelineSubmissionRow[]).map((row) => (
    row.asset_type === 'templates'
      ? { ...row, source_payload: hydratePipelineTemplateAssetReferences(row.source_payload) }
      : row
  ));
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
      if (error) throw new PipelineStoreError('Unable to load Pipeline recipe previews.', 500);
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
    (row as { vote_value: PipelineVoteValue }).vote_value,
  ]));
  const profilesById = new Map(profileRows.map((row) => [row.clerk_user_id, row]));
  const submissionsById = new Map(submissionRows.map((row) => {
    const registryAssetId = row.registry_asset_id ?? row.target_registry_asset_id;
    return [row.id, mapPipelineSubmissionRow(
      row,
      currentUserVotes,
      profilesById.get(row.contributor_id),
      registryAssetId ? registryStylesById.get(registryAssetId) : undefined,
    )] as const;
  }));
  return submissionIds.flatMap((id) => submissionsById.has(id) ? [submissionsById.get(id)!] : []);
};

export const fetchPipelineProgramAggregate = async (
  currentUserId: string,
  allowSelfVoting: boolean,
): Promise<PipelineProgramAggregate> => {
  const supabase = getSupabaseServerClient();
  const aggregate: PipelineProgramAggregate = {
    totalSubmissionCount: 0,
    totalVoteableCount: 0,
    submissionStatusCounts: {},
    reviewStatusCounts: {},
    submissionTypeCounts: {},
    managedFileCount: 0,
    managedStorageBytes: 0,
    assetTypeMetrics: {},
    monthlyStatsByContributor: {},
  };
  if (!supabase) return aggregate;
  const { data, error } = await supabase.rpc('cardforge_get_contributor_asset_program_summary', {
    p_current_user_id: currentUserId,
    p_allow_self_voting: allowSelfVoting,
  });
  if (error) throw new PipelineStoreError('Unable to load Pipeline program summary.', 500);
  const row = (data?.[0] ?? {}) as PipelineProgramSummaryRow;
  const statusCounts = asRecord(row.status_counts);
  const reviewStatusCounts = asRecord(row.review_status_counts);
  const typeCounts = asRecord(row.asset_type_counts);
  aggregate.totalSubmissionCount = asCount(row.total_submission_count);
  aggregate.totalVoteableCount = asCount(row.total_voteable_count);
  aggregate.managedFileCount = asCount(row.managed_file_count);
  aggregate.managedStorageBytes = asCount(row.managed_storage_bytes);
  for (const status of PIPELINE_STATUSES) {
    aggregate.submissionStatusCounts[status] = asCount(statusCounts[status]);
    aggregate.reviewStatusCounts[status] = asCount(reviewStatusCounts[status]);
  }
  for (const assetType of PIPELINE_TYPES) {
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
  for (const [contributorId, value] of Object.entries(asRecord(row.monthly_counts_by_contributor))) {
    const metrics = asRecord(value);
    aggregate.monthlyStatsByContributor[contributorId] = {
      submitted: asCount(metrics.submitted),
      published: asCount(metrics.published),
      archived: asCount(metrics.archived),
      rejected: asCount(metrics.rejected),
      total: asCount(metrics.total),
    };
  }
  return aggregate;
};

const normalizeListQuery = (query: PipelineListQuery): Required<PipelineListQuery> => ({
  scope: query.scope,
  trash: query.trash ?? 'active',
  query: typeof query.query === 'string' ? query.query.trim().slice(0, 120) : '',
  assetType: query.assetType && isContributorAssetType(query.assetType) ? query.assetType : 'all',
  status: query.status && isContributorAssetStatus(query.status) ? query.status : 'all',
  tier: query.tier && isContributorAssetAccessTier(query.tier) ? query.tier : 'all',
  voteFilter: ['unvoted', 'upvoted', 'downvoted'].includes(query.voteFilter ?? '') ? query.voteFilter! : 'all',
  page: Math.max(1, Math.floor(query.page ?? 1)),
  pageSize: Math.min(50, Math.max(1, Math.floor(query.pageSize ?? 12))),
});

const readPipelinePage = async (currentUserId: string, allowSelfVoting: boolean, query: PipelineListQuery) => {
  const supabase = getSupabaseServerClient();
  const normalized = normalizeListQuery(query);
  if (!['active', 'trashed', 'all'].includes(normalized.trash)) throw new PipelineStoreError('Choose a supported Trash filter.', 400);
  if (!supabase) {
    if (normalized.scope === 'shared') throw new PipelineStoreError('Shared Pipeline Trash is unavailable.', 503);
    return { rows: [], total: 0, page: normalized.page, pageSize: normalized.pageSize };
  }
  const { data, error } = await supabase.rpc('cardforge_list_contributor_asset_submission_ids', {
    p_current_user_id: currentUserId,
    p_scope: normalized.scope,
    p_trash_state: normalized.trash,
    p_query: normalized.query,
    p_asset_type: normalized.assetType === 'all' ? null : normalized.assetType,
    p_status: normalized.status === 'all' ? null : normalized.status,
    p_tier: normalized.tier === 'all' ? null : normalized.tier,
    p_vote_filter: normalized.voteFilter,
    p_allow_self_voting: allowSelfVoting,
    p_page: normalized.page,
    p_page_size: normalized.pageSize,
  });
  if (error) throw new PipelineStoreError('Unable to load Pipeline submissions.', normalized.scope === 'shared' ? 503 : 500);
  if (normalized.scope === 'shared' && (!Array.isArray(data) || data.length === 0
    || data.some(row => !row || typeof row !== 'object' || !Number.isSafeInteger(Number(row.total_count))
      || row.total_count === null || row.total_count === undefined || Number(row.total_count) < 0))) {
    throw new PipelineStoreError('Shared Pipeline Trash is unavailable.', 503);
  }
  const rows = (data ?? []) as Array<{ submission_id?: unknown; total_count?: unknown; shared_metadata?: unknown }>;
  return { rows, total: rows.length ? asCount(rows[0].total_count) : 0, page: normalized.page, pageSize: normalized.pageSize };
};

export const fetchPipelineSubmissionPage = async ({ currentUserId, profiles, includeRegistryRecipePayloads, allowSelfVoting, query }: {
  currentUserId: string; profiles: ContributorProfileRow[]; includeRegistryRecipePayloads: boolean;
  allowSelfVoting: boolean; query: PipelineListQuery;
}): Promise<{ submissions: PipelineSubmission[]; total: number; page: number; pageSize: number }> => {
  const { rows, ...page } = await readPipelinePage(currentUserId, allowSelfVoting, query);
  const ids = rows.flatMap(row => typeof row.submission_id === 'string' ? [row.submission_id] : []);
  return { ...page, submissions: await fetchSubmissionRows(currentUserId, ids, profiles, includeRegistryRecipePayloads) };
};

const sharedTrashMetadata = z.object({
  id: z.string().uuid(), lineageId: z.string().uuid().nullable(), assetType: z.enum(PIPELINE_TYPES),
  name: z.string(), description: z.string(), status: z.enum(PIPELINE_STATUSES),
  revisionNumber: z.number().int().nonnegative().nullable(),
  catalogTrashedAt: z.string().datetime({ offset: true }).nullable(),
  catalogPurgeAfter: z.string().datetime({ offset: true }).nullable(),
  catalogRetentionHold: z.boolean(), catalogSubmissionId: z.string().uuid().nullable(),
  trashedAt: z.string().datetime({ offset: true }).nullable(), purgeAfter: z.string().datetime({ offset: true }).nullable(),
  trashActorRole: z.enum(['owner', 'contributor', 'voting']).nullable(), trashPreviousStatus: z.enum(PIPELINE_STATUSES).nullable(),
  publicationRetained: z.boolean(), positiveVotes: z.number().int().nonnegative(), negativeVotes: z.number().int().nonnegative(),
  ownedByViewer: z.boolean(),
}).strict();

export const fetchSharedPipelineTrashMetadataPage = async (currentUserId: string, query: Omit<PipelineListQuery, 'scope' | 'trash'>): Promise<SharedPipelineTrashPage> => {
  const { rows, ...page } = await readPipelinePage(currentUserId, true, { ...query, scope: 'shared', trash: 'trashed' });
  const items = rows.flatMap(row => {
    if (row.submission_id === null && row.shared_metadata === null) return []; // Empty requested page retains its native filtered count.
    const parsed = sharedTrashMetadata.safeParse(row.shared_metadata);
    if (!parsed.success || parsed.data.id !== row.submission_id || parsed.data.status === 'draft' || !getPipelineTrashState(parsed.data).trashed || !isSharedPipelineTrash(parsed.data)) throw new PipelineStoreError('Shared Pipeline Trash metadata is unavailable or changed.', 503);
    return [{ ...parsed.data, lineageId: parsed.data.lineageId ?? undefined }];
  });
  return { ...page, items };
};
