import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { getVisibleRegistryAccessTiers, type RegistryViewerAccess } from './registryContentAssets';
import { isPipelineRevisionVisibleToContributor } from './pipelineVisibility';

export interface PipelineHeartMetric {
  lineageId: string;
  count: number;
  hearted: boolean;
}

export class PipelineHeartMutationError extends Error {
  constructor(
    message: string,
    public readonly status: 403 | 404 | 503,
  ) {
    super(message);
    this.name = 'PipelineHeartMutationError';
  }
}

export const isPipelineLineageId = (value: unknown): value is string => (
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value)
);

const cleanLineageIds = (values: unknown): string[] => Array.isArray(values)
  ? [...new Set(values.flatMap((value) => isPipelineLineageId(value) ? [value] : []))].slice(0, 250)
  : [];

export const parsePipelineLineageIds = (values: unknown): { lineageIds: string[]; valid: boolean } => {
  if (!Array.isArray(values) || values.length > 250 || values.some((value) => !isPipelineLineageId(value))) {
    return { lineageIds: [], valid: false };
  }
  return { lineageIds: [...new Set(values)], valid: true };
};

export const getPipelineHeartMetrics = async (lineageIdsInput: unknown, accountId: string | null): Promise<PipelineHeartMetric[]> => {
  const lineageIds = cleanLineageIds(lineageIdsInput);
  if (!lineageIds.length) return [];
  const database = getSupabaseServerClient();
  if (!database) throw new Error('Pipeline reactions are unavailable.');
  const { data, error } = await database.rpc('cardforge_get_pipeline_heart_metrics', {
    p_lineage_ids: lineageIds,
    p_account_id: accountId,
  });
  if (error) throw new Error('Pipeline reactions are unavailable.');
  const rows = (data ?? []) as Array<{ lineage_id: string; heart_count: number; viewer_hearted: boolean }>;
  const metrics = new Map<string, PipelineHeartMetric>(rows.map((metric) => {
    return [String(metric.lineage_id), {
      lineageId: String(metric.lineage_id),
      count: Number(metric.heart_count),
      hearted: Boolean(metric.viewer_hearted),
    } satisfies PipelineHeartMetric] as const;
  }));
  return lineageIds.map((lineageId) => metrics.get(lineageId) ?? { lineageId, count: 0, hearted: false });
};

export const getViewerVisiblePipelineLineageIds = async ({
  lineageIds: lineageIdsInput,
  viewerAccess,
  contributor,
  viewerId,
  owner,
}: {
  lineageIds: unknown;
  viewerAccess: RegistryViewerAccess;
  contributor: boolean;
  viewerId: string | null;
  owner: boolean;
}): Promise<string[]> => {
  const lineageIds = cleanLineageIds(lineageIdsInput);
  if (!lineageIds.length) return [];
  const database = getSupabaseServerClient();
  if (!database) throw new Error('Pipeline reactions are unavailable.');
  const { data: lineages, error: lineageError } = await database.from('cardforge_pipeline_asset_lineages')
    .select('id,registry_asset_id').in('id', lineageIds);
  if (lineageError) throw new Error('Pipeline reactions are unavailable.');
  const registryAssetIds = (lineages ?? []).flatMap((entry) => {
    const row = entry as { registry_asset_id?: unknown };
    return typeof row.registry_asset_id === 'string' ? [row.registry_asset_id] : [];
  });
  const [registryResult, submissionResult] = await Promise.all([
    registryAssetIds.length
      ? database.from('cardforge_asset_registry').select('asset_id').in('asset_id', registryAssetIds)
          .eq('status', 'published').in('access_tier', getVisibleRegistryAccessTiers(viewerAccess))
      : Promise.resolve({ data: [], error: null }),
    contributor
      ? database.from('cardforge_developer_asset_submissions').select('lineage_id,developer_id,status,purge_state')
          .in('lineage_id', lineageIds).is('purge_state', null)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (registryResult.error || submissionResult.error) throw new Error('Pipeline reactions are unavailable.');
  const visibleRegistryAssets = new Set((registryResult.data ?? []).map((entry) => String((entry as { asset_id: string }).asset_id)));
  const visibleLineages = new Set((submissionResult.data ?? []).flatMap((entry) => {
    const row = entry as { lineage_id?: unknown; developer_id?: unknown; status?: unknown; purge_state?: unknown };
    return typeof row.lineage_id === 'string'
      && typeof row.developer_id === 'string'
      && typeof row.status === 'string'
      && isPipelineRevisionVisibleToContributor({
        contributorId: row.developer_id,
        status: row.status as Parameters<typeof isPipelineRevisionVisibleToContributor>[0]['status'],
        purgeState: row.purge_state === 'pending' ? 'pending' : null,
        viewerId,
        contributor,
        owner,
      }) ? [row.lineage_id] : [];
  }));
  (lineages ?? []).forEach((entry) => {
    const row = entry as { id?: unknown; registry_asset_id?: unknown };
    if (typeof row.id === 'string' && typeof row.registry_asset_id === 'string' && visibleRegistryAssets.has(row.registry_asset_id)) {
      visibleLineages.add(row.id);
    }
  });
  return lineageIds.filter((lineageId) => visibleLineages.has(lineageId));
};

export const setPipelineHeart = async ({
  lineageId,
  accountId,
  hearted,
  viewerAccess,
  contributor,
  owner,
}: {
  lineageId: string;
  accountId: string;
  hearted: boolean;
  viewerAccess: RegistryViewerAccess;
  contributor: boolean;
  owner: boolean;
}): Promise<PipelineHeartMetric> => {
  const database = getSupabaseServerClient();
  if (!database) throw new PipelineHeartMutationError('Pipeline reactions are unavailable.', 503);
  const { data, error } = await database.rpc('cardforge_set_pipeline_heart', {
    p_lineage_id: lineageId,
    p_account_id: accountId,
    p_hearted: hearted,
    p_viewer_access: viewerAccess,
    p_contributor: contributor,
    p_owner: owner,
  });
  if (error?.message?.includes('pipeline_lineage_not_found')) {
    throw new PipelineHeartMutationError('This Pipeline object no longer exists.', 404);
  }
  if (error?.message?.includes('pipeline_reaction_not_permitted')) {
    throw new PipelineHeartMutationError('This Pipeline object is not available to your account.', 403);
  }
  if (error) throw new PipelineHeartMutationError('Pipeline reaction could not be saved.', 503);
  const row = (Array.isArray(data) ? data[0] : null) as { lineage_id?: unknown; heart_count?: unknown; viewer_hearted?: unknown } | null;
  if (!row || typeof row.lineage_id !== 'string') {
    throw new PipelineHeartMutationError('Pipeline reaction could not be confirmed.', 503);
  }
  return {
    lineageId: row.lineage_id,
    count: Number(row.heart_count),
    hearted: Boolean(row.viewer_hearted),
  };
};
