"use client";

import { readApiError } from '@/infrastructure/http/clientResponses';
import { observeProviderBoundaryResponse } from '@/features/analytics/client/tracking';
import {
  createCardForgeProjectPackageBlob,
  ProjectPackageError,
} from '../lib/projectPackageCodec';
import { buildBrowserCardForgeProjectSnapshot, decodeBrowserProjectFile } from './browserProjectPackage';
import {
  GOOGLE_DRIVE_PROJECT_MIME_TYPE,
  GOOGLE_DRIVE_PROJECT_PROVIDER,
  isGoogleDriveFileId,
  isGoogleDriveProviderRevision,
  createGoogleDriveProviderRevision,
  type GoogleDriveProjectListResult,
  type GoogleDriveProjectSummary,
  type GoogleDriveUploadCompletion,
  type GoogleDriveUploadPrepareResult,
} from '../model/googleDriveProject';
import { isProjectPackageAssetId, type ProjectSourceDescriptor } from '../model/projectPackage';
import { useProjectStore } from '../store/workspaceStore';
import { getScopedProjectStorageNamespace } from '../persistence/projectPersistenceScope';
import {
  readStructuredBrowserValue,
  removeStructuredBrowserValue,
  writeStructuredBrowserValue,
} from '../persistence/structuredBrowserStorage';
import { applyProjectDocumentToWorkspace, captureCardSetProjectDocument, captureCurrentProjectDocument } from './projectWorkspaceDocument';
import type { ProjectDocumentV1 } from '../model/projectDocument';
import { mapProjectDocumentIdentity, type ProjectDocumentIdentityMap } from '../model/projectDocumentIdentity';

const GOOGLE_DRIVE_BINDING_KEY = 'google-drive-project-binding';
const GOOGLE_DRIVE_WORK_BINDING_KEY = 'google-drive-work-binding';

const assertBindingScope = (namespace: string) => {
  if (getScopedProjectStorageNamespace('project-assets') !== namespace) {
    throw new ProjectPackageError('The browser account changed during the Drive action. Reload the correct account and check Drive before another save.');
  }
};

export interface GoogleDriveProjectBinding {
  accountId?: string;
  fileId: string;
  name: string;
  providerRevision: string;
  projectRevision: string;
  lastSavedAt: string;
  webViewLink: string | null;
  workId?: string | null;
  packageScope?: 'set' | 'workspace';
  portableWorkId?: string | null;
  identities?: ProjectDocumentIdentityMap;
  runtimeSetIds?: string[];
  /** Revision of the decoded browser representation at the last explicit save/open. */
  localProjectRevision?: string;
}

const findOpenDriveBinding = async (fileId: string, accountId: string): Promise<GoogleDriveProjectBinding | null> => {
  const bindings = await Promise.all(useProjectStore.getState().cardSets.map((set) => getGoogleDriveWorkBinding(set.id)));
  return bindings.find((binding) => binding?.fileId === fileId && binding.accountId === accountId) ?? null;
};

const getBindingStorageKey = (namespace = getScopedProjectStorageNamespace('project-assets')) => (
  `${namespace}:${GOOGLE_DRIVE_BINDING_KEY}`
);

const persistBinding = async (binding: GoogleDriveProjectBinding, namespace: string): Promise<void> => {
  assertBindingScope(namespace);
  await writeStructuredBrowserValue(getBindingStorageKey(namespace), binding.workId ? { workId: binding.workId } : binding);
};

const getWorkBindingStorageKey = (workId: string, namespace = getScopedProjectStorageNamespace('project-assets')) => (
  `${namespace}:${GOOGLE_DRIVE_WORK_BINDING_KEY}:${workId}`
);

const persistWorkBinding = async (workId: string, binding: GoogleDriveProjectBinding, namespace: string): Promise<void> => {
  assertBindingScope(namespace);
  await writeStructuredBrowserValue(getWorkBindingStorageKey(workId, namespace), { ...binding, workId });
};

const validateBinding = (binding: GoogleDriveProjectBinding | null): GoogleDriveProjectBinding | null => {
  if (binding && (!isGoogleDriveFileId(binding.fileId) || (!isGoogleDriveProviderRevision(binding.providerRevision) && !/^\d{1,80}$/.test(binding.providerRevision)) || !isProjectPackageAssetId(binding.projectRevision))) {
    throw new ProjectPackageError('The saved Set location is unreadable. Reopen the Drive file before saving.');
  }
  return binding;
};

export const getGoogleDriveWorkBinding = async (workId: string, namespace = getScopedProjectStorageNamespace('project-assets')): Promise<GoogleDriveProjectBinding | null> => (
  validateBinding(await readStructuredBrowserValue<GoogleDriveProjectBinding>(getWorkBindingStorageKey(workId, namespace)))
);

export const getGoogleDriveProjectBinding = async (): Promise<GoogleDriveProjectBinding | null> => {
  const namespace = getScopedProjectStorageNamespace('project-assets');
  const attached = await readStructuredBrowserValue<GoogleDriveProjectBinding | { workId: string }>(getBindingStorageKey(namespace));
  assertBindingScope(namespace);
  if (!attached?.workId) return validateBinding(attached as GoogleDriveProjectBinding | null);
  const binding = await getGoogleDriveWorkBinding(attached.workId, namespace);
  assertBindingScope(namespace);
  if (!binding) throw new ProjectPackageError('The attached Set location is unavailable. Reopen the provider file before saving; existing files were left unchanged.');
  return binding;
};

export const disconnectGoogleDriveProjectBinding = async (): Promise<void> => {
  await removeStructuredBrowserValue(getBindingStorageKey());
};

export const getGoogleDriveProjectSourceDescriptor = async (): Promise<ProjectSourceDescriptor> => {
  const binding = await getGoogleDriveProjectBinding();
  return {
    provider: binding ? GOOGLE_DRIVE_PROJECT_PROVIDER : 'browser',
    displayName: binding?.name ?? 'This browser',
    externalId: binding?.fileId ?? null,
    sourceRevision: binding?.projectRevision ?? null,
    lastSavedAt: binding?.lastSavedAt ?? null,
    serverReachable: Boolean(binding),
  };
};

export const loadGoogleDriveProjectLibrary = async (): Promise<GoogleDriveProjectListResult> => {
  const namespace = getScopedProjectStorageNamespace('project-assets');
  let cursor: string | null = null;
  let connection: GoogleDriveProjectListResult['connection'] | null = null;
  const projects: GoogleDriveProjectListResult['projects'] = [];
  const seenCursors = new Set<string>();
  do {
    const params = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    const response = await observeProviderBoundaryResponse('google_drive', 'project_list', () => (
      fetch(`/api/project-sources/google-drive${params}`, { cache: 'no-store' })
    ));
    if (!response.ok) throw await readApiError(response, 'Unable to load Google Drive projects.');
    const page = await response.json() as GoogleDriveProjectListResult;
    connection = page.connection;
    projects.push(...page.projects);
    const next = page.nextPageToken ?? null;
    if (!next || seenCursors.has(next)) {
      cursor = null;
    } else {
      seenCursors.add(next);
      cursor = next;
    }
  } while (cursor);
  if (!connection) throw new ProjectPackageError('Google Drive did not return a project-library connection state.');
  const bindings = await Promise.all(useProjectStore.getState().cardSets.map((set) => getGoogleDriveWorkBinding(set.id)));
  assertBindingScope(namespace);
  return { connection, projects: projects.map((project) => ({
    ...project,
    thumbnailLink: project.thumbnailLink ? `/api/project-sources/google-drive/${encodeURIComponent(project.fileId)}/thumbnail` : null,
    localWorkId: bindings.find((binding) => binding?.fileId === project.fileId
      && binding.accountId === project.accountId)?.workId ?? undefined,
  })), nextPageToken: null };
};

const createProjectPackage = async (name: string, workId?: string, identities?: ProjectDocumentIdentityMap) => {
  const namespace = getScopedProjectStorageNamespace('project-assets');
  const expectedState = useProjectStore.getState();
  const document = workId ? await captureCardSetProjectDocument(workId) : await captureCurrentProjectDocument();
  const localSnapshot = await buildBrowserCardForgeProjectSnapshot({ document, name });
  const snapshot = identities
    ? await buildBrowserCardForgeProjectSnapshot({ document: mapProjectDocumentIdentity(document, identities, 'save'), name })
    : localSnapshot;
  const blob = await createCardForgeProjectPackageBlob(snapshot);
  assertBindingScope(namespace);
  if (useProjectStore.getState() !== expectedState) throw new ProjectPackageError('The Set changed while preparing its Drive save. Retry with the current work.');
  return { document, snapshot, blob, localProjectRevision: localSnapshot.manifest.projectRevision };
};

const prepareUpload = async ({
  name,
  size,
  projectRevision,
  binding,
  workId,
  thumbnail,
}: {
  name: string;
  size: number;
  projectRevision: string;
  binding: GoogleDriveProjectBinding | null;
  workId?: string | null;
  thumbnail?: string | null;
}): Promise<GoogleDriveUploadPrepareResult> => {
  const response = await observeProviderBoundaryResponse('google_drive', 'project_prepare', () => fetch('/api/project-sources/google-drive/prepare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      size,
      projectRevision,
      thumbnail,
      fileId: binding?.fileId ?? null,
      expectedProviderRevision: binding?.providerRevision ?? null,
      expectedProjectRevision: binding?.projectRevision ?? null,
      expectedAccountId: binding?.accountId ?? null,
      workId: workId ?? null,
    }),
  }));
  if (!response.ok) throw await readApiError(response, 'Unable to prepare the Google Drive project save.');
  return await response.json() as GoogleDriveUploadPrepareResult;
};

const uploadPackage = async (
  plan: GoogleDriveUploadPrepareResult,
  blob: Blob,
): Promise<GoogleDriveUploadCompletion> => {
  let response: Response;
  try {
    response = await observeProviderBoundaryResponse('google_drive', 'project_upload', () => fetch(plan.uploadSessionUrl, {
      method: 'PUT',
      headers: { 'Content-Type': GOOGLE_DRIVE_PROJECT_MIME_TYPE },
      body: blob,
    }));
  } catch {
    throw new ProjectPackageError('The Drive upload response was lost and the file may have been saved. Browser work is unchanged. Reload Drive and check the file before another save; do not repeat this upload blindly.');
  }
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new ProjectPackageError(text ? `Google Drive did not accept the project upload. ${text.slice(0, 240)}` : 'Google Drive did not accept the project upload.');
  }
  let result: GoogleDriveUploadCompletion;
  try { result = await response.json() as GoogleDriveUploadCompletion; } catch {
    throw new ProjectPackageError('Drive may have saved the file, but its receipt was unreadable. Check the file’s current revision in Drive before another save; do not repeat this upload blindly.');
  }
  if (!result || typeof result !== 'object' || !isGoogleDriveFileId(result.id) || typeof result.headRevisionId !== 'string' || !result.headRevisionId.trim()) {
    throw new ProjectPackageError('Drive may have saved the file, but its receipt has no usable revision. Check the file’s current revision in Drive before another save; do not repeat this upload blindly.');
  }
  return result;
};

const toBinding = async ({
  completed,
  projectRevision,
  fallbackName,
  workId,
}: {
  completed: GoogleDriveUploadCompletion;
  projectRevision: string;
  fallbackName: string;
  workId?: string | null;
}): Promise<GoogleDriveProjectBinding> => ({
  fileId: completed.id,
  name: completed.name || fallbackName,
  providerRevision: await createGoogleDriveProviderRevision(completed.headRevisionId!),
  projectRevision,
  lastSavedAt: completed.modifiedTime && !Number.isNaN(Date.parse(completed.modifiedTime))
    ? completed.modifiedTime
    : new Date().toISOString(),
  webViewLink: completed.webViewLink ?? null,
  workId: workId ?? null,
  packageScope: workId ? 'set' : 'workspace',
});

export const saveCurrentProjectToGoogleDrive = async ({
  name,
  asNew = false,
  renderThumbnail,
}: {
  name: string;
  asNew?: boolean;
  renderThumbnail?: (document: ProjectDocumentV1) => Promise<string | null>;
}): Promise<GoogleDriveProjectBinding> => {
  const namespace = getScopedProjectStorageNamespace('project-assets');
  const existing = asNew ? null : await getGoogleDriveProjectBinding();
  assertBindingScope(namespace);
  if (existing?.workId) return await saveCardSetToGoogleDrive({ setId: existing.workId, name, renderThumbnail });
  if (existing && existing.packageScope !== 'workspace') {
    throw new ProjectPackageError('Reopen this Drive file before saving so CardForge can verify whether it contains one Set or a workspace backup. Existing files were left unchanged.');
  }
  if (existing?.runtimeSetIds) {
    throw new ProjectPackageError('This file contains multiple Sets. Save a new workspace backup or save each Set separately; the original Drive file was left unchanged.');
  }
  const { document, snapshot, blob } = await createProjectPackage(name);
  const thumbnail = await renderThumbnail?.(document) ?? null;
  assertBindingScope(namespace);
  const plan = await prepareUpload({
    name: snapshot.manifest.name,
    size: blob.size,
    projectRevision: snapshot.manifest.projectRevision,
    binding: existing,
    workId: null,
    thumbnail,
  });
  assertBindingScope(namespace);
  const completed = await uploadPackage(plan, blob);
  const binding = await toBinding({
    completed,
    projectRevision: snapshot.manifest.projectRevision,
    fallbackName: plan.name,
    workId: null,
  });
  assertBindingScope(namespace);
  await persistBinding(binding, namespace);
  return binding;
};

export const saveCardSetToGoogleDrive = async ({
  setId,
  name,
  asNew = false,
  renderThumbnail,
}: {
  setId: string;
  name: string;
  asNew?: boolean;
  renderThumbnail?: (document: ProjectDocumentV1) => Promise<string | null>;
}): Promise<GoogleDriveProjectBinding> => {
  const namespace = getScopedProjectStorageNamespace('project-assets');
  const existing = asNew ? null : await getGoogleDriveWorkBinding(setId);
  if (existing?.packageScope === 'workspace') {
    throw new ProjectPackageError('This Set came from a multi-Set workspace file. Use Save as new to create its own Drive document; the workspace file was left unchanged.');
  }
  // A first save keeps the existing local IDs as portable IDs. Record that
  // identity map while encoding so the saved document can refresh in place.
  const identities = structuredClone(existing?.identities ?? {});
  const { document, snapshot, blob, localProjectRevision } = await createProjectPackage(name, setId, identities);
  const thumbnail = await renderThumbnail?.(document) ?? null;
  assertBindingScope(namespace);
  const plan = await prepareUpload({
    name: snapshot.manifest.name,
    size: blob.size,
    projectRevision: snapshot.manifest.projectRevision,
    binding: existing,
    workId: existing?.portableWorkId ?? setId,
    thumbnail,
  });
  assertBindingScope(namespace);
  const completed = await uploadPackage(plan, blob);
  const binding = await toBinding({
    completed,
    projectRevision: snapshot.manifest.projectRevision,
    fallbackName: plan.name,
    workId: setId,
  });
  Object.assign(binding, {
    accountId: plan.accountId ?? existing?.accountId,
    portableWorkId: existing?.portableWorkId ?? setId,
    identities,
    runtimeSetIds: [setId],
    localProjectRevision,
  });
  assertBindingScope(namespace);
  await persistWorkBinding(setId, binding, namespace);
  await persistBinding(binding, namespace);
  return binding;
};

const downloadGoogleDriveProject = async (
  summary: Pick<GoogleDriveProjectSummary, 'fileId' | 'name' | 'accountId'>,
) => {
  const namespace = getScopedProjectStorageNamespace('project-assets');
  const response = await observeProviderBoundaryResponse('google_drive', 'project_download', () => (
    fetch(`/api/project-sources/google-drive/${encodeURIComponent(summary.fileId)}`, { cache: 'no-store' })
  ));
  if (!response.ok) throw await readApiError(response, 'Unable to download the Google Drive project.');
  const providerRevision = response.headers.get('X-CardForge-Provider-Revision') ?? '';
  const accountId = response.headers.get('X-CardForge-Provider-Account') ?? '';
  if (summary.accountId && accountId !== summary.accountId) {
    throw new ProjectPackageError('The connected Google account changed. Reload Drive before opening this document.');
  }
  const projectRevision = response.headers.get('X-CardForge-Project-Revision') ?? '';
  const modifiedAt = response.headers.get('X-CardForge-Project-Modified-At') ?? new Date().toISOString();
  if (!accountId || !isGoogleDriveProviderRevision(providerRevision) || !isProjectPackageAssetId(projectRevision)) {
    throw new ProjectPackageError('The Google Drive project response did not include valid source revisions.');
  }
  const blob = await response.blob();
  assertBindingScope(namespace);
  const file = new File([blob], summary.name, { type: GOOGLE_DRIVE_PROJECT_MIME_TYPE, lastModified: Date.parse(modifiedAt) || Date.now() });
  const decoded = await decodeBrowserProjectFile(file);
  assertBindingScope(namespace);
  if (decoded.format !== 'cardforge-package' || decoded.sourceRevision !== projectRevision) {
    throw new ProjectPackageError('The downloaded Google Drive project does not match its source revision.');
  }
  return { decoded, accountId, providerRevision, projectRevision, modifiedAt };
};

const downloadedBinding = ({
  summary,
  providerRevision,
  projectRevision,
  modifiedAt,
  workId = null,
}: {
  summary: Pick<GoogleDriveProjectSummary, 'fileId' | 'name'>;
  providerRevision: string;
  projectRevision: string;
  modifiedAt: string;
  workId?: string | null;
}): GoogleDriveProjectBinding => ({
  fileId: summary.fileId,
  name: summary.name,
  providerRevision,
  projectRevision,
  lastSavedAt: modifiedAt,
  webViewLink: null,
  workId,
  packageScope: workId ? 'set' : 'workspace',
});

export const openGoogleDriveProject = async (
  summary: Pick<GoogleDriveProjectSummary, 'fileId' | 'name' | 'accountId'>,
): Promise<GoogleDriveProjectBinding> => {
  const namespace = getScopedProjectStorageNamespace('project-assets');
  if (summary.accountId) {
    const existing = await findOpenDriveBinding(summary.fileId, summary.accountId);
    assertBindingScope(namespace);
    if (existing) return existing;
  }
  const expectedState = useProjectStore.getState();
  const { decoded, accountId, providerRevision, projectRevision, modifiedAt } = await downloadGoogleDriveProject(summary);
  assertBindingScope(namespace);
  const existing = await findOpenDriveBinding(summary.fileId, accountId);
  assertBindingScope(namespace);
  if (existing) return existing;
  if (decoded.document.cardSets.length === 0) {
    throw new ProjectPackageError('This Drive package has no Set to reopen. Use an independent browser copy to import its design resources. Browser work was left unchanged.');
  }
  const identities: ProjectDocumentIdentityMap = {};
  const document = mapProjectDocumentIdentity(decoded.document, identities, 'open');
  const binding = downloadedBinding({
    summary,
    providerRevision,
    projectRevision,
    modifiedAt,
    workId: document.activeCardSetId ?? document.cardSets[0]?.id ?? null,
  });
  Object.assign(binding, {
    accountId, identities,
    packageScope: document.cardSets.length === 1 ? 'set' : 'workspace',
    portableWorkId: decoded.document.cardSets.length === 1 ? decoded.document.cardSets[0]!.id : null,
    runtimeSetIds: document.cardSets.map((set) => set.id),
  });
  // Store the source identity before publishing the imported Set. If a later
  // binding update fails, reopening still finds the already materialized work.
  for (const set of document.cardSets) await persistWorkBinding(set.id, binding, namespace);
  assertBindingScope(namespace);
  await applyProjectDocumentToWorkspace(document, 'merge', { expectedState });
  assertBindingScope(namespace);
  if (binding.workId && document.cardSets.length === 1) {
    binding.localProjectRevision = (await createProjectPackage(binding.name, binding.workId)).localProjectRevision;
  }
  for (const set of document.cardSets) await persistWorkBinding(set.id, binding, namespace);
  await persistBinding(binding, namespace);
  return binding;
};

export const hasGoogleDriveWorkingChanges = async (binding: GoogleDriveProjectBinding): Promise<boolean> => {
  if (!binding.workId || !binding.localProjectRevision) return true;
  return (await createProjectPackage(binding.name, binding.workId)).localProjectRevision !== binding.localProjectRevision;
};

/** Explicit refresh only; ordinary Open always resumes recoverable browser work. */
export const refreshGoogleDriveProject = async (binding: GoogleDriveProjectBinding): Promise<GoogleDriveProjectBinding> => {
  const namespace = getScopedProjectStorageNamespace('project-assets');
  const expectedState = useProjectStore.getState();
  if (!binding.workId || binding.packageScope !== 'set' || !binding.identities || !binding.accountId) {
    throw new ProjectPackageError('This source cannot be safely refreshed in place. Preserve the browser work and open an independent copy to compare.');
  }
  if (await hasGoogleDriveWorkingChanges(binding)) {
    throw new ProjectPackageError('This Set has browser changes not saved to Drive. Save or make an editable backup before refreshing; neither copy was changed.');
  }
  const ownedSets = new Set(binding.runtimeSetIds ?? [binding.workId]);
  const sharedTemplates = new Set(Object.values(binding.identities.template ?? {}));
  if (expectedState.storedCards.some((card) => !ownedSets.has(card.setId ?? '')
    && (sharedTemplates.has(card.templateId) || Boolean(card.backingTemplateId && sharedTemplates.has(card.backingTemplateId))))) {
    throw new ProjectPackageError('This document’s design is also used by another browser Set. Open an independent copy to compare before refreshing shared design.');
  }
  const { decoded, accountId, providerRevision, projectRevision, modifiedAt } = await downloadGoogleDriveProject(binding);
  assertBindingScope(namespace);
  if (accountId !== binding.accountId || decoded.document.cardSets.length !== 1
    || decoded.document.cardSets[0]!.id !== binding.portableWorkId) {
    throw new ProjectPackageError('The remote document identity changed. Open an independent copy to compare; browser work was left unchanged.');
  }
  const identities = structuredClone(binding.identities);
  const document = mapProjectDocumentIdentity(decoded.document, identities, 'open');
  await applyProjectDocumentToWorkspace(document, 'merge', { expectedState, replaceSetIds: binding.runtimeSetIds ?? [binding.workId] });
  const next = { ...binding, identities, providerRevision, projectRevision, lastSavedAt: modifiedAt,
    localProjectRevision: (await createProjectPackage(binding.name, binding.workId)).localProjectRevision };
  assertBindingScope(namespace);
  await persistWorkBinding(binding.workId, next, namespace);
  await persistBinding(next, namespace);
  return next;
};

export const copyGoogleDriveProjectToBrowser = async (
  summary: Pick<GoogleDriveProjectSummary, 'fileId' | 'name'>,
): Promise<GoogleDriveProjectBinding> => {
  const namespace = getScopedProjectStorageNamespace('project-assets');
  const expectedState = useProjectStore.getState();
  const { decoded, providerRevision, projectRevision, modifiedAt } = await downloadGoogleDriveProject(summary);
  assertBindingScope(namespace);
  const imported = await applyProjectDocumentToWorkspace(decoded.document, 'copy', { expectedState });
  const workId = imported.activeSetId;
  const binding = downloadedBinding({ summary, providerRevision, projectRevision, modifiedAt, workId });
  // Intentional copy is independent. The returned source receipt is informational;
  // no attached/per-work binding can send later edits back to the original file.
  return binding;
};

const deleteGoogleDriveProjectRevision = async ({
  fileId,
  providerRevision,
  projectRevision,
  fallback,
}: {
  fileId: string;
  providerRevision: string;
  projectRevision: string;
  fallback: string;
}): Promise<void> => {
  const namespace = getScopedProjectStorageNamespace('project-assets');
  const attached = await getGoogleDriveProjectBinding();
  const workIds = new Set(useProjectStore.getState().cardSets.map((set) => set.id));
  if (attached?.workId) workIds.add(attached.workId);
  const bindings = await Promise.all([...workIds].map(async (workId) => ({
    workId,
    binding: await getGoogleDriveWorkBinding(workId, namespace),
  })));
  assertBindingScope(namespace);
  const response = await observeProviderBoundaryResponse('google_drive', 'project_delete', () => fetch(`/api/project-sources/google-drive/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      expectedProviderRevision: providerRevision,
      expectedProjectRevision: projectRevision,
    }),
  }));
  if (!response.ok) throw await readApiError(response, fallback);
  for (const entry of bindings) {
    if (entry.binding?.fileId === fileId) await removeStructuredBrowserValue(getWorkBindingStorageKey(entry.workId, namespace));
  }
  if (attached?.fileId === fileId) await removeStructuredBrowserValue(getBindingStorageKey(namespace));
};

export const deleteGoogleDriveProjectFromLibrary = async (
  summary: GoogleDriveProjectSummary,
): Promise<void> => {
  if (!summary.projectRevision) throw new ProjectPackageError('Reload this Google Drive project before deleting it so CardForge has its exact revision.');
  await deleteGoogleDriveProjectRevision({
    fileId: summary.fileId,
    providerRevision: summary.providerRevision,
    projectRevision: summary.projectRevision,
    fallback: 'Unable to delete the Google Drive project.',
  });
};

export const deleteGoogleDriveProjectCopy = async ({
  fileId,
  providerRevision,
  projectRevision,
}: {
  fileId: string;
  providerRevision: string;
  projectRevision: string;
}): Promise<void> => {
  await deleteGoogleDriveProjectRevision({ fileId, providerRevision, projectRevision, fallback: 'Unable to remove the Google Drive copy.' });
};

export const disconnectGoogleDriveStorage = async (): Promise<void> => {
  const namespace = getScopedProjectStorageNamespace('project-assets');
  const response = await observeProviderBoundaryResponse('google_drive', 'disconnect', () => (
    fetch('/api/project-sources/google-drive', { method: 'DELETE' })
  ));
  if (!response.ok) throw await readApiError(response, 'Unable to disconnect Google Drive.');
  await removeStructuredBrowserValue(getBindingStorageKey(namespace));
};
