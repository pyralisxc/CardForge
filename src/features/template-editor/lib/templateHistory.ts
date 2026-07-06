import type { TCGCardTemplate } from '@/types';
import { reconstructMinimalTemplate } from '@/lib/templateModel';

export const TEMPLATE_HISTORY_LIMIT = 40;

export const appendTemplateHistoryEntry = (
  history: TCGCardTemplate[],
  template: TCGCardTemplate,
): TCGCardTemplate[] => [
  ...history.slice(-(TEMPLATE_HISTORY_LIMIT - 1)),
  reconstructMinimalTemplate(template),
];

export interface TemplateHistorySnapshot {
  currentTemplate: TCGCardTemplate;
  history: TCGCardTemplate[];
  future: TCGCardTemplate[];
}

export const undoTemplateHistory = ({
  currentTemplate,
  history,
  future,
}: TemplateHistorySnapshot): TemplateHistorySnapshot => {
  const previous = history[history.length - 1];
  if (!previous) return { currentTemplate, history, future };

  return {
    currentTemplate: reconstructMinimalTemplate(previous),
    history: history.slice(0, -1),
    future: [reconstructMinimalTemplate(currentTemplate), ...future],
  };
};

export const redoTemplateHistory = ({
  currentTemplate,
  history,
  future,
}: TemplateHistorySnapshot): TemplateHistorySnapshot => {
  const next = future[0];
  if (!next) return { currentTemplate, history, future };

  return {
    currentTemplate: reconstructMinimalTemplate(next),
    history: appendTemplateHistoryEntry(history, currentTemplate),
    future: future.slice(1),
  };
};
