import { create } from 'zustand';
import type { StateCreator } from 'zustand';
import { createJSONStorage, devtools, persist, type StateStorage } from 'zustand/middleware';

import { reconcileCardSets, resolveActiveCardSet } from '@/domain/cards';
import { areTemplateFormatsCompatible } from '@/domain/card-formats';

import {
  createScopedProjectStorage,
  setProjectPersistenceScope,
  type ProjectPersistenceScope,
} from '../persistence/projectPersistenceScope';
import { createAppearanceSlice } from './appearanceSlice';
import { createOutputSlice } from './outputSlice';
import { createOrganizationSlice } from './organizationSlice';
import { resolveGeneratorFrontTemplateId, selectAllTemplates } from './selectors';
import { createSettingsSlice } from './settingsSlice';
import { createTemplateSlice } from './templateSlice';
import type { ProjectState, WorkspaceLifecycleSlice } from './types';
import {
  dedupeAppearanceStyles,
  normalizeStudioView,
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
  | 'studioView'
  | 'richTextHighlightColor'
  | 'cardSets'
  | 'activeCardSet'
  | 'singleCardGeneratorSelectedTemplateId'
  | 'singleCardGeneratorSelectedBackingTemplateId'
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
let hydrationTask: { scope: ProjectPersistenceScope; promise: Promise<void> } | null = null;

const getCompatibleGeneratorBackingId = (
  templates: ReturnType<typeof selectAllTemplates>,
  frontTemplateId: string | null,
  backingTemplateId: string | null,
) => {
  const front = templates.find((template) => template.id === frontTemplateId);
  const back = templates.find((template) => template.id === backingTemplateId && template.templateUsage === 'back-preset');
  return front && back && areTemplateFormatsCompatible(front, back) ? back.id ?? null : null;
};

const createLifecycleSlice: StateCreator<ProjectState, [], [], WorkspaceLifecycleSlice> = (set, get) => ({
  _rehydrateCallback: () => {
    const state = get();
    const cardSets = reconcileCardSets({
      cardSets: Array.isArray(state.cardSets) ? state.cardSets : [],
      activeCardSet: state.activeCardSet,
      storedCards: state.storedCards,
    });
    const activeCardSet = resolveActiveCardSet({
      cardSets,
      preferredId: state.activeCardSet?.id,
    });
    const templates = selectAllTemplates(state);
    const currentId = resolveGeneratorFrontTemplateId(templates, state.singleCardGeneratorSelectedTemplateId);
    const generatorBackingTemplateId = getCompatibleGeneratorBackingId(
      templates,
      currentId,
      state.singleCardGeneratorSelectedBackingTemplateId,
    );
    const templateEditorSelectedTemplateId = state.templateEditorSelectedTemplateId
      && templates.some((template) => template.id === state.templateEditorSelectedTemplateId)
      ? state.templateEditorSelectedTemplateId
      : currentId ?? templates[0]?.id ?? null;

    if (
      JSON.stringify(state.cardSets ?? []) !== JSON.stringify(cardSets)
      || state.activeCardSet?.id !== activeCardSet?.id
      || state.singleCardGeneratorSelectedTemplateId !== currentId
      || state.singleCardGeneratorSelectedBackingTemplateId !== generatorBackingTemplateId
      || state.templateEditorSelectedTemplateId !== templateEditorSelectedTemplateId
    ) {
      set({
        cardSets,
        singleCardGeneratorSelectedTemplateId: currentId,
        singleCardGeneratorSelectedBackingTemplateId: generatorBackingTemplateId,
        templateEditorSelectedTemplateId,
        activeCardSet,
      });
    }

    const studioView = normalizeStudioView(state.studioView);
    const appearanceStyles = dedupeAppearanceStyles(state.appearanceStyles);
    if (studioView !== state.studioView || appearanceStyles.length !== state.appearanceStyles.length) {
      set({ studioView, appearanceStyles });
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
        ...createOrganizationSlice(...args),
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
          studioView: normalizeStudioView(state.studioView),
          richTextHighlightColor: state.richTextHighlightColor,
          cardSets: state.cardSets,
          activeCardSet: state.activeCardSet,
          singleCardGeneratorSelectedTemplateId: state.singleCardGeneratorSelectedTemplateId,
          singleCardGeneratorSelectedBackingTemplateId: state.singleCardGeneratorSelectedBackingTemplateId,
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
        version: 3,
        migrate: (persistedState, version) => {
          const legacy = persistedState as WorkspacePersistedState & { activeTab?: unknown };
          if (version < 2) {
            const { activeTab, ...current } = legacy;
            return {
              ...current,
              studioView: normalizeStudioView(activeTab),
            } as WorkspacePersistedState;
          }
          return {
            ...legacy,
            studioView: normalizeStudioView(legacy.studioView),
          } as WorkspacePersistedState;
        },
      },
    ),
  ),
);

export const hydrateProjectWorkspaceForScope = async (scope: ProjectPersistenceScope) => {
  if (hydratedPersistenceScope === scope) return;
  if (hydrationTask?.scope === scope) return hydrationTask.promise;

  const previousTask = hydrationTask?.promise.catch(() => undefined) ?? Promise.resolve();
  const promise = previousTask.then(async () => {
    if (hydratedPersistenceScope === scope) return;
    const isScopeChange = hydratedPersistenceScope !== null && hydratedPersistenceScope !== scope;
    setProjectPersistenceScope(scope);

    if (isScopeChange) {
      useProjectStore.persist.setOptions({ storage: createInertWorkspaceJsonStorage() });
      useProjectStore.setState(useProjectStore.getInitialState());
      useProjectStore.persist.setOptions({ storage: createWorkspaceJsonStorage() });
    }

    await useProjectStore.persist.rehydrate();
    hydratedPersistenceScope = scope;
  });
  hydrationTask = { scope, promise };
  try {
    await promise;
  } finally {
    if (hydrationTask?.promise === promise) hydrationTask = null;
  }
};

export type { ProjectState } from './types';
