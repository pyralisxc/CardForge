import { createHash, randomUUID } from 'node:crypto';

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
  normalizeMcpArtworkSource,
} from './mcpArtworkSources';
import type { McpCardArtworkInput } from './mcpCardToolSchemas';
import { StudioDocumentStoreError } from './StudioDocumentStoreError';
import { getStudioDocument, updateStudioDocument } from './studioDocumentStore';

export interface AgentCardInput {
  cardId?: string;
  data: CardData;
  backingData?: CardData;
  artwork?: McpCardArtworkInput[];
}

const materializeGenerationTemplates = (templates: TCGCardTemplate[]): TCGCardTemplate[] => (
  templates.map(materializeTemplateFieldBindings)
);

const selectFrontTemplate = (templates: TCGCardTemplate[], templateId?: string | null): TCGCardTemplate => {
  const template = templateId
    ? templates.find((candidate) => candidate.id === templateId && candidate.templateUsage !== 'back-preset')
    : templates.find((candidate) => candidate.templateUsage !== 'back-preset');
  if (!template?.id) {
    throw new StudioDocumentStoreError(
      'CardForge could not find the front Template for this set. Reload the working design and choose a current front Template before retrying.',
      404,
    );
  }
  return template;
};

const selectBackTemplate = (
  templates: TCGCardTemplate[],
  front: TCGCardTemplate,
  templateId?: string | null,
): TCGCardTemplate | null => {
  if (!templateId) return null;
  const back = templates.find((candidate) => candidate.id === templateId && candidate.templateUsage === 'back-preset');
  if (!back) {
    throw new StudioDocumentStoreError(
      'CardForge could not find that card-back Template in this working design. Reload the design and use a current back Template id.',
      404,
    );
  }
  if (!areTemplateFormatsCompatible(front, back)) {
    throw new StudioDocumentStoreError(
      'That card back does not match the front Template dimensions. Choose a compatible back or remove the back before retrying.',
      409,
    );
  }
  return back;
};

const requireSet = (sets: CardSet[], setId: string): CardSet => {
  const set = sets.find((candidate) => candidate.id === setId);
  if (!set) {
    throw new StudioDocumentStoreError(
      'That card set is not part of the current working design. Reload the card-generation contract or set preview and retry with the current set id.',
      404,
    );
  }
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
      `${faceLabel} card data contains fields that are not in the Template contract: ${unknown.slice(0, 5).join(', ')}. Reload get_card_generation_contract and use only the returned field keys.`,
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
      `${faceLabel} card data is missing required fields: ${missing.map((field) => field.key).join(', ')}. Reload get_card_generation_contract, fill those fields, and retry with the same stable card id.`,
      409,
    );
  }
};

const isDisposableFallbackSet = (set: CardSet, cards: StoredDisplayCard[]): boolean => (
  set.id === 'active-card-set'
  && set.name === 'Untitled Set'
  && !cards.some((card) => card.setId === set.id)
);

const normalizeSetName = (value: string): string => value.trim() || 'Untitled Set';

const findSameNameSet = (sets: CardSet[], name: string): CardSet | null => {
  const normalized = normalizeSetName(name).toLocaleLowerCase();
  return sets.find((set) => set.name.trim().toLocaleLowerCase() === normalized) ?? null;
};

const stableCardData = (data: CardData | undefined) => (
  Object.entries(data ?? {}).sort(([left], [right]) => left.localeCompare(right))
);

export const createStableAgentCardId = (
  setId: string,
  input: AgentCardInput,
  index = 0,
): string => {
  const fingerprint = JSON.stringify({
    setId,
    index,
    data: stableCardData(input.data),
    backingData: stableCardData(input.backingData),
  });
  const digest = createHash('sha256').update(fingerprint).digest('hex').slice(0, 24);
  return `card-${digest}`;
};

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
  const resolvedSet = set
    ? {
        ...set,
        frontTemplateId: set.frontTemplateId ?? front.id!,
        backingTemplateId: set.backingTemplateId ?? back?.id ?? null,
      }
    : null;
  return {
    document,
    set: resolvedSet,
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
  const sameNameExisting = !setId ? findSameNameSet(current.document.cardSets, name) : null;
  const disposableFallback = !setId
    && current.document.cardSets.length === 1
    && isDisposableFallbackSet(current.document.cardSets[0], current.document.storedCards)
    ? current.document.cardSets[0]
    : null;
  const existing = explicitExisting ?? sameNameExisting ?? disposableFallback;
  const front = selectFrontTemplate(templates, frontTemplateId ?? existing?.frontTemplateId);
  const back = selectBackTemplate(templates, front, backingTemplateId ?? existing?.backingTemplateId);
  const nextSet: CardSet = {
    id: existing?.id ?? setId?.trim() ?? `set-${randomUUID()}`,
    name: normalizeSetName(name),
    frontTemplateId: front.id!,
    backingTemplateId: back?.id ?? null,
  };
  const replacingFallback = disposableFallback?.id === existing?.id;
  const sets = replacingFallback ? [] : [...current.document.cardSets];
  const index = sets.findIndex((candidate) => candidate.id === nextSet.id);
  if (index >= 0) sets[index] = nextSet;
  else sets.push(nextSet);
  const replacedSetId = replacingFallback ? disposableFallback?.id : undefined;
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
  const artworkResults: Array<{ cardId: string; fieldKey: string; face: 'front' | 'back'; status: 'stored' }> = [];
  for (const [inputIndex, input] of cards.entries()) {
    const uniqueId = input.cardId?.trim() || createStableAgentCardId(set.id, input, inputIndex);
    const existing = byId.get(uniqueId);
    const nextData: CardData = { ...(existing?.data ?? {}), ...input.data };
    const nextBackingData: CardData | undefined = back
      ? { ...(existing?.backingData ?? {}), ...(input.backingData ?? {}) }
      : undefined;
    const artworkTargets = new Set<string>();
    for (const artwork of input.artwork ?? []) {
      const targetTemplate = artwork.face === 'back' ? back : front;
      if (!targetTemplate) {
        throw new StudioDocumentStoreError(
          'This set does not have a card-back Template. Add a compatible back or attach the artwork to the front face instead.',
          409,
        );
      }
      const targetKey = `${artwork.face}:${artwork.fieldKey}`;
      if (artworkTargets.has(targetKey)) {
        throw new StudioDocumentStoreError(`Artwork field ${targetKey} was provided more than once for card ${uniqueId}.`, 400);
      }
      artworkTargets.add(targetKey);
      const imageField = getCardFields(targetTemplate).find((field) => field.key === artwork.fieldKey && field.isImage);
      if (!imageField) {
        throw new StudioDocumentStoreError(
          `Artwork field ${targetKey} is not an image field in the current Template contract. Reload get_card_generation_contract and retry with the same stable card id.`,
          409,
        );
      }
      const normalized = await normalizeMcpArtworkSource(artwork);
      if (artwork.face === 'back') nextBackingData![artwork.fieldKey] = normalized.dataUri;
      else nextData[artwork.fieldKey] = normalized.dataUri;
      artworkResults.push({ cardId: uniqueId, fieldKey: artwork.fieldKey, face: artwork.face, status: 'stored' });
    }
    validateCardData(front, nextData, 'Front');
    if (back) validateCardData(back, nextBackingData ?? {}, 'Back');
    const card: StoredDisplayCard = {
      uniqueId,
      templateId: front.id!,
      backingTemplateId: back?.id ?? null,
      backingData: nextBackingData,
      setId: set.id,
      setName: set.name,
      data: nextData,
    };
    byId.set(uniqueId, card);
    updatedIds.push(uniqueId);
  }
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
  return { document, set, updatedIds, artworkResults };
};
