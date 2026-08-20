import {
  materializeTemplateFieldBindings,
  reconstructMinimalTemplateObject,
  type TCGCardTemplate,
} from '@/domain/templates';
import {
  createProjectDocumentFromState,
  parseProjectDocumentValue,
  type ProjectDocumentV1,
} from '@/features/project/client/model';
import {
  gptTemplateDraftInputSchema,
  projectProductionPlanSchema,
  templateDraftAppearanceSchema,
  templateDraftElementSchema,
  templateDraftSchema,
  type GptTemplateDraftInput,
} from './templateDraftSchema';

export {
  gptTemplateDraftInputSchema,
  projectProductionPlanSchema,
  templateDraftAppearanceSchema,
  templateDraftElementSchema,
  templateDraftSchema,
};
export type { GptTemplateDraftInput };

export const STUDIO_DOCUMENT_SOURCES = ['studio', 'gpt', 'import'] as const;
export type StudioDocumentSource = typeof STUDIO_DOCUMENT_SOURCES[number];

export interface StudioDocumentSummary {
  id: string;
  title: string;
  creationSource: StudioDocumentSource;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface StudioDocument extends StudioDocumentSummary {
  document: ProjectDocumentV1;
}

export interface StudioDocumentWatermarkPolicy {
  required: boolean;
  canExportClean: boolean;
}

export const normalizeStudioDocumentTitle = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const title = value.trim().replace(/\s+/g, ' ');
  return title.length >= 1 && title.length <= 160 ? title : null;
};

export const normalizeStudioDocumentPayload = (value: unknown): ProjectDocumentV1 | null => {
  const parsed = parseProjectDocumentValue(value);
  return parsed.success ? parsed.document : null;
};

export const createTemplateFromTemplateDraft = (
  draft: GptTemplateDraftInput['template'],
  templateId: string,
): TCGCardTemplate => materializeTemplateFieldBindings(reconstructMinimalTemplateObject({
  ...(draft as Partial<TCGCardTemplate>),
  id: templateId,
  name: draft.name.trim(),
  aspectRatio: draft.aspectRatio.trim(),
  templateSource: 'user',
  templateLibrarySource: 'personal',
  templateAccessTier: undefined,
  templateRegistryStatus: 'localOnly',
  templateContributorName: undefined,
}));

export const createProjectDocumentFromTemplateDraft = (
  input: GptTemplateDraftInput,
  templateId: string,
): ProjectDocumentV1 => {
  const template = createTemplateFromTemplateDraft(input.template, templateId);
  const initialSetId = 'active-card-set';
  return createProjectDocumentFromState({
    userTemplates: [template],
    cardSets: [{
      id: initialSetId,
      name: 'Untitled Set',
      frontTemplateId: template.templateUsage === 'back-preset' ? null : template.id!,
      backingTemplateId: null,
    }],
    activeCardSetId: initialSetId,
    storedCards: [],
    appearanceStyles: [],
    productionPlan: input.productionPlan,
  });
};
