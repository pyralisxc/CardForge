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
  'updated_at',
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
    throw new PublicSiteConfigurationStoreError('Public site settings are temporarily unavailable.', 503);
  }
  return hydratePublicSiteConfiguration(data?.[0] as unknown as Record<string, unknown> | undefined);
};


export type PublicSiteVisibleField = 'primaryCtaLabel' | 'navigationLabel' | 'announcementMessage';

export interface PublicSiteVisibleFieldInput {
  field: PublicSiteVisibleField;
  value: unknown;
  navigationId?: unknown;
  expectedUpdatedAt?: unknown;
}

const validateRevision = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim() || !Number.isFinite(Date.parse(value))) {
    throw new PublicSiteConfigurationStoreError('Current site settings revision is missing. Reload Site settings before publishing.', 409);
  }
  return value;
};

const publishConfigurationPatch = async (
  values: Record<string, unknown>,
  expectedUpdatedAt: unknown,
): Promise<PublicSiteConfiguration> => {
  const revision = validateRevision(expectedUpdatedAt);
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new PublicSiteConfigurationStoreError('Public site settings database is not configured yet.', 503);
  // Conditional UPDATE rather than UPSERT: no stale form can overwrite a newer
  // revision or reseed default values. The returned row proves exact commit.
  const { data, error } = await supabase.from('cardforge_owner_settings')
    .update(values)
    .eq('id', 'cardforge')
    .eq('updated_at', revision)
    .select(SITE_CONFIGURATION_COLUMNS)
    .limit(1);
  if (error) {
    console.error('Failed to publish Owner site settings:', error);
    throw new PublicSiteConfigurationStoreError('Unable to publish site settings.', 503);
  }
  if (!data?.[0]) {
    throw new PublicSiteConfigurationStoreError(
      'Site settings changed in another session. Reload the page, review the current values, and publish again.',
      409,
    );
  }
  return hydratePublicSiteConfiguration(data[0] as Record<string, unknown>);
};

export const updatePublicSiteConfiguration = async (
  input: Record<string, unknown>,
): Promise<PublicSiteConfiguration> => {
  let normalized: PublicSiteConfiguration;
  try {
    normalized = normalizePublicSiteConfigurationInput(input);
  } catch (error) {
    throw new PublicSiteConfigurationStoreError(error instanceof Error ? error.message : 'Public site settings are invalid.', 400);
  }
  return publishConfigurationPatch({
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
  }, input.updatedAt);
};

const validateOwnerLabel = (value: unknown, maximum: number, label: string): string => {
  if (typeof value !== 'string') throw new PublicSiteConfigurationStoreError('Enter text for the selected field.', 400);
  const normalized = value.trim().replace(/[ \t]+/g, ' ');
  if (!normalized || normalized.length > maximum) {
    throw new PublicSiteConfigurationStoreError(label + ' must be between 1 and ' + maximum + ' characters.', 400);
  }
  return normalized;
};

/** Field-specific publication never replaces the rest of the settings record. */
export const updatePublicSiteVisibleField = async (
  input: PublicSiteVisibleFieldInput,
): Promise<PublicSiteConfiguration> => {
  const revision = validateRevision(input.expectedUpdatedAt);
  if (input.field === 'primaryCtaLabel') {
    return publishConfigurationPatch({
      primary_cta_label: validateOwnerLabel(input.value, 80, 'Primary action text'),
    }, revision);
  }
  if (input.field === 'announcementMessage') {
    return publishConfigurationPatch({
      announcement_message: validateOwnerLabel(input.value, 240, 'Announcement text'),
    }, revision);
  }
  if (input.field !== 'navigationLabel' || typeof input.navigationId !== 'string'
    || !['about', 'plans', 'roadmap', 'account'].includes(input.navigationId)) {
    throw new PublicSiteConfigurationStoreError('Choose a supported navigation label.', 400);
  }
  const label = validateOwnerLabel(input.value, 40, 'Navigation text');
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new PublicSiteConfigurationStoreError('Public site settings database is not configured yet.', 503);
  const { data: rows, error } = await supabase.from('cardforge_owner_settings')
    .select('updated_at,primary_navigation').eq('id', 'cardforge').limit(1);
  if (error) throw new PublicSiteConfigurationStoreError('Unable to read the current navigation.', 503);
  const row = rows?.[0] as { updated_at?: string; primary_navigation?: unknown } | undefined;
  if (!row || row.updated_at !== revision) {
    throw new PublicSiteConfigurationStoreError(
      'Navigation changed in another session. Reload and review the current labels before publishing.',
      409,
    );
  }
  if (!Array.isArray(row.primary_navigation)) {
    throw new PublicSiteConfigurationStoreError('The navigation needs repair before it can be edited in place.', 409);
  }
  let found = false;
  const nextNavigation = row.primary_navigation.map((item: unknown) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
    const candidate = item as Record<string, unknown>;
    if (candidate.id !== input.navigationId) return item;
    found = true;
    return { ...candidate, label };
  });
  if (!found) throw new PublicSiteConfigurationStoreError('The selected navigation item is no longer present. Reload Site settings.', 409);
  return publishConfigurationPatch({ primary_navigation: nextNavigation }, revision);
};
