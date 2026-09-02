"use client";

import { readApiError } from '@/infrastructure/http/clientResponses';
import { trackProviderBoundaryOutcome } from '@/features/analytics/client/tracking';
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

const GOOGLE_DRIVE_BINDING_KEY = 'google-drive-project-binding';
const GOOGLE_DRIVE_WORK_BINDING_KEY = 'google-drive-work-binding';

export interface GoogleDriveProjectBinding {
  fileId: string;
  name: string;
  providerRevision: string;
  projectRevision: string;
  lastSavedAt: string;
  webViewLink: string | null;
  workId?: string | null;
}

const getBindingStorageKey = () => (
  `${getScopedProjectStorageNamespace('project-assets')}:${GOOGLE_DRIVE_BINDING_KEY}`
);

const persistBinding = async (binding: GoogleDriveProjectBinding): Promise<void> => {
  await writeStructuredBrowserValue(getBindingStorageKey(), binding);
};

const getWorkBindingStorageKey = (workId: string) => (
  `${getScopedProjectStorageNamespace('project-assets')}:${GOOGLE_DRIVE_WORK_BINDING_KEY}:${workId}`
);

const persistWorkBinding = async (workId: string, binding: GoogleDriveProjectBinding): Promise<void> => {
  await writeStructuredBrowserValue(getWorkBindingStorageKey(workId), { ...binding, workId });
};

export const getGoogleDriveWorkBinding = async (workId: string): Promise<GoogleDriveProjectBinding | null> => (
  readStructuredBrowserValue<GoogleDriveProjectBinding>(getWorkBindingStorageKey(workId)).catch(() => null)
);

export const getGoogleDriveProjectBinding = async (): Promise<GoogleDriveProjectBinding | null> => (
  readStructuredBrowserValue<GoogleDriveProjectBinding>(getBindingStorageKey()).catch(() => null)
);

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
  const response = await fetch('/api/project-sources/google-drive', { cache: 'no-store' });
  trackProviderBoundaryOutcome('google_drive', response);
  if (!response.ok) throw await readApiError(response, 'Unable to load Google Drive projects.');
  return await response.json() as GoogleDriveProjectListResult;
};

const createProjectPackage = async (name: string, workId?: string) => {
  const document = workId ? await captureCardSetProjectDocument(workId) : await captureCurrentProjectDocument();
  const snapshot = await buildBrowserCardForgeProjectSnapshot({ document, name });
  const blob = await createCardForgeProjectPackageBlob(snapshot);
  return { snapshot, blob };
};

const prepareUpload = async ({
  name,
  size,
  projectRevision,
  binding,
  workId,
}: {
  name: string;
  size: number;
  projectRevision: string;
  binding: GoogleDriveProjectBinding | null;
  workId?: string | null;
}): Promise<GoogleDriveUploadPrepareResult> => {
  const response = await fetch('/api/project-sources/google-drive/prepare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      size,
      projectRevision,
      fileId: binding?.fileId ?? null,
      expectedProviderRevision: binding?.providerRevision ?? null,
      expectedProjectRevision: binding?.projectRevision ?? null,
      workId: workId ?? null,
    }),
  });
  trackProviderBoundaryOutcome('google_drive', response);
  if (!response.ok) throw await readApiError(response, 'Unable to prepare the Google Drive project save.');
  return await response.json() as GoogleDriveUploadPrepareResult;
};

const uploadPackage = async (
  plan: GoogleDriveUploadPrepareResult,
  blob: Blob,
): Promise<GoogleDriveUploadCompletion> => {
  let response: Response;
  try {
    response = await fetch(plan.uploadSessionUrl, {
      method: 'PUT',
      headers: { 'Content-Type': GOOGLE_DRIVE_PROJECT_MIME_TYPE },
      body: blob,
    });
    trackProviderBoundaryOutcome('google_drive', response);
  } catch {
    throw new ProjectPackageError('Google Drive project upload is unavailable. Your browser project was left unchanged; retry when Drive is reachable.');
  }
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new ProjectPackageError(text ? `Google Drive did not accept the project upload. ${text.slice(0, 240)}` : 'Google Drive did not accept the project upload.');
  }
  const result = await response.json() as GoogleDriveUploadCompletion;
  if (!isGoogleDriveFileId(result.id) || !isGoogleDriveProviderRevision(result.version)) {
    throw new ProjectPackageError('Google Drive saved the project without usable file revision metadata.');
  }
  return result;
};

const toBinding = ({
  completed,
  projectRevision,
  fallbackName,
  workId,
}: {
  completed: GoogleDriveUploadCompletion;
  projectRevision: string;
  fallbackName: string;
  workId?: string | null;
}): GoogleDriveProjectBinding => ({
  fileId: completed.id,
  name: completed.name || fallbackName,
  providerRevision: completed.version,
  projectRevision,
  lastSavedAt: completed.modifiedTime && !Number.isNaN(Date.parse(completed.modifiedTime))
    ? completed.modifiedTime
    : new Date().toISOString(),
  webViewLink: completed.webViewLink ?? null,
  workId: workId ?? null,
});

export const saveCurrentProjectToGoogleDrive = async ({
  name,
  asNew = false,
}: {
  name: string;
  asNew?: boolean;
}): Promise<GoogleDriveProjectBinding> => {
  const existing = asNew ? null : await getGoogleDriveProjectBinding();
  const { snapshot, blob } = await createProjectPackage(name);
  const plan = await prepareUpload({
    name: snapshot.manifest.name,
    size: blob.size,
    projectRevision: snapshot.manifest.projectRevision,
    binding: existing,
    workId: null,
  });
  const completed = await uploadPackage(plan, blob);
  const binding = toBinding({
    completed,
    projectRevision: snapshot.manifest.projectRevision,
    fallbackName: plan.name,
    workId: null,
  });
  await persistBinding(binding);
  return binding;
};

export const saveCardSetToGoogleDrive = async ({
  setId,
  name,
  asNew = false,
}: {
  setId: string;
  name: string;
  asNew?: boolean;
}): Promise<GoogleDriveProjectBinding> => {
  const existing = asNew ? null : await getGoogleDriveWorkBinding(setId);
  const { snapshot, blob } = await createProjectPackage(name, setId);
  const plan = await prepareUpload({
    name: snapshot.manifest.name,
    size: blob.size,
    projectRevision: snapshot.manifest.projectRevision,
    binding: existing,
    workId: setId,
  });
  const completed = await uploadPackage(plan, blob);
  const binding = toBinding({
    completed,
    projectRevision: snapshot.manifest.projectRevision,
    fallbackName: plan.name,
    workId: setId,
  });
  await persistWorkBinding(setId, binding);
  return binding;
};

const downloadGoogleDriveProject = async (
  summary: Pick<GoogleDriveProjectSummary, 'fileId' | 'name'>,
) => {
  const response = await fetch(`/api/project-sources/google-drive/${encodeURIComponent(summary.fileId)}`, { cache: 'no-store' });
  trackProviderBoundaryOutcome('google_drive', response);
  if (!response.ok) throw await readApiError(response, 'Unable to download the Google Drive project.');
  const providerRevision = response.headers.get('X-CardForge-Provider-Revision') ?? '';
  const projectRevision = response.headers.get('X-CardForge-Project-Revision') ?? '';
  const modifiedAt = response.headers.get('X-CardForge-Project-Modified-At') ?? new Date().toISOString();
  if (!isGoogleDriveProviderRevision(providerRevision) || !isProjectPackageAssetId(projectRevision)) {
    throw new ProjectPackageError('The Google Drive project response did not include valid source revisions.');
  }
  const blob = await response.blob();
  const file = new File([blob], summary.name, { type: GOOGLE_DRIVE_PROJECT_MIME_TYPE, lastModified: Date.parse(modifiedAt) || Date.now() });
  const decoded = await decodeBrowserProjectFile(file);
  if (decoded.format !== 'cardforge-package' || decoded.sourceRevision !== projectRevision) {
    throw new ProjectPackageError('The downloaded Google Drive project does not match its source revision.');
  }
  return { decoded, providerRevision, projectRevision, modifiedAt };
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
});

export const openGoogleDriveProject = async (
  summary: Pick<GoogleDriveProjectSummary, 'fileId' | 'name'>,
): Promise<GoogleDriveProjectBinding> => {
  const { decoded, providerRevision, projectRevision, modifiedAt } = await downloadGoogleDriveProject(summary);
  await applyProjectDocumentToWorkspace(decoded.document, 'replace');
  const binding = downloadedBinding({
    summary,
    providerRevision,
    projectRevision,
    modifiedAt,
    workId: decoded.document.activeCardSetId ?? decoded.document.cardSets[0]?.id ?? null,
  });
  await persistBinding(binding);
  return binding;
};

export const copyGoogleDriveProjectToBrowser = async (
  summary: Pick<GoogleDriveProjectSummary, 'fileId' | 'name'>,
): Promise<GoogleDriveProjectBinding> => {
  const { decoded, providerRevision, projectRevision, modifiedAt } = await downloadGoogleDriveProject(summary);
  const existingIds = new Set(useProjectStore.getState().cardSets.map((set) => set.id));
  const collision = decoded.document.cardSets.find((set) => existingIds.has(set.id));
  if (collision) {
    throw new ProjectPackageError(`“${collision.name}” already exists on this device. Open the Drive copy to compare it before replacing local work.`);
  }
  await applyProjectDocumentToWorkspace(decoded.document, 'merge');
  const importedIds = decoded.document.cardSets.map((set) => set.id);
  const afterIds = new Set(useProjectStore.getState().cardSets.map((set) => set.id));
  if (!importedIds.every((id) => afterIds.has(id))) {
    throw new ProjectPackageError('CardForge could not verify the copied Set in this browser. The Drive source was left unchanged.');
  }
  const workId = decoded.document.activeCardSetId ?? decoded.document.cardSets[0]?.id ?? null;
  const binding = downloadedBinding({ summary, providerRevision, projectRevision, modifiedAt, workId });
  if (workId) await persistWorkBinding(workId, binding);
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
  const response = await fetch(`/api/project-sources/google-drive/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      expectedProviderRevision: providerRevision,
      expectedProjectRevision: projectRevision,
    }),
  });
  trackProviderBoundaryOutcome('google_drive', response);
  if (!response.ok) throw await readApiError(response, fallback);
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
  const binding = await getGoogleDriveProjectBinding();
  if (binding?.fileId === summary.fileId) await disconnectGoogleDriveProjectBinding();
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
  const response = await fetch('/api/project-sources/google-drive', { method: 'DELETE' });
  trackProviderBoundaryOutcome('google_drive', response);
  if (!response.ok) throw await readApiError(response, 'Unable to disconnect Google Drive.');
  await disconnectGoogleDriveProjectBinding();
};
