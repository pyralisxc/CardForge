"use client";

import { useEffect, useRef, useState } from 'react';

export interface EditorDraftState {
  dirty: boolean;
  saving: boolean;
}

/** Local form lifecycle only; confirmed values and revisions remain feature-owned. */
export function useEditorDraft<T>(initial: T, onStateChange?: (state: EditorDraftState) => void) {
  const previousInitial = useRef(initial);
  const latestInitial = useRef(initial);
  const [baseline, setBaseline] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);

  useEffect(() => {
    latestInitial.current = initial;
    if (!dirty && !saving && JSON.stringify(initial) !== JSON.stringify(previousInitial.current)) {
      previousInitial.current = initial;
      setBaseline(initial);
      setDraft(initial);
    }
  }, [baseline, dirty, initial, saving]);
  useEffect(() => { onStateChange?.({ dirty, saving }); }, [dirty, saving, onStateChange]);
  useEffect(() => () => { onStateChange?.({ dirty: false, saving: false }); }, [onStateChange]);

  const acceptPublished = (current: T) => {
    previousInitial.current = latestInitial.current;
    setBaseline(current);
    setDraft(current);
  };
  return { baseline, draft, setDraft, saving, setSaving, dirty, acceptPublished };
}

export function combineEditorDraftStates(states: Record<string, EditorDraftState>): EditorDraftState {
  return {
    dirty: Object.values(states).some((state) => state.dirty),
    saving: Object.values(states).some((state) => state.saving),
  };
}
