import { nanoid } from 'nanoid';
import type { StateCreator } from 'zustand';

import type { CardSet } from '@/domain/cards';
import { reconstructMinimalTemplateObject, type TCGCardTemplate } from '@/domain/templates';

import { selectAllTemplates } from './selectors';
import type { ProjectState, TemplateSlice } from './types';
import { isDraftTemplateSelection } from './workspaceDefaults';

const selectFallbackTemplateId = (
  templates: TCGCardTemplate[],
  selectedId: string | null,
): string | null => {
  const selectedStillExists = selectedId
    ? isDraftTemplateSelection(selectedId) || templates.some((template) => template.id === selectedId)
    : false;
  return selectedStillExists
    ? selectedId
    : (templates.find((template) => template.templateUsage !== 'back-preset')?.id ?? null);
};

const reconcileCardSet = (
  activeCardSet: CardSet,
  templates: TCGCardTemplate[],
  selectedId: string | null,
): CardSet => ({
  ...activeCardSet,
  frontTemplateId: selectedId,
  backingTemplateId: activeCardSet.backingTemplateId
    && templates.some((template) => (
      template.id === activeCardSet.backingTemplateId && template.templateUsage === 'back-preset'
    ))
    ? activeCardSet.backingTemplateId
    : null,
});

export const createTemplateSlice: StateCreator<ProjectState, [], [], TemplateSlice> = (set, get) => ({
  defaultTemplates: [],
  userTemplates: [],

  addOrUpdateTemplate: (template, source) => {
    const templateToSave = {
      ...template,
      id: template.id?.trim() ? template.id : nanoid(),
      templateSource: source || template.templateSource || 'user',
    };
    const reconstructed = reconstructMinimalTemplateObject(templateToSave);
    const finalId = reconstructed.id!;

    set((state) => {
      const current = reconstructed.templateSource === 'default'
        ? state.defaultTemplates
        : state.userTemplates;
      const next = [...current];
      const existingIndex = next.findIndex((candidate) => candidate.id === finalId);
      if (existingIndex > -1) next[existingIndex] = reconstructed;
      else next.push(reconstructed);
      const canonical = next.map((candidate) => reconstructMinimalTemplateObject(candidate));
      if (JSON.stringify(current) === JSON.stringify(canonical)) return state;
      return reconstructed.templateSource === 'default'
        ? { defaultTemplates: canonical }
        : { userTemplates: canonical };
    });
    return finalId;
  },

  setDefaultTemplatesFromFiles: (templates) => {
    const reconstructed = templates
      .map((template) => reconstructMinimalTemplateObject({ ...template, templateSource: 'default' }))
      .filter((template) => Boolean(template.id?.trim()));
    if (reconstructed.length === 0) return 0;

    set((state) => {
      const allTemplates = [...reconstructed, ...state.userTemplates];
      const selectedId = selectFallbackTemplateId(allTemplates, state.singleCardGeneratorSelectedTemplateId);
      return {
        defaultTemplates: reconstructed,
        singleCardGeneratorSelectedTemplateId: selectedId,
        activeCardSet: reconcileCardSet(state.activeCardSet, allTemplates, selectedId),
      };
    });
    return reconstructed.length;
  },

  setUserTemplatesFromFiles: (templates) => {
    const reconstructed = templates
      .map((template) => reconstructMinimalTemplateObject({ ...template, templateSource: 'user' }))
      .filter((template) => Boolean(template.id?.trim()));

    set((state) => {
      const allTemplates = [...state.defaultTemplates, ...reconstructed];
      const selectedId = selectFallbackTemplateId(allTemplates, state.singleCardGeneratorSelectedTemplateId);
      return {
        userTemplates: reconstructed,
        singleCardGeneratorSelectedTemplateId: selectedId,
        activeCardSet: reconcileCardSet(state.activeCardSet, allTemplates, selectedId),
      };
    });
    return reconstructed.length;
  },

  mergeUserTemplatesFromFiles: (templates) => {
    const reconstructed = templates
      .map((template) => reconstructMinimalTemplateObject({ ...template, templateSource: 'user' }))
      .filter((template) => Boolean(template.id?.trim()));
    if (reconstructed.length === 0) return 0;

    set((state) => {
      const byId = new Map<string, TCGCardTemplate>();
      [...state.userTemplates, ...reconstructed].forEach((template) => {
        if (template.id) byId.set(template.id, template);
      });
      const userTemplates = Array.from(byId.values());
      const allTemplates = [...state.defaultTemplates, ...userTemplates];
      const selectedId = selectFallbackTemplateId(allTemplates, state.singleCardGeneratorSelectedTemplateId);
      return {
        userTemplates,
        singleCardGeneratorSelectedTemplateId: selectedId,
        activeCardSet: reconcileCardSet(state.activeCardSet, allTemplates, selectedId),
      };
    });
    return reconstructed.length;
  },

  cloneTemplate: (templateId) => {
    const source = selectAllTemplates(get()).find((template) => template.id === templateId);
    if (!source) return null;
    const cloned = reconstructMinimalTemplateObject({
      ...JSON.parse(JSON.stringify(source)),
      id: nanoid(),
      name: `Copy of ${source.name}`,
      templateSource: 'user',
    });
    set((state) => ({ userTemplates: [...state.userTemplates, cloned] }));
    return cloned.id!;
  },

  deleteTemplate: (templateId, source) => set((state) => {
    const targetSource = source
      || selectAllTemplates(state).find((template) => template.id === templateId)?.templateSource
      || 'user';
    const defaultTemplates = targetSource === 'default'
      ? state.defaultTemplates.filter((template) => template.id !== templateId)
      : state.defaultTemplates;
    const userTemplates = targetSource === 'user'
      ? state.userTemplates.filter((template) => template.id !== templateId)
      : state.userTemplates;
    const allTemplates = [...defaultTemplates, ...userTemplates];
    const storedCards = state.storedCards
      .filter((card) => card.templateId !== templateId)
      .map((card) => card.backingTemplateId === templateId ? { ...card, backingTemplateId: null } : card);
    const selectedId = state.singleCardGeneratorSelectedTemplateId === templateId
      ? (allTemplates.find((template) => Boolean(template.id?.trim()))?.id ?? null)
      : state.singleCardGeneratorSelectedTemplateId;
    const activeCardSet: CardSet = {
      ...state.activeCardSet,
      frontTemplateId: state.activeCardSet.frontTemplateId === templateId
        ? selectedId
        : state.activeCardSet.frontTemplateId,
      backingTemplateId: state.activeCardSet.backingTemplateId === templateId
        ? null
        : state.activeCardSet.backingTemplateId,
    };
    const editingCardUniqueId = state.editingCardUniqueId
      && state.storedCards.find((card) => card.uniqueId === state.editingCardUniqueId)?.templateId === templateId
      ? null
      : state.editingCardUniqueId;

    return {
      defaultTemplates,
      userTemplates,
      storedCards,
      singleCardGeneratorSelectedTemplateId: selectedId,
      activeCardSet,
      editingCardUniqueId,
      isEditDialogOpen: editingCardUniqueId ? state.isEditDialogOpen : false,
    };
  }),
});
