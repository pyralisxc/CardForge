import { beforeEach, describe, expect, it } from 'vitest';

import { useProjectStore } from '@/features/project/client/workspace';

describe('neutral Set workspace lifecycle', () => {
  beforeEach(() => {
    useProjectStore.setState({
      cardSets: [],
      activeCardSet: null,
      storedCards: [],
      singleCardGeneratorSelectedTemplateId: null,
      singleCardGeneratorSelectedBackingTemplateId: null,
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
});
