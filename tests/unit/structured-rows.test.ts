import { describe, expect, it } from 'vitest';

import { initializeCardDataFromTemplate } from '@/lib/cardDataDefaults';
import {
  buildStructuredRowsDataKey,
  buildStructuredRowsText,
  parseStructuredRowsValue,
  stringifyStructuredRowsValue,
} from '@/lib/structuredRows';
import type { FreeformCardElement, TCGCardTemplate } from '@/types';

const rowElement: FreeformCardElement = {
  id: 'trait-row',
  type: 'text',
  name: 'Trait Row',
  x: 0,
  y: 0,
  width: 260,
  height: 120,
  zIndex: 1,
  content: '{{trait:"Flying"}}: {{value:"+1"}}',
};

describe('structured row fields', () => {
  it('serializes repeatable row values and expands an authored row pattern', () => {
    const rows = [
      { trait: 'Flying', value: '+1' },
      { trait: 'Trample', value: '+2' },
    ];

    expect(parseStructuredRowsValue(stringifyStructuredRowsValue(rows))).toEqual(rows);
    expect(buildStructuredRowsText(rowElement, rows)).toBe('Flying: +1\nTrample: +2');
  });

  it('initializes structured row card data with one editable row', () => {
    const template: TCGCardTemplate = {
      id: 'structured-template',
      name: 'Structured Template',
      aspectRatio: '63:88',
      fieldContracts: [
        { key: 'trait', elementId: 'trait-row', type: 'structuredRows', example: 'Flying' },
        { key: 'value', elementId: 'trait-row', type: 'structuredRows', example: '+1' },
      ],
      freeformCanvas: {
        width: 630,
        height: 880,
        elements: [rowElement],
      },
    };

    const [fields, data] = initializeCardDataFromTemplate(template);
    expect(fields.map((field) => field.contentModel)).toEqual(['structuredRows', 'structuredRows']);
    expect(parseStructuredRowsValue(data[buildStructuredRowsDataKey('trait-row')])).toEqual([
      { trait: 'Flying', value: '+1' },
    ]);
  });
});
