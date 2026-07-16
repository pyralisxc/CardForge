import {
  DEFAULT_LEGAL_DOCUMENTS,
  getDefaultLegalDocument,
  normalizeLegalDocumentInput,
  type LegalDocument,
  type LegalDocumentSlug,
} from '@/features/legal/model/legalDocument';
import { getSiteOperatorSettings } from '@/features/public-site/server';
import type { SiteOperatorSettings } from '@/features/public-site/client';
import { isMissingSupabaseTableError } from '@/infrastructure/database/supabaseErrors';
import {
  getSupabaseServerClient,
  getSupabaseServerConfigStatus,
} from '@/infrastructure/database/supabaseServer';

type LegalDocumentRow = {
  slug: LegalDocumentSlug;
  title: string;
  body: string;
  published_at: string | null;
};

export class LegalDocumentStoreError extends Error {
  constructor(message: string, public readonly status = 500) {
    super(message);
  }
}

const mapLegalDocumentRow = (row: LegalDocumentRow): LegalDocument => ({
  slug: row.slug,
  title: row.title,
  body: row.body,
  publishedAt: row.published_at,
});

export const getLegalDocuments = async (): Promise<LegalDocument[]> => {
  const supabase = getSupabaseServerClient();
  if (!getSupabaseServerConfigStatus().configured || !supabase) {
    return DEFAULT_LEGAL_DOCUMENTS;
  }

  const { data, error } = await supabase
    .from('cardforge_legal_documents')
    .select('slug,title,body,published_at')
    .order('slug', { ascending: true });

  if (error) {
    if (!isMissingSupabaseTableError(error)) {
      console.error('Failed to load legal documents:', error);
    }
    return DEFAULT_LEGAL_DOCUMENTS;
  }

  return DEFAULT_LEGAL_DOCUMENTS.map((defaultDocument) => {
    const row = (data ?? []).find((document) => document.slug === defaultDocument.slug) as LegalDocumentRow | undefined;
    return row ? mapLegalDocumentRow(row) : defaultDocument;
  });
};

export const getPublishedLegalDocument = async (
  slug: LegalDocumentSlug,
): Promise<{ settings: SiteOperatorSettings; document: LegalDocument }> => {
  const [settings, documents] = await Promise.all([
    getSiteOperatorSettings(),
    getLegalDocuments(),
  ]);
  return {
    settings,
    document: documents.find((document) => document.slug === slug) ?? getDefaultLegalDocument(slug),
  };
};

export const updateLegalDocument = async (
  input: { slug?: unknown; title?: unknown; body?: unknown },
): Promise<LegalDocument[]> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new LegalDocumentStoreError('Legal document database is not configured yet.', 503);

  const normalized = normalizeLegalDocumentInput(input);
  if (!normalized.ok) throw new LegalDocumentStoreError(normalized.message, 400);

  const { error } = await supabase.from('cardforge_legal_documents').upsert({
    slug: normalized.value.slug,
    title: normalized.value.title,
    body: normalized.value.body,
    published_at: new Date().toISOString(),
  }, { onConflict: 'slug' });

  if (error) {
    console.error('Failed to update legal document:', error);
    throw new LegalDocumentStoreError('Unable to update legal document.');
  }

  return getLegalDocuments();
};
