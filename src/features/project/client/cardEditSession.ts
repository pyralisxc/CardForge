"use client";

import type { StoredDisplayCard } from '@/domain/cards';
import type { DisplayCard } from '@/domain/rendering';

import { getProjectPersistenceScope, type ProjectPersistenceScope } from '../persistence/projectPersistenceScope';
import { selectAllGeneratedDisplayCards } from '../store/selectors';
import { useProjectStore } from '../store/workspaceStore';

export interface ProjectCardEditSession {
  scope: ProjectPersistenceScope;
  setId: string;
  card: DisplayCard;
  original: StoredDisplayCard;
}

const sameSnapshot = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

/** Capture the owned card and its resolved Templates before a surface opens an editor. */
export const beginProjectCardEdit = (setId: string, cardId: string): ProjectCardEditSession | null => {
  const scope = getProjectPersistenceScope();
  if (scope === 'unscoped-disabled') return null;
  const state = useProjectStore.getState();
  const original = state.storedCards.find((card) => card.uniqueId === cardId
    && (card.setId ?? state.cardSets[0]?.id) === setId);
  const card = selectAllGeneratedDisplayCards(state).find((item) => item.uniqueId === cardId
    && (item.setId ?? state.cardSets[0]?.id) === setId);
  if (!original || !card || !state.cardSets.some((set) => set.id === setId)) return null;
  return { scope, setId, card: structuredClone(card), original: structuredClone(original) };
};

const isCurrentCard = (session: ProjectCardEditSession, state: ReturnType<typeof useProjectStore.getState>) => {
  // Both the editor and removal owner update every matching ID; ambiguous
  // identities must fail before either operation touches authored work.
  if (state.storedCards.filter((card) => card.uniqueId === session.original.uniqueId).length !== 1) return false;
  const current = state.storedCards.find((item) => item.uniqueId === session.original.uniqueId);
  const resolved = selectAllGeneratedDisplayCards(state).find((item) => item.uniqueId === session.original.uniqueId);
  return getProjectPersistenceScope() === session.scope && Boolean(current && resolved
    && state.cardSets.some((set) => set.id === session.setId)
    && (current.setId ?? state.cardSets[0]?.id) === session.setId
    && sameSnapshot(current, session.original)
    && sameSnapshot(resolved.template, session.card.template)
    && sameSnapshot(resolved.backingTemplate, session.card.backingTemplate));
};

/** Commit only card content when the original owned work and scope still match. */
export const saveProjectCardEdit = (session: ProjectCardEditSession, card: DisplayCard): boolean => {
  const state = useProjectStore.getState();
  if (!isCurrentCard(session, state)
    || card.uniqueId !== session.original.uniqueId || card.setId !== session.card.setId
    || card.backingTemplateId !== session.card.backingTemplateId
    || !sameSnapshot(card.template, session.card.template)
    || !sameSnapshot(card.backingTemplate, session.card.backingTemplate)) return false;
  state.updateGeneratedCard({ ...session.card, data: card.data, backingData: card.backingData });
  return true;
};

/** Remove the confirmed exact card through the existing session recovery owner. */
export const removeProjectCard = (session: ProjectCardEditSession): boolean => {
  const state = useProjectStore.getState();
  return isCurrentCard(session, state) && state.removeGeneratedCards([session.original.uniqueId]) === 1;
};
