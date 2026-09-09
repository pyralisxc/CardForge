import { create } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { StateCreator } from 'zustand';
import { createJSONStorage, devtools, persist, type StateStorage } from 'zustand/middleware';

import { reconcileCardSets, resolveActiveCardSet } from '@/domain/cards';
import { areTemplateFormatsCompatible } from '@/domain/card-formats';

import {
  createScopedProjectStorage,
  getProjectPersistenceScope,
  commitBrowserWorkspaceImport,
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

/** A provider Move must await a committed browser copy, not only Zustand state. */
export const persistProjectWorkspaceNow = async (): Promise<void> => {
  const options = useProjectStore.persist.getOptions();
  const state = useProjectStore.getState();
  await createScopedProjectStorage('project-workspace', {
    ...WORKSPACE_STORAGE_OPTIONS,
    suppressWriteErrors: false,
  }).setItem('workspace', JSON.stringify({
    state: options.partialize ? options.partialize(state) : state,
    version: options.version,
  }));
};

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
  | 'generatorSelectedTemplateId'
  | 'generatorSelectedBackingTemplateId'
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
let workspaceHydrationError: unknown = null;

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
    const currentId = resolveGeneratorFrontTemplateId(templates, state.generatorSelectedTemplateId);
    const generatorBackingTemplateId = getCompatibleGeneratorBackingId(
      templates,
      currentId,
      state.generatorSelectedBackingTemplateId,
    );
    const templateEditorSelectedTemplateId = state.templateEditorSelectedTemplateId
      && templates.some((template) => template.id === state.templateEditorSelectedTemplateId)
      ? state.templateEditorSelectedTemplateId
      : currentId ?? templates[0]?.id ?? null;

    if (
      JSON.stringify(state.cardSets ?? []) !== JSON.stringify(cardSets)
      || state.activeCardSet?.id !== activeCardSet?.id
      || state.generatorSelectedTemplateId !== currentId
      || state.generatorSelectedBackingTemplateId !== generatorBackingTemplateId
      || state.templateEditorSelectedTemplateId !== templateEditorSelectedTemplateId
    ) {
      set({
        cardSets,
        generatorSelectedTemplateId: currentId,
        generatorSelectedBackingTemplateId: generatorBackingTemplateId,
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

const createProjectState: StateCreator<ProjectState> = (...args) => ({
  ...createTemplateSlice(...args),
  ...createAppearanceSlice(...args),
  ...createOutputSlice(...args),
  ...createOrganizationSlice(...args),
  ...createSettingsSlice(...args),
  ...createLifecycleSlice(...args),
});

/** Run the same feature actions against a detached draft; no UI or autosave side effects. */
export const createProjectWorkspaceDraft = (expectedState: ProjectState = useProjectStore.getState()) => {
  if (useProjectStore.getState() !== expectedState) throw new Error('The workspace changed while the project was opening. Retry without discarding your current edits.');
  const draft = createStore<ProjectState>()(createProjectState);
  const data = Object.fromEntries(Object.entries(expectedState).filter(([, value]) => typeof value !== 'function'));
  draft.setState(data);
  return {
    getState: draft.getState,
    setState: draft.setState,
    commit: async (relatedWrites: readonly { key: string; value: string; expectedValue: string | null }[]) => {
      const options = useProjectStore.persist.getOptions();
      const nextState = draft.getState();
      const controller = new AbortController();
      const unsubscribe = useProjectStore.subscribe(() => controller.abort());
      try { await commitBrowserWorkspaceImport({
        value: JSON.stringify({ state: options.partialize!(nextState), version: options.version }),
        relatedWrites,
        signal: controller.signal,
        beforeCommit: () => {
          if (useProjectStore.getState() !== expectedState) throw new Error('The workspace changed while the project was opening. Your edits were left unchanged; retry.');
        },
      }); } finally { unsubscribe(); }
      useProjectStore.persist.setOptions({ storage: createInertWorkspaceJsonStorage() });
      try {
        useProjectStore.setState(Object.fromEntries(Object.entries(nextState).filter(([, value]) => typeof value !== 'function')));
      } finally { useProjectStore.persist.setOptions({ storage: options.storage }); }
    },
  };
};

export const useProjectStore = create<ProjectState>()(
  devtools(
    persist(
      createProjectState,
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
          generatorSelectedTemplateId: state.generatorSelectedTemplateId,
          generatorSelectedBackingTemplateId: state.generatorSelectedBackingTemplateId,
          templateEditorSelectedTemplateId: state.templateEditorSelectedTemplateId,
          pdfMarginMm: state.pdfMarginMm,
          pdfCardSpacingMm: state.pdfCardSpacingMm,
          pdfIncludeCutLines: state.pdfIncludeCutLines,
          pdfDuplexLayout: state.pdfDuplexLayout,
          exportMode: state.exportMode,
          exportDpi: state.exportDpi,
        }),
        onRehydrateStorage: () => (state, error) => {
          workspaceHydrationError = error ?? null;
          if (error) console.error('Error rehydrating the project workspace:', error);
          if (state) setTimeout(() => state._rehydrateCallback(), 0);
        },
        skipHydration: true,
        version: 4,
        migrate: (persistedState, version) => {
          const {
            activeTab,
            singleCardGeneratorSelectedTemplateId,
            singleCardGeneratorSelectedBackingTemplateId,
            ...current
          } = persistedState as WorkspacePersistedState & {
            activeTab?: unknown;
            singleCardGeneratorSelectedTemplateId?: string | null;
            singleCardGeneratorSelectedBackingTemplateId?: string | null;
          };
          return {
            ...current,
            generatorSelectedTemplateId: current.generatorSelectedTemplateId !== undefined
              ? current.generatorSelectedTemplateId : singleCardGeneratorSelectedTemplateId ?? null,
            generatorSelectedBackingTemplateId: current.generatorSelectedBackingTemplateId !== undefined
              ? current.generatorSelectedBackingTemplateId : singleCardGeneratorSelectedBackingTemplateId ?? null,
            studioView: normalizeStudioView(version < 2 ? activeTab : current.studioView),
          } as WorkspacePersistedState;
        },
      },
    ),
  ),
);

export const hydrateProjectWorkspaceForScope = async (scope: ProjectPersistenceScope) => {
  if (hydratedPersistenceScope === scope && getProjectPersistenceScope() === scope) return;
  if (hydrationTask?.scope === scope) return hydrationTask.promise;

  const previousTask = hydrationTask?.promise.catch(() => undefined) ?? Promise.resolve();
  const promise = previousTask.then(async () => {
    if (hydratedPersistenceScope === scope && getProjectPersistenceScope() === scope) return;
    const isScopeChange = getProjectPersistenceScope() !== scope;
    // Once we leave a hydrated account, it cannot satisfy a later fast path until
    // its own bytes have been loaded again (including after another account fails).
    hydratedPersistenceScope = null;
    setProjectPersistenceScope(scope);

    if (isScopeChange) {
      useProjectStore.persist.setOptions({ storage: createInertWorkspaceJsonStorage() });
      useProjectStore.setState(useProjectStore.getInitialState());
      useProjectStore.persist.setOptions({ storage: createWorkspaceJsonStorage() });
    }

    useProjectStore.persist.setOptions({ storage: createWorkspaceJsonStorage() });
    workspaceHydrationError = null;
    await useProjectStore.persist.rehydrate();
    if (workspaceHydrationError || !useProjectStore.persist.hasHydrated()) {
      // Zustand reports hydration errors through its callback, not rehydrate's promise.
      // Disable autosave until retry succeeds so initial state cannot replace unreadable work.
      useProjectStore.persist.setOptions({ storage: createInertWorkspaceJsonStorage() });
      throw workspaceHydrationError ?? new Error('The browser workspace could not be restored.');
    }
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
