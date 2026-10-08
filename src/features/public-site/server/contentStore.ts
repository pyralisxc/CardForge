import {
  DEFAULT_SITE_CONTENT_BLOCKS,
  getDefaultSiteContentBlock,
  normalizeSiteContentBlockInput,
  type SiteContentBlock,
  type SiteContentBlockSlug,
} from '@/features/public-site/model/siteContent';
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
    console.error('Failed to load public site content:', error);
    throw new PublicSiteStoreError('Public site content is temporarily unavailable.', 503);
  }

  return DEFAULT_SITE_CONTENT_BLOCKS.map((defaultBlock) => {
    const row = (data ?? []).find((block) => block.slug === defaultBlock.slug) as SiteContentBlockRow | undefined;
    return row ? mapSiteContentRow(row) : defaultBlock;
  });
};

export const updateSiteContentBlock = async (
  input: { slug?: unknown; body?: unknown },
): Promise<SiteContentBlock> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new PublicSiteStoreError('Public site database is not configured yet.', 503);

  const normalized = normalizeSiteContentBlockInput(input);
  if (!normalized.ok) throw new PublicSiteStoreError(normalized.message, 400);

  const updatedAt = new Date().toISOString();
  const { error } = await supabase.from('cardforge_site_content_blocks').upsert({
    slug: normalized.value.slug,
    body: normalized.value.body,
    updated_at: updatedAt,
  }, { onConflict: 'slug' });

  if (error) {
    console.error('Failed to update public site content:', error);
    throw new PublicSiteStoreError('Unable to update public site content.');
  }

  return {
    ...getDefaultSiteContentBlock(normalized.value.slug),
    body: normalized.value.body,
    updatedAt,
  };
};

export const publishSiteContentBlockRevision = async (
  input: { slug?: unknown; body?: unknown; expectedUpdatedAt?: unknown },
): Promise<SiteContentBlock> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new PublicSiteStoreError('Public site database is not configured yet.', 503);

  const normalized = normalizeSiteContentBlockInput(input);
  if (!normalized.ok) throw new PublicSiteStoreError(normalized.message, 400);

  const expectedUpdatedAt = input.expectedUpdatedAt;
  if (
    expectedUpdatedAt !== null
    && (
      typeof expectedUpdatedAt !== 'string'
      || !expectedUpdatedAt.trim()
      || Number.isNaN(new Date(expectedUpdatedAt).getTime())
    )
  ) {
    throw new PublicSiteStoreError(
      'Read the current site copy revision before publishing this block.',
      400,
    );
  }

  const { data, error } = await supabase.rpc('cardforge_publish_site_content_block', {
    p_slug: normalized.value.slug,
    p_body: normalized.value.body,
    p_expected_updated_at: expectedUpdatedAt,
  });

  if (error) {
    if (error.message?.includes('site_content_conflict')) {
      throw new PublicSiteStoreError(
        'This site copy changed after it was read. Reload the current Owner state, review the newer copy, and publish again.',
        409,
      );
    }
    if (error.message?.includes('site_content_not_found')) {
      throw new PublicSiteStoreError('This site copy block no longer exists.', 404);
    }
    if (error.message?.includes('invalid_site_content_block')) {
      throw new PublicSiteStoreError('Site copy is incomplete or invalid.', 400);
    }
    console.error('Failed to publish public site content revision:', error);
    throw new PublicSiteStoreError('Unable to publish public site content.');
  }

  const row = Array.isArray(data) ? data[0] as SiteContentBlockRow | undefined : undefined;
  if (!row) {
    throw new PublicSiteStoreError(
      'The site copy publication completed without a readable committed revision. Reload Owner state before publishing again.',
      503,
    );
  }
  return mapSiteContentRow(row);
};
