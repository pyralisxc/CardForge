import { mapRegistryRowsToCardFontOptions, type CardFontOption } from '@/lib/cardFonts';
import { getPublishedRegistryContentRows } from '@/lib/registryContentAssets';
import { getSupabaseServerConfigStatus } from '@/lib/supabaseServer';

export interface RegistryFontsPayload {
  fonts: CardFontOption[];
  registry: {
    configured: boolean;
    source: 'database';
    total: number;
  };
}

export const getRegistryFontsPayload = async (): Promise<RegistryFontsPayload> => {
  const configured = getSupabaseServerConfigStatus().configured;
  const rows = await getPublishedRegistryContentRows('font');
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
