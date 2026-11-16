'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';

import {
  DEFAULT_RICH_TEXT_HIGHLIGHT_COLOR,
  EDITOR_PREFERENCES_CHANGED_EVENT,
  readEditorPreferenceStorage,
  writeEditorPreferenceStorage,
  type StoredEditorPreferences,
} from '@/features/project/client/editorPreferenceStorage';
import { isStudioAutosaveDelaySeconds, type StudioAutosaveDelaySeconds } from '@/features/experience-settings/client';
import {
  getProjectPersistenceScope,
  PROJECT_PERSISTENCE_SCOPE_CHANGE_EVENT,
} from '@/features/project/client/persistence-workspace';

export type EditorPreferences = StoredEditorPreferences;

type EditorPreferenceScope = ReturnType<typeof getProjectPersistenceScope>;

const DEFAULT_EDITOR_PREFERENCES: EditorPreferences = {
  richTextHighlightColor: DEFAULT_RICH_TEXT_HIGHLIGHT_COLOR,
  googleDriveAutosaveEnabled: false,
  googleDriveAutosaveDelaySeconds: null,
};

const snapshots = new Map<EditorPreferenceScope, EditorPreferences>();
const localRevisions = new Map<EditorPreferenceScope, number>();
const hydrationTasks = new Map<EditorPreferenceScope, Promise<void>>();
const hydratedScopes = new Set<EditorPreferenceScope>();
const writeErrors = new Map<EditorPreferenceScope, string>();
const readErrors = new Map<EditorPreferenceScope, string>();
const pendingWrites = new Map<EditorPreferenceScope, number>();
const listeners = new Set<() => void>();

const snapshotFor = (scope: EditorPreferenceScope): EditorPreferences => {
  const existing = snapshots.get(scope);
  if (existing) return existing;
  snapshots.set(scope, DEFAULT_EDITOR_PREFERENCES);
  return DEFAULT_EDITOR_PREFERENCES;
};

const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const getSnapshot = () => snapshotFor(getProjectPersistenceScope());
const getServerSnapshot = () => DEFAULT_EDITOR_PREFERENCES;
export const getEditorPreferences = (scope: EditorPreferenceScope = getProjectPersistenceScope()) => snapshotFor(scope);

const hydrate = async (scope: EditorPreferenceScope, force = false) => {
  if (pendingWrites.has(scope) || writeErrors.has(scope) || (hydratedScopes.has(scope) && !force)) return;
  const existing = hydrationTasks.get(scope);
  if (existing && !force) return existing;
  const startedAtRevision = localRevisions.get(scope) ?? 0;
  const task = readEditorPreferenceStorage(scope)
    .then((stored) => {
      if ((localRevisions.get(scope) ?? 0) !== startedAtRevision) return;
      const current = snapshotFor(scope);
      const next = stored ?? DEFAULT_EDITOR_PREFERENCES;
      readErrors.delete(scope);
      hydratedScopes.add(scope);
      if (JSON.stringify(next) === JSON.stringify(current)) return;
      snapshots.set(scope, next);
      emit();
    })
    .catch(() => {
      if ((localRevisions.get(scope) ?? 0) !== startedAtRevision) return;
      snapshots.set(scope, DEFAULT_EDITOR_PREFERENCES);
      hydratedScopes.delete(scope);
      readErrors.set(scope, 'Saving preferences could not be read. Autosave stays off; existing preferences were not replaced.');
    })
    .finally(() => {
      if (hydrationTasks.get(scope) === task) hydrationTasks.delete(scope);
      emit();
    });
  hydrationTasks.set(scope, task);
  return task;
};

export function useEditorPreferences(scope?: EditorPreferenceScope) {
  const readSnapshot = useCallback(() => scope ? snapshotFor(scope) : getSnapshot(), [scope]);
  const preferences = useSyncExternalStore(subscribe, readSnapshot, getServerSnapshot);
  const readReady = useCallback(() => hydratedScopes.has(scope ?? getProjectPersistenceScope()), [scope]);
  const preferencesReady = useSyncExternalStore(subscribe, readReady, () => false);
  const readError = useCallback(() => writeErrors.get(scope ?? getProjectPersistenceScope()) ?? null, [scope]);
  const preferenceWriteError = useSyncExternalStore(subscribe, readError, () => null);
  const readFailure = useCallback(() => readErrors.get(scope ?? getProjectPersistenceScope()) ?? null, [scope]);
  const preferenceReadError = useSyncExternalStore(subscribe, readFailure, () => null);
  const retryPreferenceRead = useCallback(() => { void hydrate(scope ?? getProjectPersistenceScope(), true); }, [scope]);

  useEffect(() => {
    const initialScope = scope ?? getProjectPersistenceScope();
    void hydrate(initialScope);

    const onPreferenceChange = (event: Event) => {
      const changedScope = (event as CustomEvent<{ scope?: EditorPreferenceScope }>).detail?.scope
        ?? getProjectPersistenceScope();
      void hydrate(changedScope, true);
    };
    const onScopeChange = () => {
      emit();
      void hydrate(scope ?? getProjectPersistenceScope(), true);
    };
    window.addEventListener(EDITOR_PREFERENCES_CHANGED_EVENT, onPreferenceChange);
    window.addEventListener(PROJECT_PERSISTENCE_SCOPE_CHANGE_EVENT, onScopeChange);
    return () => {
      window.removeEventListener(EDITOR_PREFERENCES_CHANGED_EVENT, onPreferenceChange);
      window.removeEventListener(PROJECT_PERSISTENCE_SCOPE_CHANGE_EVENT, onScopeChange);
    };
  }, [scope]);

  const updatePreferences = useCallback((patch: Partial<EditorPreferences>) => {
    const targetScope = scope ?? getProjectPersistenceScope();
    if (!hydratedScopes.has(targetScope)) return;
    localRevisions.set(targetScope, (localRevisions.get(targetScope) ?? 0) + 1);
    const next = { ...snapshotFor(targetScope), ...patch };
    const revision = localRevisions.get(targetScope);
    writeErrors.delete(targetScope);
    snapshots.set(targetScope, next);
    pendingWrites.set(targetScope, (pendingWrites.get(targetScope) ?? 0) + 1);
    emit();
    void writeEditorPreferenceStorage(next, targetScope).catch(() => {
      if (localRevisions.get(targetScope) !== revision) return;
      writeErrors.set(targetScope, 'This preference applies for this session, but browser storage could not keep it for reopening.');
      emit();
    }).finally(() => {
      const pending = (pendingWrites.get(targetScope) ?? 1) - 1;
      if (pending) pendingWrites.set(targetScope, pending);
      else pendingWrites.delete(targetScope);
    });
  }, [scope]);

  const setRichTextHighlightColor = useCallback((value: string) => {
    if (!/^#[0-9a-f]{6}$/i.test(value.trim())) return;
    const richTextHighlightColor = value.trim().toLowerCase();
    updatePreferences({ richTextHighlightColor });
  }, [updatePreferences]);

  const setGoogleDriveAutosaveEnabled = useCallback((enabled: boolean) => {
    updatePreferences({ googleDriveAutosaveEnabled: enabled });
  }, [updatePreferences]);
  const setGoogleDriveAutosaveDelaySeconds = useCallback((delay: StudioAutosaveDelaySeconds | null) => {
    if (delay !== null && !isStudioAutosaveDelaySeconds(delay)) return;
    updatePreferences({ googleDriveAutosaveDelaySeconds: delay });
  }, [updatePreferences]);

  return {
    ...preferences,
    preferencesReady,
    preferenceWriteError,
    preferenceReadError,
    retryPreferenceRead,
    setRichTextHighlightColor,
    setGoogleDriveAutosaveEnabled,
    setGoogleDriveAutosaveDelaySeconds,
  };
}
