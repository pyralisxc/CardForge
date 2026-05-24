import { describe, expect, it } from 'vitest';

import { remapDuplicatedTextElementContracts } from '@/features/template-editor/lib/templateVariableContracts';
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
  it('copies scoped contracts for duplicated text elements and remaps copied placeholder keys', () => {
    const fieldContracts: NonNullable<TCGCardTemplate['fieldContracts']> = [
      {
        key: 'title_var_1',
        elementId: 'title-original',
        label: 'Title Var 1',
        type: 'richText',
        required: false,
        example: 'Ashen Crown',
      },
      {
        key: 'sharedRules',
        label: 'Shared Rules',
        type: 'rules',
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
        type: 'richText',
        required: false,
        example: 'Ashen Crown',
      },
    ]);
  });
});
