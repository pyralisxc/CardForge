import { resolveWithTimeout } from '@/lib/asyncTimeout';
import { getSupabaseServerClient, getSupabaseServerConfigStatus } from '@/lib/supabaseServer';

export type RegistryContentAssetType = 'template' | 'elementPreset';

export interface RegistryContentAssetRow {
  asset_id: string;
  name: string;
  url: string;
  metadata: unknown;
}

const REGISTRY_CONTENT_FETCH_TIMEOUT_MS = 3500;

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

  const { data, error } = await supabase
    .from('cardforge_asset_registry')
    .select('asset_id,name,url,metadata')
    .eq('asset_type', assetType)
    .eq('status', 'published')
    .neq('access_tier', 'hidden')
    .order('name', { ascending: true });

  if (error) {
    if ((error as { code?: string }).code !== 'PGRST205') {
      console.error(`Failed to load ${assetType} registry content:`, error);
    }
    return [];
  }

  return (data ?? []) as RegistryContentAssetRow[];
};
