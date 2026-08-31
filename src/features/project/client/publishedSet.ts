"use client";

import {
  decodeCardForgeProjectPackage,
  hydrateCardForgeProjectSnapshot,
  ProjectPackageError,
} from '../lib/projectPackageCodec';
import { applyProjectDocumentToWorkspace } from './projectWorkspaceDocument';
import { useProjectStore } from '../store/workspaceStore';

export interface PublishedSetCopyResult {
  setId: string;
  setName: string;
  cardCount: number;
}

export const createPublishedSetCopy = async ({
  packageUrl,
  expectedName,
}: {
  packageUrl: string;
  expectedName?: string;
}): Promise<PublishedSetCopyResult> => {
  const response = await fetch(packageUrl, { cache: 'no-store' });
  if (!response.ok) throw new ProjectPackageError('The published Set package is unavailable.');
  const snapshot = await decodeCardForgeProjectPackage(await response.blob());
  const document = hydrateCardForgeProjectSnapshot(snapshot);
  if (document.cardSets.length !== 1) throw new ProjectPackageError('Published starters must contain exactly one Set.');
  const sourceSetId = document.cardSets[0]?.id;
  if (!sourceSetId || !document.storedCards.some((card) => card.setId === sourceSetId)) {
    throw new ProjectPackageError('Published starters must contain at least one card.');
  }
  await applyProjectDocumentToWorkspace(document, 'copy');
  const state = useProjectStore.getState();
  const set = state.activeCardSet;
  if (!set) throw new ProjectPackageError('The published Set could not be added to this Desk.');
  if (expectedName?.trim() && set.name !== expectedName.trim()) {
    state.renameCardSet(set.id, expectedName.trim());
  }
  const next = useProjectStore.getState();
  if (!next.activeCardSet) throw new ProjectPackageError('The published Set could not be focused on this Desk.');
  const activeSet = next.activeCardSet;
  return {
    setId: activeSet.id,
    setName: activeSet.name,
    cardCount: next.storedCards.filter((card) => card.setId === activeSet.id).length,
  };
};
