import type { AppearanceStyleLibrary, TCGCardTemplate } from '@/domain/templates';
import type { CardFontOption } from '@/domain/rendering';
import { getSupabaseServerConfigStatus } from '@/infrastructure/database/supabaseServer';

import { mapAssetRegistryRowsToPayload, type AssetRegistryPayload } from './assetRegistry';
import {
  getPublishedRegistryRows,
  type PublishedRegistryAssetRow,
  type RegistryViewerAccess,
} from './registryContentAssets';
import { mapRegistryRowsToFontsPayload } from './registryFonts';
import {
  mapRegistryRowsToStyleLibrary,
  mapRegistryRowsToTemplateLibrary,
} from './repositoryCatalog';

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

export const getCardForgeCatalogManifest = async (
  access: RegistryViewerAccess = 'free',
): Promise<CardForgeCatalogManifest> => {
  const rows = await getPublishedRegistryRows(access);
  const configured = getSupabaseServerConfigStatus().configured;
  const [templates, styles] = await Promise.all([
    mapRegistryRowsToTemplateLibrary(rows.filter((row) => row.asset_type === 'template')),
    mapRegistryRowsToStyleLibrary(rows.filter((row) => row.asset_type === 'elementPreset')),
  ]);
  return {
    version: catalogVersion(access, rows),
    access,
    templates: { defaults: templates, userTemplates: [] },
    styles: { version: 1, styles: styles.sort((left, right) => left.name.localeCompare(right.name)) },
    assets: mapAssetRegistryRowsToPayload(rows, configured),
    fonts: mapRegistryRowsToFontsPayload(
      rows.filter((row) => row.asset_type === 'font'),
      configured,
    ),
  };
};
