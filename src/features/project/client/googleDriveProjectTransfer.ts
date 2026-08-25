"use client";

import { readApiError } from '@/infrastructure/http/clientResponses';
import {
  buildCardForgeProjectSnapshot,
  decodeProjectFile,
  encodeCardForgeProjectPackage,
  ProjectPackageError,
} from '../lib/projectPackageCodec';
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
import { getScopedProjectStorageNamespace } from '../persistence/projectPersistenceScope';
import {
  readStructuredBrowserValue,
  removeStructuredBrowserValue,
  writeStructuredBrowserValue,
} from '../persistence/structuredBrowserStorage';
import { applyProjectDocumentToWorkspace, captureCurrentProjectDocument } from './projectWorkspaceDocument';

const GOOGLE_DRIVE_BINDING_KEY = 'google-drive-project-binding';

export interface GoogleDriveProjectBinding {
  fileId: string;
  name: string;
  providerRevision: string;
  projectRevision: string;
  lastSavedAt: string;
  webViewLink: string | null;
}

const getBindingStorageKey = () => (
  `${getScopedProjectStorageNamespace('project-assets')}:${GOOGLE_DRIVE_BINDING_KEY}`
);

const persistBinding = async (binding: GoogleDriveProjectBinding): Promise<void> => {
  await writeStructuredBrowserValue(getBindingStorageKey(), binding);
};

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
  if (!response.ok) throw await readApiError(response, 'Unable to load Google Drive projects.');
  return await response.json() as GoogleDriveProjectListResult;
};

const createProjectPackage = async (name: string) => {
  const document = await captureCurrentProjectDocument();
  const snapshot = await buildCardForgeProjectSnapshot({ document, name });
  const encoded = await encodeCardForgeProjectPackage(snapshot);
  const bytes = new Uint8Array(encoded.byteLength);
  bytes.set(encoded);
  return { snapshot, bytes };
};

const prepareUpload = async ({
  name,
  size,
  projectRevision,
  binding,
}: {
  name: string;
  size: number;
  projectRevision: string;
  binding: GoogleDriveProjectBinding | null;
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
    }),
  });
  if (!response.ok) throw await readApiError(response, 'Unable to prepare the Google Drive project save.');
  return await response.json() as GoogleDriveUploadPrepareResult;
};

const uploadPackage = async (
  plan: GoogleDriveUploadPrepareResult,
  bytes: Uint8Array,
): Promise<GoogleDriveUploadCompletion> => {
  const uploadBytes = new Uint8Array(bytes.byteLength);
  uploadBytes.set(bytes);
  let response: Response;
  try {
    response = await fetch(plan.uploadSessionUrl, {
      method: 'PUT',
      headers: { 'Content-Type': GOOGLE_DRIVE_PROJECT_MIME_TYPE },
      body: uploadBytes.buffer,
    });
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
}: {
  completed: GoogleDriveUploadCompletion;
  projectRevision: string;
  fallbackName: string;
}): GoogleDriveProjectBinding => ({
  fileId: completed.id,
  name: completed.name || fallbackName,
  providerRevision: completed.version,
  projectRevision,
  lastSavedAt: completed.modifiedTime && !Number.isNaN(Date.parse(completed.modifiedTime))
    ? completed.modifiedTime
    : new Date().toISOString(),
  webViewLink: completed.webViewLink ?? null,
});

export const saveCurrentProjectToGoogleDrive = async ({
  name,
  asNew = false,
}: {
  name: string;
  asNew?: boolean;
}): Promise<GoogleDriveProjectBinding> => {
  const existing = asNew ? null : await getGoogleDriveProjectBinding();
  const { snapshot, bytes } = await createProjectPackage(name);
  const plan = await prepareUpload({
    name: snapshot.manifest.name,
    size: bytes.byteLength,
    projectRevision: snapshot.manifest.projectRevision,
    binding: existing,
  });
  const completed = await uploadPackage(plan, bytes);
  const binding = toBinding({
    completed,
    projectRevision: snapshot.manifest.projectRevision,
    fallbackName: plan.name,
  });
  await persistBinding(binding);
  return binding;
};

export const openGoogleDriveProject = async (
  summary: Pick<GoogleDriveProjectSummary, 'fileId' | 'name'>,
): Promise<GoogleDriveProjectBinding> => {
  const response = await fetch(`/api/project-sources/google-drive/${encodeURIComponent(summary.fileId)}`, { cache: 'no-store' });
  if (!response.ok) throw await readApiError(response, 'Unable to download the Google Drive project.');
  const providerRevision = response.headers.get('X-CardForge-Provider-Revision') ?? '';
  const projectRevision = response.headers.get('X-CardForge-Project-Revision') ?? '';
  const modifiedAt = response.headers.get('X-CardForge-Project-Modified-At') ?? new Date().toISOString();
  if (!isGoogleDriveProviderRevision(providerRevision) || !isProjectPackageAssetId(projectRevision)) {
    throw new ProjectPackageError('The Google Drive project response did not include valid source revisions.');
  }
  const blob = await response.blob();
  const file = new File([blob], summary.name, { type: GOOGLE_DRIVE_PROJECT_MIME_TYPE, lastModified: Date.parse(modifiedAt) || Date.now() });
  const decoded = await decodeProjectFile(file);
  if (decoded.format !== 'cardforge-package' || decoded.sourceRevision !== projectRevision) {
    throw new ProjectPackageError('The downloaded Google Drive project does not match its source revision.');
  }
  await applyProjectDocumentToWorkspace(decoded.document, 'replace');
  const binding: GoogleDriveProjectBinding = {
    fileId: summary.fileId,
    name: summary.name,
    providerRevision,
    projectRevision,
    lastSavedAt: modifiedAt,
    webViewLink: null,
  };
  await persistBinding(binding);
  return binding;
};

export const deleteGoogleDriveProjectFromLibrary = async (
  summary: GoogleDriveProjectSummary,
): Promise<void> => {
  if (!summary.projectRevision) throw new ProjectPackageError('Reload this Google Drive project before deleting it so CardForge has its exact revision.');
  const response = await fetch(`/api/project-sources/google-drive/${encodeURIComponent(summary.fileId)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      expectedProviderRevision: summary.providerRevision,
      expectedProjectRevision: summary.projectRevision,
    }),
  });
  if (!response.ok) throw await readApiError(response, 'Unable to delete the Google Drive project.');
  const binding = await getGoogleDriveProjectBinding();
  if (binding?.fileId === summary.fileId) await disconnectGoogleDriveProjectBinding();
};

export const disconnectGoogleDriveStorage = async (): Promise<void> => {
  const response = await fetch('/api/project-sources/google-drive', { method: 'DELETE' });
  if (!response.ok) throw await readApiError(response, 'Unable to disconnect Google Drive.');
  await disconnectGoogleDriveProjectBinding();
};
