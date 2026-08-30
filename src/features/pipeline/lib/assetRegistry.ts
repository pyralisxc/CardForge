import { cardAssetMetadataOverrideSchema } from '@/infrastructure/http/apiValidation';
import {
  buildDiscoveredCardAsset,
  type CardAssetOption,
} from '@/features/pipeline/lib/cardAssets';
import { getSupabaseServerClient, getSupabaseServerConfigStatus } from '@/infrastructure/database/supabaseServer';
import {
  getDefaultStudioAssetDestinations,
  normalizeStudioAssetDestinations,
  type StudioAssetRoutingMode,
} from '@/domain/templates';
import {
  getVisibleRegistryAccessTiers,
  type RegistryViewerAccess,
} from './registryContentAssets';

type RegistryAssetKind = 'texture' | 'divider' | 'icon' | 'image' | 'template' | 'elementPreset';

export type AssetRegistryRow = {
  asset_id: string;
  name: string;
  asset_type: string;
  url: string;
  preview_url?: string | null;
  status: string;
  access_tier: string;
  library_source: string;
  file_size_bytes: number | null;
  metadata: unknown;
  studio_destinations?: unknown;
  studio_sort_order?: unknown;
  studio_featured?: unknown;
  studio_routing_mode?: unknown;
};

export interface AssetRegistryPayload {
  textures: CardAssetOption[];
  dividers: CardAssetOption[];
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
  || value === 'icon'
  || value === 'image'
  || value === 'template'
  || value === 'elementPreset';

const emptyAssetRegistryPayload = (configured: boolean): AssetRegistryPayload => {
  return {
    textures: [],
    dividers: [],
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
  const destinations = row.studio_destinations === undefined
    ? getDefaultStudioAssetDestinations({ kind: row.asset_type, metadata: row.metadata })
    : normalizeStudioAssetDestinations(row.studio_destinations);
  const studioOrder = Number(row.studio_sort_order);
  const studioRoutingMode: StudioAssetRoutingMode = row.studio_routing_mode === 'owner'
    ? 'owner'
    : 'automatic';

  return {
    ...asset,
    previewUrl: row.preview_url ?? undefined,
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
    studioDestinations: destinations,
    studioOrder: Number.isInteger(studioOrder) && studioOrder >= 0 ? studioOrder : 100,
    studioFeatured: row.studio_featured === true,
    studioRoutingMode,
  };
};

const sortStudioAssets = (assets: CardAssetOption[]): CardAssetOption[] => [...assets].sort((left, right) => (
  Number(Boolean(right.studioFeatured)) - Number(Boolean(left.studioFeatured))
  || (left.studioOrder ?? 100) - (right.studioOrder ?? 100)
  || left.name.localeCompare(right.name)
));

export const mapAssetRegistryRowsToPayload = (
  rows: AssetRegistryRow[],
  configured = true,
): AssetRegistryPayload => {
  const assets = rows
    .map((row) => mapRegistryRowToAsset(row))
    .filter((asset): asset is CardAssetOption => Boolean(asset));

  return {
    textures: sortStudioAssets(assets.filter((asset) => asset.kind === 'texture')),
    dividers: sortStudioAssets(assets.filter((asset) => asset.kind === 'divider')),
    icons: sortStudioAssets(assets.filter((asset) => asset.kind === 'icon')),
    imageAssets: sortStudioAssets(assets.filter((asset) => asset.kind === 'image')),
    templates: sortStudioAssets(assets.filter((asset) => asset.kind === 'template')),
    elementPresets: sortStudioAssets(assets.filter((asset) => asset.kind === 'elementPreset')),
    registry: {
      configured,
      source: 'database',
      total: assets.length,
    },
  };
};

const getDatabaseAssetRegistry = async (viewerAccess: RegistryViewerAccess): Promise<AssetRegistryPayload | null> => {
  const supabase = getSupabaseServerClient();
  if (!getSupabaseServerConfigStatus().configured || !supabase) return null;

  const visibleTiers = getVisibleRegistryAccessTiers(viewerAccess);
  const { data, error } = await supabase
    .from('cardforge_asset_registry')
    .select('asset_id,name,asset_type,url,preview_url,status,access_tier,library_source,file_size_bytes,metadata,studio_destinations,studio_sort_order,studio_featured,studio_routing_mode')
    .eq('status', 'published')
    .in('access_tier', visibleTiers)
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

export const getAssetRegistryPayload = async (
  viewerAccess: RegistryViewerAccess = 'free',
): Promise<AssetRegistryPayload> => {
  const configured = getSupabaseServerConfigStatus().configured;
  const databaseRegistry = await getDatabaseAssetRegistry(viewerAccess);
  return databaseRegistry ?? emptyAssetRegistryPayload(configured);
};
