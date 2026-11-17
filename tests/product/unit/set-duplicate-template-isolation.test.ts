import { beforeEach, describe, expect, it } from 'vitest';
import { reconstructMinimalTemplateObject } from '@/domain/templates';
import { useProjectStore } from '@/features/project/store/workspaceStore';

const template = (id: string, usage: 'standard' | 'back-preset' = 'standard') => reconstructMinimalTemplateObject({
  id, name: id, aspectRatio: '63:88', templateSource: 'user', templateUsage: usage,
  templateLineageId: `${id}-lineage`, templateRevisionId: `${id}-revision`,
  freeformCanvas: { width: 630, height: 880, elements: [] },
});

describe('Set duplication Template isolation', () => {
  beforeEach(() => useProjectStore.setState(useProjectStore.getInitialState()));

  it('copies prepared, front and back designs so editing and deletion stay within the chosen Set', () => {
    const front = { ...template('front'), templateOriginLineageId: 'upstream-lineage', templateOriginRevisionId: 'upstream-revision' };
    const back = template('back', 'back-preset');
    const prepared = template('prepared');
    const completedReview = {
      version: 1 as const, templateId: 'front', sourceLineageId: 'upstream-lineage',
      sourceRevisionId: 'upstream-revision', sourceFingerprint: 'a'.repeat(64),
      outcome: 'reviewed' as const, decisions: [{ key: 'name', decision: 'keep' as const }],
    };
    const deferredReview = {
      ...completedReview, sourceRevisionId: 'deferred-revision', outcome: 'deferred' as const,
      decisions: [{ key: 'name', decision: 'defer' as const }],
    };
    const original = { id: 'original', name: 'Original', templateIds: ['front', 'back', 'prepared'], updateReviews: [completedReview, deferredReview] };
    const card = { uniqueId: 'card', setId: original.id, templateId: 'front', backingTemplateId: 'back', data: { name: 'A' }, backingData: { name: 'B' } };
    useProjectStore.setState({ cardSets: [original], activeCardSet: original, storedCards: [card, { ...card, uniqueId: 'other-card' }], userTemplates: [front, back, prepared], defaultTemplates: [] });
    const copyId = useProjectStore.getState().duplicateCardSet(original.id);
    expect(copyId).toBeTruthy();
    const state = useProjectStore.getState();
    const copy = state.cardSets.find((set) => set.id === copyId)!;
    const copiedCard = state.storedCards.find((item) => item.setId === copyId)!;
    expect(copy.updateReviews).toEqual([{ ...completedReview, templateId: copiedCard.templateId }]);
    expect(copy.updateReviews?.[0]).not.toBe(original.updateReviews[0]);
    expect(copy.updateReviews?.[0]?.decisions).not.toBe(original.updateReviews[0].decisions);
    expect(state.cardSets.find((set) => set.id === original.id)?.updateReviews).toEqual([completedReview, deferredReview]);
    expect(copy.templateIds).toHaveLength(3);
    expect(copy.templateIds).not.toContain('prepared');
    expect(copiedCard.templateId).not.toBe('front');
    expect(copiedCard.backingTemplateId).not.toBe('back');
    expect(copy.templateIds).toContain(copiedCard.templateId);
    expect(copy.templateIds).toContain(copiedCard.backingTemplateId);
    const copiedFront = state.userTemplates.find((item) => item.id === copiedCard.templateId)!;
    expect(copiedFront.templateOriginLineageId).toBe('front-lineage');
    expect(copiedFront.templateOriginRevisionId).toBe('front-revision');
    expect(copiedFront).toHaveProperty('templateOriginAncestors', [{ lineageId: 'upstream-lineage', revisionId: 'upstream-revision' }]);
    state.commitTemplateChange({ template: { ...copiedFront, name: 'Changed copy' }, source: 'user' });
    expect(useProjectStore.getState().userTemplates.find((item) => item.id === 'front')?.name).toBe('front');
    useProjectStore.getState().deleteTemplate(copiedCard.templateId, 'user');
    expect(useProjectStore.getState().storedCards.find((item) => item.uniqueId === 'card')).toEqual(card);

    const destinationId = useProjectStore.getState().createCardSet('Destination');
    useProjectStore.getState().referenceTemplateInCardSet(destinationId, 'front');
    const acquiredId = useProjectStore.getState().cardSets.find((set) => set.id === destinationId)!.templateIds![0];
    expect(acquiredId).not.toBe('front');
    expect(useProjectStore.getState().cardSets.find((set) => set.id === destinationId)?.updateReviews)
      .toEqual([{ ...completedReview, templateId: acquiredId }]);
    const acquired = useProjectStore.getState().userTemplates.find((item) => item.id === acquiredId)!;
    expect(acquired).toMatchObject({ templateOriginLineageId: 'front-lineage', templateOriginRevisionId: 'front-revision' });
    useProjectStore.getState().commitTemplateChange({ template: { ...acquired, name: 'Destination design' }, setId: destinationId });

    expect(useProjectStore.getState().moveGeneratedCardsToSet(['card', 'other-card'], destinationId)).toBe(2);
    const moved = useProjectStore.getState().storedCards.find((item) => item.uniqueId === 'card')!;
    expect(moved).toMatchObject({ uniqueId: card.uniqueId, setId: destinationId, data: card.data, backingData: card.backingData });
    expect(moved.templateId).not.toBe('front');
    expect(moved.templateId).not.toBe(acquiredId);
    expect(moved.backingTemplateId).not.toBe('back');
    expect(useProjectStore.getState().cardSets.find((set) => set.id === destinationId)?.updateReviews)
      .toContainEqual({ ...completedReview, templateId: moved.templateId });
    expect(useProjectStore.getState().cardSets.find((set) => set.id === original.id)?.templateIds).toEqual(original.templateIds);
    expect(useProjectStore.getState().userTemplates.find((item) => item.id === 'front')).toEqual(front);
    expect(useProjectStore.getState().userTemplates.find((item) => item.id === acquiredId)?.name).toBe('Destination design');

    const movedDesign = useProjectStore.getState().userTemplates.find((item) => item.id === moved.templateId)!;
    const selectedId = useProjectStore.getState().commitTemplateChange({
      template: { ...movedDesign, name: 'Selected-only design' }, artifactIds: ['card'], setId: destinationId,
    });
    expect(selectedId).not.toBe(moved.templateId);
    expect(useProjectStore.getState().storedCards.find((item) => item.uniqueId === 'card')?.templateId).toBe(selectedId);
    expect(useProjectStore.getState().storedCards.find((item) => item.uniqueId === 'other-card')?.templateId).toBe(moved.templateId);
    expect(useProjectStore.getState().userTemplates.find((item) => item.id === moved.templateId)?.name).toBe('front');
    expect(useProjectStore.getState().cardSets.find((set) => set.id === destinationId)?.updateReviews)
      .toContainEqual({ ...completedReview, templateId: selectedId });
    expect(useProjectStore.getState().cardSets.find((set) => set.id === destinationId)?.updateReviews)
      .not.toContainEqual({ ...deferredReview, templateId: selectedId });
    expect(useProjectStore.getState().cardSets.find((set) => set.id === original.id)?.updateReviews)
      .toEqual([completedReview, deferredReview]);
    const beforeStaleSave = useProjectStore.getState();
    expect(() => beforeStaleSave.commitTemplateChange({
      template: { ...acquired, name: 'Stale edit' }, sourceTemplateId: acquired.id,
      expectedSourceRevisionId: acquired.templateRevisionId ?? null, setId: destinationId,
    })).toThrow(/changed/);
    expect(useProjectStore.getState()).toBe(beforeStaleSave);

    const library = template('library');
    useProjectStore.getState().addOrUpdateTemplate(library);
    const savedId = useProjectStore.getState().commitTemplateChange({
      template: { ...library, name: 'Set-only edit' }, sourceTemplateId: library.id, setId: original.id,
    });
    expect(savedId).not.toBe(library.id);
    expect(useProjectStore.getState().userTemplates.find((item) => item.id === library.id)).toEqual(library);
    expect(useProjectStore.getState().userTemplates.find((item) => item.id === savedId)).toMatchObject({
      name: 'Set-only edit', templateLineageId: savedId, templateRevision: 1,
      templateOriginLineageId: 'library-lineage', templateOriginRevisionId: 'library-revision',
    });
    expect(useProjectStore.getState().deleteCardSet(destinationId)).toBe(true);
    expect(useProjectStore.getState().userTemplates.some((item) => item.id === acquiredId || item.id === selectedId || item.id === moved.templateId)).toBe(false);
    expect(useProjectStore.getState().userTemplates.find((item) => item.id === library.id)).toEqual(library);
    expect(useProjectStore.getState().userTemplates.find((item) => item.id === front.id)).toEqual(front);
  });

  it('leaves the original untouched if a referenced design cannot be resolved', () => {
    const original = { id: 'original', name: 'Original', templateIds: ['missing'] };
    useProjectStore.setState({ cardSets: [original], activeCardSet: original, storedCards: [], userTemplates: [], defaultTemplates: [{ ...template('missing'), templateSource: 'default' }] });
    const before = useProjectStore.getState();
    expect(before.duplicateCardSet(original.id)).toBeNull();
    expect(useProjectStore.getState()).toBe(before);
  });

  it('refuses direct Template replacement or merge that would rewrite or resolve a referenced identity', () => {
    const original = template('shared');
    const set = { id: 'owner', name: 'Owner', templateIds: ['shared', 'missing'] };
    useProjectStore.setState({
      cardSets: [set],
      activeCardSet: set,
      storedCards: [],
      userTemplates: [original],
      defaultTemplates: [],
    });
    const before = useProjectStore.getState();
    before.setUserTemplatesFromFiles([]);
    expect(useProjectStore.getState().userTemplates).toEqual([original]);
    const afterPreserving = useProjectStore.getState();
    expect(() => afterPreserving.mergeUserTemplatesFromFiles([{ ...original, name: 'Changed source' }])).toThrow(/referenced by Set work/i);
    expect(useProjectStore.getState()).toBe(afterPreserving);
    expect(() => afterPreserving.mergeUserTemplatesFromFiles([template('missing')])).toThrow(/unresolved historical reference/i);
    expect(useProjectStore.getState()).toBe(afterPreserving);
  });

  it('includes legacy unassigned cards visible in the first Set and no other Set', () => {
    const design = template('front');
    const first = { id: 'first', name: 'First' };
    const second = { id: 'second', name: 'Second' };
    useProjectStore.setState({ cardSets: [first, second], activeCardSet: first, userTemplates: [design], defaultTemplates: [], storedCards: [{ uniqueId: 'legacy', templateId: 'front', data: { name: 'Legacy' } }] });
    const firstCopy = useProjectStore.getState().duplicateCardSet(first.id);
    expect(useProjectStore.getState().storedCards.find((card) => card.setId === firstCopy)?.data.name).toBe('Legacy');
    const secondCopy = useProjectStore.getState().duplicateCardSet(second.id);
    expect(useProjectStore.getState().storedCards.filter((card) => card.setId === secondCopy)).toHaveLength(0);
    expect(useProjectStore.getState().storedCards.find((card) => card.uniqueId === 'legacy')?.setId).toBeUndefined();
  });
});
