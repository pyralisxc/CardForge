import { describe, expect, it } from 'vitest';

import {
  TEMPLATE_HISTORY_LIMIT,
  appendTemplateHistoryEntry,
  redoTemplateHistory,
  undoTemplateHistory,
} from '@/features/template-editor/lib/templateHistory';
import type { TCGCardTemplate } from '@/types';

const template = (name: string): TCGCardTemplate => ({
  id: name,
  name,
  aspectRatio: '63:88',
});

describe('templateHistory', () => {
  it('caps history to the configured limit', () => {
    const history = Array.from({ length: TEMPLATE_HISTORY_LIMIT + 5 }, (_, index) => template(`template-${index}`));
    const next = appendTemplateHistoryEntry(history, template('latest'));

    expect(next).toHaveLength(TEMPLATE_HISTORY_LIMIT);
    expect(next[0].name).toBe('template-6');
    expect(next.at(-1)?.name).toBe('latest');
  });

  it('moves the latest history entry into current template on undo', () => {
    const result = undoTemplateHistory({
      currentTemplate: template('current'),
      history: [template('first'), template('previous')],
      future: [template('future')],
    });

    expect(result.currentTemplate.name).toBe('previous');
    expect(result.history.map((item) => item.name)).toEqual(['first']);
    expect(result.future.map((item) => item.name)).toEqual(['current', 'future']);
  });

  it('moves the first future entry into current template on redo', () => {
    const result = redoTemplateHistory({
      currentTemplate: template('current'),
      history: [template('previous')],
      future: [template('next'), template('later')],
    });

    expect(result.currentTemplate.name).toBe('next');
    expect(result.history.map((item) => item.name)).toEqual(['previous', 'current']);
    expect(result.future.map((item) => item.name)).toEqual(['later']);
  });
});
