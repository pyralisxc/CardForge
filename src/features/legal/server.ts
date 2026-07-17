export {
  getLegalDocuments,
  getPublishedLegalDocument,
  LegalDocumentStoreError,
  publishLegalDocument,
  type LegalDocumentStoreClient,
  type LegalDocumentStoreDependencies,
} from './server/legalDocumentStore';
export {
  getCachedPublishedLegalDocument,
  legalDocumentTag,
  revalidateLegalDocumentCache,
} from './server/publicLegalCache';
