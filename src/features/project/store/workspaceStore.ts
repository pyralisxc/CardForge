import { create } from 'zustand';
import type { StateCreator } from 'zustand';
import { createJSONStorage, devtools, persist, type StateStorage } from 'zustand/middleware';

import { areTemplateFormatsCompatible } from '@/domain/card-formats';

import {
  createScopedProjectStorage,
  setProjectPersistenceScope,
  type ProjectPersistenceScope,
} from '../persistence/projectPersistenceScope';
import { createAppearanceSlice } from './appearanceSlice';
import { createOutputSlice } from './outputSlice';
import { resolveGeneratorFrontTemplateId, selectAllTemplates } from './selectors';
import { createSettingsSlice } from './settingsSlice';
import { createTemplateSlice } from './templateSlice';
import type { ProjectState, WorkspaceLifecycleSlice } from './types';
import {
  createDefaultActiveCardSet,
  dedupeAppearanceStyles,
  normalizeActiveTab,
} from './workspaceDefaults';

const WORKSPACE_STORAGE_OPTIONS = {
  keepRecoverySnapshot: true,
  suppressWriteErrors: true,
  trackWorkspaceSaveStatus: true,
} as const;

type WorkspacePersistedState = Pick<
  ProjectState,
  | 'userTemplates'
  | 'appearanceStyles'
  | 'storedCards'
  | 'selectedPaperSize'
  | 'activeTab'
  | 'richTextHighlightColor'
  | 'activeCardSet'
  | 'singleCardGeneratorSelectedTemplateId'
  | 'templateEditorSelectedTemplateId'
  | 'pdfMarginMm'
  | 'pdfCardSpacingMm'
  | 'pdfIncludeCutLines'
  | 'pdfDuplexLayout'
  | 'exportMode'
  | 'exportDpi'
>;

const inertStorage: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

const createWorkspaceJsonStorage = () => createJSONStorage<WorkspacePersistedState>(() => createScopedProjectStorage(
  'project-workspace',
  WORKSPACE_STORAGE_OPTIONS,
));

const createInertWorkspaceJsonStorage = () => createJSONStorage<WorkspacePersistedState>(() => inertStorage);

let hydratedPersistenceScope: ProjectPersistenceScope | null = null;

const createLifecycleSlice: StateCreator<ProjectState, [], [], WorkspaceLifecycleSlice> = (set, get) => ({
  _rehydrateCallback: () => {
    const state = get();
    const activeCardSet = state.activeCardSet || createDefaultActiveCardSet();
    const templates = selectAllTemplates(state);
    const currentId = resolveGeneratorFrontTemplateId(
      templates,
      activeCardSet.frontTemplateId || state.singleCardGeneratorSelectedTemplateId,
    );
    const frontTemplate = templates.find((template) => template.id === currentId);
    const backTemplate = templates.find((template) => (
      template.id === activeCardSet.backingTemplateId && template.templateUsage === 'back-preset'
    ));
    const backingTemplateId = frontTemplate && backTemplate && areTemplateFormatsCompatible(frontTemplate, backTemplate)
      ? backTemplate.id ?? null
      : null;
    const templateEditorSelectedTemplateId = state.templateEditorSelectedTemplateId
      && templates.some((template) => template.id === state.templateEditorSelectedTemplateId)
      ? state.templateEditorSelectedTemplateId
      : currentId ?? templates[0]?.id ?? null;

    if (
      state.activeCardSet !== activeCardSet
      || state.singleCardGeneratorSelectedTemplateId !== currentId
      || activeCardSet.frontTemplateId !== currentId
      || activeCardSet.backingTemplateId !== backingTemplateId
      || state.templateEditorSelectedTemplateId !== templateEditorSelectedTemplateId
    ) {
      set({
        singleCardGeneratorSelectedTemplateId: currentId,
        templateEditorSelectedTemplateId,
        activeCardSet: {
          ...activeCardSet,
          frontTemplateId: currentId,
          backingTemplateId,
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
        storage: createWorkspaceJsonStorage(),
        partialize: (state): WorkspacePersistedState => ({
          userTemplates: state.userTemplates,
          appearanceStyles: dedupeAppearanceStyles(state.appearanceStyles),
          storedCards: state.storedCards,
          selectedPaperSize: state.selectedPaperSize,
          activeTab: normalizeActiveTab(state.activeTab),
          richTextHighlightColor: state.richTextHighlightColor,
          activeCardSet: state.activeCardSet,
          singleCardGeneratorSelectedTemplateId: state.singleCardGeneratorSelectedTemplateId,
          templateEditorSelectedTemplateId: state.templateEditorSelectedTemplateId,
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
        skipHydration: true,
        version: 1,
      },
    ),
  ),
);

export const hydrateProjectWorkspaceForScope = async (scope: ProjectPersistenceScope) => {
  const isScopeChange = hydratedPersistenceScope !== null && hydratedPersistenceScope !== scope;
  setProjectPersistenceScope(scope);

  if (isScopeChange) {
    useProjectStore.persist.setOptions({ storage: createInertWorkspaceJsonStorage() });
    useProjectStore.setState(useProjectStore.getInitialState());
    useProjectStore.persist.setOptions({ storage: createWorkspaceJsonStorage() });
  }

  await useProjectStore.persist.rehydrate();
  hydratedPersistenceScope = scope;
};

export type { ProjectState } from './types';
