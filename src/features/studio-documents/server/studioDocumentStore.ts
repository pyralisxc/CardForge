import { randomUUID } from 'node:crypto';

import type { ProjectDocumentV1 } from '@/features/project/server';
import {
  normalizeStudioDocumentPayload,
  type StudioDocument,
  type StudioDocumentInstallSummary,
  type StudioDocumentProjectSourceProvider,
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
  source_project_provider: StudioDocumentProjectSourceProvider | null;
  source_project_external_id: string | null;
  source_provider_revision: string | null;
  source_project_revision: string | null;
  source_project_name: string | null;
}

const SUMMARY_COLUMNS = 'id,title,creation_source,revision,created_at,updated_at,last_activity_at,expires_at,retention_hours,deleted_at,purge_after,last_installed_revision,last_installed_at,last_install_summary,source_project_provider,source_project_external_id,source_provider_revision,source_project_revision,source_project_name';
const DOCUMENT_COLUMNS = `${SUMMARY_COLUMNS},document_payload`;
const STUDIO_DOCUMENT_LIST_LIMIT = 100;

export interface StudioDocumentListPage {
  documents: StudioDocumentSummary[];
  hasMore: boolean;
}

export interface StudioDocumentProjectSourceLineage {
  provider: StudioDocumentProjectSourceProvider;
  externalId: string;
  providerRevision: string;
  projectRevision: string;
  projectName: string;
}

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
  sourceProjectProvider: row.source_project_provider,
  sourceProjectExternalId: row.source_project_external_id,
  sourceProviderRevision: row.source_provider_revision,
  sourceProjectRevision: row.source_project_revision,
  sourceProjectName: row.source_project_name,
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

const validateProjectSourceLineage = (lineage: StudioDocumentProjectSourceLineage | null): void => {
  if (!lineage) return;
  if (!lineage.externalId.trim() || !lineage.providerRevision.trim() || !lineage.projectName.trim()) {
    throw new StudioDocumentStoreError('Project checkout lineage requires a source id, provider revision, and project name.', 400);
  }
  if (!/^[a-f0-9]{64}$/u.test(lineage.projectRevision)) {
    throw new StudioDocumentStoreError('Project checkout lineage requires an exact CardForge project revision.', 400);
  }
};

export const listStudioDocumentsPage = async (
  ownerUserId: string,
  retentionHours: number,
): Promise<StudioDocumentListPage> => {
  await applyRetentionPolicy(ownerUserId, retentionHours);
  const { data, error } = await requireStore()
    .from('cardforge_studio_documents')
    .select(SUMMARY_COLUMNS)
    .eq('owner_user_id', ownerUserId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(STUDIO_DOCUMENT_LIST_LIMIT + 1);
  if (error) {
    console.error('Failed to list Studio documents:', error);
    throw new StudioDocumentStoreError('Unable to list Studio documents.');
  }
  const rows = data ?? [];
  return {
    documents: rows
      .slice(0, STUDIO_DOCUMENT_LIST_LIMIT)
      .map((row) => toSummary(row as unknown as Omit<StudioDocumentRow, 'document_payload'>)),
    hasMore: rows.length > STUDIO_DOCUMENT_LIST_LIMIT,
  };
};

export const listStudioDocuments = async (
  ownerUserId: string,
  retentionHours: number,
): Promise<StudioDocumentSummary[]> => (
  await listStudioDocumentsPage(ownerUserId, retentionHours)
).documents;

export const listDeletedStudioDocumentsPage = async (
  ownerUserId: string,
): Promise<StudioDocumentListPage> => {
  const { data, error } = await requireStore()
    .from('cardforge_studio_documents')
    .select(SUMMARY_COLUMNS)
    .eq('owner_user_id', ownerUserId)
    .not('deleted_at', 'is', null)
    .gt('purge_after', new Date().toISOString())
    .order('deleted_at', { ascending: false })
    .limit(STUDIO_DOCUMENT_LIST_LIMIT + 1);
  if (error) {
    console.error('Failed to list deleted Studio documents:', error);
    throw new StudioDocumentStoreError('Unable to list deleted Studio documents.');
  }
  const rows = data ?? [];
  return {
    documents: rows
      .slice(0, STUDIO_DOCUMENT_LIST_LIMIT)
      .map((row) => toSummary(row as unknown as Omit<StudioDocumentRow, 'document_payload'>)),
    hasMore: rows.length > STUDIO_DOCUMENT_LIST_LIMIT,
  };
};

export const listDeletedStudioDocuments = async (
  ownerUserId: string,
): Promise<StudioDocumentSummary[]> => (
  await listDeletedStudioDocumentsPage(ownerUserId)
).documents;

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
  sourceProject = null,
}: {
  ownerUserId: string;
  title: string;
  creationSource: StudioDocumentSource;
  document: ProjectDocumentV1;
  retentionHours: number;
  sourceProject?: StudioDocumentProjectSourceLineage | null;
}): Promise<StudioDocument> => {
  validateProjectSourceLineage(sourceProject);
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
      source_project_provider: sourceProject?.provider ?? null,
      source_project_external_id: sourceProject?.externalId ?? null,
      source_provider_revision: sourceProject?.providerRevision ?? null,
      source_project_revision: sourceProject?.projectRevision ?? null,
      source_project_name: sourceProject?.projectName ?? null,
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

export const recordStudioDocumentProjectSourceCommit = async ({
  ownerUserId,
  documentId,
  expectedDocumentRevision,
  sourceProject,
  nextProviderRevision,
  nextProjectRevision,
  nextProjectName,
}: {
  ownerUserId: string;
  documentId: string;
  expectedDocumentRevision: number;
  sourceProject: StudioDocumentProjectSourceLineage;
  nextProviderRevision: string;
  nextProjectRevision: string;
  nextProjectName: string;
}): Promise<StudioDocumentSummary> => {
  validateProjectSourceLineage(sourceProject);
  validateProjectSourceLineage({
    ...sourceProject,
    providerRevision: nextProviderRevision,
    projectRevision: nextProjectRevision,
    projectName: nextProjectName,
  });
  const { data, error } = await requireStore()
    .from('cardforge_studio_documents')
    .update({
      source_provider_revision: nextProviderRevision,
      source_project_revision: nextProjectRevision,
      source_project_name: nextProjectName,
    })
    .eq('id', documentId)
    .eq('owner_user_id', ownerUserId)
    .eq('revision', expectedDocumentRevision)
    .eq('source_project_provider', sourceProject.provider)
    .eq('source_project_external_id', sourceProject.externalId)
    .eq('source_provider_revision', sourceProject.providerRevision)
    .eq('source_project_revision', sourceProject.projectRevision)
    .is('deleted_at', null)
    .select(SUMMARY_COLUMNS)
    .maybeSingle();
  if (error) {
    console.error('Failed to advance Studio project-source lineage:', error);
    throw new StudioDocumentStoreError('CardForge could not record the committed project source revision.', 503);
  }
  if (!data) {
    throw new StudioDocumentStoreError(
      'The working document or its project source changed while the commit was finishing. Reload the current working document before committing again.',
      409,
    );
  }
  return toSummary(data as unknown as Omit<StudioDocumentRow, 'document_payload'>);
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
