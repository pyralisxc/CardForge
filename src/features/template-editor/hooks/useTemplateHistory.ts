"use client";

import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useState } from 'react';

import type { TCGCardTemplate } from '@/types';
import { reconstructMinimalTemplate } from '@/lib/templateModel';
import {
  appendTemplateHistoryEntry,
  redoTemplateHistory,
  undoTemplateHistory,
} from '@/features/template-editor/lib/templateHistory';

type TemplateUpdater = (template: TCGCardTemplate) => TCGCardTemplate;

export function useTemplateHistory(initialTemplate: TCGCardTemplate) {
  const [currentTemplate, setCurrentTemplateState] = useState<TCGCardTemplate>(() => reconstructMinimalTemplate(initialTemplate));
  const [history, setHistory] = useState<TCGCardTemplate[]>([]);
  const [future, setFuture] = useState<TCGCardTemplate[]>([]);

  useEffect(() => {
    setCurrentTemplateState(reconstructMinimalTemplate(initialTemplate));
    setHistory([]);
    setFuture([]);
  }, [initialTemplate]);

  const setCurrentTemplate: Dispatch<SetStateAction<TCGCardTemplate>> = useCallback((nextValue) => {
    setCurrentTemplateState((previous) => {
      const next = typeof nextValue === 'function'
        ? (nextValue as TemplateUpdater)(previous)
        : nextValue;
      return reconstructMinimalTemplate(next);
    });
  }, []);

  const resetTemplate = useCallback((template: TCGCardTemplate) => {
    setCurrentTemplateState(reconstructMinimalTemplate(template));
    setHistory([]);
    setFuture([]);
  }, []);

  const recordTemplateHistory = useCallback((template: TCGCardTemplate = currentTemplate) => {
    setHistory((items) => appendTemplateHistoryEntry(items, template));
    setFuture([]);
  }, [currentTemplate]);

  const commitTemplate = useCallback((updater: TemplateUpdater, trackHistory = true) => {
    setCurrentTemplateState((previous) => {
      const before = reconstructMinimalTemplate(previous);
      const next = reconstructMinimalTemplate(updater(before));
      if (trackHistory) {
        setHistory((items) => appendTemplateHistoryEntry(items, before));
        setFuture([]);
      }
      return next;
    });
  }, []);

  const updateTemplate = useCallback((updates: Partial<TCGCardTemplate>, trackHistory = true) => {
    commitTemplate((template) => ({ ...template, ...updates }), trackHistory);
  }, [commitTemplate]);

  const undo = useCallback(() => {
    const nextState = undoTemplateHistory({ currentTemplate, history, future });
    if (nextState.currentTemplate === currentTemplate && nextState.history === history && nextState.future === future) return;
    setCurrentTemplateState(nextState.currentTemplate);
    setHistory(nextState.history);
    setFuture(nextState.future);
  }, [currentTemplate, future, history]);

  const redo = useCallback(() => {
    const nextState = redoTemplateHistory({ currentTemplate, history, future });
    if (nextState.currentTemplate === currentTemplate && nextState.history === history && nextState.future === future) return;
    setCurrentTemplateState(nextState.currentTemplate);
    setHistory(nextState.history);
    setFuture(nextState.future);
  }, [currentTemplate, future, history]);

  return {
    commitTemplate,
    currentTemplate,
    future,
    history,
    recordTemplateHistory,
    redo,
    resetTemplate,
    setCurrentTemplate,
    updateTemplate,
    undo,
  };
}
