import { describe, expect, it } from 'vitest';

import {
  commitTemplateEditorState,
  createTemplateEditorState,
  redoTemplateEditorState,
  reconcileTemplateEditorSelection,
  undoTemplateEditorState,
} from '@/features/template-editor/lib/templateEditorState';
import type { FreeformCanvas, TCGCardTemplate } from '@/types';

const canvas = (elementIds: string[]): FreeformCanvas => ({
  width: 300,
  height: 420,
  elements: elementIds.map((id, index) => ({
    id,
    name: id,
    type: 'shape',
    x: 10,
    y: 10,
    width: 20,
    height: 20,
    zIndex: index + 1,
  })),
});

const template = (
  name: string,
  frontIds: string[],
): TCGCardTemplate => ({
  id: name,
  name,
  aspectRatio: '63:88',
  freeformCanvas: canvas(frontIds),
});

describe('templateEditorState', () => {
  it('initializes selection from the template canvas', () => {
    const state = createTemplateEditorState(template('initial', ['front-a', 'front-b']));

    expect(state.selectedElementId).toBe('front-a');
    expect(state.history).toEqual([]);
    expect(state.future).toEqual([]);
  });

  it('reconciles missing selection to the first canvas element', () => {
    const state = createTemplateEditorState(template('initial', ['front-a', 'front-b']));
    const reconciled = reconcileTemplateEditorSelection({
      ...state,
      selectedElementId: 'missing',
    });

    expect(reconciled.selectedElementId).toBe('front-a');
  });

  it('undo and redo restore template and selected element together', () => {
    const initial = createTemplateEditorState(template('initial', ['front-a']));
    const edited = commitTemplateEditorState(
      { ...initial, selectedElementId: 'front-a' },
      (currentTemplate) => ({
        ...currentTemplate,
        name: 'edited',
        freeformCanvas: canvas(['front-b']),
      }),
      true,
      'front-b',
    );

    expect(edited.currentTemplate.name).toBe('edited');
    expect(edited.selectedElementId).toBe('front-b');
    expect(edited.history).toHaveLength(1);

    const undone = undoTemplateEditorState(edited);
    expect(undone.currentTemplate.name).toBe('initial');
    expect(undone.selectedElementId).toBe('front-a');
    expect(undone.future).toHaveLength(1);

    const redone = redoTemplateEditorState(undone);
    expect(redone.currentTemplate.name).toBe('edited');
    expect(redone.selectedElementId).toBe('front-b');
  });

  it('does not add history entries for untracked commits', () => {
    const state = createTemplateEditorState(template('initial', ['front-a']));
    const edited = commitTemplateEditorState(
      state,
      (currentTemplate) => ({ ...currentTemplate, name: 'typing' }),
      false,
    );

    expect(edited.currentTemplate.name).toBe('typing');
    expect(edited.history).toHaveLength(0);
    expect(edited.future).toHaveLength(0);
  });
});
