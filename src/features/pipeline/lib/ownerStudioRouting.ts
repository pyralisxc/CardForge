import {
  STUDIO_ASSET_DESTINATION_DEFINITIONS,
  getCompatibleStudioAssetDestinations,
  normalizeStudioAssetDestinations,
  type StudioAssetDestination,
  type StudioAssetRoutingMode,
  type StudioRegistryAssetKind,
} from '@/domain/templates';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';

import {
  PipelineRegistryCommandError,
  updatePipelineAssetStudioRouting,
} from './pipelineRegistryCommands';

export interface OwnerStudioRoutingItem {
  assetId: string;
  name: string;
  assetType: StudioRegistryAssetKind;
  url: string;
  status: string;
  accessTier: string;
  librarySource: string;
  pipelineSubmissionId: string | null;
  studioDestinations: StudioAssetDestination[];
  compatibleDestinations: StudioAssetDestination[];
  studioSortOrder: number;
  studioFeatured: boolean;
  studioRoutingMode: StudioAssetRoutingMode;
}

export interface OwnerStudioRoutingCount {
  destination: StudioAssetDestination;
  totalCount: number;
  liveCount: number;
}

export interface OwnerStudioRoutingPage {
  items: OwnerStudioRoutingItem[];
  counts: OwnerStudioRoutingCount[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

type RegistryRoutingRow = {
  asset_id: string;
  name: string;
  asset_type: unknown;
  url: string;
  status: string;
  access_tier: string;
  library_source: string;
  contributor_submission_id: string | null;
  metadata: unknown;
  studio_destinations: unknown;
  studio_sort_order: unknown;
  studio_featured: unknown;
  studio_routing_mode: unknown;
};

const isStudioRegistryAssetKind = (value: unknown): value is StudioRegistryAssetKind => (
  value === 'template'
  || value === 'image'
  || value === 'texture'
  || value === 'divider'
  || value === 'icon'
  || value === 'elementPreset'
  || value === 'font'
);

const requireSupabase = () => {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new PipelineRegistryCommandError('The Forge Pipeline database is not configured.', 503);
  }
  return supabase;
};

const clampInteger = (value: unknown, fallback: number, minimum: number, maximum: number): number => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
};

export const getOwnerStudioRoutingPage = async ({
  destination,
  query,
  page,
  pageSize,
}: {
  destination?: StudioAssetDestination | null;
  query?: string;
  page?: number;
  pageSize?: number;
}): Promise<OwnerStudioRoutingPage> => {
  const supabase = requireSupabase();
  const normalizedPage = clampInteger(page, 1, 1, 100000);
  const normalizedPageSize = clampInteger(pageSize, 12, 6, 24);
  const start = (normalizedPage - 1) * normalizedPageSize;
  const normalizedQuery = query?.trim().slice(0, 80) ?? '';

  let registryQuery = supabase
    .from('cardforge_asset_registry')
    .select('asset_id,name,asset_type,url,status,access_tier,library_source,contributor_submission_id,metadata,studio_destinations,studio_sort_order,studio_featured,studio_routing_mode', { count: 'exact' });
  if (destination) registryQuery = registryQuery.contains('studio_destinations', [destination]);
  if (normalizedQuery) registryQuery = registryQuery.ilike('name', `%${normalizedQuery}%`);

  const [registryResult, countsResult] = await Promise.all([
    registryQuery
      .order('studio_featured', { ascending: false })
      .order('studio_sort_order', { ascending: true })
      .order('name', { ascending: true })
      .range(start, start + normalizedPageSize - 1),
    supabase.rpc('cardforge_get_studio_routing_counts'),
  ]);

  if (registryResult.error || countsResult.error) {
    console.error('Unable to load owner Studio routing:', registryResult.error ?? countsResult.error);
    throw new PipelineRegistryCommandError('Unable to load the Studio Map.', 503);
  }

  const items = ((registryResult.data ?? []) as RegistryRoutingRow[]).flatMap((row) => {
    if (!isStudioRegistryAssetKind(row.asset_type)) return [];
    return [{
      assetId: row.asset_id,
      name: row.name,
      assetType: row.asset_type,
      url: row.url,
      status: row.status,
      accessTier: row.access_tier,
      librarySource: row.library_source,
      pipelineSubmissionId: row.contributor_submission_id,
      studioDestinations: normalizeStudioAssetDestinations(row.studio_destinations),
      compatibleDestinations: getCompatibleStudioAssetDestinations({ kind: row.asset_type, metadata: row.metadata }),
      studioSortOrder: clampInteger(row.studio_sort_order, 100, 0, 100000),
      studioFeatured: row.studio_featured === true,
      studioRoutingMode: row.studio_routing_mode === 'owner' ? 'owner' : 'automatic',
    } satisfies OwnerStudioRoutingItem];
  });

  const countRows = (countsResult.data ?? []) as Array<{
    destination: unknown;
    total_count: unknown;
    live_count: unknown;
  }>;
  const counts = STUDIO_ASSET_DESTINATION_DEFINITIONS.map((definition) => {
    const row = countRows.find((candidate) => candidate.destination === definition.id);
    return {
      destination: definition.id,
      totalCount: Number(row?.total_count ?? 0),
      liveCount: Number(row?.live_count ?? 0),
    };
  });
  const total = registryResult.count ?? items.length;

  return {
    items,
    counts,
    total,
    page: normalizedPage,
    pageSize: normalizedPageSize,
    totalPages: Math.max(1, Math.ceil(total / normalizedPageSize)),
  };
};

export const updateOwnerStudioRouting = async (input: {
  assetId: unknown;
  mode: unknown;
  destinations: unknown;
  sortOrder: unknown;
  featured: unknown;
}): Promise<void> => {
  const assetId = typeof input.assetId === 'string' ? input.assetId.trim() : '';
  const mode: StudioAssetRoutingMode | null = input.mode === 'owner' || input.mode === 'automatic'
    ? input.mode
    : null;
  const destinations = normalizeStudioAssetDestinations(input.destinations);
  const sortOrder = Number(input.sortOrder);
  if (!assetId || !mode || !Array.isArray(input.destinations) || !Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 100000 || typeof input.featured !== 'boolean') {
    throw new PipelineRegistryCommandError('Studio placement requires a valid asset, mode, destinations, order, and featured state.', 400);
  }
  if (destinations.length !== input.destinations.length) {
    throw new PipelineRegistryCommandError('One or more Studio destinations are invalid.', 400);
  }

  await updatePipelineAssetStudioRouting({
    assetId,
    mode,
    destinations,
    sortOrder,
    featured: input.featured,
  });
};
