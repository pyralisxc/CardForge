import { resolveWithTimeout } from '@/shared/asyncTimeout';
import { getSupabaseServerClient, getSupabaseServerConfigStatus } from '@/infrastructure/database/supabaseServer';
import type { PostgrestError } from '@supabase/supabase-js';
import type { StudioAssetDestination, StudioAssetRoutingMode } from '@/domain/templates';

export type RegistryContentAssetType = 'template' | 'elementPreset' | 'font';
export type RegistryViewerAccess = 'free' | 'paid' | 'dev';
export type RegistryVisibleAccessTier = 'free' | 'paid' | 'developer';

export const getVisibleRegistryAccessTiers = (
  viewerAccess: RegistryViewerAccess,
): RegistryVisibleAccessTier[] => viewerAccess === 'dev'
  ? ['free', 'paid', 'developer']
  : viewerAccess === 'paid'
    ? ['free', 'paid']
    : ['free'];

export interface RegistryContentAssetRow {
  asset_id: string;
  developer_submission_id?: string | null;
  lineage_id?: string | null;
  name: string;
  url: string;
  preview_url?: string | null;
  status?: 'draft' | 'submitted' | 'voting' | 'publish_candidate' | 'published' | 'archived' | 'rejected';
  access_tier?: 'free' | 'paid' | 'developer' | 'hidden';
  library_source?: 'official' | 'developer';
  metadata: unknown;
  content_payload?: unknown;
  studio_destinations?: StudioAssetDestination[];
  studio_sort_order?: number;
  studio_featured?: boolean;
  studio_routing_mode?: StudioAssetRoutingMode;
}

export interface PublishedRegistryAssetRow extends RegistryContentAssetRow {
  asset_type: string;
  status: 'published';
  access_tier: 'free' | 'paid' | 'developer';
  library_source: 'official' | 'developer';
  file_size_bytes: number | null;
  updated_at: string | null;
}

const REGISTRY_CONTENT_FETCH_TIMEOUT_MS = 1200;
const REGISTRY_CONTENT_ROWS_TIMEOUT_MS = 1200;
const REGISTRY_CONTENT_TIMEOUT_ERROR: PostgrestError = {
  code: 'REGISTRY_CONTENT_TIMEOUT',
  details: 'Timed out while loading published registry content rows.',
  hint: 'The Forge Pipeline catalog is unavailable until the registry responds.',
  message: 'Registry content request timed out.',
  name: 'PostgrestError',
  toJSON: () => ({
    code: 'REGISTRY_CONTENT_TIMEOUT',
    details: 'Timed out while loading published registry content rows.',
      hint: 'The Forge Pipeline catalog is unavailable until the registry responds.',
    message: 'Registry content request timed out.',
    name: 'PostgrestError',
  }),
};

export const getEmbeddedRegistryContent = <T>(
  metadata: unknown,
  keys: string[],
  isContent: (value: unknown) => value is T,
): T | null => {
  if (!metadata || typeof metadata !== 'object') return null;
  const record = metadata as Record<string, unknown>;

  for (const key of keys) {
    const candidate = record[key];
    if (isContent(candidate)) return candidate;
  }

  return null;
};

const fetchRegistryJsonContent = async <T>(
  url: string,
  isContent: (value: unknown) => value is T,
): Promise<T | null> => {
  if (!/^https?:\/\//i.test(url)) return null;

  return resolveWithTimeout(
    (async () => {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) return null;
      const parsed = await response.json() as unknown;
      return isContent(parsed) ? parsed : null;
    })(),
    { fallback: null, timeoutMs: REGISTRY_CONTENT_FETCH_TIMEOUT_MS },
  );
};

export const readRegistryContentAsset = async <T>(
  row: RegistryContentAssetRow,
  keys: string[],
  isContent: (value: unknown) => value is T,
): Promise<T | null> => {
  if (isContent(row.content_payload)) return row.content_payload;
  const embedded = getEmbeddedRegistryContent(row.metadata, keys, isContent);
  if (embedded) return embedded;

  return fetchRegistryJsonContent(row.url, isContent);
};

const attachSubmissionPayloads = async <Row extends RegistryContentAssetRow>(
  supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>,
  rows: Row[],
): Promise<Row[]> => {
  const submissionIds = [...new Set(rows.flatMap((row) => (
    row.developer_submission_id ? [row.developer_submission_id] : []
  )))];
  const registryAssetIds = [...new Set(rows.map((row) => row.asset_id).filter(Boolean))];
  const [submissionResult, lineageResult] = await Promise.all([
    submissionIds.length
      ? supabase.from('cardforge_developer_asset_submissions').select('id,lineage_id,source_payload').in('id', submissionIds)
      : Promise.resolve({ data: [], error: null }),
    registryAssetIds.length
      ? supabase.from('cardforge_pipeline_asset_lineages').select('id,registry_asset_id').in('registry_asset_id', registryAssetIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (submissionResult.error || lineageResult.error) throw new Error('Published CardForge content revisions are temporarily unavailable.');
  const payloadsById = new Map((submissionResult.data ?? []).flatMap((entry) => {
    const row = entry as { id?: unknown; lineage_id?: unknown; source_payload?: unknown };
    return typeof row.id === 'string' ? [[row.id, {
      lineageId: typeof row.lineage_id === 'string' ? row.lineage_id : null,
      payload: row.source_payload,
    }] as const] : [];
  }));
  const lineageByAssetId = new Map((lineageResult.data ?? []).flatMap((entry) => {
    const row = entry as { id?: unknown; registry_asset_id?: unknown };
    return typeof row.id === 'string' && typeof row.registry_asset_id === 'string'
      ? [[row.registry_asset_id, row.id] as const]
      : [];
  }));
  return rows.map((row) => ({
    ...row,
    lineage_id: row.developer_submission_id
      ? payloadsById.get(row.developer_submission_id)?.lineageId ?? lineageByAssetId.get(row.asset_id) ?? null
      : lineageByAssetId.get(row.asset_id) ?? null,
    content_payload: row.developer_submission_id
      ? payloadsById.get(row.developer_submission_id)?.payload
      : undefined,
  }));
};

export const getPublishedRegistryContentRows = async (
  assetType: RegistryContentAssetType,
  viewerAccess: RegistryViewerAccess = 'free',
): Promise<RegistryContentAssetRow[]> => {
  const supabase = getSupabaseServerClient();
  if (!getSupabaseServerConfigStatus().configured || !supabase) return [];

  const visibleTiers = getVisibleRegistryAccessTiers(viewerAccess);
  const { data, error } = await resolveWithTimeout(
    Promise.resolve(
      supabase
        .from('cardforge_asset_registry')
        .select('asset_id,developer_submission_id,name,url,status,access_tier,library_source,metadata,studio_destinations,studio_sort_order,studio_featured,studio_routing_mode')
        .eq('asset_type', assetType)
        .eq('status', 'published')
        .in('access_tier', visibleTiers)
        .order('name', { ascending: true }),
    ),
    {
      fallback: {
        data: null,
        error: REGISTRY_CONTENT_TIMEOUT_ERROR,
        count: null,
        status: 408,
        statusText: 'Request Timeout',
        success: false,
      },
      timeoutMs: REGISTRY_CONTENT_ROWS_TIMEOUT_MS,
    },
  );

  if (error) {
    if ((error as { code?: string }).code !== 'PGRST205' && (error as { code?: string }).code !== 'REGISTRY_CONTENT_TIMEOUT') {
      console.error(`Failed to load ${assetType} registry content:`, error);
    }
    return [];
  }

  return attachSubmissionPayloads(supabase, (data ?? []) as RegistryContentAssetRow[]);
};

export const getPublishedRegistryRows = async (
  viewerAccess: RegistryViewerAccess = 'free',
): Promise<PublishedRegistryAssetRow[]> => {
  const supabase = getSupabaseServerClient();
  if (!getSupabaseServerConfigStatus().configured || !supabase) return [];

  const visibleTiers = getVisibleRegistryAccessTiers(viewerAccess);
  const { data, error } = await resolveWithTimeout(
    Promise.resolve(
      supabase
        .from('cardforge_asset_registry')
        .select('asset_id,developer_submission_id,name,asset_type,url,preview_url,status,access_tier,library_source,file_size_bytes,metadata,updated_at,studio_destinations,studio_sort_order,studio_featured,studio_routing_mode')
        .eq('status', 'published')
        .in('access_tier', visibleTiers)
        .order('asset_type', { ascending: true })
        .order('name', { ascending: true }),
    ),
    {
      fallback: {
        data: null,
        error: REGISTRY_CONTENT_TIMEOUT_ERROR,
        count: null,
        status: 408,
        statusText: 'Request Timeout',
        success: false,
      },
      timeoutMs: REGISTRY_CONTENT_ROWS_TIMEOUT_MS,
    },
  );
  if (error) {
    if ((error as { code?: string }).code !== 'PGRST205' && (error as { code?: string }).code !== 'REGISTRY_CONTENT_TIMEOUT') {
      console.error('Failed to load published registry catalog:', error);
    }
    throw new Error('Published CardForge catalog is temporarily unavailable.');
  }
  return attachSubmissionPayloads(supabase, (data ?? []) as PublishedRegistryAssetRow[]);
};
