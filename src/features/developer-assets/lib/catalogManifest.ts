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
  return {
    ...bootstrap,
    assets: mapAssetRegistryRowsToPayload(rows, getSupabaseServerConfigStatus().configured),
  };
};
