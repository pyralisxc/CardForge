import {
  DEFAULT_SITE_MEDIA,
  getDefaultSiteMedia,
  isSiteMediaSlot,
  normalizeSiteMediaPresentation,
  type SiteMediaAsset,
  type SiteMediaPresentation,
  type SiteMediaSlot,
  type SiteMediaVersion,
} from '@/features/public-site/model/siteMedia';
import { isMissingSupabaseTableError } from '@/infrastructure/database/supabaseErrors';
import {
  getSupabaseServerClient,
  getSupabaseServerConfigStatus,
} from '@/infrastructure/database/supabaseServer';

type SiteMediaRow = {
  slot: SiteMediaSlot;
  storage_path: string | null;
  alt: string;
  width: number | null;
  height: number | null;
  presentation: unknown;
  previous_storage_path: string | null;
  previous_alt: string | null;
  previous_width: number | null;
  previous_height: number | null;
  previous_presentation: unknown | null;
  previous_updated_at: string | null;
  updated_at: string | null;
};

export class SiteMediaStoreError extends Error {
  constructor(message: string, public readonly status = 500) {
    super(message);
  }
}

const normalizeStoredPresentation = (slot: SiteMediaSlot, value: unknown): SiteMediaPresentation => {
  const normalized = normalizeSiteMediaPresentation(slot, value ?? {});
  return normalized.ok ? normalized.value : getDefaultSiteMedia(slot).presentation;
};

const mapPreviousVersion = (row: SiteMediaRow): SiteMediaVersion | null => {
  if (!row.previous_alt || !row.previous_presentation) return null;
  return {
    storagePath: row.previous_storage_path,
    alt: row.previous_alt,
    width: row.previous_width,
    height: row.previous_height,
    presentation: normalizeStoredPresentation(row.slot, row.previous_presentation),
    updatedAt: row.previous_updated_at,
  };
};

const mapRow = (row: SiteMediaRow): SiteMediaAsset => {
  const fallback = getDefaultSiteMedia(row.slot);
  return {
    ...fallback,
    storagePath: row.storage_path,
    alt: row.alt,
    width: row.width ?? (row.storage_path ? null : fallback.width),
    height: row.height ?? (row.storage_path ? null : fallback.height),
    presentation: normalizeStoredPresentation(row.slot, row.presentation),
    previousVersion: mapPreviousVersion(row),
    updatedAt: row.updated_at,
  };
};

const mergeRowsWithDefaults = <Row extends { slot: SiteMediaSlot }>(
  rows: Row[],
  mapper: (row: Row) => SiteMediaAsset,
): SiteMediaAsset[] => DEFAULT_SITE_MEDIA.map((asset) => {
  const row = rows.find((candidate) => candidate.slot === asset.slot);
  return row ? mapper(row) : getDefaultSiteMedia(asset.slot);
});

export const getSiteMedia = async (): Promise<SiteMediaAsset[]> => {
  const supabase = getSupabaseServerClient();
  if (!getSupabaseServerConfigStatus().configured || !supabase) {
    return DEFAULT_SITE_MEDIA.map((asset) => getDefaultSiteMedia(asset.slot));
  }

  const { data, error } = await supabase
    .from('cardforge_site_media')
    .select('slot,storage_path,alt,width,height,presentation,previous_storage_path,previous_alt,previous_width,previous_height,previous_presentation,previous_updated_at,updated_at')
    .order('slot', { ascending: true });

  if (!error) return mergeRowsWithDefaults((data ?? []) as SiteMediaRow[], mapRow);
  if (isMissingSupabaseTableError(error)) {
    return DEFAULT_SITE_MEDIA.map((asset) => getDefaultSiteMedia(asset.slot));
  }

  console.error('Failed to load public site media:', error);
  return DEFAULT_SITE_MEDIA.map((asset) => getDefaultSiteMedia(asset.slot));
};

const validateDimensions = (width: unknown, height: unknown): { width: number | null; height: number | null } => {
  const validDimension = (value: unknown): value is number => (
    typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 20_000
  );
  if (width === null && height === null) return { width: null, height: null };
  if (!validDimension(width) || !validDimension(height)) {
    throw new SiteMediaStoreError('Image dimensions are invalid.', 400);
  }
  return { width, height };
};

const validateStoragePath = (slot: SiteMediaSlot, storagePath: unknown): string | null => {
  if (storagePath === null) return null;
  const expectedPrefix = slot === 'founder.portrait'
    ? 'founder/portrait/'
    : `landing/${slot.replace('landing.', '')}/`;
  if (typeof storagePath !== 'string' || !storagePath.startsWith(expectedPrefix)) {
    throw new SiteMediaStoreError('Public image storage path is invalid.', 400);
  }
  return storagePath;
};

export const updateSiteMedia = async (input: {
  slot: unknown;
  storagePath: unknown;
  alt: unknown;
  width: unknown;
  height: unknown;
  presentation: unknown;
}): Promise<SiteMediaAsset[]> => {
  if (!isSiteMediaSlot(input.slot)) throw new SiteMediaStoreError('Unknown public image.', 400);
  const storagePath = validateStoragePath(input.slot, input.storagePath);
  const dimensions = validateDimensions(input.width, input.height);
  if (typeof input.alt !== 'string' || !input.alt.trim() || input.alt.trim().length > 300) {
    throw new SiteMediaStoreError('Image description is required and must be 300 characters or fewer.', 400);
  }
  const presentation = normalizeSiteMediaPresentation(input.slot, input.presentation);
  if (!presentation.ok) throw new SiteMediaStoreError(presentation.message, 400);

  const supabase = getSupabaseServerClient();
  if (!supabase) throw new SiteMediaStoreError('Public image storage is not configured yet.', 503);
  const current = (await getSiteMedia()).find((asset) => asset.slot === input.slot)
    ?? getDefaultSiteMedia(input.slot);
  const updatedAt = new Date().toISOString();
  const { error } = await supabase.from('cardforge_site_media').upsert({
    slot: input.slot,
    storage_path: storagePath,
    alt: input.alt.trim(),
    width: dimensions.width,
    height: dimensions.height,
    presentation: presentation.value,
    previous_storage_path: current.storagePath,
    previous_alt: current.alt,
    previous_width: current.width,
    previous_height: current.height,
    previous_presentation: current.presentation,
    previous_updated_at: current.updatedAt,
    updated_at: updatedAt,
  }, { onConflict: 'slot' });
  if (error) {
    console.error('Failed to update public site media:', error);
    throw new SiteMediaStoreError('Unable to publish the public image.');
  }
  return getSiteMedia();
};

export const restorePreviousSiteMedia = async (slot: unknown): Promise<SiteMediaAsset[]> => {
  if (!isSiteMediaSlot(slot)) throw new SiteMediaStoreError('Unknown public image.', 400);
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new SiteMediaStoreError('Public image storage is not configured yet.', 503);
  const current = (await getSiteMedia()).find((asset) => asset.slot === slot);
  if (!current?.previousVersion) throw new SiteMediaStoreError('There is no previous image version to restore.', 409);
  const previous = current.previousVersion;
  const { error } = await supabase.from('cardforge_site_media').upsert({
    slot,
    storage_path: previous.storagePath,
    alt: previous.alt,
    width: previous.width,
    height: previous.height,
    presentation: previous.presentation,
    previous_storage_path: current.storagePath,
    previous_alt: current.alt,
    previous_width: current.width,
    previous_height: current.height,
    previous_presentation: current.presentation,
    previous_updated_at: current.updatedAt,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'slot' });
  if (error) {
    console.error('Failed to restore public site media:', error);
    throw new SiteMediaStoreError('Unable to restore the previous public image.');
  }
  return getSiteMedia();
};
