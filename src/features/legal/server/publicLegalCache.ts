import { revalidateTag, unstable_cache } from 'next/cache';

import { PUBLIC_IDENTITY_TAG } from '@/features/business-identity/server';
import {
  DEFAULT_LEGAL_DOCUMENTS,
  type LegalDocumentSlug,
} from '../model/legalDocument';
import { getPublishedLegalDocument } from './legalDocumentStore';

export const legalDocumentTag = (slug: LegalDocumentSlug): string =>
  `public:legal:${slug}`;

const readers = Object.fromEntries(
  DEFAULT_LEGAL_DOCUMENTS.map(({ slug }) => [
    slug,
    unstable_cache(
      () => getPublishedLegalDocument(slug),
      ['public-legal-document', slug],
      {
        tags: [legalDocumentTag(slug), PUBLIC_IDENTITY_TAG],
        revalidate: 3600,
      },
    ),
  ]),
) as Record<LegalDocumentSlug, () => ReturnType<typeof getPublishedLegalDocument>>;

export const getCachedPublishedLegalDocument = (slug: LegalDocumentSlug) => readers[slug]();

export const revalidateLegalDocumentCache = (slug: LegalDocumentSlug): void => {
  try {
    revalidateTag(legalDocumentTag(slug), { expire: 0 });
  } catch (error) {
    console.error(`Unable to invalidate ${slug} legal publication cache:`, error);
  }
};
