import { randomUUID } from 'node:crypto';

import { areTemplateFormatsCompatible } from '@/domain/card-formats';
import type { CardData, CardSet, StoredDisplayCard } from '@/domain/cards';
import {
  extractTemplateFieldDefinitions,
  materializeTemplateFieldBindings,
  type TCGCardTemplate,
} from '@/domain/templates';
import {
  createBulkExampleJson,
  createBulkFaceFieldDefinitions,
  createBulkImportContract,
} from '@/features/card-generator/server';
import { requireContributionScope, type DeveloperCockpitAccess } from '@/features/developer-access/server';
import {
  normalizeEmbeddedTemplateAsset,
  type EmbeddedTemplateAssetMimeType,
} from './embeddedTemplateAssets';
import { StudioDocumentStoreError } from './StudioDocumentStoreError';
import { getStudioDocument, updateStudioDocument } from './studioDocumentStore';

export interface AgentCardInput {
  cardId?: string;
  data: CardData;
  backingData?: CardData;
}

const materializeGenerationTemplates = (templates: TCGCardTemplate[]): TCGCardTemplate[] => (
  templates.map(materializeTemplateFieldBindings)
);

const selectFrontTemplate = (templates: TCGCardTemplate[], templateId?: string | null): TCGCardTemplate => {
  const template = templateId
    ? templates.find((candidate) => candidate.id === templateId && candidate.templateUsage !== 'back-preset')
    : templates.find((candidate) => candidate.templateUsage !== 'back-preset');
  if (!template?.id) throw new StudioDocumentStoreError('The Studio document does not contain the requested front Template.', 404);
  return template;
};

const selectBackTemplate = (
  templates: TCGCardTemplate[],
  front: TCGCardTemplate,
  templateId?: string | null,
): TCGCardTemplate | null => {
  if (!templateId) return null;
  const back = templates.find((candidate) => candidate.id === templateId && candidate.templateUsage === 'back-preset');
  if (!back) throw new StudioDocumentStoreError('The requested card-back Template is not part of this Studio document.', 404);
  if (!areTemplateFormatsCompatible(front, back)) {
    throw new StudioDocumentStoreError('The requested card back does not match the front Template dimensions.', 409);
  }
  return back;
};

const requireSet = (sets: CardSet[], setId: string): CardSet => {
  const set = sets.find((candidate) => candidate.id === setId);
  if (!set) throw new StudioDocumentStoreError('That card set is not part of this Studio document.', 404);
  return set;
};

const getCardFields = (template: TCGCardTemplate) => (
  extractTemplateFieldDefinitions(template).filter((field) => !field.isStaticBaseText)
);

const validateCardData = (template: TCGCardTemplate, data: CardData, faceLabel: string) => {
  const fields = getCardFields(template);
  const allowed = new Set(fields.map((field) => field.key));
  const unknown = Object.keys(data).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    throw new StudioDocumentStoreError(
      `${faceLabel} card data contains fields that are not in the Template contract: ${unknown.slice(0, 5).join(', ')}. Load get_card_generation_contract before generating cards.`,
      409,
    );
  }
  const missing = fields.filter((field) => (
    field.required
    && field.defaultValue === undefined
    && (data[field.key] === undefined || String(data[field.key]).trim() === '')
  ));
  if (missing.length > 0) {
    throw new StudioDocumentStoreError(
      `${faceLabel} card data is missing required fields: ${missing.map((field) => field.key).join(', ')}.`,
      409,
    );
  }
};

const isDisposableFallbackSet = (set: CardSet, cards: StoredDisplayCard[]): boolean => (
  set.id === 'active-card-set'
  && set.name === 'Untitled Set'
  && !cards.some((card) => card.setId === set.id)
);

export const getDeveloperCardGenerationContract = async ({
  access,
  documentId,
  setId,
}: {
  access: DeveloperCockpitAccess;
  documentId: string;
  setId?: string;
}) => {
  requireContributionScope(access, 'studio.ai.create');
  const document = await getStudioDocument(access.user.id, documentId);
  const templates = materializeGenerationTemplates(document.document.userTemplates);
  const set = setId ? requireSet(document.document.cardSets, setId) : document.document.cardSets[0];
  const front = selectFrontTemplate(templates, set?.frontTemplateId);
  const back = set?.backingTemplateId
    ? selectBackTemplate(templates, front, set.backingTemplateId)
    : null;
  const frontFields = getCardFields(front);
  const backFields = back ? getCardFields(back) : [];
  const bulkFields = createBulkFaceFieldDefinitions(frontFields, backFields);
  return {
    document,
    set: set ?? null,
    frontTemplateId: front.id!,
    backingTemplateId: back?.id ?? null,
    frontFields,
    backFields,
    bulkContract: createBulkImportContract({ template: front, fieldDefinitions: bulkFields }),
    exampleJson: createBulkExampleJson({ template: front, backingTemplate: back, fieldDefinitions: bulkFields }),
  };
};

export const upsertDeveloperCardSet = async ({
  access,
  documentId,
  expectedRevision,
  setId,
  name,
  frontTemplateId,
  backingTemplateId,
}: {
  access: DeveloperCockpitAccess;
  documentId: string;
  expectedRevision: number;
  setId?: string;
  name: string;
  frontTemplateId?: string | null;
  backingTemplateId?: string | null;
}) => {
  requireContributionScope(access, 'studio.ai.create');
  const current = await getStudioDocument(access.user.id, documentId);
  const templates = materializeGenerationTemplates(current.document.userTemplates);
  const explicitExisting = setId ? current.document.cardSets.find((candidate) => candidate.id === setId) : null;
  const disposableFallback = !setId
    && current.document.cardSets.length === 1
    && isDisposableFallbackSet(current.document.cardSets[0], current.document.storedCards)
    ? current.document.cardSets[0]
    : null;
  const existing = explicitExisting ?? disposableFallback;
  const front = selectFrontTemplate(templates, frontTemplateId ?? existing?.frontTemplateId);
  const back = selectBackTemplate(templates, front, backingTemplateId ?? existing?.backingTemplateId);
  const nextSet: CardSet = {
    id: explicitExisting?.id ?? setId?.trim() ?? `set-${randomUUID()}`,
    name: name.trim() || explicitExisting?.name || 'Untitled Set',
    frontTemplateId: front.id!,
    backingTemplateId: back?.id ?? null,
  };
  const sets = disposableFallback ? [] : [...current.document.cardSets];
  const index = sets.findIndex((candidate) => candidate.id === nextSet.id);
  if (index >= 0) sets[index] = nextSet;
  else sets.push(nextSet);
  const replacedSetId = disposableFallback?.id;
  const storedCards = current.document.storedCards.map((card) => (
    card.setId === nextSet.id || (replacedSetId && card.setId === replacedSetId)
      ? {
          ...card,
          setId: nextSet.id,
          setName: nextSet.name,
          templateId: nextSet.frontTemplateId!,
          backingTemplateId: nextSet.backingTemplateId,
        }
      : card
  ));
  return updateStudioDocument({
    ownerUserId: access.user.id,
    documentId,
    expectedRevision,
    title: current.title,
    document: {
      ...current.document,
      userTemplates: templates,
      cardSets: sets,
      activeCardSetId: nextSet.id,
      storedCards,
    },
  });
};

export const upsertDeveloperCards = async ({
  access,
  documentId,
  expectedRevision,
  setId,
  cards,
}: {
  access: DeveloperCockpitAccess;
  documentId: string;
  expectedRevision: number;
  setId: string;
  cards: AgentCardInput[];
}) => {
  requireContributionScope(access, 'studio.ai.create');
  const current = await getStudioDocument(access.user.id, documentId);
  const templates = materializeGenerationTemplates(current.document.userTemplates);
  const set = requireSet(current.document.cardSets, setId);
  const front = selectFrontTemplate(templates, set.frontTemplateId);
  const back = set.backingTemplateId
    ? selectBackTemplate(templates, front, set.backingTemplateId)
    : null;
  const byId = new Map(current.document.storedCards.map((card) => [card.uniqueId, card]));
  const updatedIds: string[] = [];
  cards.forEach((input) => {
    validateCardData(front, input.data, 'Front');
    const uniqueId = input.cardId?.trim() || `card-${randomUUID()}`;
    const existing = byId.get(uniqueId);
    const nextBackingData = back ? (input.backingData ?? existing?.backingData ?? {}) : undefined;
    if (back) validateCardData(back, nextBackingData ?? {}, 'Back');
    const card: StoredDisplayCard = {
      uniqueId,
      templateId: front.id!,
      backingTemplateId: back?.id ?? null,
      backingData: nextBackingData,
      setId: set.id,
      setName: set.name,
      data: input.data,
    };
    byId.set(uniqueId, card);
    updatedIds.push(uniqueId);
  });
  const document = await updateStudioDocument({
    ownerUserId: access.user.id,
    documentId,
    expectedRevision,
    title: current.title,
    document: {
      ...current.document,
      userTemplates: templates,
      activeCardSetId: set.id,
      storedCards: Array.from(byId.values()),
    },
  });
  return { document, set, updatedIds };
};

export const attachDeveloperCardArtwork = async ({
  access,
  documentId,
  expectedRevision,
  cardId,
  fieldKey,
  face,
  mimeType,
  data,
}: {
  access: DeveloperCockpitAccess;
  documentId: string;
  expectedRevision: number;
  cardId: string;
  fieldKey: string;
  face: 'front' | 'back';
  mimeType: EmbeddedTemplateAssetMimeType;
  data: string;
}) => {
  requireContributionScope(access, 'studio.ai.create');
  const current = await getStudioDocument(access.user.id, documentId);
  const templates = materializeGenerationTemplates(current.document.userTemplates);
  const cardIndex = current.document.storedCards.findIndex((card) => card.uniqueId === cardId);
  const card = current.document.storedCards[cardIndex];
  if (!card) throw new StudioDocumentStoreError('That card is not part of this Studio document.', 404);
  const set = requireSet(current.document.cardSets, card.setId ?? current.document.activeCardSetId ?? '');
  const front = selectFrontTemplate(templates, set.frontTemplateId);
  const back = set.backingTemplateId
    ? selectBackTemplate(templates, front, set.backingTemplateId)
    : null;
  const template = face === 'back' ? back : front;
  if (!template) throw new StudioDocumentStoreError('This set does not have a card-back Template.', 409);
  const imageField = getCardFields(template).find((field) => field.key === fieldKey && field.isImage);
  if (!imageField) throw new StudioDocumentStoreError('That field is not an image field on the selected card face.', 409);
  const normalized = await normalizeEmbeddedTemplateAsset({ data, mimeType });
  const cards = [...current.document.storedCards];
  cards[cardIndex] = face === 'back'
    ? { ...card, backingData: { ...(card.backingData ?? {}), [fieldKey]: normalized.dataUri } }
    : { ...card, data: { ...card.data, [fieldKey]: normalized.dataUri } };
  return updateStudioDocument({
    ownerUserId: access.user.id,
    documentId,
    expectedRevision,
    title: current.title,
    document: {
      ...current.document,
      userTemplates: templates,
      storedCards: cards,
    },
  });
};
