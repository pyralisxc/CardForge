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
  createMcpArtworkOperationBudget,
  normalizeMcpArtworkSource,
} from './mcpArtworkSources';
import type {
  McpCardArtworkInput,
  McpCardWriteMode,
} from './mcpCardToolSchemas';
import { StudioDocumentStoreError } from './StudioDocumentStoreError';
import { getStudioDocumentRetentionHours } from './studioDocumentAccess';
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
  const document = await getStudioDocument(
    access.user.id,
    documentId,
    await getStudioDocumentRetentionHours(access.entitlement),
  );
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
  const retentionHours = await getStudioDocumentRetentionHours(access.entitlement);
  const current = await getStudioDocument(access.user.id, documentId, retentionHours);
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
    retentionHours,
  });
};

export const upsertDeveloperCards = async ({
  access,
  documentId,
  expectedRevision,
  setId,
  cards,
  writeMode = 'upsert',
}: {
  access: DeveloperCockpitAccess;
  documentId: string;
  expectedRevision: number;
  setId: string;
  cards: AgentCardInput[];
  writeMode?: McpCardWriteMode;
}) => {
  requireContributionScope(access, 'studio.ai.create');
  const artworkBudget = createMcpArtworkOperationBudget(cards.flatMap((card) => card.artwork ?? []));
  const retentionHours = await getStudioDocumentRetentionHours(access.entitlement);
  const current = await getStudioDocument(access.user.id, documentId, retentionHours);
  const templates = materializeGenerationTemplates(current.document.userTemplates);
  const set = requireSet(current.document.cardSets, setId);
  const front = selectFrontTemplate(templates, set.frontTemplateId);
  const back = set.backingTemplateId
    ? selectBackTemplate(templates, front, set.backingTemplateId)
    : null;
  const byId = new Map(current.document.storedCards.map((card) => [card.uniqueId, card]));
  const updatedIds: string[] = [];
  const addedIds: string[] = [];
  const revisedIds: string[] = [];
  const artworkResults: Array<{ cardId: string; fieldKey: string; face: 'front' | 'back'; status: 'stored' }> = [];
  for (const [inputIndex, input] of cards.entries()) {
    if (writeMode === 'revise' && !input.cardId?.trim()) {
      throw new StudioDocumentStoreError(
        'Revision mode requires the existing stable cardId for every card. Reload preview_card_set or the current generation contract and retry with those exact ids.',
        409,
      );
    }
    const uniqueId = input.cardId?.trim() || createStableAgentCardId(set.id, input, inputIndex);
    const existing = byId.get(uniqueId);
    if (writeMode === 'revise' && !existing) {
      throw new StudioDocumentStoreError(
        `Card ${uniqueId} does not exist in this working document. Reload preview_card_set and retry the revision with a current card id.`,
        404,
      );
    }
    if (writeMode === 'create' && existing) {
      throw new StudioDocumentStoreError(
        `Card ${uniqueId} already exists. Use revise mode with that id instead of creating a duplicate.`,
        409,
      );
    }
    if (existing && existing.setId !== set.id) {
      throw new StudioDocumentStoreError(
        `Card ${uniqueId} belongs to a different Set. Use move_cards before revising it in this Set.`,
        409,
      );
    }
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
      const normalized = await normalizeMcpArtworkSource(artwork, artworkBudget);
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
    if (existing) revisedIds.push(uniqueId);
    else addedIds.push(uniqueId);
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
    retentionHours,
  });
  return { document, set, updatedIds, addedIds, revisedIds, artworkResults };
};

export const deleteDeveloperCards = async ({
  access,
  documentId,
  expectedRevision,
  setId,
  cardIds,
}: {
  access: DeveloperCockpitAccess;
  documentId: string;
  expectedRevision: number;
  setId: string;
  cardIds: string[];
}) => {
  requireContributionScope(access, 'studio.ai.create');
  const retentionHours = await getStudioDocumentRetentionHours(access.entitlement);
  const current = await getStudioDocument(access.user.id, documentId, retentionHours);
  const set = requireSet(current.document.cardSets, setId);
  const requested = new Set(cardIds);
  const cardsById = new Map(current.document.storedCards.map((card) => [card.uniqueId, card]));
  for (const id of requested) {
    const card = cardsById.get(id);
    if (!card || card.setId !== set.id) {
      throw new StudioDocumentStoreError(`Card ${id} is not in "${set.name}". Reload preview_card_set before deleting cards.`, 404);
    }
  }
  const document = await updateStudioDocument({
    ownerUserId: access.user.id,
    documentId,
    expectedRevision,
    title: current.title,
    document: {
      ...current.document,
      activeCardSetId: set.id,
      storedCards: current.document.storedCards.filter((card) => !requested.has(card.uniqueId)),
    },
    retentionHours,
  });
  return { document, set, deletedIds: [...requested] };
};

export const moveDeveloperCards = async ({
  access,
  documentId,
  expectedRevision,
  sourceSetId,
  targetSetId,
  cardIds,
}: {
  access: DeveloperCockpitAccess;
  documentId: string;
  expectedRevision: number;
  sourceSetId: string;
  targetSetId: string;
  cardIds: string[];
}) => {
  requireContributionScope(access, 'studio.ai.create');
  if (sourceSetId === targetSetId) throw new StudioDocumentStoreError('Source and target Set must be different.', 400);
  const retentionHours = await getStudioDocumentRetentionHours(access.entitlement);
  const current = await getStudioDocument(access.user.id, documentId, retentionHours);
  const source = requireSet(current.document.cardSets, sourceSetId);
  const target = requireSet(current.document.cardSets, targetSetId);
  const templates = materializeGenerationTemplates(current.document.userTemplates);
  const targetFront = selectFrontTemplate(templates, target.frontTemplateId);
  const targetBack = target.backingTemplateId ? selectBackTemplate(templates, targetFront, target.backingTemplateId) : null;
  const requested = new Set(cardIds);
  const cardsById = new Map(current.document.storedCards.map((card) => [card.uniqueId, card]));
  for (const id of requested) {
    const card = cardsById.get(id);
    if (!card || card.setId !== source.id) {
      throw new StudioDocumentStoreError(`Card ${id} is not in "${source.name}". Reload both Sets before moving cards.`, 404);
    }
    validateCardData(targetFront, card.data, 'Front');
    if (targetBack) validateCardData(targetBack, card.backingData ?? {}, 'Back');
  }
  const storedCards = current.document.storedCards.map((card) => (
    requested.has(card.uniqueId)
      ? {
          ...card,
          setId: target.id,
          setName: target.name,
          templateId: targetFront.id!,
          backingTemplateId: targetBack?.id ?? null,
          backingData: targetBack ? card.backingData : undefined,
        }
      : card
  ));
  const document = await updateStudioDocument({
    ownerUserId: access.user.id,
    documentId,
    expectedRevision,
    title: current.title,
    document: {
      ...current.document,
      userTemplates: templates,
      activeCardSetId: target.id,
      storedCards,
    },
    retentionHours,
  });
  return { document, sourceSet: source, targetSet: target, movedIds: [...requested] };
};

export const deleteDeveloperCardSet = async ({
  access,
  documentId,
  expectedRevision,
  setId,
  deleteCards = false,
}: {
  access: DeveloperCockpitAccess;
  documentId: string;
  expectedRevision: number;
  setId: string;
  deleteCards?: boolean;
}) => {
  requireContributionScope(access, 'studio.ai.create');
  const retentionHours = await getStudioDocumentRetentionHours(access.entitlement);
  const current = await getStudioDocument(access.user.id, documentId, retentionHours);
  const set = requireSet(current.document.cardSets, setId);
  const setCards = current.document.storedCards.filter((card) => card.setId === set.id);
  if (setCards.length > 0 && !deleteCards) {
    throw new StudioDocumentStoreError(
      `"${set.name}" still contains ${setCards.length} card${setCards.length === 1 ? '' : 's'}. Delete or move those cards first, or retry with deleteCards true only when the user explicitly wants the Set and its cards removed.`,
      409,
    );
  }
  let cardSets = current.document.cardSets.filter((candidate) => candidate.id !== set.id);
  const storedCards = deleteCards
    ? current.document.storedCards.filter((card) => card.setId !== set.id)
    : current.document.storedCards;
  if (cardSets.length === 0) {
    const front = materializeGenerationTemplates(current.document.userTemplates)
      .find((template) => template.templateUsage !== 'back-preset');
    cardSets = [{
      id: 'active-card-set',
      name: 'Untitled Set',
      frontTemplateId: front?.id ?? null,
      backingTemplateId: null,
    }];
  }
  const activeSet = cardSets[0]!;
  const document = await updateStudioDocument({
    ownerUserId: access.user.id,
    documentId,
    expectedRevision,
    title: current.title,
    document: {
      ...current.document,
      cardSets,
      activeCardSetId: activeSet.id,
      storedCards,
    },
    retentionHours,
  });
  return { document, deletedSet: set, deletedCardIds: deleteCards ? setCards.map((card) => card.uniqueId) : [] };
};
