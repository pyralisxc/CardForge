import { describe, expect, it } from 'vitest';

import {
  commitTemplateEditorState,
  createTemplateEditorState,
  redoTemplateEditorState,
  reconcileTemplateEditorSelection,
  setTemplateEditorFace,
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
  backIds: string[] = [],
): TCGCardTemplate => ({
  id: name,
  name,
  aspectRatio: '63:88',
  freeformCanvas: canvas(frontIds),
  backCanvas: backIds.length > 0 ? canvas(backIds) : undefined,
});

describe('templateEditorState', () => {
  it('initializes selection from the active front canvas', () => {
    const state = createTemplateEditorState(template('initial', ['front-a', 'front-b']));

    expect(state.activeFace).toBe('front');
    expect(state.selectedElementId).toBe('front-a');
    expect(state.history).toEqual([]);
    expect(state.future).toEqual([]);
  });

  it('switches faces with a valid selection for that face', () => {
    const state = setTemplateEditorFace(
      createTemplateEditorState(template('two-face', ['front-a'], ['back-a', 'back-b'])),
      'back',
    );

    expect(state.activeFace).toBe('back');
    expect(state.selectedElementId).toBe('back-a');
  });

  it('reconciles missing selection to the first element on the active face', () => {
    const state = createTemplateEditorState(template('initial', ['front-a', 'front-b']));
    const reconciled = reconcileTemplateEditorSelection({
      ...state,
      selectedElementId: 'missing',
    });

    expect(reconciled.selectedElementId).toBe('front-a');
  });

  it('undo and redo restore template, active face, and selected element together', () => {
    const initial = createTemplateEditorState(template('initial', ['front-a'], ['back-a']));
    const onBack = setTemplateEditorFace(initial, 'back');
    const edited = commitTemplateEditorState(
      { ...onBack, selectedElementId: 'back-a' },
      (currentTemplate) => ({
        ...currentTemplate,
        name: 'edited',
        backCanvas: canvas(['back-b']),
      }),
      true,
      'back-b',
    );

    expect(edited.currentTemplate.name).toBe('edited');
    expect(edited.activeFace).toBe('back');
    expect(edited.selectedElementId).toBe('back-b');
    expect(edited.history).toHaveLength(1);

    const undone = undoTemplateEditorState(edited);
    expect(undone.currentTemplate.name).toBe('initial');
    expect(undone.activeFace).toBe('back');
    expect(undone.selectedElementId).toBe('back-a');
    expect(undone.future).toHaveLength(1);

    const redone = redoTemplateEditorState(undone);
    expect(redone.currentTemplate.name).toBe('edited');
    expect(redone.activeFace).toBe('back');
    expect(redone.selectedElementId).toBe('back-b');
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
