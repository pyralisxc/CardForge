"use client";

import { useCallback, useEffect, useSyncExternalStore } from 'react';

import {
  DEFAULT_RICH_TEXT_HIGHLIGHT_COLOR,
  EDITOR_PREFERENCES_CHANGED_EVENT,
  readEditorPreferenceStorage,
  writeEditorPreferenceStorage,
} from '@/features/project/client/editorPreferenceStorage';
import {
  getProjectPersistenceScope,
  PROJECT_PERSISTENCE_SCOPE_CHANGE_EVENT,
} from '@/features/project/client/persistence-workspace';

export interface EditorPreferences {
  richTextHighlightColor: string;
}

type EditorPreferenceScope = ReturnType<typeof getProjectPersistenceScope>;

const DEFAULT_EDITOR_PREFERENCES: EditorPreferences = {
  richTextHighlightColor: DEFAULT_RICH_TEXT_HIGHLIGHT_COLOR,
};

const snapshots = new Map<EditorPreferenceScope, EditorPreferences>();
const localRevisions = new Map<EditorPreferenceScope, number>();
const hydrationTasks = new Map<EditorPreferenceScope, Promise<void>>();
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

const hydrate = async (scope: EditorPreferenceScope, force = false) => {
  const existing = hydrationTasks.get(scope);
  if (existing && !force) return existing;
  const startedAtRevision = localRevisions.get(scope) ?? 0;
  const task = readEditorPreferenceStorage(scope)
    .then((stored) => {
      if (!stored || (localRevisions.get(scope) ?? 0) !== startedAtRevision) return;
      const current = snapshotFor(scope);
      if (stored.richTextHighlightColor === current.richTextHighlightColor) return;
      snapshots.set(scope, { richTextHighlightColor: stored.richTextHighlightColor });
      emit();
    })
    .finally(() => {
      if (hydrationTasks.get(scope) === task) hydrationTasks.delete(scope);
    });
  hydrationTasks.set(scope, task);
  return task;
};

export function useEditorPreferences() {
  const preferences = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    const initialScope = getProjectPersistenceScope();
    void hydrate(initialScope);

    const onPreferenceChange = (event: Event) => {
      const scope = (event as CustomEvent<{ scope?: EditorPreferenceScope }>).detail?.scope
        ?? getProjectPersistenceScope();
      void hydrate(scope, true);
    };
    const onScopeChange = () => {
      emit();
      void hydrate(getProjectPersistenceScope(), true);
    };
    window.addEventListener(EDITOR_PREFERENCES_CHANGED_EVENT, onPreferenceChange);
    window.addEventListener(PROJECT_PERSISTENCE_SCOPE_CHANGE_EVENT, onScopeChange);
    return () => {
      window.removeEventListener(EDITOR_PREFERENCES_CHANGED_EVENT, onPreferenceChange);
      window.removeEventListener(PROJECT_PERSISTENCE_SCOPE_CHANGE_EVENT, onScopeChange);
    };
  }, []);

  const setRichTextHighlightColor = useCallback((value: string) => {
    if (!/^#[0-9a-f]{6}$/i.test(value.trim())) return;
    const scope = getProjectPersistenceScope();
    const richTextHighlightColor = value.trim().toLowerCase();
    localRevisions.set(scope, (localRevisions.get(scope) ?? 0) + 1);
    const next = { richTextHighlightColor };
    snapshots.set(scope, next);
    emit();
    void writeEditorPreferenceStorage(next, scope);
  }, []);

  return {
    ...preferences,
    setRichTextHighlightColor,
  };
}
