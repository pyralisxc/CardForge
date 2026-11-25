import { normalizeCardSet } from '@/domain/cards';
import { ProjectPackageError } from '../lib/projectPackageCodec';
import type { ProjectDocumentV1 } from '../model/projectDocument';

export const requireSingleSetRegistry = (cardSets: unknown) => {
  if (!Array.isArray(cardSets) || cardSets.length !== 1) {
    throw new ProjectPackageError('Choose a file containing exactly one Set. Whole-workspace backups belong in browser recovery.');
  }
  if (!normalizeCardSet(cardSets[0])) throw new ProjectPackageError('This file has no valid Set identity. Open legacy material through workspace recovery instead.');
};

export const requireCompleteSingleSet = (document: ProjectDocumentV1) => {
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
