import {
  DEFAULT_PUBLIC_SITE_CONFIGURATION,
  hydratePublicSiteConfiguration,
  normalizePublicSiteConfigurationInput,
  type PublicSiteConfiguration,
} from '@/features/public-site/model/siteConfiguration';
import {
  getSupabaseServerClient,
  getSupabaseServerConfigStatus,
} from '@/infrastructure/database/supabaseServer';

export class PublicSiteConfigurationStoreError extends Error {
  constructor(message: string, public readonly status = 500) {
    super(message);
  }
}

const SITE_CONFIGURATION_COLUMNS = [
  'announcement_enabled',
  'announcement_message',
  'primary_cta_label',
  'primary_cta_href',
  'support_offer_visible',
  'homepage_title',
  'homepage_description',
  'search_keywords',
  'watermark_preview_opacity',
  'watermark_share_opacity',
  'watermark_width_percent',
  'primary_navigation',
  'homepage_sections',
].join(',');

const SITE_CONFIGURATION_SNAPSHOT_COLUMNS = `${SITE_CONFIGURATION_COLUMNS},updated_at`;

type PublicSiteConfigurationSnapshotRow = Record<string, unknown> & {
  updated_at?: unknown;
};

export interface PublicSiteConfigurationSnapshot {
  settings: PublicSiteConfiguration;
  updatedAt: string | null;
}

const normalizeExpectedUpdatedAt = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim() || Number.isNaN(Date.parse(value))) {
    throw new PublicSiteConfigurationStoreError(
      'Read the current public site settings revision before publishing.',
      400,
    );
  }
  return value;
};

const mapSnapshot = (
  row: PublicSiteConfigurationSnapshotRow | null | undefined,
): PublicSiteConfigurationSnapshot => ({
  settings: hydratePublicSiteConfiguration(row),
  updatedAt: typeof row?.updated_at === 'string' ? row.updated_at : null,
});

export const getPublicSiteConfigurationSnapshot = async (): Promise<PublicSiteConfigurationSnapshot> => {
  const supabase = getSupabaseServerClient();
  if (!getSupabaseServerConfigStatus().configured || !supabase) {
    return {
      settings: DEFAULT_PUBLIC_SITE_CONFIGURATION,
      updatedAt: null,
    };
  }
  const { data, error } = await supabase
    .from('cardforge_owner_settings')
    .select(SITE_CONFIGURATION_SNAPSHOT_COLUMNS)
    .eq('id', 'cardforge')
    .limit(1);
  if (error) {
    console.error('Failed to load public site configuration:', error);
    throw new PublicSiteConfigurationStoreError('Public site settings are temporarily unavailable.', 503);
  }
  return mapSnapshot(data?.[0] as PublicSiteConfigurationSnapshotRow | undefined);
};

export const getPublicSiteConfiguration = async (): Promise<PublicSiteConfiguration> => (
  (await getPublicSiteConfigurationSnapshot()).settings
);

const normalizeSiteConfiguration = (
  input: Record<string, unknown>,
): PublicSiteConfiguration => {
  try {
    return normalizePublicSiteConfigurationInput(input);
  } catch (error) {
    throw new PublicSiteConfigurationStoreError(
      error instanceof Error ? error.message : 'Public site settings are invalid.',
      400,
    );
  }
};

const toSiteConfigurationRow = (
  normalized: PublicSiteConfiguration,
): Record<string, unknown> => ({
  announcement_enabled: normalized.announcementEnabled,
  announcement_message: normalized.announcementMessage,
  primary_cta_label: normalized.primaryCtaLabel,
  primary_cta_href: normalized.primaryCtaHref,
  support_offer_visible: normalized.supportOfferVisible,
  homepage_title: normalized.homepageTitle,
  homepage_description: normalized.homepageDescription,
  search_keywords: normalized.searchKeywords,
  watermark_preview_opacity: normalized.watermarkPreviewOpacity,
  watermark_share_opacity: normalized.watermarkShareOpacity,
  watermark_width_percent: normalized.watermarkWidthPercent,
  primary_navigation: normalized.primaryNavigation,
  homepage_sections: normalized.homepageSections,
});

export const publishPublicSiteConfigurationRevision = async (
  input: Record<string, unknown>,
  expectedUpdatedAt: unknown,
): Promise<PublicSiteConfigurationSnapshot> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new PublicSiteConfigurationStoreError(
      'Public site settings database is not configured yet.',
      503,
    );
  }

  const expectedRevision = normalizeExpectedUpdatedAt(expectedUpdatedAt);
  const normalized = normalizeSiteConfiguration(input);
  const { data, error } = await supabase
    .from('cardforge_owner_settings')
    .update(toSiteConfigurationRow(normalized))
    .eq('id', 'cardforge')
    .eq('updated_at', expectedRevision)
    .select(SITE_CONFIGURATION_SNAPSHOT_COLUMNS)
    .maybeSingle();

  if (error) {
    console.error('Failed to publish public site configuration revision:', error);
    throw new PublicSiteConfigurationStoreError('Unable to update public site settings.');
  }
  if (!data) {
    throw new PublicSiteConfigurationStoreError(
      'Public site settings changed after they were read. Reload the current Owner state, review the newer settings, and publish again.',
      409,
    );
  }
  return mapSnapshot(data as PublicSiteConfigurationSnapshotRow);
};

export const updatePublicSiteConfiguration = async (
  input: Record<string, unknown>,
): Promise<PublicSiteConfiguration> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new PublicSiteConfigurationStoreError('Public site settings database is not configured yet.', 503);
  const normalized = normalizeSiteConfiguration(input);
  const { error } = await supabase.from('cardforge_owner_settings').upsert({
    id: 'cardforge',
    ...toSiteConfigurationRow(normalized),
  }, { onConflict: 'id' });
  if (error) {
    console.error('Failed to update public site configuration:', error);
    throw new PublicSiteConfigurationStoreError('Unable to update public site settings.');
  }
  return normalized;
};