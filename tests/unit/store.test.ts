import { beforeEach, describe, expect, it } from 'vitest';
import {
  reconstructMinimalTemplateObject,
  createDefaultFreeformCanvas,
  selectGeneratedDisplayCards,
  useAppStore,
} from '@/store/appStore';
import type { StoredDisplayCard, TCGCardTemplate } from '@/types';

describe('app store helpers', () => {
  beforeEach(() => {
    useAppStore.setState({
      templates: [],
      storedCards: [],
      singleCardGeneratorSelectedTemplateId: null,
      editingCardUniqueId: null,
      isEditDialogOpen: false,
    });
  });

  it('reconstructs an empty new template with a freeform canvas', () => {
    const template = reconstructMinimalTemplateObject({
      id: '',
      name: 'Recovered Template',
    });

    expect(template.id).toBeTruthy();
    expect(template.name).toBe('Recovered Template');
    expect(template.freeformCanvas).toBeDefined();
    expect(template.freeformCanvas?.elements.length).toBeGreaterThan(0);
  });

  it('reconstructs a template preserving freeform canvas elements', () => {
    const template = reconstructMinimalTemplateObject({
      id: 'template-1',
      name: 'Template',
      aspectRatio: '63:88',
      freeformCanvas: {
        width: 630,
        height: 880,
        elements: [{ id: 'el-1', type: 'text', name: 'Title', x: 0, y: 0, width: 200, height: 50, zIndex: 1, content: 'Test' }],
      },
    });

    expect(template.freeformCanvas?.elements).toHaveLength(1);
    expect(template.freeformCanvas?.elements[0].id).toBe('el-1');
  });

  it('reconstructs a freeform template with a valid canvas', () => {
    const freeformTemplate = reconstructMinimalTemplateObject({
      id: 'freeform-template',
      name: 'Freeform',
      aspectRatio: '63:88',
      freeformCanvas: {
        width: 630,
        height: 880,
        elements: [
          { id: '', type: 'text', name: '', x: 10, y: 20, width: 200, height: 60, zIndex: 3, content: '{{title:"Name"}}' },
        ],
      },
    });

    expect(freeformTemplate.freeformCanvas?.width).toBe(630);
    expect(freeformTemplate.freeformCanvas?.elements[0].id).toBeTruthy();
    expect(freeformTemplate.freeformCanvas?.elements[0].content).toBe('{{title:"Name"}}');
  });

  it('selects generated cards only when their template still exists', () => {
    const template: TCGCardTemplate = reconstructMinimalTemplateObject({
      id: 'template-1',
      name: 'Template',
    });
    const storedCards: StoredDisplayCard[] = [
      { uniqueId: 'card-1', templateId: 'template-1', data: { cardName: 'Kept' } },
      { uniqueId: 'card-2', templateId: 'missing-template', data: { cardName: 'Skipped' } },
    ];

    const cards = selectGeneratedDisplayCards({
      templates: [template],
      storedCards,
    } as Parameters<typeof selectGeneratedDisplayCards>[0]);

    expect(cards).toHaveLength(1);
    expect(cards[0].uniqueId).toBe('card-1');
    expect(cards[0].template.id).toBe('template-1');
  });

  it('selects generated cards that use a freeform template', () => {
    const template: TCGCardTemplate = reconstructMinimalTemplateObject({
      id: 'freeform-template',
      name: 'Freeform',
      aspectRatio: '63:88',
      freeformCanvas: createDefaultFreeformCanvas(),
    });
    const storedCards: StoredDisplayCard[] = [
      { uniqueId: 'card-freeform', templateId: 'freeform-template', data: { cardName: 'Kept' } },
    ];

    const cards = selectGeneratedDisplayCards({
      templates: [template],
      storedCards,
    } as Parameters<typeof selectGeneratedDisplayCards>[0]);

    expect(cards).toHaveLength(1);
    expect(cards[0].template.freeformCanvas).toBeDefined();
  });

  it('deleting a template also removes generated cards that depend on it', () => {
    const keptTemplate = reconstructMinimalTemplateObject({
      id: 'template-kept',
      name: 'Kept',
    });
    const deletedTemplate = reconstructMinimalTemplateObject({
      id: 'template-deleted',
      name: 'Deleted',
    });

    useAppStore.setState({
      templates: [keptTemplate, deletedTemplate],
      storedCards: [
        { uniqueId: 'card-kept', templateId: 'template-kept', data: {} },
        { uniqueId: 'card-deleted', templateId: 'template-deleted', data: {} },
      ],
      singleCardGeneratorSelectedTemplateId: 'template-deleted',
      editingCardUniqueId: 'card-deleted',
      isEditDialogOpen: true,
    });

    useAppStore.getState().deleteTemplate('template-deleted');

    expect(useAppStore.getState().templates.map(t => t.id)).toEqual(['template-kept']);
    expect(useAppStore.getState().storedCards.map(card => card.uniqueId)).toEqual(['card-kept']);
    expect(useAppStore.getState().singleCardGeneratorSelectedTemplateId).toBe('template-kept');
    expect(useAppStore.getState().editingCardUniqueId).toBeNull();
    expect(useAppStore.getState().isEditDialogOpen).toBe(false);
  });

  it('_rehydrateCallback fixes selectedTemplateId if the template no longer exists', () => {
    const template = reconstructMinimalTemplateObject({ id: 'only-template', name: 'Only' });
    useAppStore.setState({
      templates: [template],
      singleCardGeneratorSelectedTemplateId: 'stale-id-that-no-longer-exists',
    });

    useAppStore.getState()._rehydrateCallback();

    expect(useAppStore.getState().singleCardGeneratorSelectedTemplateId).toBe('only-template');
  });
});
