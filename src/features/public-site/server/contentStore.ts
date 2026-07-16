import {
  DEFAULT_SITE_CONTENT_BLOCKS,
  getDefaultSiteContentBlock,
  normalizeSiteContentBlockInput,
  type SiteContentBlock,
  type SiteContentBlockSlug,
} from '@/features/public-site/model/siteContent';
import {
  DEFAULT_SITE_OPERATOR_SETTINGS,
  normalizeSiteOperatorSettingsInput,
  type SiteOperatorSettings,
} from '@/features/public-site/model/siteOperator';
import { isMissingSupabaseTableError } from '@/infrastructure/database/supabaseErrors';
import {
  getSupabaseServerClient,
  getSupabaseServerConfigStatus,
} from '@/infrastructure/database/supabaseServer';

type SiteOperatorSettingsRow = {
  business_name: string;
  owner_name: string;
  support_email: string;
  support_phone: string;
  website_url: string;
};

type SiteContentBlockRow = {
  slug: SiteContentBlockSlug;
  body: string;
  updated_at: string | null;
};

export class PublicSiteStoreError extends Error {
  constructor(message: string, public readonly status = 500) {
    super(message);
  }
}

const mapSiteOperatorSettingsRow = (
  row: SiteOperatorSettingsRow | null | undefined,
): SiteOperatorSettings => row ? {
  businessName: row.business_name || DEFAULT_SITE_OPERATOR_SETTINGS.businessName,
  ownerName: row.owner_name || DEFAULT_SITE_OPERATOR_SETTINGS.ownerName,
  supportEmail: row.support_email || DEFAULT_SITE_OPERATOR_SETTINGS.supportEmail,
  supportPhone: row.support_phone || DEFAULT_SITE_OPERATOR_SETTINGS.supportPhone,
  websiteUrl: row.website_url || DEFAULT_SITE_OPERATOR_SETTINGS.websiteUrl,
} : DEFAULT_SITE_OPERATOR_SETTINGS;

const mapSiteContentRow = (row: SiteContentBlockRow): SiteContentBlock => ({
  ...getDefaultSiteContentBlock(row.slug),
  body: row.body,
  updatedAt: row.updated_at,
});

export const getSiteOperatorSettings = async (): Promise<SiteOperatorSettings> => {
  const supabase = getSupabaseServerClient();
  if (!getSupabaseServerConfigStatus().configured || !supabase) {
    return DEFAULT_SITE_OPERATOR_SETTINGS;
  }

  const { data, error } = await supabase
    .from('cardforge_owner_settings')
    .select('business_name,owner_name,support_email,support_phone,website_url')
    .eq('id', 'cardforge')
    .limit(1);

  if (error) {
    if (!isMissingSupabaseTableError(error)) {
      console.error('Failed to load public site operator settings:', error);
    }
    return DEFAULT_SITE_OPERATOR_SETTINGS;
  }

  return mapSiteOperatorSettingsRow(data?.[0] as SiteOperatorSettingsRow | undefined);
};

export const getSiteContentBlocks = async (): Promise<SiteContentBlock[]> => {
  const supabase = getSupabaseServerClient();
  if (!getSupabaseServerConfigStatus().configured || !supabase) {
    return DEFAULT_SITE_CONTENT_BLOCKS;
  }

  const { data, error } = await supabase
    .from('cardforge_site_content_blocks')
    .select('slug,body,updated_at')
    .order('slug', { ascending: true });

  if (error) {
    if (!isMissingSupabaseTableError(error)) {
      console.error('Failed to load public site content:', error);
    }
    return DEFAULT_SITE_CONTENT_BLOCKS;
  }

  return DEFAULT_SITE_CONTENT_BLOCKS.map((defaultBlock) => {
    const row = (data ?? []).find((block) => block.slug === defaultBlock.slug) as SiteContentBlockRow | undefined;
    return row ? mapSiteContentRow(row) : defaultBlock;
  });
};

export const updateSiteOperatorSettings = async (
  input: Partial<Record<keyof SiteOperatorSettings, unknown>>,
): Promise<SiteOperatorSettings> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new PublicSiteStoreError('Public site database is not configured yet.', 503);

  const normalized = normalizeSiteOperatorSettingsInput(input);
  const { error } = await supabase.from('cardforge_owner_settings').upsert({
    id: 'cardforge',
    business_name: normalized.businessName,
    owner_name: normalized.ownerName,
    support_email: normalized.supportEmail,
    support_phone: normalized.supportPhone,
    website_url: normalized.websiteUrl,
  }, { onConflict: 'id' });

  if (error) {
    console.error('Failed to update public site operator settings:', error);
    throw new PublicSiteStoreError('Unable to update public site settings.');
  }

  return normalized;
};

export const updateSiteContentBlock = async (
  input: { slug?: unknown; body?: unknown },
): Promise<SiteContentBlock[]> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new PublicSiteStoreError('Public site database is not configured yet.', 503);

  const normalized = normalizeSiteContentBlockInput(input);
  if (!normalized.ok) throw new PublicSiteStoreError(normalized.message, 400);

  const { error } = await supabase.from('cardforge_site_content_blocks').upsert({
    slug: normalized.value.slug,
    body: normalized.value.body,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'slug' });

  if (error) {
    console.error('Failed to update public site content:', error);
    throw new PublicSiteStoreError('Unable to update public site content.');
  }

  return getSiteContentBlocks();
};
