import { createHash, randomUUID } from 'node:crypto';

import { areTemplateFormatsCompatible } from '@/domain/card-formats';
import { ensureCardSetTemplateReferences, type CardData, type CardSet, type StoredDisplayCard } from '@/domain/cards';
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
import { requireAccountToolCapability, type AccountToolAccess } from '@/features/account/server';
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
  templateId?: string;
  backingTemplateId?: string | null;
  data: CardData;
  backingData?: CardData;
  artwork?: McpCardArtworkInput[];
}

const materializeGenerationTemplates = (templates: TCGCardTemplate[]): TCGCardTemplate[] => (
  templates.map(materializeTemplateFieldBindings)
);

const selectFrontTemplate = (templates: TCGCardTemplate[], templateId: string): TCGCardTemplate => {
  const template = templates.find((candidate) => candidate.id === templateId && candidate.templateUsage !== 'back-preset');
  if (!template?.id) {
    throw new StudioDocumentStoreError(
      'CardForge could not find that front Template in this working design. Reload the working design and choose a current front Template before retrying.',
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

const uniqueIds = (values: Array<string | null | undefined>): string[] => (
  [...new Set(values.filter((value): value is string => Boolean(value?.trim())).map((value) => value.trim()))]
);

const getSetCards = (cards: readonly StoredDisplayCard[], set: CardSet | null | undefined) => (
  set ? cards.filter((card) => card.setId === set.id) : cards
);

const resolveFrontTemplateForGeneration = ({
  templates,
  set,
  cards,
  templateId,
}: {
  templates: TCGCardTemplate[];
  set: CardSet | null | undefined;
  cards: readonly StoredDisplayCard[];
  templateId?: string | null;
}): TCGCardTemplate => {
  if (templateId?.trim()) return selectFrontTemplate(templates, templateId.trim());

  const referenced = uniqueIds(set?.templateIds ?? [])
    .map((id) => templates.find((template) => template.id === id && template.templateUsage !== 'back-preset'))
    .filter((template): template is TCGCardTemplate => Boolean(template?.id));
  if (referenced.length === 1) return referenced[0]!;
  if (referenced.length > 1) {
    throw new StudioDocumentStoreError(
      `This Set references ${referenced.length} front Templates. Choose templateId explicitly before generating cards.`,
      409,
    );
  }

  const usedIds = uniqueIds(getSetCards(cards, set).map((card) => card.templateId));
  if (usedIds.length === 1) return selectFrontTemplate(templates, usedIds[0]!);
  if (usedIds.length > 1) {
    throw new StudioDocumentStoreError(
      `This Set already uses ${usedIds.length} front Templates. Choose templateId explicitly; CardForge will not use an arbitrary representative card as the generation source.`,
      409,
    );
  }

  const available = templates.filter((template) => template.id && template.templateUsage !== 'back-preset');
  if (available.length === 1) return available[0]!;
  if (available.length > 1) {
    throw new StudioDocumentStoreError(
      `This working design has ${available.length} front Templates. Choose templateId explicitly before generating cards.`,
      409,
    );
  }
  throw new StudioDocumentStoreError('This working design has no front Template available for card generation.', 404);
};

const resolveBackTemplateForGeneration = ({
  templates,
  front,
  set,
  cards,
  backingTemplateId,
}: {
  templates: TCGCardTemplate[];
  front: TCGCardTemplate;
  set: CardSet | null | undefined;
  cards: readonly StoredDisplayCard[];
  backingTemplateId?: string | null;
}): TCGCardTemplate | null => {
  if (backingTemplateId === null) return null;
  if (typeof backingTemplateId === 'string' && backingTemplateId.trim()) {
    return selectBackTemplate(templates, front, backingTemplateId.trim());
  }

  const referenced = uniqueIds(set?.templateIds ?? [])
    .map((id) => templates.find((template) => template.id === id && template.templateUsage === 'back-preset'))
    .filter((template): template is TCGCardTemplate => Boolean(template?.id) && areTemplateFormatsCompatible(front, template!));
  if (referenced.length === 1) return referenced[0]!;
  if (referenced.length > 1) {
    throw new StudioDocumentStoreError(
      `This Set references ${referenced.length} compatible card backs. Choose backingTemplateId explicitly, or pass null for front-only cards.`,
      409,
    );
  }

  const usedIds = uniqueIds(getSetCards(cards, set).map((card) => card.backingTemplateId));
  if (usedIds.length === 1) return selectBackTemplate(templates, front, usedIds[0]!);
  if (usedIds.length > 1) {
    throw new StudioDocumentStoreError(
      'This Set uses more than one card back. Choose backingTemplateId explicitly, or pass null for front-only cards.',
      409,
    );
  }
  return null;
};

const getCardFields = (template: TCGCardTemplate) => (
  extractTemplateFieldDefinitions(template).filter((field) => !field.isStaticBaseText)
);

const validateIncomingCardFields = (template: TCGCardTemplate, data: CardData, faceLabel: string) => {
  const allowed = new Set(getCardFields(template).map((field) => field.key));
  const unknown = Object.keys(data).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    throw new StudioDocumentStoreError(
      `${faceLabel} card data contains fields that are not in the Template contract: ${unknown.slice(0, 5).join(', ')}. Reload get_card_generation_contract and use only the returned field keys.`,
      409,
    );
  }
};

const validateRequiredCardData = (template: TCGCardTemplate, data: CardData, faceLabel: string) => {
  const missing = getCardFields(template).filter((field) => (
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
    templateId: input.templateId ?? null,
    backingTemplateId: input.backingTemplateId ?? null,
    data: stableCardData(input.data),
    backingData: stableCardData(input.backingData),
  });
  const digest = createHash('sha256').update(fingerprint).digest('hex').slice(0, 24);
  return `card-${digest}`;
};

export const getCardGenerationContract = async ({
  access,
  documentId,
  setId,
  templateId,
  backingTemplateId,
}: {
  access: AccountToolAccess;
  documentId: string;
  setId?: string;
  templateId?: string;
  backingTemplateId?: string | null;
}) => {
  requireAccountToolCapability(access, 'studio.ai.create');
  const document = await getStudioDocument(
    access.user.id,
    documentId,
    await getStudioDocumentRetentionHours(access.entitlement),
  );
  const templates = materializeGenerationTemplates(document.document.userTemplates);
  const set = setId ? requireSet(document.document.cardSets, setId) : document.document.cardSets[0];
  const front = resolveFrontTemplateForGeneration({
    templates,
    set,
    cards: document.document.storedCards,
    templateId,
  });
  const back = resolveBackTemplateForGeneration({
    templates,
    front,
    set,
    cards: document.document.storedCards,
    backingTemplateId,
  });
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

export const upsertWorkingCardSet = async ({
  access,
  documentId,
  expectedRevision,
  setId,
  name,
}: {
  access: AccountToolAccess;
  documentId: string;
  expectedRevision: number;
  setId?: string;
  name: string;
}) => {
  requireAccountToolCapability(access, 'studio.ai.create');
  const retentionHours = await getStudioDocumentRetentionHours(access.entitlement);
  const current = await getStudioDocument(access.user.id, documentId, retentionHours);
  const explicitExisting = setId ? current.document.cardSets.find((candidate) => candidate.id === setId) : null;
  const sameNameExisting = !setId ? findSameNameSet(current.document.cardSets, name) : null;
  const existing = explicitExisting ?? sameNameExisting;
  const nextSet: CardSet = {
    ...(existing ?? {}),
    id: existing?.id ?? setId?.trim() ?? `set-${randomUUID()}`,
    name: normalizeSetName(name),
  };
  const sets = [...current.document.cardSets];
  const index = sets.findIndex((candidate) => candidate.id === nextSet.id);
  if (index >= 0) sets[index] = nextSet;
  else sets.push(nextSet);
  const storedCards = current.document.storedCards.map((card) => (
    card.setId === nextSet.id ? { ...card, setId: nextSet.id, setName: nextSet.name } : card
  ));
  return updateStudioDocument({
    ownerUserId: access.user.id,
    documentId,
    expectedRevision,
    title: current.title,
    document: {
      ...current.document,
      cardSets: sets,
      activeCardSetId: nextSet.id,
      storedCards,
    },
    retentionHours,
  });
};

export const upsertWorkingCards = async ({
  access,
  documentId,
  expectedRevision,
  setId,
  cards,
  writeMode = 'upsert',
}: {
  access: AccountToolAccess;
  documentId: string;
  expectedRevision: number;
  setId: string;
  cards: AgentCardInput[];
  writeMode?: McpCardWriteMode;
}) => {
  requireAccountToolCapability(access, 'studio.ai.create');
  const artworkBudget = createMcpArtworkOperationBudget(cards.flatMap((card) => card.artwork ?? []));
  const retentionHours = await getStudioDocumentRetentionHours(access.entitlement);
  const current = await getStudioDocument(access.user.id, documentId, retentionHours);
  const templates = materializeGenerationTemplates(current.document.userTemplates);
  const set = requireSet(current.document.cardSets, setId);
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

    if (existing && input.templateId && input.templateId !== existing.templateId) {
      throw new StudioDocumentStoreError(
        `Card ${uniqueId} already uses Template ${existing.templateId}. Card edits preserve design identity; change the Template relationship in Studio instead of retargeting it through a data write.`,
        409,
      );
    }
    if (existing && input.backingTemplateId !== undefined && input.backingTemplateId !== (existing.backingTemplateId ?? null)) {
      throw new StudioDocumentStoreError(
        `Card ${uniqueId} already has its current back relationship. Card edits preserve design identity; change the back Template in Studio instead of retargeting it through a data write.`,
        409,
      );
    }

    const front = existing
      ? selectFrontTemplate(templates, existing.templateId)
      : resolveFrontTemplateForGeneration({ templates, set, cards: Array.from(byId.values()), templateId: input.templateId });
    const back = existing
      ? selectBackTemplate(templates, front, existing.backingTemplateId)
      : resolveBackTemplateForGeneration({
          templates,
          front,
          set,
          cards: Array.from(byId.values()),
          backingTemplateId: input.backingTemplateId,
        });

    validateIncomingCardFields(front, input.data, 'Front');
    if (back && input.backingData) validateIncomingCardFields(back, input.backingData, 'Back');
    if (!back && input.backingData && Object.keys(input.backingData).length > 0) {
      throw new StudioDocumentStoreError('Backing data was provided for a front-only card. Choose a compatible backingTemplateId or remove the backing data.', 409);
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
          'This card does not have a card-back Template. Add a compatible back or attach the artwork to the front face instead.',
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
    validateRequiredCardData(front, nextData, 'Front');
    if (back) validateRequiredCardData(back, nextBackingData ?? {}, 'Back');
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

  const storedCards = Array.from(byId.values());
  const cardSets = ensureCardSetTemplateReferences({ cardSets: current.document.cardSets, storedCards });
  const updatedSet = cardSets.find((candidate) => candidate.id === set.id) ?? set;
  const document = await updateStudioDocument({
    ownerUserId: access.user.id,
    documentId,
    expectedRevision,
    title: current.title,
    document: {
      ...current.document,
      userTemplates: templates,
      cardSets,
      activeCardSetId: set.id,
      storedCards,
    },
    retentionHours,
  });
  return { document, set: updatedSet, updatedIds, addedIds, revisedIds, artworkResults };
};

export const deleteWorkingCards = async ({
  access,
  documentId,
  expectedRevision,
  setId,
  cardIds,
}: {
  access: AccountToolAccess;
  documentId: string;
  expectedRevision: number;
  setId: string;
  cardIds: string[];
}) => {
  requireAccountToolCapability(access, 'studio.ai.create');
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

export const moveWorkingCards = async ({
  access,
  documentId,
  expectedRevision,
  sourceSetId,
  targetSetId,
  cardIds,
}: {
  access: AccountToolAccess;
  documentId: string;
  expectedRevision: number;
  sourceSetId: string;
  targetSetId: string;
  cardIds: string[];
}) => {
  requireAccountToolCapability(access, 'studio.ai.create');
  if (sourceSetId === targetSetId) throw new StudioDocumentStoreError('Source and target Set must be different.', 400);
  const retentionHours = await getStudioDocumentRetentionHours(access.entitlement);
  const current = await getStudioDocument(access.user.id, documentId, retentionHours);
  const source = requireSet(current.document.cardSets, sourceSetId);
  const target = requireSet(current.document.cardSets, targetSetId);
  const requested = new Set(cardIds);
  const cardsById = new Map(current.document.storedCards.map((card) => [card.uniqueId, card]));
  for (const id of requested) {
    const card = cardsById.get(id);
    if (!card || card.setId !== source.id) {
      throw new StudioDocumentStoreError(`Card ${id} is not in "${source.name}". Reload both Sets before moving cards.`, 404);
    }
  }
  const storedCards = current.document.storedCards.map((card) => (
    requested.has(card.uniqueId) ? { ...card, setId: target.id, setName: target.name } : card
  ));
  const cardSets = ensureCardSetTemplateReferences({ cardSets: current.document.cardSets, storedCards });
  const updatedSource = cardSets.find((candidate) => candidate.id === source.id) ?? source;
  const updatedTarget = cardSets.find((candidate) => candidate.id === target.id) ?? target;
  const document = await updateStudioDocument({
    ownerUserId: access.user.id,
    documentId,
    expectedRevision,
    title: current.title,
    document: {
      ...current.document,
      cardSets,
      activeCardSetId: target.id,
      storedCards,
    },
    retentionHours,
  });
  return { document, sourceSet: updatedSource, targetSet: updatedTarget, movedIds: [...requested] };
};

export const deleteWorkingCardSet = async ({
  access,
  documentId,
  expectedRevision,
  setId,
  deleteCards = false,
}: {
  access: AccountToolAccess;
  documentId: string;
  expectedRevision: number;
  setId: string;
  deleteCards?: boolean;
}) => {
  requireAccountToolCapability(access, 'studio.ai.create');
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
  const cardSets = current.document.cardSets.filter((candidate) => candidate.id !== set.id);
  const storedCards = deleteCards
    ? current.document.storedCards.filter((card) => card.setId !== set.id)
    : current.document.storedCards;
  const activeSet = cardSets[0] ?? null;
  const document = await updateStudioDocument({
    ownerUserId: access.user.id,
    documentId,
    expectedRevision,
    title: current.title,
    document: {
      ...current.document,
      cardSets,
      activeCardSetId: activeSet?.id ?? null,
      storedCards,
    },
    retentionHours,
  });
  return { document, deletedSet: set, deletedCardIds: deleteCards ? setCards.map((card) => card.uniqueId) : [] };
};