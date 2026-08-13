import { mapRegistryRowsToCardFontOptions, type CardFontOption } from '@/domain/rendering';
import { getPublishedRegistryContentRows } from '@/features/developer-assets/lib/registryContentAssets';
import type { RegistryViewerAccess } from '@/features/developer-assets/lib/registryContentAssets';
import { getSupabaseServerConfigStatus } from '@/infrastructure/database/supabaseServer';

export interface RegistryFontsPayload {
  fonts: CardFontOption[];
  registry: {
    configured: boolean;
    source: 'database';
    total: number;
  };
}

export const getRegistryFontsPayload = async (
  viewerAccess: RegistryViewerAccess = 'free',
): Promise<RegistryFontsPayload> => {
  const configured = getSupabaseServerConfigStatus().configured;
  const rows = await getPublishedRegistryContentRows('font', viewerAccess);
  const fonts = mapRegistryRowsToCardFontOptions(rows.map((row) => ({
    asset_id: row.asset_id,
    name: row.name,
    url: row.url,
    metadata: row.metadata,
  })));

  return {
    fonts,
    registry: {
      configured,
      source: 'database',
      total: fonts.length,
    },
  };
};
