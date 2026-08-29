import { nanoid } from 'nanoid';
import type { StateCreator } from 'zustand';

import type { CardSetOrganization } from '@/domain/cards';

import type { OrganizationSlice, ProjectState } from './types';

export const DEFAULT_CARD_SET_ORGANIZATION: CardSetOrganization = {
  arrangement: 'grid',
  groupBy: 'none',
  sort: 'manual',
  tags: [],
  positions: {},
};

const organizationFor = (state: ProjectState, setId: string): CardSetOrganization => (
  state.cardSets.find((set) => set.id === setId)?.organization ?? DEFAULT_CARD_SET_ORGANIZATION
);

const updateSet = (
  state: ProjectState,
  setId: string,
  organization: CardSetOrganization,
) => {
  const cardSets = state.cardSets.map((set) => set.id === setId ? { ...set, organization } : set);
  const activeCardSet = state.activeCardSet.id === setId
    ? { ...state.activeCardSet, organization }
    : state.activeCardSet;
  return { cardSets, activeCardSet };
};

export const createOrganizationSlice: StateCreator<ProjectState, [], [], OrganizationSlice> = (set, get) => ({
  updateCardSetOrganization: (setId, patch) => {
    if (!get().cardSets.some((candidate) => candidate.id === setId)) return false;
    set((state) => updateSet(state, setId, { ...organizationFor(state, setId), ...patch }));
    return true;
  },
  addCardSetTag: (setId, label) => {
    const normalizedLabel = label.trim();
    if (!normalizedLabel || !get().cardSets.some((candidate) => candidate.id === setId)) return null;
    const existing = organizationFor(get(), setId).tags.find((tag) => tag.label.toLocaleLowerCase() === normalizedLabel.toLocaleLowerCase());
    if (existing) return existing.id;
    const id = `tag-${nanoid()}`;
    set((state) => {
      const organization = organizationFor(state, setId);
      return updateSet(state, setId, { ...organization, tags: [...organization.tags, { id, label: normalizedLabel }] });
    });
    return id;
  },
  renameCardSetTag: (setId, tagId, label) => {
    const normalizedLabel = label.trim();
    if (!normalizedLabel || !organizationFor(get(), setId).tags.some((tag) => tag.id === tagId)) return false;
    set((state) => {
      const organization = organizationFor(state, setId);
      return updateSet(state, setId, {
        ...organization,
        tags: organization.tags.map((tag) => tag.id === tagId ? { ...tag, label: normalizedLabel } : tag),
      });
    });
    return true;
  },
  removeCardSetTag: (setId, tagId) => {
    if (!organizationFor(get(), setId).tags.some((tag) => tag.id === tagId)) return false;
    set((state) => {
      const organization = organizationFor(state, setId);
      return {
        ...updateSet(state, setId, {
          ...organization,
          tags: organization.tags.filter((tag) => tag.id !== tagId),
          groupTagId: organization.groupTagId === tagId ? undefined : organization.groupTagId,
        }),
        storedCards: state.storedCards.map((card) => ({
          ...card,
          tagIds: card.tagIds?.filter((id) => id !== tagId),
        })),
      };
    });
    return true;
  },
  setCardsTag: (cardIds, tagId, applied) => {
    const ids = new Set(cardIds);
    if (!ids.size || !get().cardSets.some((set) => set.organization?.tags.some((tag) => tag.id === tagId))) return 0;
    let changed = 0;
    set((state) => ({
      storedCards: state.storedCards.map((card) => {
        if (!ids.has(card.uniqueId)) return card;
        const tags = new Set(card.tagIds ?? []);
        const hadTag = tags.has(tagId);
        if (applied) tags.add(tagId); else tags.delete(tagId);
        if (hadTag === tags.has(tagId)) return card;
        changed += 1;
        return { ...card, tagIds: [...tags], updatedAt: new Date().toISOString() };
      }),
    }));
    return changed;
  },
  setCardPositions: (setId, positions) => {
    if (!get().cardSets.some((candidate) => candidate.id === setId)) return false;
    set((state) => {
      const organization = organizationFor(state, setId);
      return updateSet(state, setId, { ...organization, positions: { ...organization.positions, ...positions } });
    });
    return true;
  },
});
