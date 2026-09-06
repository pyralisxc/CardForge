import { describe, expect, it } from 'vitest';

import { applyAccountLibraryOrganizationOperation } from '@/features/storage-management/model/accountLibrary';

describe('account library organization operations', () => {
  it('adds a tag per Set without copying other selected Sets’ tags', () => {
    const setA = { type: 'Trading card set', tags: ['TCG'] };
    const setB = { type: 'Postcards', tags: ['Postcards'] };

    expect(applyAccountLibraryOrganizationOperation(setA, { kind: 'add-tag', tag: 'Needs artwork' })).toEqual({
      type: 'Trading card set', tags: ['TCG', 'Needs artwork'],
    });
    expect(applyAccountLibraryOrganizationOperation(setB, { kind: 'add-tag', tag: 'Needs artwork' })).toEqual({
      type: 'Postcards', tags: ['Postcards', 'Needs artwork'],
    });
  });

  it('supports individual removal and rename without changing a Set workflow', () => {
    expect(applyAccountLibraryOrganizationOperation({ type: 'Postcards', tags: ['Launch', 'Needs artwork'] }, {
      kind: 'rename-tag', from: 'Needs artwork', to: 'Art ready',
    })).toEqual({ type: 'Postcards', tags: ['Launch', 'Art ready'] });
    expect(applyAccountLibraryOrganizationOperation({ type: 'Postcards', tags: ['Launch', 'Art ready'] }, {
      kind: 'remove-tag', tag: 'launch',
    })).toEqual({ type: 'Postcards', tags: ['Art ready'] });
  });
});
