import { beforeEach, describe, expect, it } from 'vitest';

import { useProjectStore } from '@/features/project/client/workspace';
import { selectAllGeneratedDisplayCards } from '@/features/project/store/selectors';
import { createProjectScaleFixture } from '../../fixtures/projectScale';

describe('neutral Set workspace lifecycle', () => {
  beforeEach(() => {
    useProjectStore.setState({
      cardSets: [],
      activeCardSet: null,
      storedCards: [],
      userTemplates: [],
      defaultTemplates: [],
      generatorSelectedTemplateId: null,
      generatorSelectedBackingTemplateId: null,
    });
  });

  it('starts without inventing a Set', () => {
    expect(useProjectStore.getState().cardSets).toEqual([]);
    expect(useProjectStore.getState().activeCardSet).toBeNull();
  });

  it('creates a content-neutral Set only at the explicit creation boundary', () => {
    const id = useProjectStore.getState().createCardSet('Playing Cards');
    const created = useProjectStore.getState().cardSets.find((set) => set.id === id);

    expect(created).toEqual({ id, name: 'Playing Cards' });
    expect(created && 'frontTemplateId' in created).toBe(false);
    expect(created && 'backingTemplateId' in created).toBe(false);
    expect(useProjectStore.getState().activeCardSet?.id).toBe(id);
  });

  it('returns to no active Set after deleting the final Set', () => {
    const id = useProjectStore.getState().createCardSet('Temporary Set');

    expect(useProjectStore.getState().deleteCardSet(id)).toBe(true);
    expect(useProjectStore.getState().cardSets).toEqual([]);
    expect(useProjectStore.getState().activeCardSet).toBeNull();
  });

  it('shares Template changes across Sets until a card explicitly uses a copy', () => {
    const fixture = createProjectScaleFixture(100);
    const template = fixture.userTemplates[0]!;
    const cards = fixture.storedCards.slice(0, 2).map((card, index) => ({ ...card, setId: `set-${index}` }));
    useProjectStore.setState({ userTemplates: [template], storedCards: cards });
    useProjectStore.getState().addOrUpdateTemplate({ ...template, name: 'Shared redesign' });
    let displayed = selectAllGeneratedDisplayCards(useProjectStore.getState());
    expect(displayed.map((card) => card.template.name)).toEqual(['Shared redesign', 'Shared redesign']);
    expect(displayed.map((card) => card.data)).toEqual(cards.map((card) => card.data));

    const copyId = useProjectStore.getState().cloneTemplate(template.id!);
    const copy = useProjectStore.getState().userTemplates.find((candidate) => candidate.id === copyId)!;
    useProjectStore.getState().updateGeneratedCard({ ...displayed[0]!, template: copy });
    useProjectStore.getState().addOrUpdateTemplate({ ...template, name: 'Next shared redesign' });
    displayed = selectAllGeneratedDisplayCards(useProjectStore.getState());
    expect(displayed[0]!.template.name).toBe('Copy of Shared redesign');
    expect(displayed[1]!.template.name).toBe('Next shared redesign');
    expect(displayed.map((card) => card.data)).toEqual(cards.map((card) => card.data));
    expect(displayed.map((card) => card.setId)).toEqual(['set-0', 'set-1']);
  });
});
