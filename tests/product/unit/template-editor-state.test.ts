import { describe, expect, it } from 'vitest';

import {
  acceptSavedTemplateEditorState,
  commitTemplateEditorState,
  createTemplateEditorState,
  redoTemplateEditorState,
  reconcileTemplateEditorSelection,
  undoTemplateEditorState,
} from '@/features/template-editor/lib/templateEditorState';
import type { FreeformCanvas, TCGCardTemplate } from '@/domain/templates';

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
    expect(undone.currentTemplate).toEqual(initial.currentTemplate);
    expect(undone.selectedElementId).toBe('front-a');
    expect(undone.future).toHaveLength(1);

    const redone = redoTemplateEditorState(undone);
    expect(redone.currentTemplate).toEqual(edited.currentTemplate);
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

it('groups one continuous authored field edit without crossing another field or a discrete command',()=>{
 const base=createTemplateEditorState(template('history',['front-a']));
 const change=(name:string)=>(current:TCGCardTemplate)=>({...current,name});
 const first=commitTemplateEditorState(base,change('a'),true,undefined,{key:'field:a',at:100});
 const second=commitTemplateEditorState(first,change('ab'),true,undefined,{key:'field:a',at:200});
 expect(second.history).toHaveLength(1);expect(undoTemplateEditorState(second).currentTemplate.name).toBe('history');
 const other=commitTemplateEditorState(second,change('other'),true,undefined,{key:'field:b',at:250});
 expect(other.history).toHaveLength(2);
 const discrete=commitTemplateEditorState(other,change('discrete'));
 expect(discrete.history).toHaveLength(3);
 const resumed=commitTemplateEditorState(discrete,change('resumed'),true,undefined,{key:'field:b',at:300});
 expect(resumed.history).toHaveLength(4);
});
it('does not record equivalent updates and invalidates redo on any new authored change',()=>{
 const base=createTemplateEditorState(template('history',['front-a']));
 expect(commitTemplateEditorState(base,current=>({...current}))).toBe(base);
 const changed=commitTemplateEditorState(base,current=>({...current,name:'first'}));
 const undone=undoTemplateEditorState(changed);
 const next=commitTemplateEditorState(undone,current=>({...current,name:'new'}),false);
 expect(next.future).toEqual([]);
});

it('accepts authoritative same-ID metadata while preserving selection, history and later authored work', () => {
 const base=createTemplateEditorState({...template('same',['first','selected']),templateSource:'default',templateLibrarySource:'pipeline',templateRevision:3,templateRevisionId:'published-3'});
 const submitted=commitTemplateEditorState({...base,selectedElementId:'selected'},t=>({...t,name:'Submitted'}));
 const saved:TCGCardTemplate={...submitted.currentTemplate,templateSource:'user',templateLibrarySource:'personal',templateRegistryStatus:'draft',templateRevisionId:'draft-4',templateParentRevisionId:'published-3'};
 const accepted=acceptSavedTemplateEditorState(submitted,submitted.currentTemplate,saved);
 expect(accepted.currentTemplate).toEqual(saved);expect(accepted.selectedElementId).toBe('selected');
 const undone=undoTemplateEditorState(accepted);
 expect(undone.currentTemplate.name).toBe('same');expect(undone.currentTemplate.templateRevisionId).toBe('draft-4');
 expect(redoTemplateEditorState(undone).currentTemplate).toEqual(saved);
 const later=commitTemplateEditorState(submitted,t=>({...t,name:'Later authored name'}));
 const recovered=acceptSavedTemplateEditorState(later,submitted.currentTemplate,saved);
 expect(recovered.currentTemplate.name).toBe('Later authored name');expect(recovered.currentTemplate.templateRevisionId).toBe('draft-4');
 expect(undoTemplateEditorState(recovered).currentTemplate).toEqual(saved);
 const other=createTemplateEditorState(template('other',['other-element']));
 expect(acceptSavedTemplateEditorState(other,submitted.currentTemplate,saved)).toBe(other);
});
