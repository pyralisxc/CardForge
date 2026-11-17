import { beforeEach, describe, expect, it } from 'vitest';

import { reconstructMinimalTemplateObject } from '@/domain/templates';
import { useProjectStore } from '@/features/project/client/workspace';

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

  it('acquires a distinct working Template per Set and keeps the unowned source unchanged', () => {
    const template = reconstructMinimalTemplateObject({ id: 'library-design', name: 'Library design', templateSource: 'user' });
    const sets = [{ id: 'set-0', name: 'First' }, { id: 'set-1', name: 'Second' }];
    useProjectStore.setState({ cardSets: sets, activeCardSet: sets[0]!, userTemplates: [template] });
    useProjectStore.getState().referenceTemplateInCardSet('set-0', template.id!);
    const firstId = useProjectStore.getState().cardSets.find((set) => set.id === 'set-0')?.templateIds?.[0];
    useProjectStore.getState().referenceTemplateInCardSet('set-1', template.id!);
    const secondId = useProjectStore.getState().cardSets.find((set) => set.id === 'set-1')?.templateIds?.[0];
    expect(firstId).not.toBe(template.id);
    expect(secondId).not.toBe(template.id);
    expect(secondId).not.toBe(firstId);

    const first = useProjectStore.getState().userTemplates.find((candidate) => candidate.id === firstId)!;
    useProjectStore.getState().commitTemplateChange({
      template: { ...first, name: 'First Set redesign' },
      sourceTemplateId: first.id,
      setId: 'set-0',
    });

    expect(useProjectStore.getState().userTemplates.find((candidate) => candidate.id === template.id)?.name).toBe('Library design');
    expect(useProjectStore.getState().userTemplates.find((candidate) => candidate.id === firstId)?.name).toBe('First Set redesign');
    expect(useProjectStore.getState().userTemplates.find((candidate) => candidate.id === secondId)?.name).toBe('Library design');
    expect(useProjectStore.getState().cardSets.map((set) => set.templateIds?.[0])).toEqual([firstId, secondId]);
  });
});
