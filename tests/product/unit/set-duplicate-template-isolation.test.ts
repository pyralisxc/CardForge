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
    const front = template('front');
    const back = template('back', 'back-preset');
    const prepared = template('prepared');
    const original = { id: 'original', name: 'Original', templateIds: ['front', 'back', 'prepared'] };
    const card = { uniqueId: 'card', setId: original.id, templateId: 'front', backingTemplateId: 'back', data: { name: 'A' }, backingData: { name: 'B' } };
    useProjectStore.setState({ cardSets: [original], activeCardSet: original, storedCards: [card], userTemplates: [front, back, prepared], defaultTemplates: [] });
    const copyId = useProjectStore.getState().duplicateCardSet(original.id);
    expect(copyId).toBeTruthy();
    const state = useProjectStore.getState();
    const copy = state.cardSets.find((set) => set.id === copyId)!;
    const copiedCard = state.storedCards.find((item) => item.setId === copyId)!;
    expect(copy.templateIds).toHaveLength(3);
    expect(copy.templateIds).not.toContain('prepared');
    expect(copiedCard.templateId).not.toBe('front');
    expect(copiedCard.backingTemplateId).not.toBe('back');
    expect(copy.templateIds).toContain(copiedCard.templateId);
    expect(copy.templateIds).toContain(copiedCard.backingTemplateId);
    const copiedFront = state.userTemplates.find((item) => item.id === copiedCard.templateId)!;
    expect(copiedFront.templateOriginLineageId).toBe('front-lineage');
    expect(copiedFront.templateOriginRevisionId).toBe('front-revision');
    state.commitTemplateChange({ template: { ...copiedFront, name: 'Changed copy' }, source: 'user' });
    expect(useProjectStore.getState().userTemplates.find((item) => item.id === 'front')?.name).toBe('front');
    useProjectStore.getState().deleteTemplate(copiedCard.templateId, 'user');
    expect(useProjectStore.getState().storedCards.find((item) => item.uniqueId === 'card')).toEqual(card);
  });

  it('leaves the original untouched if a referenced design cannot be resolved', () => {
    const original = { id: 'original', name: 'Original', templateIds: ['missing'] };
    useProjectStore.setState({ cardSets: [original], activeCardSet: original, storedCards: [], userTemplates: [], defaultTemplates: [] });
    const before = useProjectStore.getState();
    expect(before.duplicateCardSet(original.id)).toBeNull();
    expect(useProjectStore.getState()).toBe(before);
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
