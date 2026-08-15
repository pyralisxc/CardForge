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

export const getCardForgeCatalogManifest = async (
  access: RegistryViewerAccess = 'free',
): Promise<CardForgeCatalogManifest> => {
  const rows = await getPublishedRegistryRows(access);
  const configured = getSupabaseServerConfigStatus().configured;
  const [templates, styles] = await Promise.all([
    mapRegistryRowsToTemplateLibrary(sortRoutedRows(rows.filter((row) => row.asset_type === 'template' && isRoutedTo(row, 'template.')))),
    mapRegistryRowsToStyleLibrary(sortRoutedRows(rows.filter((row) => row.asset_type === 'elementPreset' && isRoutedTo(row, 'style.')))),
  ]);
  return {
    version: catalogVersion(access, rows),
    access,
    templates: { defaults: templates, userTemplates: [] },
    styles: { version: 1, styles },
    assets: mapAssetRegistryRowsToPayload(rows, configured),
    fonts: mapRegistryRowsToFontsPayload(
      sortRoutedRows(rows.filter((row) => row.asset_type === 'font' && isRoutedTo(row, 'typography.font'))),
      configured,
    ),
  };
};
