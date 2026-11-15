"use client";

import { decodeCardForgeProjectPackage, ProjectPackageError } from '../lib/projectPackageCodec';
import type { ProjectDocumentV1 } from '../model/projectDocument';
import { CARDFORGE_PROJECT_FILE_EXTENSION } from '../model/projectPackage';
import { getProjectPersistenceScope } from '../persistence/projectPersistenceScope';
import { useProjectStore } from '../store/workspaceStore';
import { materializeBrowserProjectSnapshot } from './browserProjectPackage';
import { applyProjectDocumentToWorkspace } from './projectWorkspaceDocument';

const requireSingleSetRegistry = (cardSets: unknown) => {
  if (!Array.isArray(cardSets) || cardSets.length !== 1) {
    throw new ProjectPackageError('Choose a file containing exactly one Set. Whole-workspace backups belong in browser recovery.');
  }
};

const requireCompleteSingleSet = (document: ProjectDocumentV1) => {
  requireSingleSetRegistry(document.cardSets);
  const set = document.cardSets[0]!;
  if (document.storedCards.some((card) => card.setId && card.setId !== set.id)) {
    throw new ProjectPackageError('This file contains cards outside its Set. Open it through workspace recovery instead.');
  }
  const templates = new Set(document.userTemplates.map((template) => template.id));
  const required = [...(set.templateIds ?? []), ...document.storedCards.flatMap((card) => [card.templateId, card.backingTemplateId])];
  if (required.some((id) => id && !templates.has(id))) {
    throw new ProjectPackageError('This Set file is missing a required Template snapshot. Existing work was left unchanged.');
  }
};

export const openBrowserSetFile = async (file: File, signal: AbortSignal): Promise<string> => {
  signal.throwIfAborted();
  if (!file.name.toLowerCase().endsWith(CARDFORGE_PROJECT_FILE_EXTENSION)) {
    throw new ProjectPackageError('Choose a .cardforge Set file. Whole-workspace backups belong in browser recovery.');
  }
  const scope = getProjectPersistenceScope();
  if (scope === 'unscoped-disabled') throw new Error('Wait for the browser workspace to finish opening before choosing a Set file.');
  const expectedState = useProjectStore.getState();
  const snapshot = await decodeCardForgeProjectPackage(file, (manifest) => {
    requireSingleSetRegistry((manifest as { project: { cardSets?: unknown } }).project.cardSets);
  });
  signal.throwIfAborted();
  if (getProjectPersistenceScope() !== scope) throw new Error('The workspace account changed while the Set file was opening. Choose the file again in the intended account.');
  const document = await materializeBrowserProjectSnapshot(snapshot, requireCompleteSingleSet);
  signal.throwIfAborted();
  if (getProjectPersistenceScope() !== scope) throw new Error('The workspace account changed while the Set file was opening. Choose the file again in the intended account.');
  const result = await applyProjectDocumentToWorkspace(document, 'copy', {
    expectedState, signal, validatePreparedDocument: requireCompleteSingleSet,
  });
  return result.activeSetId!;
};
