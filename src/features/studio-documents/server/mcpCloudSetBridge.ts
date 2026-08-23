import { createHash } from 'node:crypto';

import type { DeveloperCockpitAccess } from '@/features/developer-access/server';
import {
  getCachedCardForgeStudioBootstrap,
  type RegistryViewerAccess,
} from '@/features/developer-assets/server';
import {
  CloudSetStoreError,
  createCardSetTransfer,
  createProjectDocumentFromState,
  CUSTOM_DIVIDER_ASSETS_STORAGE_KEY,
  CUSTOM_ICON_ASSETS_STORAGE_KEY,
  CUSTOM_IMAGE_ASSETS_STORAGE_KEY,
  CUSTOM_TEXTURE_ASSETS_STORAGE_KEY,
  deleteCloudSet,
  getCloudSet,
  getCloudSetAssetIdFromReference,
  getCloudSetAssetReference,
  prepareCloudSetUploads,
  saveCloudSet,
  type CardForgeTransferV1,
  type CloudSetAssetDescriptor,
  type CloudSetDownloadAsset,
  type CloudSetSummary,
} from '@/features/project/server';
import {
  getStudioDocumentAssetIdFromReference,
  replaceStudioDocumentAssetReferences,
} from '../assetReferences';
import { StudioDocumentStoreError } from './StudioDocumentStoreError';
import { getStudioDocumentRetentionHours } from './studioDocumentAccess';
import { getStudioDocumentAssetDownloads } from './studioDocumentAssetStore';
import {
  createStudioDocument,
  getStudioDocument,
} from './studioDocumentStore';

const registryAccessFor = (access: DeveloperCockpitAccess): RegistryViewerAccess => {
  if (access.isOwner || access.isDeveloper || access.entitlement.accessMode === 'dev') return 'dev';
  return access.entitlement.accessMode === 'paid' ? 'paid' : 'free';
};

const replaceCloudAssetReferences = (value: unknown, replacements: ReadonlyMap<string, string>): unknown => {
  if (typeof value === 'string') {
    const id = getCloudSetAssetIdFromReference(value);
    return id ? replacements.get(id) ?? value : value;
  }
  if (Array.isArray(value)) return value.map((entry) => replaceCloudAssetReferences(entry, replacements));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => (
      [key, replaceCloudAssetReferences(entry, replacements)]
    )));
  }
  return value;
};

const downloadCloudAssetsAsDataUris = async (assets: CloudSetDownloadAsset[]) => {
  const replacements = new Map<string, string>();
  for (const asset of assets) {
    const response = await fetch(asset.signedUrl, { cache: 'no-store' });
    if (!response.ok) throw new CloudSetStoreError('CardForge could not read one of this cloud Set’s private artwork files.', 503);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length !== asset.size) {
      throw new CloudSetStoreError('One of this cloud Set’s private artwork files changed unexpectedly. Reload the cloud Set and retry.', 409);
    }
    replacements.set(asset.id, `data:${asset.mimeType};base64,${bytes.toString('base64')}`);
  }
  return replacements;
};

const requiredTemplateIds = (transfer: CardForgeTransferV1): Set<string> => {
  const ids = new Set<string>();
  transfer.sets.forEach((set) => {
    if (set.frontTemplateId) ids.add(set.frontTemplateId);
    if (set.backingTemplateId) ids.add(set.backingTemplateId);
  });
  transfer.cards.forEach((card) => {
    if (card.templateId) ids.add(card.templateId);
    if (card.backingTemplateId) ids.add(card.backingTemplateId);
  });
  return ids;
};

const resolveWorkingTemplates = async (
  access: DeveloperCockpitAccess,
  transfer: CardForgeTransferV1,
) => {
  const needed = requiredTemplateIds(transfer);
  const catalog = await getCachedCardForgeStudioBootstrap(registryAccessFor(access));
  const byId = new Map<string, typeof transfer.templates[number]>();
  catalog.templates.defaults.forEach((template) => {
    if (template.id && needed.has(template.id)) byId.set(template.id, template);
  });
  transfer.templates.forEach((template) => {
    if (template.id) byId.set(template.id, template);
  });
  const missing = [...needed].filter((id) => !byId.has(id));
  if (missing.length > 0) {
    throw new CloudSetStoreError(
      `This cloud Set references Template${missing.length === 1 ? '' : 's'} that are not available to the current account: ${missing.slice(0, 5).join(', ')}.`,
      409,
    );
  }
  return [...byId.values()];
};

export const checkoutCloudSetForAgent = async ({
  access,
  setId,
  expectedCloudRevision,
}: {
  access: DeveloperCockpitAccess;
  setId: string;
  expectedCloudRevision?: number | null;
}) => {
  if (!access.entitlement.isSignedIn || !access.entitlement.accountUserId) {
    throw new CloudSetStoreError('A linked CardForge account is required to edit cloud Sets.', 401);
  }
  const cloud = await getCloudSet(access.entitlement.accountUserId, setId);
  if (expectedCloudRevision !== undefined && expectedCloudRevision !== null && cloud.summary.revision !== expectedCloudRevision) {
    throw new CloudSetStoreError(
      `This cloud Set is revision ${cloud.summary.revision}, not ${expectedCloudRevision}. Reload it before starting an editable agent checkout.`,
      409,
    );
  }
  const replacements = await downloadCloudAssetsAsDataUris(cloud.assets);
  const hydrated = replaceCloudAssetReferences(cloud.payload, replacements) as CardForgeTransferV1;
  const templates = await resolveWorkingTemplates(access, hydrated);
  const set = hydrated.sets.find((candidate) => candidate.id === setId) ?? hydrated.sets[0];
  if (!set) throw new CloudSetStoreError('The cloud Set payload no longer contains its Set record.', 409);
  const customAssets = hydrated.customAssets;
  const projectDocument = createProjectDocumentFromState({
    userTemplates: templates,
    cardSets: hydrated.sets,
    activeCardSetId: set.id,
    storedCards: hydrated.cards,
    appearanceStyles: [],
    customTextureAssets: customAssets[CUSTOM_TEXTURE_ASSETS_STORAGE_KEY],
    customDividerAssets: customAssets[CUSTOM_DIVIDER_ASSETS_STORAGE_KEY],
    customIconAssets: customAssets[CUSTOM_ICON_ASSETS_STORAGE_KEY],
    customImageAssets: customAssets[CUSTOM_IMAGE_ASSETS_STORAGE_KEY],
  });
  const workingDocument = await createStudioDocument({
    ownerUserId: access.user.id,
    title: `${cloud.summary.name} · agent working copy`,
    creationSource: 'gpt',
    document: projectDocument,
    retentionHours: await getStudioDocumentRetentionHours(access.entitlement),
    sourceCloudSetId: set.id,
    sourceCloudRevision: cloud.summary.revision,
  });
  return {
    cloud: cloud.summary,
    workingDocument,
    set,
  };
};

interface PreparedWorkingAsset {
  descriptor: CloudSetAssetDescriptor;
  bytes: Buffer;
}

const prepareWorkingSetForCloud = async ({
  ownerUserId,
  documentId,
  transfer,
}: {
  ownerUserId: string;
  documentId: string;
  transfer: CardForgeTransferV1;
}): Promise<{ payload: CardForgeTransferV1; assets: PreparedWorkingAsset[] }> => {
  const downloads = await getStudioDocumentAssetDownloads({ ownerUserId, documentId, value: transfer });
  const replacements = new Map<string, string>();
  const assets: PreparedWorkingAsset[] = [];
  for (const download of downloads) {
    const response = await fetch(download.signedUrl, { cache: 'no-store' });
    if (!response.ok) throw new StudioDocumentStoreError('CardForge could not read one of the agent working document’s private artwork files.', 503);
    const bytes = Buffer.from(await response.arrayBuffer());
    const digest = createHash('sha256').update(bytes).digest('hex');
    if (digest !== download.id || getStudioDocumentAssetIdFromReference(`cardforge-studio-asset://${download.id}`) !== download.id) {
      throw new StudioDocumentStoreError('Private agent artwork failed its content-addressed integrity check.', 409);
    }
    replacements.set(download.id, getCloudSetAssetReference(download.id));
    assets.push({
      descriptor: { id: download.id, mimeType: 'image/webp', size: bytes.length },
      bytes,
    });
  }
  return {
    payload: replaceStudioDocumentAssetReferences(transfer, replacements) as CardForgeTransferV1,
    assets,
  };
};

const uploadPreparedAssets = async (
  uploads: Array<{ id: string; signedUrl: string }>,
  assets: PreparedWorkingAsset[],
) => {
  const byId = new Map(assets.map((asset) => [asset.descriptor.id, asset]));
  for (const upload of uploads) {
    const asset = byId.get(upload.id);
    if (!asset) throw new CloudSetStoreError('CardForge lost track of a private artwork file while committing the cloud Set.', 500);
    const form = new FormData();
    form.append('cacheControl', '3600');
    form.append('', new Blob([new Uint8Array(asset.bytes)], { type: asset.descriptor.mimeType }));
    const response = await fetch(upload.signedUrl, {
      method: 'PUT',
      headers: { 'x-upsert': 'true' },
      body: form,
    });
    if (!response.ok) throw new CloudSetStoreError('One of the Set artwork files could not be committed to private cloud storage.', 503);
  }
};

export const commitAgentWorkingSetToCloud = async ({
  access,
  documentId,
  expectedDocumentRevision,
  setId,
  expectedCloudRevision,
}: {
  access: DeveloperCockpitAccess;
  documentId: string;
  expectedDocumentRevision: number;
  setId: string;
  expectedCloudRevision: number;
}): Promise<{ summary: CloudSetSummary; documentRevision: number }> => {
  if (!access.entitlement.isSignedIn || !access.entitlement.accountUserId) {
    throw new CloudSetStoreError('A linked CardForge account is required to update cloud Sets.', 401);
  }
  const document = await getStudioDocument(
    access.user.id,
    documentId,
    await getStudioDocumentRetentionHours(access.entitlement),
  );
  if (document.revision !== expectedDocumentRevision) {
    throw new StudioDocumentStoreError(
      `The agent working document is revision ${document.revision}, not ${expectedDocumentRevision}. Reload the working Set before committing it to cloud.`,
      409,
    );
  }
  if (document.sourceCloudSetId !== setId || document.sourceCloudRevision !== expectedCloudRevision) {
    throw new StudioDocumentStoreError(
      `This agent working document was checked out from ${document.sourceCloudSetId ?? 'no cloud Set'} revision ${document.sourceCloudRevision ?? 'none'}, not ${setId} revision ${expectedCloudRevision}. Check out the current cloud revision before committing so unrelated or stale working content cannot overwrite it.`,
      409,
    );
  }
  const set = document.document.cardSets.find((candidate) => candidate.id === setId);
  if (!set) throw new StudioDocumentStoreError('That Set is not part of this agent working document.', 404);
  const transfer = createCardSetTransfer({
    set,
    storedCards: document.document.storedCards,
    templates: document.document.userTemplates,
    customAssets: document.document.customAssets,
  });
  const prepared = await prepareWorkingSetForCloud({
    ownerUserId: access.user.id,
    documentId,
    transfer,
  });
  const descriptors = prepared.assets.map((asset) => asset.descriptor);
  const uploadPlan = await prepareCloudSetUploads({
    ownerUserId: access.entitlement.accountUserId,
    slotLimit: access.entitlement.capabilities.cloudSetLimit,
    setId: set.id,
    name: set.name,
    payload: prepared.payload,
    assets: descriptors,
  });
  await uploadPreparedAssets(uploadPlan.uploads, prepared.assets);
  const summary = await saveCloudSet({
    ownerUserId: access.entitlement.accountUserId,
    slotLimit: access.entitlement.capabilities.cloudSetLimit,
    setId: set.id,
    name: set.name,
    payload: prepared.payload,
    assets: descriptors,
    expectedRevision: expectedCloudRevision,
  });
  return { summary, documentRevision: document.revision };
};

export const deleteCloudSetForAgent = async ({
  access,
  setId,
  expectedCloudRevision,
}: {
  access: DeveloperCockpitAccess;
  setId: string;
  expectedCloudRevision: number;
}) => {
  if (!access.entitlement.isSignedIn || !access.entitlement.accountUserId) {
    throw new CloudSetStoreError('A linked CardForge account is required to remove cloud Sets.', 401);
  }
  const current = await getCloudSet(access.entitlement.accountUserId, setId);
  if (current.summary.revision !== expectedCloudRevision) {
    throw new CloudSetStoreError(
      `This cloud Set is revision ${current.summary.revision}, not ${expectedCloudRevision}. Reload it before deleting the cloud save.`,
      409,
    );
  }
  await deleteCloudSet(access.entitlement.accountUserId, setId, expectedCloudRevision);
  return current.summary;
};
