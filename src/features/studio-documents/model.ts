import {
  createPersonalTemplateFork,
  materializeTemplateFieldBindings,
  reconstructMinimalTemplateObject,
  type TCGCardTemplate,
} from '@/domain/templates';
import {
  createProjectDocumentFromState,
  parseProjectDocumentValue,
  type ProjectDocumentV1,
} from '@/features/project/client/model';
import type { CardSet, StoredDisplayCard } from '@/domain/cards';
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
export type { StudioDocumentAssetDownload } from './assetReferences';

export const STUDIO_DOCUMENT_SOURCES = ['studio', 'gpt', 'import'] as const;
export type StudioDocumentSource = typeof STUDIO_DOCUMENT_SOURCES[number];
export const STUDIO_DOCUMENT_PROJECT_SOURCE_PROVIDERS = ['google-drive'] as const;
export type StudioDocumentProjectSourceProvider = typeof STUDIO_DOCUMENT_PROJECT_SOURCE_PROVIDERS[number];

export interface StudioDocumentInstallSummary {
  templateCount: number;
  templateAddedCount: number;
  templateUpdatedCount: number;
  setCount: number;
  cardCount: number;
  cardAddedCount: number;
  cardUpdatedCount: number;
  cardSkippedCount: number;
  activeSetId: string | null;
  destination: 'template-maker' | 'generator' | 'sets';
}

export interface StudioDocumentSummary {
  id: string;
  title: string;
  creationSource: StudioDocumentSource;
  revision: number;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  expiresAt: string;
  retentionHours: number;
  deletedAt: string | null;
  purgeAfter: string | null;
  lastInstalledRevision: number | null;
  lastInstalledAt: string | null;
  lastInstallSummary: StudioDocumentInstallSummary | null;
  sourceProjectProvider: StudioDocumentProjectSourceProvider | null;
  sourceProjectExternalId: string | null;
  sourceProviderRevision: string | null;
  sourceProjectRevision: string | null;
  sourceProjectName: string | null;
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

export const prepareTemplateDocumentSet = (
  document: ProjectDocumentV1,
  sourceId: string,
  title: string,
  existingSets: CardSet[],
  existingCards: readonly StoredDisplayCard[] = [],
): { document: ProjectDocumentV1; contextKept: boolean } => {
  if (!document.productionPlan || document.cardSets.length !== 0 || document.userTemplates.length !== 1) return { document, contextKept: false };
  const id = `studio-document-${sourceId}`;
  const existing = existingSets.find((set) => set.id === id);
  if (existing && existingCards.some((card) => card.setId === id || (!card.setId && existingSets[0]?.id === id))) {
    throw new Error('This Studio revision cannot be mapped safely onto the existing generated Set. Keep its cards and open the Template as an independent copy instead.');
  }
  const source = document.userTemplates[0]!;
  const working = {
    ...createPersonalTemplateFork(source),
    templateContributorName: source.templateContributorName,
  };
  const set: CardSet = {
    ...existing,
    id,
    name: existing?.name ?? title,
    templateIds: working.id ? [working.id] : [],
  };
  return {
    document: { ...document, version: 4, userTemplates: [...document.userTemplates, working], cardSets: [set], activeCardSetId: id },
    contextKept: Boolean(existing?.plan),
  };
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
  return createProjectDocumentFromState({
    userTemplates: [template],
    cardSets: [],
    activeCardSetId: null,
    storedCards: [],
    appearanceStyles: [],
    productionPlan: input.productionPlan,
  });
};
