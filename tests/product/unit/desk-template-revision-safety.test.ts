import { describe, expect, it } from 'vitest';
import { reconstructMinimalTemplateObject, type TCGCardTemplate } from '@/domain/templates';
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
