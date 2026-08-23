import { createHash } from 'node:crypto';

import type { DeveloperCockpitAccess } from '@/features/developer-access/server';
import {
  buildCardForgeProjectSnapshot,
  encodeCardForgeProjectPackage,
  getGoogleDriveProject,
  GOOGLE_DRIVE_PROJECT_PROVIDER,
  updateGoogleDriveProjectFromServer,
  type ProjectDocumentV1,
} from '@/features/project/server';
import { replaceStudioDocumentAssetReferences } from '../assetReferences';
import { StudioDocumentStoreError } from './StudioDocumentStoreError';
import { getStudioDocumentRetentionHours } from './studioDocumentAccess';
import { getStudioDocumentAssetDownloads } from './studioDocumentAssetStore';
import {
  createStudioDocument,
  getStudioDocument,
  recordStudioDocumentProjectSourceCommit,
  type StudioDocumentProjectSourceLineage,
} from './studioDocumentStore';

const requireAccountId = (access: DeveloperCockpitAccess): string => {
  if (!access.entitlement.isSignedIn || !access.entitlement.accountUserId) {
    throw new StudioDocumentStoreError('A linked CardForge account is required to use connected project storage.', 401);
  }
  return access.entitlement.accountUserId;
};

const assertExpectedSource = ({
  actualProviderRevision,
  actualProjectRevision,
  expectedProviderRevision,
  expectedProjectRevision,
}: {
  actualProviderRevision: string;
  actualProjectRevision: string;
  expectedProviderRevision?: string | null;
  expectedProjectRevision?: string | null;
}) => {
  if (expectedProviderRevision && actualProviderRevision !== expectedProviderRevision) {
    throw new StudioDocumentStoreError(
      `The connected project is provider revision ${actualProviderRevision}, not ${expectedProviderRevision}. Reload it before starting an editable checkout.`,
      409,
    );
  }
  if (expectedProjectRevision && actualProjectRevision !== expectedProjectRevision) {
    throw new StudioDocumentStoreError(
      'The connected CardForge project changed after the revision the agent read. Reload it before starting an editable checkout.',
      409,
    );
  }
};

export const checkoutConnectedProjectForAgent = async ({
  access,
  provider,
  projectId,
  expectedProviderRevision,
  expectedProjectRevision,
}: {
  access: DeveloperCockpitAccess;
  provider: typeof GOOGLE_DRIVE_PROJECT_PROVIDER;
  projectId: string;
  expectedProviderRevision?: string | null;
  expectedProjectRevision?: string | null;
}) => {
  const accountUserId = requireAccountId(access);
  if (provider !== GOOGLE_DRIVE_PROJECT_PROVIDER) {
    throw new StudioDocumentStoreError(`Connected project provider “${provider}” is not supported.`, 400);
  }
  const source = await getGoogleDriveProject({ ownerUserId: accountUserId, fileId: projectId });
  const projectRevision = source.summary.projectRevision;
  if (!projectRevision) {
    throw new StudioDocumentStoreError('The connected project is missing its exact CardForge project revision.', 409);
  }
  assertExpectedSource({
    actualProviderRevision: source.summary.providerRevision,
    actualProjectRevision: projectRevision,
    expectedProviderRevision,
    expectedProjectRevision,
  });
  const sourceProject: StudioDocumentProjectSourceLineage = {
    provider,
    externalId: source.summary.fileId,
    providerRevision: source.summary.providerRevision,
    projectRevision,
    projectName: source.summary.name,
  };
  const workingDocument = await createStudioDocument({
    ownerUserId: access.user.id,
    title: `${source.summary.name.replace(/\.cardforge$/iu, '')} · agent working copy`,
    creationSource: 'gpt',
    document: source.document,
    retentionHours: await getStudioDocumentRetentionHours(access.entitlement),
    sourceProject,
  });
  return { source: source.summary, workingDocument };
};

const materializeWorkingDocumentAssets = async ({
  ownerUserId,
  documentId,
  document,
}: {
  ownerUserId: string;
  documentId: string;
  document: ProjectDocumentV1;
}): Promise<ProjectDocumentV1> => {
  const downloads = await getStudioDocumentAssetDownloads({ ownerUserId, documentId, value: document });
  if (downloads.length === 0) return document;
  const replacements = new Map<string, string>();
  for (const download of downloads) {
    const response = await fetch(download.signedUrl, { cache: 'no-store' });
    if (!response.ok) {
      throw new StudioDocumentStoreError('CardForge could not read one of the agent working document’s private artwork files.', 503);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (download.size !== null && bytes.length !== download.size) {
      throw new StudioDocumentStoreError('Private agent artwork changed unexpectedly while preparing the project commit.', 409);
    }
    const digest = createHash('sha256').update(bytes).digest('hex');
    if (digest !== download.id) {
      throw new StudioDocumentStoreError('Private agent artwork failed its content-addressed integrity check.', 409);
    }
    replacements.set(download.id, `data:${download.mimeType};base64,${bytes.toString('base64')}`);
  }
  return replaceStudioDocumentAssetReferences(document, replacements) as ProjectDocumentV1;
};

export const commitAgentWorkingProjectToSource = async ({
  access,
  documentId,
  expectedDocumentRevision,
  provider,
  projectId,
  expectedProviderRevision,
  expectedProjectRevision,
}: {
  access: DeveloperCockpitAccess;
  documentId: string;
  expectedDocumentRevision: number;
  provider: typeof GOOGLE_DRIVE_PROJECT_PROVIDER;
  projectId: string;
  expectedProviderRevision: string;
  expectedProjectRevision: string;
}) => {
  const accountUserId = requireAccountId(access);
  if (provider !== GOOGLE_DRIVE_PROJECT_PROVIDER) {
    throw new StudioDocumentStoreError(`Connected project provider “${provider}” is not supported.`, 400);
  }
  const workingDocument = await getStudioDocument(
    access.user.id,
    documentId,
    await getStudioDocumentRetentionHours(access.entitlement),
  );
  if (workingDocument.revision !== expectedDocumentRevision) {
    throw new StudioDocumentStoreError(
      `The agent working document is revision ${workingDocument.revision}, not ${expectedDocumentRevision}. Reload it before committing.`,
      409,
    );
  }
  const sourceProject: StudioDocumentProjectSourceLineage = {
    provider,
    externalId: projectId,
    providerRevision: expectedProviderRevision,
    projectRevision: expectedProjectRevision,
    projectName: workingDocument.sourceProjectName ?? 'CardForge Project.cardforge',
  };
  if (
    workingDocument.sourceProjectProvider !== provider
    || workingDocument.sourceProjectExternalId !== projectId
    || workingDocument.sourceProviderRevision !== expectedProviderRevision
    || workingDocument.sourceProjectRevision !== expectedProjectRevision
  ) {
    throw new StudioDocumentStoreError(
      'This working document was not checked out from the exact connected project revisions supplied for commit. Reload the current source project before committing.',
      409,
    );
  }
  const hydratedDocument = await materializeWorkingDocumentAssets({
    ownerUserId: access.user.id,
    documentId,
    document: workingDocument.document,
  });
  const snapshot = await buildCardForgeProjectSnapshot({
    document: hydratedDocument,
    name: sourceProject.projectName,
  });
  const bytes = await encodeCardForgeProjectPackage(snapshot);
  const updated = await updateGoogleDriveProjectFromServer({
    ownerUserId: accountUserId,
    fileId: projectId,
    name: sourceProject.projectName,
    bytes,
    projectRevision: snapshot.manifest.projectRevision,
    expectedProviderRevision,
    expectedProjectRevision,
  });
  const nextProjectRevision = updated.projectRevision ?? snapshot.manifest.projectRevision;
  const lineage = await recordStudioDocumentProjectSourceCommit({
    ownerUserId: access.user.id,
    documentId,
    expectedDocumentRevision,
    sourceProject,
    nextProviderRevision: updated.providerRevision,
    nextProjectRevision,
    nextProjectName: updated.name,
  });
  return {
    documentId,
    documentRevision: workingDocument.revision,
    previousProviderRevision: expectedProviderRevision,
    previousProjectRevision: expectedProjectRevision,
    source: {
      ...updated,
      projectRevision: nextProjectRevision,
    },
    lineage,
  };
};
