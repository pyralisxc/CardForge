"use client";

import { useCallback, useEffect, useSyncExternalStore } from 'react';

import {
  DEFAULT_RICH_TEXT_HIGHLIGHT_COLOR,
  EDITOR_PREFERENCES_CHANGED_EVENT,
  readEditorPreferenceStorage,
  writeEditorPreferenceStorage,
} from '@/features/project/client/editorPreferenceStorage';

export interface EditorPreferences {
  richTextHighlightColor: string;
}

const DEFAULT_EDITOR_PREFERENCES: EditorPreferences = {
  richTextHighlightColor: DEFAULT_RICH_TEXT_HIGHLIGHT_COLOR,
};

let snapshot: EditorPreferences = DEFAULT_EDITOR_PREFERENCES;
let hydrationTask: Promise<void> | null = null;
let localRevision = 0;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const getSnapshot = () => snapshot;
const getServerSnapshot = () => DEFAULT_EDITOR_PREFERENCES;

const hydrate = async (force = false) => {
  if (hydrationTask && !force) return hydrationTask;
  const startedAtRevision = localRevision;
  const task = readEditorPreferenceStorage()
    .then((stored) => {
      if (!stored || localRevision !== startedAtRevision) return;
      const next = { richTextHighlightColor: stored.richTextHighlightColor };
      if (next.richTextHighlightColor === snapshot.richTextHighlightColor) return;
      snapshot = next;
      emit();
    })
    .finally(() => {
      if (hydrationTask === task) hydrationTask = null;
    });
  hydrationTask = task;
  return task;
};

export function useEditorPreferences() {
  const preferences = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    void hydrate();
    const onExternalChange = () => { void hydrate(true); };
    window.addEventListener(EDITOR_PREFERENCES_CHANGED_EVENT, onExternalChange);
    return () => window.removeEventListener(EDITOR_PREFERENCES_CHANGED_EVENT, onExternalChange);
  }, []);

  const setRichTextHighlightColor = useCallback((value: string) => {
    if (!/^#[0-9a-f]{6}$/i.test(value.trim())) return;
    const richTextHighlightColor = value.trim().toLowerCase();
    localRevision += 1;
    snapshot = { richTextHighlightColor };
    emit();
    void writeEditorPreferenceStorage(snapshot);
  }, []);

  return {
    ...preferences,
    setRichTextHighlightColor,
  };
}
