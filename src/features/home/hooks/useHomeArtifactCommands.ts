"use client";

import { useToast } from '@/components/ui/use-toast';

import type { useHomeProjectWorkspace } from './useHomeProjectWorkspace';

type ProjectWorkspace = ReturnType<typeof useHomeProjectWorkspace>;

interface UseHomeArtifactCommandsOptions {
  actions: Pick<ProjectWorkspace['actions'],
    'addCardSetTag' | 'addGeneratedCards' | 'moveGeneratedCardsToSet' | 'openEditDialog'
    | 'reorderGeneratedCard' | 'setActiveCardSetId' | 'setCardsTag' | 'setStudioView'
    | 'updateCardSetOrganization'>;
  state: Pick<ProjectWorkspace['state'],
    'cardSets' | 'effectiveMoveTargetId' | 'focusedCards' | 'selectedCard' | 'selectedCards'>;
  focusedSetId: string | null;
  openDesign: (setId: string) => void;
  setSelection: (ids: string[]) => void;
  setTagDraft: (value: string) => void;
  tagDraft: string;
}

export function useHomeArtifactCommands({
  actions,
  state,
  focusedSetId,
  openDesign,
  setSelection,
  setTagDraft,
  tagDraft,
}: UseHomeArtifactCommandsOptions) {
  const { toast } = useToast();

  const applyNewTag = () => {
    if (!focusedSetId || !state.selectedCards.length) return;
    const tagId = actions.addCardSetTag(focusedSetId, tagDraft);
    if (!tagId) return;
    actions.setCardsTag(state.selectedCards.map((card) => card.uniqueId), tagId, true);
    setTagDraft('');
  };

  const moveSelectedCards = () => {
    if (!state.selectedCards.length || !state.effectiveMoveTargetId) return;
    const movedCount = actions.moveGeneratedCardsToSet(
      state.selectedCards.map((card) => card.uniqueId),
      state.effectiveMoveTargetId,
    );
    if (!movedCount) return;
    const destination = state.cardSets.find((set) => set.id === state.effectiveMoveTargetId);
    toast({
      title: `${movedCount} card${movedCount === 1 ? '' : 's'} moved`,
      description: `The selection now belongs to ${destination?.name ?? 'the selected Set'}.`,
    });
    setSelection([]);
  };

  const editSelectedCard = (artifactId: string = state.selectedCard?.uniqueId ?? '') => {
    const card = state.focusedCards.find((candidate) => candidate.uniqueId === artifactId);
    if (!card || !focusedSetId) return;
    actions.setActiveCardSetId(focusedSetId);
    actions.setStudioView('template');
    actions.openEditDialog(card.uniqueId);
    openDesign(focusedSetId);
  };

  const duplicateSelectedCards = () => {
    if (!state.selectedCards.length || !focusedSetId) return;
    actions.setActiveCardSetId(focusedSetId);
    actions.addGeneratedCards(state.selectedCards.map((card) => ({
      ...card,
      uniqueId: `card-${globalThis.crypto.randomUUID()}`,
      setId: focusedSetId,
    })));
    toast({
      title: `${state.selectedCards.length} card${state.selectedCards.length === 1 ? '' : 's'} duplicated`,
      description: 'Each copy is independently editable in this Set.',
    });
  };

  const reorderSelectedCard = (direction: 'earlier' | 'later') => {
    if (state.selectedCard) actions.reorderGeneratedCard(state.selectedCard.uniqueId, direction);
  };

  const updateOrganization: typeof actions.updateCardSetOrganization = (setId, patch) => {
    return actions.updateCardSetOrganization(setId, patch);
  };

  return {
    applyNewTag,
    duplicateSelectedCards,
    editSelectedCard,
    moveSelectedCards,
    reorderSelectedCard,
    updateOrganization: (patch: Parameters<typeof actions.updateCardSetOrganization>[1]) => {
      if (focusedSetId) updateOrganization(focusedSetId, patch);
    },
  };
}
