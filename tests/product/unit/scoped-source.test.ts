import { describe, expect, it } from 'vitest';

import {
  beginScopedSource,
  mustClearScopedSourceForFailure,
  settleScopedSourceFailure,
  settleScopedSourceValue,
} from '@/shared/scopedSource';

describe('scoped source lifecycle', () => {
  const source = { scope: 'account:one', value: ['campaign:one'], phase: 'ready' as const, failure: null };

  it('shows a same-account refresh as loading without dropping known results', () => {
    expect(beginScopedSource(source, 'account:one')).toMatchObject({
      value: ['campaign:one'], phase: 'loading', failure: null,
    });
  });

  it('retains same-account results only for transient failures', () => {
    expect(settleScopedSourceFailure(source, 'account:one', { kind: 'unavailable' })).toMatchObject({
      value: ['campaign:one'], phase: 'unavailable', failure: { kind: 'unavailable' },
    });
  });

  it.each(['authentication', 'authorization', 'not_found'] as const)('clears protected results on %s', (kind) => {
    expect(mustClearScopedSourceForFailure(kind)).toBe(true);
    expect(settleScopedSourceFailure(source, 'account:one', { kind })).toMatchObject({
      value: null,
      failure: { kind },
    });
  });

  it('does not carry results into another account scope', () => {
    expect(beginScopedSource(source, 'account:two')).toMatchObject({ value: null, phase: 'loading' });
    expect(settleScopedSourceFailure(source, 'account:two', { kind: 'unavailable' })).toMatchObject({ value: null });
  });

  it('makes known empty and incomplete results explicit', () => {
    expect(settleScopedSourceValue<string, string[], { kind: 'unavailable' }>('account:one', [], { empty: true })).toMatchObject({ phase: 'empty' });
    expect(settleScopedSourceValue<string, string[], { kind: 'unavailable' }>('account:one', ['first'], { incomplete: true })).toMatchObject({ phase: 'incomplete' });
  });
});
