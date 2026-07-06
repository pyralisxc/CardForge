import { describe, expect, it } from 'vitest';

import { buildContractSegmentStyle } from '@/lib/cardTextRender';
import {
  buildFieldStyleDataKey,
  parseFieldStyleColumnHeader,
  resolveFieldContractStyleOverrides,
} from '@/lib/fieldStyleOverrides';
import type { TCGCardTemplate } from '@/types';

type FieldContract = NonNullable<TCGCardTemplate['fieldContracts']>[number];

describe('field style overrides', () => {
  it('recognizes font family style columns for structured and CSV rows', () => {
    expect(parseFieldStyleColumnHeader('cardName.fontFamily', ['cardName'])).toEqual({
      fieldKey: 'cardName',
      property: 'fontFamily',
    });
    expect(parseFieldStyleColumnHeader('cardName.style.fontFamily', ['cardName'])).toEqual({
      fieldKey: 'cardName',
      property: 'fontFamily',
    });
  });

  it('applies variable font family contracts to rendered text segments', () => {
    const contract: FieldContract = {
      key: 'cardName',
      fontFamily: 'font-serif',
    };
    const resolved = resolveFieldContractStyleOverrides(contract, {
      [buildFieldStyleDataKey('cardName', 'fontFamily')]: 'font-mono',
    }, 'cardName');

    expect(resolved?.fontFamily).toBe('font-mono');
    expect(buildContractSegmentStyle(resolved)).toMatchObject({
      fontFamily: 'Menlo, Consolas, monospace',
    });
  });
});
