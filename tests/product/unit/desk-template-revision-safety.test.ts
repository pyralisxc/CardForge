import { describe, expect, it } from 'vitest';
import { reconstructMinimalTemplateObject, validateNativeTemplateStructure, type TCGCardTemplate } from '@/domain/templates';
import { normalizeSetUpdateReviews } from '@/domain/cards/setUpdateReview';
import { createTemplateUpdateComparison, resolveTemplateUpdateReview } from '@/features/project/model/templateUpdateReview';
import type { SetTemplateState } from '@/features/project/model/setTemplateOwnership';

const template = (id: string, keys: string[]) => reconstructMinimalTemplateObject({ id, name: 'Design', aspectRatio: '63:88', templateSource: 'user', templateLineageId: 'source', templateRevisionId: id,
  fieldContracts: keys.map((key) => ({ key, type: 'text' as const })), freeformCanvas: { width: 630, height: 880, elements: keys.map((key, index) => ({ id: key, name: key, type: 'text' as const, content: `{{${key}}}`, x: 0, y: index * 30, width: 100, height: 30, zIndex: index })) } });
const workspace = (current: TCGCardTemplate, source: TCGCardTemplate, face: 'front' | 'back' = 'front'): SetTemplateState => ({
  userTemplates: [current, source], cardSets: [{ id: 'set', name: 'My Set', templateIds: [current.id!] }],
  storedCards: [{ uniqueId: 'artifact', setId: 'set', templateId: face === 'front' ? current.id! : 'other',
    ...(face === 'back' ? { backingTemplateId: current.id!, backingData: { name: 'Dragon', lore: 'Private story' } } : {}), data: { name: 'Dragon', lore: 'Private story' } }],
});
const fingerprint = 'a'.repeat(64);

describe('Set-owned selective Template Update review', () => {
  it('reviews properties without auto-acceptance and completes an all-kept review without changing content', () => {
    const current = template('current', ['name']);
    const source = template('incoming', ['name']);
    source.name = 'Incoming title';
    source.freeformCanvas!.elements[0].x = 20;
    source.freeformCanvas!.elements[0].width = 150;
    const state = workspace(current, source);
    const before = structuredClone(state);
    const comparison = createTemplateUpdateComparison(state, 'set', 'current', source);
    expect(comparison.changes).toHaveLength(3);
    const x = comparison.changes.find((change) => change.path.at(-1) === 'x')!;
    expect(x.group).toBe('Element · name');
    const partial = resolveTemplateUpdateReview(state, comparison, source, { [x.key]: 'use' }, fingerprint);
    expect(partial.template.freeformCanvas!.elements[0].x).toBe(20);
    expect(partial.template.name).toBe(current.name);
    expect(partial.review.outcome).toBe('deferred');
    expect(partial.review.decisions.filter((choice) => choice.decision === 'defer')).toHaveLength(2);
    expect(JSON.stringify(partial.review)).not.toContain('Incoming title');
    const kept = resolveTemplateUpdateReview(state, comparison, source, Object.fromEntries(comparison.changes.map((change) => [change.key, 'keep'])), fingerprint);
    expect(kept.review.outcome).toBe('reviewed');
    expect(kept.changesTemplate).toBe(false);
    expect(kept.template).toEqual(current);
    expect(normalizeSetUpdateReviews([kept.review])).toEqual([kept.review]);
    expect(() => normalizeSetUpdateReviews([{ ...partial.review, outcome: 'reviewed' }])).toThrow(/deferred/i);
    expect(() => normalizeSetUpdateReviews([{ ...kept.review, oldSnapshot: current }])).toThrow(/unsupported/i);
    expect(state).toEqual(before);
  });

  it('rejects mixed parent choices that form a cycle while accepting a valid reparenting', () => {
    const current = template('current', ['name']);
    const source = template('incoming', ['name']);
    const elementA = { id: 'group-a', name: 'Group A', type: 'text' as const, content: 'Group A', x: 0, y: 0, width: 100, height: 100, zIndex: 1 };
    const elementB = { id: 'group-b', name: 'Group B', type: 'text' as const, content: 'Group B', x: 0, y: 0, width: 100, height: 100, zIndex: 2 };
    current.freeformCanvas!.hierarchyVersion = 2;
    source.freeformCanvas!.hierarchyVersion = 2;
    current.freeformCanvas!.elements.push({ ...elementA, parentId: 'group-b' }, elementB);
    source.freeformCanvas!.elements.push(elementA, { ...elementB, parentId: 'group-a' });
    expect(validateNativeTemplateStructure(current)).toBeNull();
    expect(validateNativeTemplateStructure(source)).toBeNull();

    const state = workspace(current, source);
    const before = structuredClone(state);
    const comparison = createTemplateUpdateComparison(state, 'set', 'current', source);
    const parentChange = (id: string) => comparison.changes.find((change) => (
      change.path.at(-1) === 'parentId'
      && change.path.some((segment) => typeof segment === 'object' && 'by' in segment && segment.by === 'id' && segment.value === id)
    ))!;
    const keepAUseB = {
      [parentChange('group-a').key]: 'keep' as const,
      [parentChange('group-b').key]: 'use' as const,
    };
    expect(() => resolveTemplateUpdateReview(state, comparison, source, keepAUseB, fingerprint)).toThrow(/valid design/i);
    expect(state).toEqual(before);

    const useAll = Object.fromEntries(comparison.changes.map((change) => [change.key, 'use' as const]));
    const accepted = resolveTemplateUpdateReview(state, comparison, source, useAll, fingerprint);
    expect(accepted.template.freeformCanvas!.elements.find((element) => element.id === 'group-a')?.parentId).toBeUndefined();
    expect(accepted.template.freeformCanvas!.elements.find((element) => element.id === 'group-b')?.parentId).toBe('group-a');
    expect(validateNativeTemplateStructure(accepted.template)).toBeNull();
    expect(state).toEqual(before);
  });

  it.each(['front', 'back'] as const)('refuses field loss and stale %s reviews without changing authored work', (face) => {
    const current = template('current', ['name', 'lore']);
    const source = template('incoming', ['name']);
    if (face === 'back') { current.templateUsage = 'back-preset'; source.templateUsage = 'back-preset'; }
    const state = workspace(current, source, face);
    const before = structuredClone(state);
    const comparison = createTemplateUpdateComparison(state, 'set', 'current', source);
    const useAll = Object.fromEntries(comparison.changes.map((change) => [change.key, 'use' as const]));
    expect(() => resolveTemplateUpdateReview(state, comparison, source, useAll, fingerprint)).toThrow(/remove fields/i);
    expect(state).toEqual(before);
    const stale = { ...state, userTemplates: [{ ...current, name: 'Later edit' }, source] };
    expect(() => resolveTemplateUpdateReview(stale, comparison, source, {}, fingerprint)).toThrow(/changed while review/i);
    expect(() => resolveTemplateUpdateReview(state, comparison, { ...source, name: 'Replaced source' }, {}, fingerprint)).toThrow(/changed while review/i);
    expect(() => createTemplateUpdateComparison(state, 'set', 'current', { ...source, templateLineageId: 'unrelated' })).toThrow(/related revision/i);
    const ambiguous = structuredClone(source);
    ambiguous.freeformCanvas!.elements.push(structuredClone(ambiguous.freeformCanvas!.elements[0]));
    expect(() => createTemplateUpdateComparison(state, 'set', 'current', ambiguous)).toThrow();
  });
});
