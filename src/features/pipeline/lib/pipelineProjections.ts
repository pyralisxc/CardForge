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
  type PipelineSubmission,
  type PipelineSubmissionRow,
} from './pipelineProgram';
import { PipelineStoreError } from './pipelineStoreError';
import { isRepositoryStyle } from './registryContentValidation';
import type { ContributorProfileRow } from '@/features/contributor-access/server';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { hydratePipelineTemplateAssetReferences } from './pipelineTemplateAssets';

const SUBMISSION_COLUMNS = 'id,lineage_id,contributor_id,contributor_email,asset_type,requested_studio_destination,specialty_tags,use_case_tags,semantic_role,visual_family,variant_of_asset_id,variant_kind,compatibility_tags,source_notes,editorial_review_status,editorial_review_note,editorial_reviewed_by,editorial_reviewed_at,name,description,preview_url,source_url,source_file_size_bytes,source_mime_type,source_storage_bucket,source_storage_path,registry_asset_id,status,contributor_lifecycle_state,automated_status,owner_status_override,calculated_access_tier,automated_access_tier,owner_access_tier_override,quality_score,tier_decision_reason,owner_note,decision_reason,positive_votes,negative_votes,source_payload,target_registry_asset_id,base_revision_number,revision_number,published_at,purge_state,trashed_at,purge_after,trash_reason,retention_hold,submitted_at,updated_at';

export type PipelineListScope = 'all' | 'own' | 'review';

export interface PipelineListQuery {
  scope: PipelineListScope;
  query?: string;
  assetType?: string;
  status?: string;
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
    supabase.from('cardforge_contributor_asset_submissions').select(SUBMISSION_COLUMNS).in('id', submissionIds),
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