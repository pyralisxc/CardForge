import { mapRegistryRowsToCardFontOptions, type CardFontOption } from '@/domain/rendering';
import type { RegistryContentAssetRow } from '@/features/pipeline/lib/registryContentAssets';

export interface RegistryFontsPayload {
  fonts: CardFontOption[];
  registry: {
    configured: boolean;
    source: 'database';
    total: number;
  };
}

export const mapRegistryRowsToFontsPayload = (
  rows: RegistryContentAssetRow[],
  configured: boolean,
): RegistryFontsPayload => {
  const fonts = mapRegistryRowsToCardFontOptions(rows.map((row) => ({
    asset_id: row.asset_id,
    name: row.name,
    url: row.url,
    metadata: row.metadata,
  })));
  return {
    fonts,
    registry: { configured, source: 'database', total: fonts.length },
  };
};
