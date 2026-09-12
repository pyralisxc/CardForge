import { describe, expect, it } from 'vitest';

import type { DisplayCard } from '@/domain/rendering';
import { reconstructMinimalTemplateObject } from '@/domain/templates';
import { buildBulkRevisionPlan } from '@/features/card-generator/lib/bulkRevision';

const a = reconstructMinimalTemplateObject({ id: 'a', name: 'A', aspectRatio: '63:88' });
const b = reconstructMinimalTemplateObject({ id: 'b', name: 'B', aspectRatio: '63:88' });

const card = (id: string, template: DisplayCard['template'], rarity: string): DisplayCard => ({
  uniqueId: id,
  template,
  setId: 'set-a',
  setName: 'Set A',
  data: { name: id, rarity },
});

describe('bulk revision design authority', () => {
  it('preserves each existing Artifact Template while patching imported values', () => {
    const existing = [card('one', a, 'Common'), card('two', b, 'Rare')];
    const incoming = [card('one', a, 'Mythic'), card('two', a, 'Mythic')];
    const plan = buildBulkRevisionPlan({ existing, incoming, match: { kind: 'unique-id' } });
    expect(plan.revisions.map((item) => item.template.id)).toEqual(['a', 'b']);
    expect(plan.revisions.map((item) => item.data.rarity)).toEqual(['Mythic', 'Mythic']);
  });
});
