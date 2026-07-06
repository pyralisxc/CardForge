import { cardAssetMetadataOverrideSchema } from '@/lib/apiValidation';
import {
  buildDiscoveredCardAsset,
  type CardAssetOption,
} from '@/lib/cardAssets';
import { getSupabaseServerClient, getSupabaseServerConfigStatus } from '@/lib/supabaseServer';

type RegistryAssetKind = CardAssetOption['kind'];

export type AssetRegistryRow = {
  asset_id: string;
  name: string;
  asset_type: string;
  url: string;
  status: string;
  access_tier: string;
  library_source: string;
  file_size_bytes: number | null;
  metadata: unknown;
};

export interface AssetRegistryPayload {
  textures: CardAssetOption[];
  dividers: CardAssetOption[];
  parts: CardAssetOption[];
  icons: CardAssetOption[];
  imageAssets: CardAssetOption[];
  templates: CardAssetOption[];
  elementPresets: CardAssetOption[];
  registry: {
    configured: boolean;
    source: 'database';
    total: number;
  };
}

const isRegistryAssetKind = (value: unknown): value is RegistryAssetKind =>
  value === 'texture'
  || value === 'divider'
  || value === 'part'
  || value === 'icon'
  || value === 'image'
  || value === 'template'
  || value === 'elementPreset';

const emptyAssetRegistryPayload = (configured: boolean): AssetRegistryPayload => {
  return {
    textures: [],
    dividers: [],
    parts: [],
    icons: [],
    imageAssets: [],
    templates: [],
    elementPresets: [],
    registry: {
      configured,
      source: 'database',
      total: 0,
    },
  };
};

const mapRegistryRowToAsset = (row: AssetRegistryRow): CardAssetOption | null => {
  if (!isRegistryAssetKind(row.asset_type)) return null;
  const parsedMetadata = cardAssetMetadataOverrideSchema.passthrough().safeParse(row.metadata ?? {});
  const metadata = parsedMetadata.success ? parsedMetadata.data : undefined;
  const asset = buildDiscoveredCardAsset({
    url: row.url,
    kind: row.asset_type,
    relativePath: row.asset_id,
    metadata: {
      ...metadata,
      id: row.asset_id,
      name: row.name,
    },
  });

  return {
    ...asset,
    kind: row.asset_type === 'icon'
      ? 'icon'
      : row.asset_type === 'image'
        ? 'image'
        : row.asset_type === 'template'
          ? 'template'
          : row.asset_type === 'elementPreset'
            ? 'elementPreset'
            : asset.kind,
    librarySource: row.library_source === 'developer' ? 'developer' : 'official',
    accessTier: row.access_tier === 'paid'
      ? 'paid'
      : row.access_tier === 'free'
        ? 'free'
        : row.access_tier === 'developer'
          ? 'developer'
          : row.access_tier === 'hidden'
            ? 'hidden'
            : 'free',
    registryStatus: row.status === 'draft'
      || row.status === 'submitted'
      || row.status === 'voting'
      || row.status === 'publish_candidate'
      || row.status === 'archived'
      || row.status === 'rejected'
      ? row.status
      : 'published',
    fileSizeBytes: row.file_size_bytes ?? undefined,
  };
};

export const mapAssetRegistryRowsToPayload = (
  rows: AssetRegistryRow[],
  configured = true,
): AssetRegistryPayload | null => {
  const assets = rows
    .map((row) => mapRegistryRowToAsset(row))
    .filter((asset): asset is CardAssetOption => Boolean(asset));

  return {
    textures: assets.filter((asset) => asset.kind === 'texture'),
    dividers: assets.filter((asset) => asset.kind === 'divider'),
    parts: assets.filter((asset) => asset.kind === 'part'),
    icons: assets.filter((asset) => asset.kind === 'icon'),
    imageAssets: assets.filter((asset) => asset.kind === 'image'),
    templates: assets.filter((asset) => asset.kind === 'template'),
    elementPresets: assets.filter((asset) => asset.kind === 'elementPreset'),
    registry: {
      configured,
      source: 'database',
      total: assets.length,
    },
  };
};

const getDatabaseAssetRegistry = async (): Promise<AssetRegistryPayload | null> => {
  const supabase = getSupabaseServerClient();
  if (!getSupabaseServerConfigStatus().configured || !supabase) return null;

  const { data, error } = await supabase
    .from('cardforge_asset_registry')
    .select('asset_id,name,asset_type,url,status,access_tier,library_source,file_size_bytes,metadata')
    .eq('status', 'published')
    .neq('access_tier', 'hidden')
    .order('asset_type', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    if ((error as { code?: string }).code !== 'PGRST205') {
      console.error('Failed to load asset registry:', error);
    }
    return null;
  }

  return mapAssetRegistryRowsToPayload((data ?? []) as AssetRegistryRow[]);
};

export const getAssetRegistryPayload = async (): Promise<AssetRegistryPayload> => {
  const configured = getSupabaseServerConfigStatus().configured;
  const databaseRegistry = await getDatabaseAssetRegistry();
  return databaseRegistry ?? emptyAssetRegistryPayload(configured);
};
