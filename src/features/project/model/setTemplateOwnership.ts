import { nanoid } from 'nanoid';

import { authoredPlanInputSurvives, authoredPlanValuesEqual, ensureCardSetTemplateReferences, type CardSet, type SetUpdateReview, type StoredDisplayCard } from '@/domain/cards';
import { createPersonalTemplateFork, getAuthoredTemplatePayload, reconstructMinimalTemplateObject, type TCGCardTemplate } from '@/domain/templates';

export interface SetTemplateState {
  cardSets: CardSet[];
  storedCards: StoredDisplayCard[];
  userTemplates: TCGCardTemplate[];
}

export class SetTemplateOwnershipError extends Error {
  constructor(readonly kind: 'not_found' | 'unavailable' | 'conflict', message: string) {
    super(message);
    this.name = 'SetTemplateOwnershipError';
  }
}

const indexSnapshots = (templates: readonly TCGCardTemplate[]) => {
  const snapshots = new Map<string, TCGCardTemplate>();
  for (const template of templates) {
    if (!template.id) continue;
    const previous = snapshots.get(template.id);
    if (previous && !authoredPlanValuesEqual(previous, template)) {
      throw new SetTemplateOwnershipError('conflict', `Template ${template.id} has conflicting definitions. Resolve the source mapping before changing this Set; the source was kept.`);
    }
    snapshots.set(template.id, template);
  }
  return snapshots;
};

export const getCardSetTemplateIds = (state: SetTemplateState, setId: string): string[] => [...new Set([
  ...(state.cardSets.find((set) => set.id === setId)?.templateIds ?? []),
  ...state.storedCards.filter((card) => (card.setId ?? state.cardSets[0]?.id) === setId)
    .flatMap((card) => [card.templateId, card.backingTemplateId]),
].filter((id): id is string => Boolean(id)))];

const indexOwners = (state: SetTemplateState) => {
  const owners = new Map<string, Set<string>>();
  const include = (templateId: string | null | undefined, setId: string | undefined) => {
    if (!templateId || !setId) return;
    const sets = owners.get(templateId) ?? new Set<string>();
    sets.add(setId);
    owners.set(templateId, sets);
  };
  state.cardSets.forEach((set) => set.templateIds?.forEach((id) => include(id, set.id)));
  state.storedCards.forEach((card) => {
    const setId = card.setId ?? state.cardSets[0]?.id;
    include(card.templateId, setId);
    include(card.backingTemplateId, setId);
  });
  return owners;
};

export const getTemplateReferenceSetIds = (state: SetTemplateState, templateId: string): string[] => [...(indexOwners(state).get(templateId) ?? [])];

const resolveOwner = (state: SetTemplateState, templateId: string, owners: Map<string, Set<string>>): string | null => {
  if (!state.userTemplates.some((template) => template.id === templateId && template.templateSource !== 'default')) return null;
  const sets = owners.get(templateId);
  if (sets && sets.size > 1) {
    throw new SetTemplateOwnershipError('conflict', `Template ${templateId} is still shared by multiple Sets. Preserve the source and resolve its working copies before editing.`);
  }
  return sets?.values().next().value ?? null;
};

/** References confer working ownership only after the versioned legacy conversion. */
export const getTemplateOwnerSetId = (state: SetTemplateState, templateId: string): string | null => resolveOwner(state, templateId, indexOwners(state));

export const inheritCompletedSetUpdateReviews = (
  cardSets: CardSet[],
  sourceSetId: string | null,
  sourceTemplateId: string,
  destinationSetId: string,
  destinationTemplateId: string,
): CardSet[] => {
  if (sourceTemplateId === destinationTemplateId) return cardSets;
  const inherited = cardSets.find((set) => set.id === sourceSetId)?.updateReviews
    ?.filter((review) => review.templateId === sourceTemplateId && review.outcome === 'reviewed') ?? [];
  if (!inherited.length) return cardSets;
  return cardSets.map((set) => {
    if (set.id !== destinationSetId) return set;
    const bySource = new Map((set.updateReviews ?? []).map((review) => [
      JSON.stringify([review.templateId, review.sourceLineageId, review.sourceRevisionId]), review,
    ]));
    inherited.forEach((review) => {
      const copied: SetUpdateReview = { ...structuredClone(review), templateId: destinationTemplateId };
      bySource.set(JSON.stringify([copied.templateId, copied.sourceLineageId, copied.sourceRevisionId]), copied);
    });
    return { ...set, updateReviews: [...bySource.values()] };
  });
};

export const preserveReferencedTemplateIdentities = (
  state: SetTemplateState,
  incoming: TCGCardTemplate[],
): TCGCardTemplate[] => {
  const incomingById = new Map<string, TCGCardTemplate>();
  for (const template of incoming) {
    if (!template.id) continue;
    const duplicate = incomingById.get(template.id);
    if (duplicate && !authoredPlanValuesEqual(duplicate, template)) {
      throw new SetTemplateOwnershipError('conflict', `Template ${template.id} has conflicting imported definitions. Resolve the source mapping before changing this workspace; existing work was kept.`);
    }
    incomingById.set(template.id, template);
  }
  const referencedIds = new Set([
    ...state.cardSets.flatMap((set) => set.templateIds ?? []),
    ...state.storedCards.flatMap((card) => [card.templateId, card.backingTemplateId]),
  ].filter((id): id is string => Boolean(id)));
  const currentById = new Map(state.userTemplates.flatMap((template) => template.id ? [[template.id, template] as const] : []));
  for (const id of referencedIds) {
    const current = currentById.get(id);
    const replacement = incomingById.get(id);
    if (!current) {
      if (replacement) {
        throw new SetTemplateOwnershipError('conflict', `Template ${id} is an unresolved historical reference. Reload or explicitly convert the source before adding a definition with that identity; existing work was kept.`);
      }
      continue;
    }
    if (replacement && !authoredPlanValuesEqual(current, replacement)) {
      throw new SetTemplateOwnershipError('conflict', `Template ${id} is referenced by Set work. Save through that Set or install an independent copy; existing work was kept.`);
    }
    if (!replacement) incomingById.set(id, current);
  }
  return [...incomingById.values()];
};

const copyWorkingTemplate = (source: TCGCardTemplate, createId: () => string) => {
  const canonicalSource = reconstructMinimalTemplateObject(structuredClone(source));
  if (!authoredPlanInputSurvives(getAuthoredTemplatePayload(source), getAuthoredTemplatePayload(canonicalSource))) {
    throw new SetTemplateOwnershipError('unavailable', `Template ${source.id ?? '(unknown)'} contains authored fields this CardForge version cannot preserve during Set acquisition. Export or revise it with a compatible version; its original work was kept.`);
  }
  return reconstructMinimalTemplateObject({
  ...createPersonalTemplateFork(canonicalSource, {}, createId),
  templateContributorName: source.templateContributorName,
  });
};

export const prepareSetTemplateAcquisition = (
  state: SetTemplateState,
  setId: string,
  templateIds: readonly string[],
  availableTemplates: readonly TCGCardTemplate[] = [],
  createId: () => string = nanoid,
): { userTemplates: TCGCardTemplate[]; templateIds: Map<string, string> } => {
  if (!state.cardSets.some((set) => set.id === setId)) {
    throw new SetTemplateOwnershipError('not_found', 'The destination Set is no longer available. Your authored work was kept.');
  }
  const snapshots = new Map([...indexSnapshots(availableTemplates), ...indexSnapshots(state.userTemplates)]);
  const owners = indexOwners(state);
  const acquired = new Map<string, string>();
  const copies: TCGCardTemplate[] = [];
  for (const id of new Set(templateIds)) {
    if (resolveOwner(state, id, owners) === setId) {
      acquired.set(id, id);
      continue;
    }
    const source = snapshots.get(id);
    if (!source) {
      throw new SetTemplateOwnershipError('unavailable', `Template ${id} has no available source snapshot. Choose and review a design before acquiring it; your authored work was kept.`);
    }
    const copy = copyWorkingTemplate(source, createId);
    copies.push(copy);
    acquired.set(id, copy.id!);
  }
  return { userTemplates: [...state.userTemplates, ...copies], templateIds: acquired };
};

export const prepareCardSetTemplateBindings = (
  state: SetTemplateState,
  storedCards: StoredDisplayCard[],
  availableTemplates: readonly TCGCardTemplate[] = [],
) => {
  const previous = new Map(state.storedCards.map((card) => [card.uniqueId, card]));
  const requested = new Map<string, Set<string>>();
  const changedBindings = new Set<string>();
  for (const card of storedCards) {
    const before = previous.get(card.uniqueId);
    const setId = card.setId ?? state.cardSets[0]?.id;
    if (!setId || (before && (before.setId ?? state.cardSets[0]?.id) === setId
      && before.templateId === card.templateId && before.backingTemplateId === card.backingTemplateId)) continue;
    changedBindings.add(card.uniqueId);
    const ids = requested.get(setId) ?? new Set<string>();
    [card.templateId, card.backingTemplateId].forEach((id) => { if (id) ids.add(id); });
    requested.set(setId, ids);
  }
  let userTemplates = state.userTemplates;
  let cardSets = state.cardSets;
  const templateIdsBySet = new Map<string, Map<string, string>>();
  for (const [setId, ids] of requested) {
    const acquired = prepareSetTemplateAcquisition({ ...state, userTemplates }, setId, [...ids], availableTemplates);
    userTemplates = acquired.userTemplates;
    templateIdsBySet.set(setId, acquired.templateIds);
    acquired.templateIds.forEach((destinationTemplateId, sourceTemplateId) => {
      cardSets = inheritCompletedSetUpdateReviews(
        cardSets, getTemplateOwnerSetId(state, sourceTemplateId), sourceTemplateId, setId, destinationTemplateId,
      );
    });
  }
  const cards = storedCards.map((card) => {
    if (!changedBindings.has(card.uniqueId)) return card;
    const mapping = templateIdsBySet.get(card.setId ?? state.cardSets[0]?.id ?? '');
    return {
      ...card,
      templateId: mapping?.get(card.templateId) ?? card.templateId,
      backingTemplateId: card.backingTemplateId ? mapping?.get(card.backingTemplateId) ?? card.backingTemplateId : card.backingTemplateId,
    };
  });
  const preparedSets = ensureCardSetTemplateReferences({ cardSets, storedCards: state.storedCards });
  const completedSets = ensureCardSetTemplateReferences({ cardSets: preparedSets, storedCards: cards });
  return { userTemplates, storedCards: cards, cardSets: completedSets, templateIdsBySet };
};

/** Only persisted definitions establish a legacy snapshot; current catalog content is not historical evidence. */
export const materializeLegacySetTemplates = <T extends SetTemplateState>(state: T, createId: () => string = nanoid): { state: T; templateIdsBySet: Map<string, Map<string, string>> } => {
  const snapshots = indexSnapshots(state.userTemplates);
  const mappings = new Map<string, Map<string, string>>();
  const copies: TCGCardTemplate[] = [];
  for (const set of state.cardSets) {
    const mapping = new Map<string, string>();
    for (const id of getCardSetTemplateIds(state, set.id)) {
      const source = snapshots.get(id);
      if (!source) continue;
      const copy = copyWorkingTemplate(source, createId);
      copies.push(copy);
      mapping.set(id, copy.id!);
    }
    mappings.set(set.id, mapping);
  }
  const storedCards = state.storedCards.map((card) => {
    const mapping = mappings.get(card.setId ?? state.cardSets[0]?.id ?? '');
    return {
      ...card,
      templateId: mapping?.get(card.templateId) ?? card.templateId,
      backingTemplateId: card.backingTemplateId ? mapping?.get(card.backingTemplateId) ?? card.backingTemplateId : card.backingTemplateId,
    };
  });
  const cardSets = ensureCardSetTemplateReferences({
    cardSets: state.cardSets.map((set) => ({
      ...set,
      ...(set.templateIds ? { templateIds: set.templateIds.map((id) => mappings.get(set.id)?.get(id) ?? id) } : {}),
    })),
    storedCards,
  });
  return { state: { ...state, cardSets, storedCards, userTemplates: [...state.userTemplates, ...copies] }, templateIdsBySet: mappings };
};

export const assertSetTemplateOwnership = (state: SetTemplateState, requireComplete = false): void => {
  const snapshots = indexSnapshots(state.userTemplates);
  const owners = indexOwners(state);
  for (const set of state.cardSets) {
    for (const id of getCardSetTemplateIds(state, set.id)) {
      const template = snapshots.get(id);
      if (!template || template.templateSource === 'default') {
        if (requireComplete) {
          throw new SetTemplateOwnershipError('unavailable', `Set ${set.name} still needs a working snapshot for Template ${id}. Review that design before saving a complete Set; your authored work was kept.`);
        }
        continue;
      }
      resolveOwner(state, id, owners);
    }
  }
};

/** Validate identity transitions, not just the final reference count. */
export const assertSetTemplateOwnershipTransition = (
  previous: SetTemplateState,
  next: SetTemplateState,
  legacyPrevious = false,
): void => {
  assertSetTemplateOwnership(next);
  const before = indexSnapshots(previous.userTemplates);
  const after = indexSnapshots(next.userTemplates);
  const previousOwners = indexOwners(previous);
  const nextOwners = indexOwners(next);
  for (const [id, template] of before) {
    const updated = after.get(id);
    if (legacyPrevious && previousOwners.has(id)) {
      if (!updated || nextOwners.has(id) || !authoredPlanValuesEqual(getAuthoredTemplatePayload(template), getAuthoredTemplatePayload(updated))) {
        throw new SetTemplateOwnershipError('conflict', 'The legacy source design must be preserved before its working copies can change. Open or convert the Set, then reload its current design ids; your draft was kept.');
      }
      continue;
    }
    if (!updated) continue;
    const owner = resolveOwner(previous, id, previousOwners);
    const nextOwner = resolveOwner(next, id, nextOwners);
    if (owner !== nextOwner) {
      throw new SetTemplateOwnershipError('conflict', 'A working design cannot be transferred by changing its references. Acquire an independent copy in the destination Set; existing work was kept.');
    }
  }
  for (const id of previousOwners.keys()) {
    if (!before.has(id) && after.has(id)) {
      throw new SetTemplateOwnershipError('conflict', 'The original design snapshot is missing. Review and acquire a new design rather than replacing the unresolved historical identity.');
    }
  }
};
