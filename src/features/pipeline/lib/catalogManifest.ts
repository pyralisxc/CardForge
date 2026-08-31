import {
  getDefaultStudioAssetDestinations,
  type AppearanceStyleLibrary,
  type StudioAssetDestination,
  type StudioRegistryAssetKind,
  type TCGCardTemplate,
} from '@/domain/templates';
import type { CardFontOption } from '@/domain/rendering';
import { getSupabaseServerConfigStatus } from '@/infrastructure/database/supabaseServer';

import { mapAssetRegistryRowsToPayload, type AssetRegistryPayload } from './assetRegistry';
import {
  getPublishedRegistryRows,
  type PublishedRegistryAssetRow,
  type RegistryViewerAccess,
} from './registryContentAssets';
import { mapRegistryRowsToFontsPayload } from './registryFonts';
import { mapRegistryRowsToStyleLibrary, mapRegistryRowsToTemplateLibrary } from './repositoryCatalog';

export interface CardForgeCatalogManifest {
  version: string;
  access: RegistryViewerAccess;
  templates: {
    defaults: TCGCardTemplate[];
    userTemplates: [];
  };
  styles: AppearanceStyleLibrary;
  assets: AssetRegistryPayload;
  fonts: {
    fonts: CardFontOption[];
    registry: AssetRegistryPayload['registry'];
  };
  sets: {
    items: PublishedSetCatalogItem[];
  };
  pipeline?: {
    items: PublishedPipelineCatalogItem[];
  };
}

export interface PublishedPipelineCatalogItem {
  id: string;
  lineageId: string | null;
  name: string;
  assetType: string;
  previewUrl: string | null;
  access: 'free' | 'paid' | 'contributor';
  source: 'official' | 'contributor';
  fileSizeBytes: number | null;
  updatedAt: string | null;
}

export interface PublishedSetCatalogItem {
  id: string;
  name: string;
  packageUrl: string;
  previewUrl: string | null;
  access: 'free' | 'paid' | 'contributor';
  source: 'official' | 'contributor';
  fileSizeBytes: number | null;
  revision: number;
  description: string;
  specialtyTags: string[];
  useCaseTags: string[];
}

export interface CardForgeStudioBootstrapManifest {
  version: string;
  access: RegistryViewerAccess;
  templates: CardForgeCatalogManifest['templates'];
  styles: AppearanceStyleLibrary;
  fonts: CardForgeCatalogManifest['fonts'];
  studioDefaults: {
    defaultTemplateId: string | null;
  };
}

export interface CardForgeStudioAssetManifest {
  version: string;
  access: RegistryViewerAccess;
  assets: Pick<AssetRegistryPayload, 'textures' | 'dividers' | 'icons' | 'imageAssets'>;
}

const catalogVersion = (
  access: RegistryViewerAccess,
  rows: PublishedRegistryAssetRow[],
): string => {
  const newest = rows.reduce((value, row) => (
    row.updated_at && row.updated_at > value ? row.updated_at : value
  ), '0');
  return `registry-1:${access}:${rows.length}:${newest}`;
};

const rowDestinations = (row: PublishedRegistryAssetRow): StudioAssetDestination[] => (
  row.studio_destinations
  ?? getDefaultStudioAssetDestinations({
    kind: row.asset_type as StudioRegistryAssetKind,
    metadata: row.metadata,
  })
);

const isRoutedTo = (row: PublishedRegistryAssetRow, prefix: string): boolean => (
  rowDestinations(row).some((destination) => destination.startsWith(prefix))
);

const sortRoutedRows = (rows: PublishedRegistryAssetRow[]): PublishedRegistryAssetRow[] => [...rows].sort((left, right) => (
  Number(Boolean(right.studio_featured)) - Number(Boolean(left.studio_featured))
  || (left.studio_sort_order ?? 100) - (right.studio_sort_order ?? 100)
  || left.name.localeCompare(right.name)
));

const mapStudioBootstrap = async (
  access: RegistryViewerAccess,
  rows: PublishedRegistryAssetRow[],
): Promise<CardForgeStudioBootstrapManifest> => {
  const configured = getSupabaseServerConfigStatus().configured;
  const [templates, styles, fonts] = await Promise.all([
    mapRegistryRowsToTemplateLibrary(sortRoutedRows(rows.filter((row) => row.asset_type === 'template' && isRoutedTo(row, 'template.')))),
    mapRegistryRowsToStyleLibrary(sortRoutedRows(rows.filter((row) => row.asset_type === 'elementPreset' && isRoutedTo(row, 'style.')))),
    Promise.resolve(mapRegistryRowsToFontsPayload(
      sortRoutedRows(rows.filter((row) => row.asset_type === 'font' && isRoutedTo(row, 'typography.font'))),
      configured,
    )),
  ]);

  return {
    version: catalogVersion(access, rows),
    access,
    templates: { defaults: templates, userTemplates: [] },
    styles: { version: 1, styles },
    fonts,
    studioDefaults: { defaultTemplateId: null },
  };
};

export const getCardForgeStudioBootstrapManifest = async (
  access: RegistryViewerAccess = 'free',
): Promise<CardForgeStudioBootstrapManifest> => {
  const rows = await getPublishedRegistryRows(access);
  return mapStudioBootstrap(access, rows);
};

export const getCardForgeStudioAssetManifest = async (
  access: RegistryViewerAccess = 'free',
): Promise<CardForgeStudioAssetManifest> => {
  const rows = await getPublishedRegistryRows(access);
  const payload = mapAssetRegistryRowsToPayload(rows, getSupabaseServerConfigStatus().configured);
  return {
    version: catalogVersion(access, rows),
    access,
    assets: {
      textures: payload.textures,
      dividers: payload.dividers,
      icons: payload.icons,
      imageAssets: payload.imageAssets,
    },
  };
};

export const getCardForgeCatalogManifest = async (
  access: RegistryViewerAccess = 'free',
): Promise<CardForgeCatalogManifest> => {
  const rows = await getPublishedRegistryRows(access);
  const bootstrap = await mapStudioBootstrap(access, rows);
  const sets = rows.filter((row) => row.asset_type === 'set').map((row): PublishedSetCatalogItem => {
    const metadata = row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? row.metadata as Record<string, unknown>
      : {};
    return {
      id: row.asset_id,
      name: row.name,
      packageUrl: row.url,
      previewUrl: row.preview_url ?? null,
      access: row.access_tier,
      source: row.library_source,
      fileSizeBytes: row.file_size_bytes,
      revision: typeof metadata.revisionNumber === 'number' ? metadata.revisionNumber : 1,
      description: typeof metadata.description === 'string' ? metadata.description : 'A published CardForge Set starter.',
      specialtyTags: Array.isArray(metadata.specialtyTags) ? metadata.specialtyTags.filter((tag): tag is string => typeof tag === 'string') : [],
      useCaseTags: Array.isArray(metadata.useCaseTags) ? metadata.useCaseTags.filter((tag): tag is string => typeof tag === 'string') : [],
    };
  });
  return {
    ...bootstrap,
    assets: mapAssetRegistryRowsToPayload(rows, getSupabaseServerConfigStatus().configured),
    sets: { items: sets },
    pipeline: {
      items: rows.map((row) => ({
        id: row.asset_id,
        lineageId: row.lineage_id ?? null,
        name: row.name,
        assetType: row.asset_type,
        previewUrl: row.preview_url ?? null,
        access: row.access_tier,
        source: row.library_source,
        fileSizeBytes: row.file_size_bytes,
        updatedAt: row.updated_at,
      })),
    },
  };
};
