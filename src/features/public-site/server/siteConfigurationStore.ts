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
  'creator_pass_offer_visible',
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

export const getPublicSiteConfiguration = async (): Promise<PublicSiteConfiguration> => {
  const supabase = getSupabaseServerClient();
  if (!getSupabaseServerConfigStatus().configured || !supabase) return DEFAULT_PUBLIC_SITE_CONFIGURATION;
  const { data, error } = await supabase
    .from('cardforge_owner_settings')
    .select(SITE_CONFIGURATION_COLUMNS)
    .eq('id', 'cardforge')
    .limit(1);
  if (error) {
    console.error('Failed to load public site configuration:', error);
    return DEFAULT_PUBLIC_SITE_CONFIGURATION;
  }
  return hydratePublicSiteConfiguration(data?.[0] as unknown as Record<string, unknown> | undefined);
};

export const updatePublicSiteConfiguration = async (
  input: Record<string, unknown>,
): Promise<PublicSiteConfiguration> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new PublicSiteConfigurationStoreError('Public site settings database is not configured yet.', 503);
  let normalized: PublicSiteConfiguration;
  try {
    normalized = normalizePublicSiteConfigurationInput(input);
  } catch (error) {
    throw new PublicSiteConfigurationStoreError(error instanceof Error ? error.message : 'Public site settings are invalid.', 400);
  }
  const { error } = await supabase.from('cardforge_owner_settings').upsert({
    id: 'cardforge',
    announcement_enabled: normalized.announcementEnabled,
    announcement_message: normalized.announcementMessage,
    primary_cta_label: normalized.primaryCtaLabel,
    primary_cta_href: normalized.primaryCtaHref,
    creator_pass_offer_visible: normalized.creatorPassOfferVisible,
    support_offer_visible: normalized.supportOfferVisible,
    homepage_title: normalized.homepageTitle,
    homepage_description: normalized.homepageDescription,
    search_keywords: normalized.searchKeywords,
    watermark_preview_opacity: normalized.watermarkPreviewOpacity,
    watermark_share_opacity: normalized.watermarkShareOpacity,
    watermark_width_percent: normalized.watermarkWidthPercent,
    primary_navigation: normalized.primaryNavigation,
    homepage_sections: normalized.homepageSections,
  }, { onConflict: 'id' });
  if (error) {
    console.error('Failed to update public site configuration:', error);
    throw new PublicSiteConfigurationStoreError('Unable to update public site settings.');
  }
  return normalized;
};
