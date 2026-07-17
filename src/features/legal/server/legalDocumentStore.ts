import {
  DEFAULT_LEGAL_DOCUMENTS,
  getDefaultLegalDocument,
  normalizeLegalDocumentInput,
  type LegalDocument,
  type LegalDocumentSlug,
} from '@/features/legal/model/legalDocument';
import { getBusinessIdentity } from '@/features/business-identity/server';
import type { BusinessIdentity } from '@/features/business-identity/client';
import { isMissingSupabaseTableError } from '@/infrastructure/database/supabaseErrors';
import {
  getSupabaseServerClient,
  getSupabaseServerConfigStatus,
} from '@/infrastructure/database/supabaseServer';

const LEGAL_DOCUMENT_COLUMNS =
  'slug,version,title,body,effective_date,published_at,business_identity_version';

type LegalDocumentRow = {
  slug: LegalDocumentSlug;
  version: number;
  title: string;
  body: string;
  effective_date: string;
  published_at: string;
  business_identity_version: number;
};

type StoreResult = { data: unknown; error: unknown };

interface LegalDocumentReadOrder {
  order: (
    column: string,
    options: { ascending: boolean },
  ) => PromiseLike<StoreResult>;
}

interface LegalDocumentReadTable {
  select: (columns: string) => {
    order: (
      column: string,
      options: { ascending: boolean },
    ) => LegalDocumentReadOrder;
  };
}

export interface LegalDocumentStoreClient {
  from: (table: string) => LegalDocumentReadTable;
  rpc: (
    name: string,
    parameters: Record<string, unknown>,
  ) => PromiseLike<StoreResult>;
}

export interface LegalDocumentStoreDependencies {
  configured?: boolean;
  client?: LegalDocumentStoreClient | null;
}

export class LegalDocumentStoreError extends Error {
  override readonly name = 'LegalDocumentStoreError';

  constructor(message: string, public readonly status = 500) {
    super(message);
  }
}

const resolveDependencies = (
  dependencies: LegalDocumentStoreDependencies,
): { configured: boolean; client: LegalDocumentStoreClient | null } => ({
  configured: dependencies.configured ?? getSupabaseServerConfigStatus().configured,
  client: dependencies.client === undefined
    ? getSupabaseServerClient() as unknown as LegalDocumentStoreClient | null
    : dependencies.client,
});

const mapLegalDocumentRow = (row: LegalDocumentRow): LegalDocument => ({
  slug: row.slug,
  version: row.version,
  title: row.title,
  body: row.body,
  effectiveDate: row.effective_date,
  publishedAt: row.published_at,
  businessIdentityVersion: row.business_identity_version,
});

const isMissingLegalStorageError = (error: unknown): boolean => {
  if (isMissingSupabaseTableError(error)) return true;
  if (typeof error !== 'object' || error === null || !('code' in error)) return false;
  return ['PGRST202', '42P01', '42883'].includes(String((error as { code?: unknown }).code));
};

const isIdentityVersionConflict = (error: unknown): boolean => (
  typeof error === 'object'
  && error !== null
  && 'message' in error
  && String((error as { message?: unknown }).message).includes(
    'cardforge_business_identity_version_conflict',
  )
);

export const getLegalDocuments = async (
  dependencies: LegalDocumentStoreDependencies = {},
): Promise<LegalDocument[]> => {
  const { configured, client } = resolveDependencies(dependencies);
  if (!configured || !client) return DEFAULT_LEGAL_DOCUMENTS;

  const { data, error } = await client
    .from('cardforge_legal_documents')
    .select(LEGAL_DOCUMENT_COLUMNS)
    .order('slug', { ascending: true })
    .order('version', { ascending: false });

  if (error) {
    if (!isMissingLegalStorageError(error)) console.error('Failed to load legal documents:', error);
    return DEFAULT_LEGAL_DOCUMENTS;
  }

  const rows = Array.isArray(data) ? data as LegalDocumentRow[] : [];
  return DEFAULT_LEGAL_DOCUMENTS.map((defaultDocument) => {
    const latest = rows.find((candidate) => candidate.slug === defaultDocument.slug);
    return latest ? mapLegalDocumentRow(latest) : defaultDocument;
  });
};

export const getPublishedLegalDocument = async (
  slug: LegalDocumentSlug,
): Promise<{ businessIdentity: BusinessIdentity; document: LegalDocument }> => {
  const [businessIdentity, documents] = await Promise.all([
    getBusinessIdentity(),
    getLegalDocuments(),
  ]);
  return {
    businessIdentity,
    document: documents.find((document) => document.slug === slug) ?? getDefaultLegalDocument(slug),
  };
};

export const publishLegalDocument = async (
  input: {
    slug?: unknown;
    title?: unknown;
    body?: unknown;
    effectiveDate?: unknown;
    expectedBusinessIdentityVersion?: unknown;
  },
  dependencies: LegalDocumentStoreDependencies = {},
): Promise<LegalDocument[]> => {
  const normalized = normalizeLegalDocumentInput(input);
  if (!normalized.ok) throw new LegalDocumentStoreError(normalized.message, 400);

  const { configured, client } = resolveDependencies(dependencies);
  if (!configured || !client) {
    throw new LegalDocumentStoreError('Legal document database is not configured yet.', 503);
  }

  const { data, error } = await client.rpc('publish_cardforge_legal_document', {
    p_slug: normalized.value.slug,
    p_title: normalized.value.title,
    p_body: normalized.value.body,
    p_effective_date: normalized.value.effectiveDate,
    p_expected_identity_version: normalized.value.expectedBusinessIdentityVersion,
  });

  if (error) {
    if (isIdentityVersionConflict(error)) {
      throw new LegalDocumentStoreError(
        'Business identity changed since this legal page was loaded. Refresh and publish again.',
        409,
      );
    }
    if (isMissingLegalStorageError(error)) {
      throw new LegalDocumentStoreError(
        'Legal publication storage is not ready. Apply the prepared database migration first.',
        503,
      );
    }
    console.error('Failed to publish legal document:', error);
    throw new LegalDocumentStoreError('Unable to publish legal document.');
  }

  const published = (Array.isArray(data) ? data[0] : data) as LegalDocumentRow | null | undefined;
  if (!published) throw new LegalDocumentStoreError('Legal publication returned no result.');

  return getLegalDocuments({ configured, client });
};
