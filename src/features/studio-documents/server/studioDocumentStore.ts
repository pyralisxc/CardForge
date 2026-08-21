import { randomUUID } from 'node:crypto';

import type { ProjectDocumentV1 } from '@/features/project/server';
import {
  normalizeStudioDocumentPayload,
  type StudioDocument,
  type StudioDocumentSource,
  type StudioDocumentSummary,
} from '@/features/studio-documents/model';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';

import { StudioDocumentStoreError } from './StudioDocumentStoreError';
import {
  cleanupUploadedStudioDocumentAssets,
  externalizeStudioDocumentAssets,
  removeStudioDocumentAssets,
  removeUnreferencedStudioDocumentAssets,
} from './studioDocumentAssetStore';

interface StudioDocumentRow {
  id: string;
  title: string;
  creation_source: StudioDocumentSource;
  document_payload: unknown;
  revision: number;
  created_at: string;
  updated_at: string;
}

const SUMMARY_COLUMNS = 'id,title,creation_source,revision,created_at,updated_at';
const DOCUMENT_COLUMNS = `${SUMMARY_COLUMNS},document_payload`;

const toSummary = (row: Omit<StudioDocumentRow, 'document_payload'>): StudioDocumentSummary => ({
  id: row.id,
  title: row.title,
  creationSource: row.creation_source,
  revision: row.revision,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toDocument = (row: StudioDocumentRow): StudioDocument => {
  const document = normalizeStudioDocumentPayload(row.document_payload);
  if (!document) {
    throw new StudioDocumentStoreError('The stored Studio document is invalid.', 500);
  }
  return { ...toSummary(row), document };
};

const requireStore = () => {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new StudioDocumentStoreError('Studio document storage is not configured yet.', 503);
  }
  return supabase;
};

export const listStudioDocuments = async (ownerUserId: string): Promise<StudioDocumentSummary[]> => {
  const { data, error } = await requireStore()
    .from('cardforge_studio_documents')
    .select(SUMMARY_COLUMNS)
    .eq('owner_user_id', ownerUserId)
    .order('updated_at', { ascending: false })
    .limit(100);
  if (error) {
    console.error('Failed to list Studio documents:', error);
    throw new StudioDocumentStoreError('Unable to list Studio documents.');
  }
  return (data ?? []).map((row) => toSummary(row as unknown as Omit<StudioDocumentRow, 'document_payload'>));
};

export const getStudioDocument = async (
  ownerUserId: string,
  documentId: string,
): Promise<StudioDocument> => {
  const { data, error } = await requireStore()
    .from('cardforge_studio_documents')
    .select(DOCUMENT_COLUMNS)
    .eq('id', documentId)
    .eq('owner_user_id', ownerUserId)
    .maybeSingle();
  if (error) {
    console.error('Failed to load Studio document:', error);
    throw new StudioDocumentStoreError('Unable to load the Studio document.');
  }
  if (!data) throw new StudioDocumentStoreError('Studio document not found.', 404);
  return toDocument(data as unknown as StudioDocumentRow);
};

export const createStudioDocument = async ({
  ownerUserId,
  title,
  creationSource,
  document,
}: {
  ownerUserId: string;
  title: string;
  creationSource: StudioDocumentSource;
  document: ProjectDocumentV1;
}): Promise<StudioDocument> => {
  const documentId = randomUUID();
  const externalized = await externalizeStudioDocumentAssets({ ownerUserId, documentId, document });
  const { data, error } = await requireStore()
    .from('cardforge_studio_documents')
    .insert({
      id: documentId,
      owner_user_id: ownerUserId,
      title,
      creation_source: creationSource,
      document_version: externalized.document.version,
      document_payload: externalized.document,
    })
    .select(DOCUMENT_COLUMNS)
    .single();
  if (error || !data) {
    try {
      await removeStudioDocumentAssets(ownerUserId, documentId);
    } catch (assetError) {
      console.error('Unable to clean artwork after a failed Studio document creation:', assetError);
    }
    console.error('Failed to create Studio document:', error);
    throw new StudioDocumentStoreError('Unable to create the Studio document.');
  }
  return toDocument(data as unknown as StudioDocumentRow);
};

export const updateStudioDocument = async ({
  ownerUserId,
  documentId,
  title,
  document,
  expectedRevision,
}: {
  ownerUserId: string;
  documentId: string;
  title: string;
  document: ProjectDocumentV1;
  expectedRevision: number;
}): Promise<StudioDocument> => {
  const externalized = await externalizeStudioDocumentAssets({ ownerUserId, documentId, document });
  const { data, error } = await requireStore()
    .from('cardforge_studio_documents')
    .update({
      title,
      document_version: externalized.document.version,
      document_payload: externalized.document,
      revision: expectedRevision + 1,
    })
    .eq('id', documentId)
    .eq('owner_user_id', ownerUserId)
    .eq('revision', expectedRevision)
    .select(DOCUMENT_COLUMNS)
    .maybeSingle();
  if (error) {
    await cleanupUploadedStudioDocumentAssets({
      ownerUserId,
      documentId,
      uploadedAssetIds: externalized.uploadedAssetIds,
    });
    console.error('Failed to update Studio document:', error);
    throw new StudioDocumentStoreError('Unable to update the Studio document.');
  }
  if (!data) {
    await cleanupUploadedStudioDocumentAssets({
      ownerUserId,
      documentId,
      uploadedAssetIds: externalized.uploadedAssetIds,
    });
    throw new StudioDocumentStoreError(
      `The CardForge working document changed after revision ${expectedRevision}. Reload the current design or card-generation contract, then retry with the new expectedRevision while reusing the same stable set and card ids.`,
      409,
    );
  }
  const updated = toDocument(data as unknown as StudioDocumentRow);
  await removeUnreferencedStudioDocumentAssets({ ownerUserId, documentId, document: updated.document });
  return updated;
};

export const deleteStudioDocument = async (
  ownerUserId: string,
  documentId: string,
): Promise<void> => {
  await getStudioDocument(ownerUserId, documentId);
  await removeStudioDocumentAssets(ownerUserId, documentId);
  const { data, error } = await requireStore()
    .from('cardforge_studio_documents')
    .delete()
    .eq('id', documentId)
    .eq('owner_user_id', ownerUserId)
    .select('id')
    .maybeSingle();
  if (error) {
    console.error('Failed to delete Studio document:', error);
    throw new StudioDocumentStoreError('Unable to delete the Studio document.');
  }
  if (!data) throw new StudioDocumentStoreError('Studio document not found.', 404);
};
