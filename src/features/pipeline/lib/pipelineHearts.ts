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

const uniqueLineageIds = (values: string[]): string[] => [...new Map(values.map(value => [value.toLowerCase(), value])).values()];
const cleanLineageIds = (values: unknown): string[] => Array.isArray(values)
  ? uniqueLineageIds(values.filter(isPipelineLineageId)).slice(0, 250)
  : [];

export const parsePipelineLineageIds = (values: unknown): { lineageIds: string[]; valid: boolean } => {
  if (!Array.isArray(values) || values.length > 250 || values.some((value) => !isPipelineLineageId(value))) {
    return { lineageIds: [], valid: false };
  }
  return { lineageIds: uniqueLineageIds(values), valid: true };
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
  const rows = (data ?? []) as Array<{ lineage_id: unknown; heart_count: unknown; viewer_hearted: unknown }>;
  const metrics = new Map<string, PipelineHeartMetric>();
  const requested = new Map(lineageIds.map(id => [id.toLowerCase(), id]));
  for (const row of rows) {
    if (typeof row.lineage_id !== 'string' || !requested.has(row.lineage_id.toLowerCase()) || metrics.has(row.lineage_id.toLowerCase())
      || typeof row.heart_count !== 'number' || !Number.isSafeInteger(row.heart_count) || row.heart_count < 0
      || typeof row.viewer_hearted !== 'boolean') throw new Error('Pipeline reactions are unavailable.');
    metrics.set(row.lineage_id.toLowerCase(), { lineageId: requested.get(row.lineage_id.toLowerCase())!, count: row.heart_count, hearted: row.viewer_hearted });
  }
  if (metrics.size !== lineageIds.length) throw new Error('Pipeline reactions are unavailable.');
  return lineageIds.map((lineageId) => metrics.get(lineageId.toLowerCase())!);
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
      ? database.from('cardforge_contributor_asset_submissions').select('lineage_id,contributor_id,status,purge_state,trashed_at,revision_publication_retained,published_at,revision_trash_actor_role,revision_trash_previous_status')
          .in('lineage_id', lineageIds).is('purge_state', null)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (registryResult.error || submissionResult.error) throw new Error('Pipeline reactions are unavailable.');
  const visibleRegistryAssets = new Set((registryResult.data ?? []).map((entry) => String((entry as { asset_id: string }).asset_id)));
  const visibleLineages = new Set((submissionResult.data ?? []).flatMap((entry) => {
    const row = entry as { lineage_id?: unknown; contributor_id?: unknown; status?: unknown; purge_state?: unknown; revision_trash_previous_status?: unknown; trashed_at?: string | null; revision_publication_retained?: boolean; published_at?: string | null; revision_trash_actor_role?: string | null };
    return typeof row.lineage_id === 'string'
      && typeof row.contributor_id === 'string'
      && typeof row.status === 'string'
      && isPipelineRevisionVisibleToContributor({
        contributorId: row.contributor_id,
        status: row.status as Parameters<typeof isPipelineRevisionVisibleToContributor>[0]['status'],
        trashPreviousStatus: typeof row.revision_trash_previous_status === 'string' ? row.revision_trash_previous_status as Parameters<typeof isPipelineRevisionVisibleToContributor>[0]['trashPreviousStatus'] : null, trashedAt: row.trashed_at, publicationRetained: row.revision_publication_retained, publishedAt: row.published_at, trashActorRole: row.revision_trash_actor_role,
        purgeState: row.purge_state === 'pending' ? 'pending' : null,
        viewerId,
        contributor,
        owner,
      }) ? [row.lineage_id.toLowerCase()] : [];
  }));
  (lineages ?? []).forEach((entry) => {
    const row = entry as { id?: unknown; registry_asset_id?: unknown };
    if (typeof row.id === 'string' && typeof row.registry_asset_id === 'string' && visibleRegistryAssets.has(row.registry_asset_id)) {
      visibleLineages.add(row.id.toLowerCase());
    }
  });
  return lineageIds.filter((lineageId) => visibleLineages.has(lineageId.toLowerCase()));
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
}): Promise<{ lineageId: string; outcome: 'committed' | 'uncertain'; metric: PipelineHeartMetric | null; warnings: string[] }> => {
  const database = getSupabaseServerClient();
  if (!database) throw new PipelineHeartMutationError('Pipeline reactions are unavailable.', 503);
  const uncertain = () => ({ lineageId, outcome: 'uncertain' as const, metric: null, warnings: ['heart_outcome_unconfirmed'] });
  let response: Awaited<ReturnType<typeof database.rpc>>;
  try {
    response = await database.rpc('cardforge_set_pipeline_heart', {
      p_lineage_id: lineageId,
      p_account_id: accountId,
      p_hearted: hearted,
      p_viewer_access: viewerAccess,
      p_contributor: contributor,
      p_owner: owner,
    });
  } catch { return uncertain(); }
  const { data, error } = response;
  if (error?.message?.includes('pipeline_lineage_not_found')) {
    throw new PipelineHeartMutationError('This Pipeline object no longer exists.', 404);
  }
  if (error?.message?.includes('pipeline_reaction_not_permitted')) {
    throw new PipelineHeartMutationError('This Pipeline object is not available to your account.', 403);
  }
  if (error) return uncertain();
  const row = (Array.isArray(data) && data.length === 1 ? data[0] : null) as { lineage_id?: unknown; heart_count?: unknown; viewer_hearted?: unknown } | null;
  if (!row || typeof row.lineage_id !== 'string' || row.lineage_id.toLowerCase() !== lineageId.toLowerCase()
    || typeof row.viewer_hearted !== 'boolean' || row.viewer_hearted !== hearted
    || typeof row.heart_count !== 'number' || !Number.isSafeInteger(row.heart_count) || row.heart_count < 0) return uncertain();
  return { lineageId, outcome: 'committed', metric: { lineageId, count: row.heart_count, hearted: row.viewer_hearted }, warnings: [] };

};
