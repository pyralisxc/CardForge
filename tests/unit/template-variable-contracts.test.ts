import { describe, expect, it } from 'vitest';

import {
  getNextScopedVariableKey,
  removeScopedTextElementVariableContract,
  remapDuplicatedTextElementContracts,
  renameScopedTextElementVariable,
  upsertTemplateFieldContract,
} from '@/features/template-editor/lib/templateVariableContracts';
import type { FreeformCardElement, TCGCardTemplate } from '@/types';

const textElement = (
  id: string,
  content: string,
): FreeformCardElement => ({
  id,
  name: id,
  type: 'text',
  x: 0,
  y: 0,
  width: 100,
  height: 40,
  zIndex: 1,
  content,
});

describe('templateVariableContracts', () => {
  it('upserts scoped field contracts by key and element', () => {
    const template: TCGCardTemplate = {
      id: 'template-1',
      name: 'Template',
      aspectRatio: '2.5/3.5',
      fieldContracts: [
        { key: 'title', elementId: 'title-element', label: 'Old Title', type: 'text' },
      ],
    };

    const result = upsertTemplateFieldContract(template, 'title', {
      elementId: 'title-element',
      label: 'Card Title',
      type: 'text',
    });

    expect(result.fieldContracts).toEqual([
      { key: 'title', elementId: 'title-element', label: 'Card Title', type: 'text' },
    ]);
  });

  it('renames scoped variables in both contracts and the active canvas text content', () => {
    const template: TCGCardTemplate = {
      id: 'template-1',
      name: 'Template',
      aspectRatio: '2.5/3.5',
      fieldContracts: [
        { key: 'title_var_1', elementId: 'title-element', label: 'Title Var 1', type: 'text' },
      ],
      freeformCanvas: {
        width: 750,
        height: 1050,
        elements: [textElement('title-element', '{{title_var_1:"Ashen Crown"}}')],
      },
    };

    const result = renameScopedTextElementVariable({
      template,
      activeFace: 'front',
      fallbackCanvas: template.freeformCanvas!,
      selectedElementId: 'title-element',
      oldKey: 'title_var_1',
      nextKey: 'card_title',
    });

    expect(result.fieldContracts).toContainEqual(
      expect.objectContaining({ key: 'card_title', elementId: 'title-element', label: 'Card Title' }),
    );
    expect(result.freeformCanvas?.elements[0].content).toBe('{{card_title:"Ashen Crown"}}');
  });

  it('removes only the selected element contract for a variable key', () => {
    const template: TCGCardTemplate = {
      id: 'template-1',
      name: 'Template',
      aspectRatio: '2.5/3.5',
      fieldContracts: [
        { key: 'title', elementId: 'title-element', type: 'text' },
        { key: 'title', elementId: 'subtitle-element', type: 'text' },
      ],
    };

    const result = removeScopedTextElementVariableContract(template, 'title-element', 'title');

    expect(result.fieldContracts).not.toContainEqual(expect.objectContaining({ key: 'title', elementId: 'title-element' }));
    expect(result.fieldContracts).toContainEqual(expect.objectContaining({ key: 'title', elementId: 'subtitle-element' }));
  });

  it('suggests the next scoped variable key from the selected text element name', () => {
    const selectedElement = textElement('rules-element', 'Deal {{rules_box_var_1:"2"}} damage.');
    selectedElement.name = 'Rules Box';

    const result = getNextScopedVariableKey(
      [
        { key: 'rules_box_var_1', elementId: 'rules-element', type: 'text' },
      ],
      selectedElement,
    );

    expect(result).toBe('rules_box_var_2');
  });

  it('copies scoped contracts for duplicated text elements and remaps copied placeholder keys', () => {
    const fieldContracts: NonNullable<TCGCardTemplate['fieldContracts']> = [
      {
        key: 'title_var_1',
        elementId: 'title-original',
        label: 'Title Var 1',
        type: 'text',
        required: false,
        example: 'Ashen Crown',
      },
      {
        key: 'sharedRules',
        label: 'Shared Rules',
        type: 'text',
      },
    ];

    const result = remapDuplicatedTextElementContracts({
      elements: [
        textElement('title-original', '{{title_var_1:"Ashen Crown"}}'),
        textElement('title-copy', '{{title_var_1:"Ashen Crown"}}'),
      ],
      fieldContracts,
      duplicatedElementIdMap: {
        'title-original': 'title-copy',
      },
      createKey: (baseKey) => `${baseKey}_copy`,
    });

    expect(result.elements.find((element) => element.id === 'title-copy')?.content).toBe('{{title_var_1_copy:"Ashen Crown"}}');
    expect(result.fieldContracts).toEqual([
      fieldContracts[0],
      fieldContracts[1],
      {
        key: 'title_var_1_copy',
        elementId: 'title-copy',
        label: 'Title Var 1 Copy',
        type: 'text',
        required: false,
        example: 'Ashen Crown',
      },
    ]);
  });
});
