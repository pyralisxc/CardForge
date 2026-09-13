import { describe, expect, it } from 'vitest';

import type { StoredDisplayCard } from '@/domain/cards';
import { reconstructMinimalTemplateObject } from '@/domain/templates';
import { applyTemplateFieldRemoval, buildTemplateSaveImpact } from '@/features/template-editor/lib/templateSaveImpact';

const template = (fields: Array<{ key: string; required?: boolean }>) => reconstructMinimalTemplateObject({
  id: 'template-a',
  name: 'Creature',
  aspectRatio: '63:88',
  fieldContracts: fields,
  freeformCanvas: { width: 630, height: 880, elements: [] },
});

const cards: StoredDisplayCard[] = [
  { uniqueId: 'a', templateId: 'template-a', setId: 'set-a', data: { name: 'Dragon', defense: 4 } },
  { uniqueId: 'b', templateId: 'template-a', setId: 'set-a', data: { name: 'Goblin', defense: 1 } },
  { uniqueId: 'c', templateId: 'other', backingTemplateId: 'template-a', setId: 'set-a', data: { name: 'Back user' }, backingData: { defense: 2 } },
];

describe('Template save impact', () => {
  it('reports destructive removals and new required fields across front and back dependents', () => {
    const impact = buildTemplateSaveImpact({
      previous: template([{ key: 'name', required: true }, { key: 'defense' }]),
      next: template([{ key: 'name', required: true }, { key: 'rarity', required: true }]),
      cards,
    });
    expect(impact.removedFieldKeys).toEqual(['defense']);
    expect(impact.addedRequiredFieldKeys).toEqual(['rarity']);
    expect(impact.frontArtifactIds).toEqual(['a', 'b']);
    expect(impact.backArtifactIds).toEqual(['c']);
    expect(impact.requiresReview).toBe(true);
  });

  it('deletes intentionally removed field values only from dependents in scope', () => {
    const next = applyTemplateFieldRemoval({
      cards,
      templateId: 'template-a',
      removedFieldKeys: ['defense'],
      scopeIds: ['b', 'c'],
    });
    expect(next.find((card) => card.uniqueId === 'a')?.data.defense).toBe(4);
    expect(next.find((card) => card.uniqueId === 'b')?.data.defense).toBeUndefined();
    expect(next.find((card) => card.uniqueId === 'c')?.backingData?.defense).toBeUndefined();
  });
});
