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
import {
  createProjectDocumentFromTemplateDraft,
  createTemplateFromTemplateDraft,
  type GptTemplateDraftInput,
} from '@/features/studio-documents/model';

import { StudioDocumentStoreError } from './StudioDocumentStoreError';
import {
  createStudioDocument,
  getStudioDocument,
  listStudioDocuments,
  updateStudioDocument,
} from './studioDocumentStore';

export const createDeveloperTemplateDraft = async (
  access: DeveloperCockpitAccess,
  input: GptTemplateDraftInput,
) => {
  requireContributionScope(access, 'studio.ai.create');
  return createStudioDocument({
    ownerUserId: access.user.id,
    title: input.title,
    creationSource: 'gpt',
    document: createProjectDocumentFromTemplateDraft(input, `gpt-${randomUUID()}`),
  });
};

export const listDeveloperTemplateDrafts = async (access: DeveloperCockpitAccess) => {
  requireContributionScope(access, 'studio.ai.create');
  return listStudioDocuments(access.user.id);
};

export const getDeveloperTemplateDraft = async (
  access: DeveloperCockpitAccess,
  documentId: string,
) => {
  requireContributionScope(access, 'studio.ai.create');
  return getStudioDocument(access.user.id, documentId);
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
  const current = await getStudioDocument(access.user.id, documentId);
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

  return updateStudioDocument({
    ownerUserId: access.user.id,
    documentId,
    expectedRevision,
    title: input.title,
    document: {
      ...current.document,
      userTemplates: [createTemplateFromTemplateDraft(input.template, templateId)],
      productionPlan: input.productionPlan,
    },
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
  const document = await getStudioDocument(access.user.id, documentId);
  const localTemplate = selectTemplate(document.document.userTemplates, templateId);
  if (!isRepositoryTemplate(localTemplate) || localTemplate.templateSource === 'default') {
    throw new StudioDocumentStoreError(
      'Only a complete personal Template can continue as a new Pipeline draft.',
      409,
    );
  }

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
      ...localTemplate,
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
