import { create } from 'zustand';
import type { StateCreator } from 'zustand';
import { createJSONStorage, devtools, persist } from 'zustand/middleware';

import { createIndexedDbStorage } from '../persistence/indexedDbStorage';
import { createAppearanceSlice } from './appearanceSlice';
import { createOutputSlice } from './outputSlice';
import { selectAllTemplates } from './selectors';
import { createSettingsSlice } from './settingsSlice';
import { createTemplateSlice } from './templateSlice';
import type { ProjectState, WorkspaceLifecycleSlice } from './types';
import {
  createDefaultActiveCardSet,
  dedupeAppearanceStyles,
  normalizeActiveTab,
} from './workspaceDefaults';

const createLifecycleSlice: StateCreator<ProjectState, [], [], WorkspaceLifecycleSlice> = (set, get) => ({
  _rehydrateCallback: () => {
    const state = get();
    const activeCardSet = state.activeCardSet || createDefaultActiveCardSet();
    const currentId = activeCardSet.frontTemplateId || state.singleCardGeneratorSelectedTemplateId;
    const templates = selectAllTemplates(state);
    const selectedTemplateExists = currentId && templates.some((template) => template.id === currentId);

    if (!selectedTemplateExists && templates.length > 0) {
      const firstValid = templates.find((template) => (
        template.templateUsage !== 'back-preset' && Boolean(template.id?.trim())
      ));
      if (firstValid) {
        set({
          singleCardGeneratorSelectedTemplateId: firstValid.id,
          activeCardSet: {
            ...activeCardSet,
            frontTemplateId: firstValid.id,
            backingTemplateId: activeCardSet.backingTemplateId
              && templates.some((template) => (
                template.id === activeCardSet.backingTemplateId && template.templateUsage === 'back-preset'
              ))
              ? activeCardSet.backingTemplateId
              : null,
          },
        });
      }
    } else if (
      state.activeCardSet !== activeCardSet
      || state.singleCardGeneratorSelectedTemplateId !== currentId
    ) {
      set({
        singleCardGeneratorSelectedTemplateId: currentId,
        activeCardSet: {
          ...activeCardSet,
          frontTemplateId: currentId,
          backingTemplateId: activeCardSet.backingTemplateId
            && templates.some((template) => (
              template.id === activeCardSet.backingTemplateId && template.templateUsage === 'back-preset'
            ))
            ? activeCardSet.backingTemplateId
            : null,
        },
      });
    }

    const activeTab = normalizeActiveTab(state.activeTab);
    const appearanceStyles = dedupeAppearanceStyles(state.appearanceStyles);
    if (activeTab !== state.activeTab || appearanceStyles.length !== state.appearanceStyles.length) {
      set({ activeTab, appearanceStyles });
    }
  },
});

export const useProjectStore = create<ProjectState>()(
  devtools(
    persist(
      (...args) => ({
        ...createTemplateSlice(...args),
        ...createAppearanceSlice(...args),
        ...createOutputSlice(...args),
        ...createSettingsSlice(...args),
        ...createLifecycleSlice(...args),
      }),
      {
        name: 'workspace',
        storage: createJSONStorage(() => createIndexedDbStorage(
          'project-workspace',
          { keepRecoverySnapshot: true, suppressWriteErrors: true, trackWorkspaceSaveStatus: true },
        )),
        partialize: (state) => ({
          userTemplates: state.userTemplates,
          appearanceStyles: dedupeAppearanceStyles(state.appearanceStyles),
          storedCards: state.storedCards,
          selectedPaperSize: state.selectedPaperSize,
          activeTab: normalizeActiveTab(state.activeTab),
          richTextHighlightColor: state.richTextHighlightColor,
          activeCardSet: state.activeCardSet,
          singleCardGeneratorSelectedTemplateId: state.singleCardGeneratorSelectedTemplateId,
          pdfMarginMm: state.pdfMarginMm,
          pdfCardSpacingMm: state.pdfCardSpacingMm,
          pdfIncludeCutLines: state.pdfIncludeCutLines,
          pdfDuplexLayout: state.pdfDuplexLayout,
          exportMode: state.exportMode,
          exportDpi: state.exportDpi,
        }),
        onRehydrateStorage: () => (state, error) => {
          if (error) console.error('Error rehydrating the project workspace:', error);
          if (state) setTimeout(() => state._rehydrateCallback(), 0);
        },
        version: 1,
      },
    ),
  ),
);

export type { ProjectState } from './types';
