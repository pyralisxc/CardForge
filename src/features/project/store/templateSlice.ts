import { nanoid } from 'nanoid';
import type { StateCreator } from 'zustand';

import { ensureCardSetTemplateReferences } from '@/domain/cards';
import { createPersonalTemplateFork, reconstructMinimalTemplateObject, type TCGCardTemplate } from '@/domain/templates';

import { selectAllTemplates } from './selectors';
import type { ProjectState, TemplateSlice } from './types';
import { isDraftTemplateSelection } from './workspaceDefaults';

const selectFallbackTemplateId = (templates: TCGCardTemplate[], selectedId: string | null, preferredTemplateId: string | null = null): string | null => {
  const selectedStillExists = selectedId ? isDraftTemplateSelection(selectedId) || templates.some((template) => template.id === selectedId) : false;
  if (selectedStillExists) return selectedId;
  const preferredTemplate = preferredTemplateId ? templates.find((template) => template.id === preferredTemplateId && template.templateUsage !== 'back-preset') : null;
  return preferredTemplate?.id ?? templates.find((template) => template.templateUsage !== 'back-preset')?.id ?? null;
};

const selectFallbackEditorTemplateId = (templates: TCGCardTemplate[], selectedId: string | null, generatorTemplateId: string | null): string | null => {
  const selectedStillExists = selectedId ? isDraftTemplateSelection(selectedId) || templates.some((template) => template.id === selectedId) : false;
  if (selectedStillExists) return selectedId;
  if (generatorTemplateId && templates.some((template) => template.id === generatorTemplateId)) return generatorTemplateId;
  return templates[0]?.id ?? null;
};

const removeKeys = (data: Record<string, string | number | undefined> | undefined, keys: readonly string[]) => {
  if (!data || !keys.length) return data;
  const next = { ...data };
  keys.forEach((key) => { delete next[key]; });
  return next;
};

export const createTemplateSlice: StateCreator<ProjectState, [], [], TemplateSlice> = (set, get) => ({
  defaultTemplates: [],
  userTemplates: [],

  addOrUpdateTemplate: (template, source) => {
    const templateToSave = { ...template, id: template.id?.trim() ? template.id : nanoid(), templateSource: source || template.templateSource || 'user' };
    const reconstructed = reconstructMinimalTemplateObject(templateToSave);
    const finalId = reconstructed.id!;
    set((state) => {
      const current = reconstructed.templateSource === 'default' ? state.defaultTemplates : state.userTemplates;
      const next = [...current];
      const existingIndex = next.findIndex((candidate) => candidate.id === finalId);
      if (existingIndex > -1) next[existingIndex] = reconstructed;
      else next.push(reconstructed);
      const canonical = next.map((candidate) => reconstructMinimalTemplateObject(candidate));
      if (JSON.stringify(current) === JSON.stringify(canonical)) return state;
      return reconstructed.templateSource === 'default' ? { defaultTemplates: canonical } : { userTemplates: canonical };
    });
    return finalId;
  },

  commitTemplateChange: ({ template, source, sourceTemplateId, artifactIds, face, removedFieldKeys = [], setId }) => {
    const reconstructed = reconstructMinimalTemplateObject({ ...template, id: template.id?.trim() ? template.id : nanoid(), templateSource: source || template.templateSource || 'user' });
    const finalId = reconstructed.id!;
    const fromId = sourceTemplateId?.trim() || finalId;
    const scope = artifactIds ? new Set(artifactIds) : null;
    const targetFace = face ?? (reconstructed.templateUsage === 'back-preset' ? 'back' : 'front');
    set((state) => {
      const targetCollection = reconstructed.templateSource === 'default' ? state.defaultTemplates : state.userTemplates;
      const nextCollection = [...targetCollection];
      const existingIndex = nextCollection.findIndex((candidate) => candidate.id === finalId);
      if (existingIndex >= 0) nextCollection[existingIndex] = reconstructed;
      else nextCollection.push(reconstructed);
      const storedCards = state.storedCards.map((card) => {
        const inScope = !scope || scope.has(card.uniqueId);
        if (!inScope) return card;
        let next = card;
        if (finalId !== fromId) {
          if (targetFace === 'front' && card.templateId === fromId) next = { ...next, templateId: finalId };
          if (targetFace === 'back' && card.backingTemplateId === fromId) next = { ...next, backingTemplateId: finalId };
        }
        const usesTarget = targetFace === 'front' ? next.templateId === finalId : next.backingTemplateId === finalId;
        if (!usesTarget || !removedFieldKeys.length) return next;
        return targetFace === 'front'
          ? { ...next, data: removeKeys(next.data, removedFieldKeys) ?? {}, updatedAt: new Date().toISOString() }
          : { ...next, backingData: removeKeys(next.backingData, removedFieldKeys), updatedAt: new Date().toISOString() };
      });
      let cardSets = ensureCardSetTemplateReferences({ cardSets: state.cardSets, storedCards });
      if (setId) cardSets = cardSets.map((cardSet) => cardSet.id === setId && !cardSet.templateIds?.includes(finalId)
        ? { ...cardSet, templateIds: [...(cardSet.templateIds ?? []), finalId] }
        : cardSet);
      const activeCardSet = state.activeCardSet ? cardSets.find((cardSet) => cardSet.id === state.activeCardSet?.id) ?? state.activeCardSet : null;
      return {
        ...(reconstructed.templateSource === 'default'
          ? { defaultTemplates: nextCollection.map((candidate) => reconstructMinimalTemplateObject(candidate)) }
          : { userTemplates: nextCollection.map((candidate) => reconstructMinimalTemplateObject(candidate)) }),
        storedCards,
        cardSets,
        activeCardSet,
        templateEditorSelectedTemplateId: finalId,
        ...(reconstructed.templateUsage !== 'back-preset' ? { generatorSelectedTemplateId: finalId } : {}),
      };
    });
    return finalId;
  },

  clearPersonalTemplateOverride: (templateId) => set((state) => ({
    userTemplates: state.userTemplates.filter((template) => template.id !== templateId),
  })),

  setDefaultTemplatesFromFiles: (templates, preferredTemplateId = null) => {
    const reconstructed = templates.map((template) => reconstructMinimalTemplateObject({ ...template, templateSource: 'default' })).filter((template) => Boolean(template.id?.trim()));
    if (reconstructed.length === 0) return 0;
    set((state) => {
      const allTemplates = selectAllTemplates({ defaultTemplates: reconstructed, userTemplates: state.userTemplates });
      const selectedId = selectFallbackTemplateId(allTemplates, state.generatorSelectedTemplateId, preferredTemplateId);
      return { defaultTemplates: reconstructed, generatorSelectedTemplateId: selectedId, templateEditorSelectedTemplateId: selectFallbackEditorTemplateId(allTemplates, state.templateEditorSelectedTemplateId, selectedId) };
    });
    return reconstructed.length;
  },

  setUserTemplatesFromFiles: (templates) => {
    const reconstructed = templates.map((template) => reconstructMinimalTemplateObject({ ...template, templateSource: 'user' })).filter((template) => Boolean(template.id?.trim()));
    set((state) => {
      const allTemplates = selectAllTemplates({ defaultTemplates: state.defaultTemplates, userTemplates: reconstructed });
      const selectedId = selectFallbackTemplateId(allTemplates, state.generatorSelectedTemplateId);
      return { userTemplates: reconstructed, generatorSelectedTemplateId: selectedId, templateEditorSelectedTemplateId: selectFallbackEditorTemplateId(allTemplates, state.templateEditorSelectedTemplateId, selectedId) };
    });
    return reconstructed.length;
  },

  mergeUserTemplatesFromFiles: (templates) => {
    const reconstructed = templates.map((template) => reconstructMinimalTemplateObject({ ...template, templateSource: 'user' })).filter((template) => Boolean(template.id?.trim()));
    if (reconstructed.length === 0) return 0;
    set((state) => {
      const byId = new Map<string, TCGCardTemplate>();
      [...state.userTemplates, ...reconstructed].forEach((template) => { if (template.id) byId.set(template.id, template); });
      const userTemplates = Array.from(byId.values());
      const allTemplates = selectAllTemplates({ defaultTemplates: state.defaultTemplates, userTemplates });
      const selectedId = selectFallbackTemplateId(allTemplates, state.generatorSelectedTemplateId);
      return { userTemplates, generatorSelectedTemplateId: selectedId, templateEditorSelectedTemplateId: selectFallbackEditorTemplateId(allTemplates, state.templateEditorSelectedTemplateId, selectedId) };
    });
    return reconstructed.length;
  },

  cloneTemplate: (templateId) => {
    const source = selectAllTemplates(get()).find((template) => template.id === templateId);
    if (!source) return null;
    const cloned = reconstructMinimalTemplateObject(createPersonalTemplateFork(source, { name: `Copy of ${source.name}` }));
    set((state) => ({ userTemplates: [...state.userTemplates, cloned] }));
    return cloned.id!;
  },

  deleteTemplate: (templateId, source) => set((state) => {
    const targetSource = source || selectAllTemplates(state).find((template) => template.id === templateId)?.templateSource || 'user';
    const defaultTemplates = targetSource === 'default' ? state.defaultTemplates.filter((template) => template.id !== templateId) : state.defaultTemplates;
    const userTemplates = targetSource === 'user' ? state.userTemplates.filter((template) => template.id !== templateId) : state.userTemplates;
    const allTemplates = selectAllTemplates({ defaultTemplates, userTemplates });
    const storedCards = state.storedCards.filter((card) => card.templateId !== templateId).map((card) => card.backingTemplateId === templateId ? { ...card, backingTemplateId: null, backingData: undefined } : card);
    const cardSets = state.cardSets.map((cardSet) => ({ ...cardSet, templateIds: cardSet.templateIds?.filter((id) => id !== templateId) }));
    const activeCardSet = state.activeCardSet ? cardSets.find((cardSet) => cardSet.id === state.activeCardSet?.id) ?? state.activeCardSet : null;
    const selectedId = state.generatorSelectedTemplateId === templateId ? allTemplates.find((template) => Boolean(template.id?.trim()))?.id ?? null : state.generatorSelectedTemplateId;
    const editorSelectedId = state.templateEditorSelectedTemplateId === templateId ? selectFallbackEditorTemplateId(allTemplates, null, selectedId) : state.templateEditorSelectedTemplateId;
    const editingCardUniqueId = state.editingCardUniqueId && state.storedCards.find((card) => card.uniqueId === state.editingCardUniqueId)?.templateId === templateId ? null : state.editingCardUniqueId;
    return { defaultTemplates, userTemplates, storedCards, cardSets, activeCardSet, generatorSelectedTemplateId: selectedId, templateEditorSelectedTemplateId: editorSelectedId, editingCardUniqueId, isEditDialogOpen: editingCardUniqueId ? state.isEditDialogOpen : false };
  }),
});
