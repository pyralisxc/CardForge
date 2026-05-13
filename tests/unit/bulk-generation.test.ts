import { describe, expect, it } from 'vitest';

import {
  buildInitialColumnMapping,
  shouldBlockBulkGeneration,
  updateColumnMapping,
} from '@/lib/bulkGeneration';

describe('bulk generation helpers', () => {
  it('builds initial column mapping with case-insensitive matching', () => {
    const headers = ['RulesText', 'TYPELINE', 'unknownCol'];
    const fieldKeys = ['rulesText', 'typeLine', 'setCode'];

    expect(buildInitialColumnMapping(headers, fieldKeys)).toEqual({
      RulesText: 'rulesText',
      TYPELINE: 'typeLine',
      unknownCol: '',
    });
  });

  it('updates column mapping for advanced interactions', () => {
    const current = {
      rulesText: 'rulesText',
      typeLine: 'typeLine',
    };

    const remapped = updateColumnMapping(current, 'typeLine', 'setCode');
    expect(remapped).toEqual({
      rulesText: 'rulesText',
      typeLine: 'setCode',
    });

    const ignored = updateColumnMapping(remapped, 'rulesText', '__unmapped__');
    expect(ignored).toEqual({
      rulesText: '',
      typeLine: 'setCode',
    });
  });

  it('blocks generation only when strict mode has warnings', () => {
    expect(shouldBlockBulkGeneration(false, 1, 0)).toBe(false);
    expect(shouldBlockBulkGeneration(true, 0, 0)).toBe(false);
    expect(shouldBlockBulkGeneration(true, 1, 0)).toBe(true);
    expect(shouldBlockBulkGeneration(true, 0, 2)).toBe(true);
  });
});
