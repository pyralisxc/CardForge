"use client";

import { useMemo } from 'react';
import { selectAllGeneratedDisplayCards } from '../store/selectors';
import { useProjectStore } from '../store/workspaceStore';
import { useWorkspaceUpdates } from './useWorkspaceUpdates';
export type { WorkspaceTemplateUpdate as SetTemplateUpdate } from '../client/workspaceUpdates';

export function useSetTemplateUpdates(setId: string) {
  const cardSets = useProjectStore((state) => state.cardSets);
  const userTemplates = useProjectStore((state) => state.userTemplates);
  const defaultTemplates = useProjectStore((state) => state.defaultTemplates);
  const storedCards = useProjectStore((state) => state.storedCards);
  const workspace = useWorkspaceUpdates();
  const projection = workspace.sets.find((candidate) => candidate.set.id === setId);
  const set = cardSets.find((candidate) => candidate.id === setId);
  const cards = useMemo(() => {
    const state = useProjectStore.getState();
    return selectAllGeneratedDisplayCards({ ...state, cardSets, defaultTemplates, storedCards, userTemplates })
      .filter((card) => (card.setId ?? cardSets[0]?.id) === setId);
  }, [cardSets, defaultTemplates, storedCards, userTemplates, setId]);
  return { set, cards, items: projection?.items ?? [], unavailable: projection?.unavailable.map((item) => item.review) ?? [],
    checking: workspace.checking, error: workspace.inspectionError, pending: projection?.pending ?? 0, refresh: workspace.refreshLocal };
}
