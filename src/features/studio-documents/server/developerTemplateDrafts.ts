import { createHash, randomUUID } from 'node:crypto';

import type { TCGCardTemplate } from '@/domain/templates';
import {
  createNewSharedTemplateId,
  createTemplatePipelineDraft,
  isRepositoryTemplate,
} from '@/features/developer-assets/server';
import {
  requireContributionScope,
  type DeveloperCockpitAccess,
} from '@/features/developer-access/server';
import type { ProjectAssetBinding } from '@/features/project/server';
import {
  createProjectDocumentFromTemplateDraft,
  createTemplateFromTemplateDraft,
  type GptTemplateDraftInput,
} from '@/features/studio-documents/model';
import { replaceStudioDocumentAssetReferences } from '../assetReferences';

import {
  bindEmbeddedTemplateAsset,
  normalizeEmbeddedTemplateAsset,
  preserveEmbeddedTemplateAssets,
  type EmbeddedTemplateAssetMimeType,
} from './embeddedTemplateAssets';
import { StudioDocumentStoreError } from './StudioDocumentStoreError';
import { getStudioDocumentRetentionHours } from './studioDocumentAccess';
import { getStudioDocumentAssetDownloads } from './studioDocumentAssetStore';
import {
  createStudioDocument,
  getStudioDocument,
  listStudioDocuments,
  updateStudioDocument,
} from './studioDocumentStore';

const MAX_PIPELINE_EMBEDDED_TEMPLATE_ASSET_BYTES = 10 * 1024 * 1024;

export const createDeveloperTemplateDraft = async (
  access: DeveloperCockpitAccess,
  input: GptTemplateDraftInput,
) => {
  requireContributionScope(access, 'studio.ai.create');
  const retentionHours = await getStudioDocumentRetentionHours(access.entitlement);
  return createStudioDocument({
    ownerUserId: access.user.id,
    title: input.title,
    creationSource: 'gpt',
    document: createProjectDocumentFromTemplateDraft(input, `gpt-${randomUUID()}`),
    retentionHours,
  });
};

export const listDeveloperTemplateDrafts = async (access: DeveloperCockpitAccess) => {
  requireContributionScope(access, 'studio.ai.create');
  return listStudioDocuments(access.user.id, await getStudioDocumentRetentionHours(access.entitlement));
};

export const getDeveloperTemplateDraft = async (
  access: DeveloperCockpitAccess,
  documentId: string,
) => {
  requireContributionScope(access, 'studio.ai.create');
  return getStudioDocument(access.user.id, documentId, await getStudioDocumentRetentionHours(access.entitlement));
};

export const updateDeveloperTemplateDraft = async ({
  access,
  documentId,
  expectedRevision,
  input,
}: {
  access: DeveloperCockpitAccess;
  documentId: string;
  expectedRevision: number;
  input: GptTemplateDraftInput;
}) => {
  requireContributionScope(access, 'studio.ai.create');
  const retentionHours = await getStudioDocumentRetentionHours(access.entitlement);
  const current = await getStudioDocument(access.user.id, documentId, retentionHours);
  if (current.document.userTemplates.length !== 1) {
    throw new StudioDocumentStoreError(
      'MCP revision currently requires a Studio document with exactly one editable Template.',
      409,
    );
  }
  const currentTemplate = current.document.userTemplates[0];
  const templateId = currentTemplate.id?.trim();
  if (!templateId) {
    throw new StudioDocumentStoreError('The editable Template is missing its CardForge id.', 409);
  }

  const preserved = preserveEmbeddedTemplateAssets({
    currentTemplate,
    nextTemplate: createTemplateFromTemplateDraft(input.template, templateId),
    currentPlan: current.document.productionPlan,
    nextPlan: input.productionPlan,
  });

  return updateStudioDocument({
    ownerUserId: access.user.id,
    documentId,
    expectedRevision,
    title: input.title,
    document: {
      ...current.document,
      userTemplates: [preserved.template],
      productionPlan: preserved.productionPlan,
    },
    retentionHours,
  });
};

const getSingleEditableTemplate = (templates: TCGCardTemplate[]): TCGCardTemplate => {
  if (templates.length !== 1) {
    throw new StudioDocumentStoreError(
      'Embedded artwork currently requires a Studio document with exactly one editable Template.',
      409,
    );
  }
  const template = templates[0];
  if (!template.id?.trim()) {
    throw new StudioDocumentStoreError('The editable Template is missing its CardForge id.', 409);
  }
  return template;
};

export const attachDeveloperTemplateDraftAsset = async ({
  access,
  documentId,
  expectedRevision,
  assetRequirementId,
  binding,
  mimeType,
  data,
}: {
  access: DeveloperCockpitAccess;
  documentId: string;
  expectedRevision: number;
  assetRequirementId: string;
  binding: ProjectAssetBinding;
  mimeType: EmbeddedTemplateAssetMimeType;
  data: string;
}) => {
  requireContributionScope(access, 'studio.ai.create');
  const retentionHours = await getStudioDocumentRetentionHours(access.entitlement);
  const current = await getStudioDocument(access.user.id, documentId, retentionHours);
  if (current.revision !== expectedRevision) {
    throw new StudioDocumentStoreError(
      'The Studio document changed. Reload it before attaching artwork.',
      409,
    );
  }
  const productionPlan = current.document.productionPlan;
  if (!productionPlan) {
    throw new StudioDocumentStoreError('This Studio document does not have a production plan.', 409);
  }
  const requirementIndex = productionPlan.assets.findIndex((asset) => asset.id === assetRequirementId);
  const requirement = productionPlan.assets[requirementIndex];
  if (!requirement) {
    throw new StudioDocumentStoreError('That planned asset is not part of this Studio document.', 404);
  }
  if (!['custom-generated', 'user-provided', 'cardforge-output'].includes(requirement.source)) {
    throw new StudioDocumentStoreError(
      'Only generated, user-provided, or CardForge-output artwork can be embedded into a private Template.',
      400,
    );
  }

  const template = getSingleEditableTemplate(current.document.userTemplates);
  const normalized = await normalizeEmbeddedTemplateAsset({ data, mimeType });
  const targetElementIds = requirement.targetElementIds ?? [];
  const nextTemplate = bindEmbeddedTemplateAsset({
    template,
    binding,
    targetElementIds,
    dataUri: normalized.dataUri,
  });
  const nextAssets = [...productionPlan.assets];
  nextAssets[requirementIndex] = {
    ...requirement,
    status: 'selected',
    binding,
    embeddedAssetId: requirement.id,
    assetUrl: undefined,
    width: normalized.width,
    height: normalized.height,
  };

  return updateStudioDocument({
    ownerUserId: access.user.id,
    documentId,
    expectedRevision,
    title: current.title,
    document: {
      ...current.document,
      userTemplates: [nextTemplate],
      productionPlan: { ...productionPlan, assets: nextAssets },
    },
    retentionHours,
  });
};

const selectTemplate = (
  templates: TCGCardTemplate[],
  templateId?: string,
): TCGCardTemplate => {
  if (templateId) {
    const selected = templates.find((template) => template.id === templateId);
    if (!selected) throw new StudioDocumentStoreError('That Template is not part of this Studio document.', 404);
    return selected;
  }
  if (templates.length !== 1) {
    throw new StudioDocumentStoreError(
      'Choose a Template id before continuing a multi-Template Studio document in the Pipeline.',
      409,
    );
  }
  return templates[0];
};

const materializeTemplateForPipelineReview = async ({
  ownerUserId,
  documentId,
  template,
}: {
  ownerUserId: string;
  documentId: string;
  template: TCGCardTemplate;
}): Promise<TCGCardTemplate> => {
  const downloads = await getStudioDocumentAssetDownloads({
    ownerUserId,
    documentId,
    value: template,
  });
  if (downloads.length === 0) return template;

  let totalBytes = 0;
  const replacements = new Map<string, string>();
  for (const asset of downloads) {
    const response = await fetch(asset.signedUrl, { cache: 'no-store' });
    if (!response.ok) {
      throw new StudioDocumentStoreError(
        'CardForge could not carry one of the Template’s private artwork files into Forge Review. Retry the Pipeline handoff while the Studio draft is still available.',
        503,
      );
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    totalBytes += bytes.length;
    if (totalBytes > MAX_PIPELINE_EMBEDDED_TEMPLATE_ASSET_BYTES) {
      throw new StudioDocumentStoreError(
        'This Template contains more than 10 MB of private embedded artwork. Optimize or publish the reusable media through the Forge Pipeline before continuing the Template to owner review.',
        413,
      );
    }
    replacements.set(asset.id, `data:${asset.mimeType};base64,${bytes.toString('base64')}`);
  }
  return replaceStudioDocumentAssetReferences(template, replacements) as TCGCardTemplate;
};

export const continueDeveloperTemplateDraftInPipeline = async ({
  access,
  documentId,
  templateId,
}: {
  access: DeveloperCockpitAccess;
  documentId: string;
  templateId?: string;
}) => {
  requireContributionScope(access, 'library.submit');
  const document = await getStudioDocument(
    access.user.id,
    documentId,
    await getStudioDocumentRetentionHours(access.entitlement),
  );
  const localTemplate = selectTemplate(document.document.userTemplates, templateId);
  if (!isRepositoryTemplate(localTemplate) || localTemplate.templateSource === 'default') {
    throw new StudioDocumentStoreError(
      'Only a complete personal Template can continue as a new Pipeline draft.',
      409,
    );
  }
  const reviewTemplate = await materializeTemplateForPipelineReview({
    ownerUserId: access.user.id,
    documentId: document.id,
    template: localTemplate,
  });

  const sharedTemplateId = createNewSharedTemplateId({
    developerId: access.user.id,
    localTemplateId: localTemplate.id!,
    name: localTemplate.name,
  });
  const submissionKey = createHash('sha256')
    .update(`mcp:${access.user.id}:${document.id}:${document.revision}:${localTemplate.id}`)
    .digest('hex');
  const draft = await createTemplatePipelineDraft({
    template: {
      ...reviewTemplate,
      id: sharedTemplateId,
      templateSource: 'default',
      templateLibrarySource: 'pipeline',
      templateAccessTier: 'developer',
      templateRegistryStatus: 'draft',
      templateRevision: 0,
      templateRevisionId: undefined,
    },
    developerId: access.user.id,
    developerEmail: access.email,
    submissionKey,
  });

  return {
    draft,
    openInPipelineUrl: `/developer/cockpit?tab=library&submission=${encodeURIComponent(draft.id)}`,
  };
};
