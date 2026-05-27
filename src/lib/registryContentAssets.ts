import { resolveWithTimeout } from '@/lib/asyncTimeout';
import { getSupabaseServerClient, getSupabaseServerConfigStatus } from '@/lib/supabaseServer';
import type { PostgrestError } from '@supabase/supabase-js';

export type RegistryContentAssetType = 'template' | 'elementPreset';

export interface RegistryContentAssetRow {
  asset_id: string;
  name: string;
  url: string;
  status?: 'draft' | 'submitted' | 'voting' | 'publish_candidate' | 'published' | 'archived' | 'rejected';
  access_tier?: 'free' | 'paid' | 'developer' | 'hidden';
  library_source?: 'official' | 'developer';
  metadata: unknown;
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
  const embedded = getEmbeddedRegistryContent(row.metadata, keys, isContent);
  if (embedded) return embedded;

  return fetchRegistryJsonContent(row.url, isContent);
};

export const getPublishedRegistryContentRows = async (
  assetType: RegistryContentAssetType,
): Promise<RegistryContentAssetRow[]> => {
  const supabase = getSupabaseServerClient();
  if (!getSupabaseServerConfigStatus().configured || !supabase) return [];

  const { data, error } = await resolveWithTimeout(
    Promise.resolve(
      supabase
        .from('cardforge_asset_registry')
        .select('asset_id,name,url,status,access_tier,library_source,metadata')
        .eq('asset_type', assetType)
        .eq('status', 'published')
        .neq('access_tier', 'hidden')
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

  return (data ?? []) as RegistryContentAssetRow[];
};
