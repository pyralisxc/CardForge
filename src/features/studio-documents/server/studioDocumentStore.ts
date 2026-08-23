import { randomUUID } from 'node:crypto';

import type { ProjectDocumentV1 } from '@/features/project/server';
import {
  normalizeStudioDocumentPayload,
  type StudioDocument,
  type StudioDocumentInstallSummary,
  type StudioDocumentSource,
  type StudioDocumentSummary,
} from '@/features/studio-documents/model';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';

import { StudioDocumentStoreError } from './StudioDocumentStoreError';
import {
  cleanupUploadedStudioDocumentAssets,
  externalizeStudioDocumentAssets,
  removeStudioDocumentAssets,
} from './studioDocumentAssetStore';

interface StudioDocumentRow {
  id: string;
  title: string;
  creation_source: StudioDocumentSource;
  document_payload: unknown;
  revision: number;
  created_at: string;
  updated_at: string;
  last_activity_at: string;
  expires_at: string;
  retention_hours: number;
  deleted_at: string | null;
  purge_after: string | null;
  last_installed_revision: number | null;
  last_installed_at: string | null;
  last_install_summary: unknown;
  source_cloud_set_id: string | null;
  source_cloud_revision: number | null;
}

const SUMMARY_COLUMNS = 'id,title,creation_source,revision,created_at,updated_at,last_activity_at,expires_at,retention_hours,deleted_at,purge_after,last_installed_revision,last_installed_at,last_install_summary,source_cloud_set_id,source_cloud_revision';
const DOCUMENT_COLUMNS = `${SUMMARY_COLUMNS},document_payload`;

const readInstallSummary = (value: unknown): StudioDocumentInstallSummary | null => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as StudioDocumentInstallSummary
    : null
);

const toSummary = (row: Omit<StudioDocumentRow, 'document_payload'>): StudioDocumentSummary => ({
  id: row.id,
  title: row.title,
  creationSource: row.creation_source,
  revision: row.revision,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  lastActivityAt: row.last_activity_at,
  expiresAt: row.expires_at,
  retentionHours: row.retention_hours,
  deletedAt: row.deleted_at,
  purgeAfter: row.purge_after,
  lastInstalledRevision: row.last_installed_revision,
  lastInstalledAt: row.last_installed_at,
  lastInstallSummary: readInstallSummary(row.last_install_summary),
  sourceCloudSetId: row.source_cloud_set_id,
  sourceCloudRevision: row.source_cloud_revision,
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

const applyRetentionPolicy = async (ownerUserId: string, retentionHours: number): Promise<void> => {
  const { error } = await requireStore().rpc('cardforge_apply_studio_document_retention', {
    p_owner_user_id: ownerUserId,
    p_retention_hours: retentionHours,
  });
  if (error) {
    console.error('Failed to apply Studio document retention:', error);
    throw new StudioDocumentStoreError('Unable to apply Studio document retention.');
  }
};

export const listStudioDocuments = async (
  ownerUserId: string,
  retentionHours: number,
): Promise<StudioDocumentSummary[]> => {
  await applyRetentionPolicy(ownerUserId, retentionHours);
  const { data, error } = await requireStore()
    .from('cardforge_studio_documents')
    .select(SUMMARY_COLUMNS)
    .eq('owner_user_id', ownerUserId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(100);
  if (error) {
    console.error('Failed to list Studio documents:', error);
    throw new StudioDocumentStoreError('Unable to list Studio documents.');
  }
  return (data ?? []).map((row) => toSummary(row as unknown as Omit<StudioDocumentRow, 'document_payload'>));
};

export const listDeletedStudioDocuments = async (
  ownerUserId: string,
): Promise<StudioDocumentSummary[]> => {
  const { data, error } = await requireStore()
    .from('cardforge_studio_documents')
    .select(SUMMARY_COLUMNS)
    .eq('owner_user_id', ownerUserId)
    .not('deleted_at', 'is', null)
    .gt('purge_after', new Date().toISOString())
    .order('deleted_at', { ascending: false })
    .limit(100);
  if (error) {
    console.error('Failed to list deleted Studio documents:', error);
    throw new StudioDocumentStoreError('Unable to list deleted Studio documents.');
  }
  return (data ?? []).map((row) => toSummary(row as unknown as Omit<StudioDocumentRow, 'document_payload'>));
};

export const getStudioDocument = async (
  ownerUserId: string,
  documentId: string,
  retentionHours?: number,
): Promise<StudioDocument> => {
  if (retentionHours) {
    const { data: touched, error: touchError } = await requireStore().rpc('cardforge_touch_studio_document', {
      p_owner_user_id: ownerUserId,
      p_document_id: documentId,
      p_retention_hours: retentionHours,
    });
    if (touchError) {
      console.error('Failed to refresh Studio document activity:', touchError);
      throw new StudioDocumentStoreError('Unable to refresh the Studio document.');
    }
    if (!touched) throw new StudioDocumentStoreError('Studio document not found or awaiting permanent deletion.', 404);
  }
  const { data, error } = await requireStore()
    .from('cardforge_studio_documents')
    .select(DOCUMENT_COLUMNS)
    .eq('id', documentId)
    .eq('owner_user_id', ownerUserId)
    .is('deleted_at', null)
    .gt('expires_at', new Date().toISOString())
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
  retentionHours,
  sourceCloudSetId = null,
  sourceCloudRevision = null,
}: {
  ownerUserId: string;
  title: string;
  creationSource: StudioDocumentSource;
  document: ProjectDocumentV1;
  retentionHours: number;
  sourceCloudSetId?: string | null;
  sourceCloudRevision?: number | null;
}): Promise<StudioDocument> => {
  if ((sourceCloudSetId === null) !== (sourceCloudRevision === null)) {
    throw new StudioDocumentStoreError('Cloud checkout lineage requires both a Set id and source revision.', 400);
  }
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
      retention_hours: retentionHours,
      last_activity_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + retentionHours * 60 * 60 * 1000).toISOString(),
      retention_grace_until: null,
      source_cloud_set_id: sourceCloudSetId,
      source_cloud_revision: sourceCloudRevision,
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
  retentionHours,
}: {
  ownerUserId: string;
  documentId: string;
  title: string;
  document: ProjectDocumentV1;
  expectedRevision: number;
  retentionHours: number;
}): Promise<StudioDocument> => {
  await applyRetentionPolicy(ownerUserId, retentionHours);
  const externalized = await externalizeStudioDocumentAssets({ ownerUserId, documentId, document });
  const { data, error } = await requireStore()
    .from('cardforge_studio_documents')
    .update({
      title,
      document_version: externalized.document.version,
      document_payload: externalized.document,
      revision: expectedRevision + 1,
      retention_hours: retentionHours,
      last_activity_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + retentionHours * 60 * 60 * 1000).toISOString(),
      retention_grace_until: null,
    })
    .eq('id', documentId)
    .eq('owner_user_id', ownerUserId)
    .eq('revision', expectedRevision)
    .is('deleted_at', null)
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
  return toDocument(data as unknown as StudioDocumentRow);
};

export const recordStudioDocumentInstallation = async ({
  ownerUserId,
  documentId,
  revision,
  summary,
}: {
  ownerUserId: string;
  documentId: string;
  revision: number;
  summary: StudioDocumentInstallSummary;
}): Promise<StudioDocumentSummary> => {
  const installedAt = new Date().toISOString();
  const { data, error } = await requireStore()
    .from('cardforge_studio_documents')
    .update({
      last_installed_revision: revision,
      last_installed_at: installedAt,
      last_install_summary: summary,
    })
    .eq('id', documentId)
    .eq('owner_user_id', ownerUserId)
    .eq('revision', revision)
    .eq('creation_source', 'gpt')
    .is('deleted_at', null)
    .select(SUMMARY_COLUMNS)
    .maybeSingle();
  if (error) {
    console.error('Failed to acknowledge Studio document installation:', error);
    throw new StudioDocumentStoreError('Unable to acknowledge the installed CardForge revision.');
  }
  if (!data) {
    throw new StudioDocumentStoreError(
      `CardForge could not acknowledge revision ${revision} because the agent working document has changed. Reopen and apply the latest revision instead.`,
      409,
    );
  }
  return toSummary(data as unknown as Omit<StudioDocumentRow, 'document_payload'>);
};

export const deleteStudioDocument = async (
  ownerUserId: string,
  documentId: string,
): Promise<void> => {
  const deletedAt = new Date();
  const { data, error } = await requireStore()
    .from('cardforge_studio_documents')
    .update({
      deleted_at: deletedAt.toISOString(),
      purge_after: new Date(deletedAt.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      purge_state: 'pending',
    })
    .eq('id', documentId)
    .eq('owner_user_id', ownerUserId)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();
  if (error) {
    console.error('Failed to move Studio document to trash:', error);
    throw new StudioDocumentStoreError('Unable to move the Studio document to recoverable trash.');
  }
  if (!data) throw new StudioDocumentStoreError('Studio document not found.', 404);
};

export const restoreStudioDocument = async (
  ownerUserId: string,
  documentId: string,
  retentionHours: number,
): Promise<StudioDocumentSummary> => {
  const now = new Date();
  const { data, error } = await requireStore()
    .from('cardforge_studio_documents')
    .update({
      deleted_at: null,
      purge_after: null,
      purge_state: null,
      purge_claimed_at: null,
      retention_hours: retentionHours,
      last_activity_at: now.toISOString(),
      expires_at: new Date(now.getTime() + retentionHours * 60 * 60 * 1000).toISOString(),
      retention_grace_until: null,
    })
    .eq('id', documentId)
    .eq('owner_user_id', ownerUserId)
    .not('deleted_at', 'is', null)
    .gt('purge_after', now.toISOString())
    .eq('purge_state', 'pending')
    .select(SUMMARY_COLUMNS)
    .maybeSingle();
  if (error) {
    console.error('Failed to restore Studio document:', error);
    throw new StudioDocumentStoreError('Unable to restore the Studio document.');
  }
  if (!data) throw new StudioDocumentStoreError('Studio document is no longer recoverable.', 404);
  return toSummary(data as unknown as Omit<StudioDocumentRow, 'document_payload'>);
};
