import {
  DEFAULT_SITE_CONTENT_BLOCKS,
  getDefaultSiteContentBlock,
  normalizeSiteContentBlockInput,
  type SiteContentBlock,
  type SiteContentBlockSlug,
} from '@/features/public-site/model/siteContent';
import { isMissingSupabaseTableError } from '@/infrastructure/database/supabaseErrors';
import {
  getSupabaseServerClient,
  getSupabaseServerConfigStatus,
} from '@/infrastructure/database/supabaseServer';

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

const mapSiteContentRow = (row: SiteContentBlockRow): SiteContentBlock => ({
  ...getDefaultSiteContentBlock(row.slug),
  body: row.body,
  updatedAt: row.updated_at,
});

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
