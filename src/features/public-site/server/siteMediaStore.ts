import {
  DEFAULT_SITE_MEDIA,
  getDefaultSiteMedia,
  isSiteMediaSlot,
  type SiteMediaAsset,
  type SiteMediaSlot,
} from '@/features/public-site/model/siteMedia';
import { isMissingSupabaseTableError } from '@/infrastructure/database/supabaseErrors';
import {
  getSupabaseServerClient,
  getSupabaseServerConfigStatus,
} from '@/infrastructure/database/supabaseServer';

type SiteMediaRow = {
  slot: SiteMediaSlot;
  storage_path: string;
  alt: string;
  updated_at: string | null;
};

export class SiteMediaStoreError extends Error {
  constructor(message: string, public readonly status = 500) {
    super(message);
  }
}

const mapRow = (row: SiteMediaRow): SiteMediaAsset => ({
  ...getDefaultSiteMedia(row.slot),
  storagePath: row.storage_path,
  alt: row.alt,
  updatedAt: row.updated_at,
});

export const getSiteMedia = async (): Promise<SiteMediaAsset[]> => {
  const supabase = getSupabaseServerClient();
  if (!getSupabaseServerConfigStatus().configured || !supabase) {
    return DEFAULT_SITE_MEDIA.map((asset) => getDefaultSiteMedia(asset.slot));
  }

  const { data, error } = await supabase
    .from('cardforge_site_media')
    .select('slot,storage_path,alt,updated_at')
    .order('slot', { ascending: true });

  if (error) {
    if (!isMissingSupabaseTableError(error)) console.error('Failed to load public site media:', error);
    return DEFAULT_SITE_MEDIA.map((asset) => getDefaultSiteMedia(asset.slot));
  }

  return DEFAULT_SITE_MEDIA.map((asset) => {
    const row = (data ?? []).find((candidate) => candidate.slot === asset.slot) as SiteMediaRow | undefined;
    return row ? mapRow(row) : getDefaultSiteMedia(asset.slot);
  });
};

export const updateSiteMedia = async (input: {
  slot: unknown;
  storagePath: unknown;
  alt: unknown;
}): Promise<SiteMediaAsset[]> => {
  if (!isSiteMediaSlot(input.slot)) throw new SiteMediaStoreError('Unknown homepage image.', 400);
  if (typeof input.storagePath !== 'string' || !input.storagePath.startsWith(`landing/${input.slot.replace('landing.', '')}/`)) {
    throw new SiteMediaStoreError('Homepage image storage path is invalid.', 400);
  }
  if (typeof input.alt !== 'string' || !input.alt.trim() || input.alt.trim().length > 300) {
    throw new SiteMediaStoreError('Image description is required and must be 300 characters or fewer.', 400);
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) throw new SiteMediaStoreError('Homepage image storage is not configured yet.', 503);

  const { error } = await supabase.from('cardforge_site_media').upsert({
    slot: input.slot,
    storage_path: input.storagePath,
    alt: input.alt.trim(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'slot' });
  if (error) {
    console.error('Failed to update public site media:', error);
    throw new SiteMediaStoreError('Unable to publish the homepage image.');
  }
  return getSiteMedia();
};
