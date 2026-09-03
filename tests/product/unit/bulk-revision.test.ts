import { describe, expect, it } from 'vitest';

import type { DisplayCard } from '@/domain/rendering';
import type { TCGCardTemplate } from '@/domain/templates';
import { buildBulkResourceRevisionPlan, buildBulkRevisionPlan } from '@/features/card-generator/lib/bulkRevision';

const template = { id: 'template-playing-card', name: 'Playing Card' } as TCGCardTemplate;
const card = (uniqueId: string, data: Record<string, string>): DisplayCard => ({
  uniqueId,
  template,
  setId: 'deck',
  setName: 'Deck',
  data,
});

describe('bulk revision planning', () => {
  it('revises matched cards in place while preserving IDs, unspecified fields, and final count', () => {
    const plan = buildBulkRevisionPlan({
      existing: [card('ace-spades', { rank: 'Ace', suit: 'Spades', note: 'keep' }), card('king-hearts', { rank: 'King', suit: 'Hearts' })],
      incoming: [card('import-1', { rank: 'Ace', suit: 'Clubs' }), card('import-2', { rank: 'Queen', suit: 'Diamonds' })],
      match: { kind: 'field', key: 'rank', label: 'Rank' },
    });

    expect(plan).toMatchObject({ matchedCount: 1, unmatchedRows: [3], ambiguousRows: [], finalArtifactCount: 2 });
    expect(plan.revisions[0]).toMatchObject({ uniqueId: 'ace-spades', data: { rank: 'Ace', suit: 'Clubs', note: 'keep' } });
    expect(plan.changedFields).toContain('suit');
    expect(plan.preservedFields).toContain('note');
  });

  it('blocks duplicate targets as ambiguous instead of appending duplicates', () => {
    const plan = buildBulkRevisionPlan({
      existing: [card('one', { name: 'Same' }), card('two', { name: 'Same' })],
      incoming: [card('incoming', { name: 'Same', note: 'new' })],
      match: { kind: 'field', key: 'name', label: 'Name' },
    });
    expect(plan).toMatchObject({ matchedCount: 0, unmatchedRows: [], ambiguousRows: [2], finalArtifactCount: 2 });
  });

  it('matches imported revisions only inside an explicit stable-ID scope', () => {
    const plan = buildBulkRevisionPlan({
      existing: [card('selected', { name: 'Same', note: 'keep' }), card('outside', { name: 'Same', note: 'outside' })],
      incoming: [card('incoming', { name: 'Same', note: 'changed' })],
      match: { kind: 'field', key: 'name', label: 'Name' },
      scopeIds: ['selected'],
    });

    expect(plan).toMatchObject({ matchedCount: 1, ambiguousRows: [], finalArtifactCount: 2 });
    expect(plan.revisions[0]).toMatchObject({ uniqueId: 'selected', data: { name: 'Same', note: 'changed' } });
  });

  it('matches nothing when an explicit selection has become empty instead of widening to the Set', () => {
    const plan = buildBulkRevisionPlan({
      existing: [card('outside', { name: 'Same', note: 'outside' })],
      incoming: [card('incoming', { name: 'Same', note: 'changed' })],
      match: { kind: 'field', key: 'name', label: 'Name' },
      scopeIds: [],
    });

    expect(plan).toMatchObject({ matchedCount: 0, unmatchedRows: [2], ambiguousRows: [], finalArtifactCount: 1 });
    expect(plan.revisions).toEqual([]);
  });

  it('maps Library resources onto selected Artifacts without changing identities or untouched fields', () => {
    const plan = buildBulkResourceRevisionPlan({
      existing: [card('one', { name: 'One', artwork: 'old-1', note: 'keep-1' }), card('two', { name: 'Two', artwork: 'old-2', note: 'keep-2' })],
      fieldKey: 'artwork',
      assignments: [
        { targetId: 'one', value: 'project://image-a' },
        { targetId: 'two', value: 'project://image-b' },
      ],
    });

    expect(plan).toMatchObject({ matchedCount: 2, finalArtifactCount: 2, changedFields: ['artwork'] });
    expect(plan.revisions.map((revision) => revision.uniqueId)).toEqual(['one', 'two']);
    expect(plan.revisions.map((revision) => revision.data)).toEqual([
      { name: 'One', artwork: 'project://image-a', note: 'keep-1' },
      { name: 'Two', artwork: 'project://image-b', note: 'keep-2' },
    ]);
  });
});
