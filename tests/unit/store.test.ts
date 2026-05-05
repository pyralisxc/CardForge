import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_TEMPLATES_DATA,
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
      hasSeededDefaultTemplates: false,
      singleCardGeneratorSelectedTemplateId: null,
      editingCardUniqueId: null,
      isEditDialogOpen: false,
    });
  });

  it('reconstructs an empty new template with default rows and columns', () => {
    const template = reconstructMinimalTemplateObject({
      id: '',
      name: 'Recovered Template',
      rows: [],
    });

    expect(template.id).toBeTruthy();
    expect(template.name).toBe('Recovered Template');
    expect(template.rows.length).toBeGreaterThan(0);
    expect(template.rows[0].columns.length).toBeGreaterThan(0);
  });

  it('repairs rows that have no columns', () => {
    const template = reconstructMinimalTemplateObject({
      id: 'template-1',
      name: 'Template',
      aspectRatio: '63:88',
      rows: [{ id: 'row-1', columns: [] }],
    });

    expect(template.rows).toHaveLength(1);
    expect(template.rows[0].columns).toHaveLength(1);
  });

  it('reconstructs a freeform template with a valid canvas and leaves row templates compatible', () => {
    const rowTemplate = reconstructMinimalTemplateObject({
      id: 'row-template',
      name: 'Rows',
      aspectRatio: '63:88',
      rows: [{ id: 'row-1', columns: [] }],
    });
    const freeformTemplate = reconstructMinimalTemplateObject({
      id: 'freeform-template',
      name: 'Freeform',
      layoutMode: 'freeform',
      aspectRatio: '63:88',
      rows: [],
      freeformCanvas: {
        width: 630,
        height: 880,
        elements: [
          { id: '', type: 'text', name: '', x: 10, y: 20, width: 200, height: 60, zIndex: 3, content: '{{title:"Name"}}' },
        ],
      },
    });

    expect(rowTemplate.layoutMode).toBe('rows');
    expect(rowTemplate.freeformCanvas).toBeUndefined();
    expect(freeformTemplate.layoutMode).toBe('freeform');
    expect(freeformTemplate.rows).toEqual([]);
    expect(freeformTemplate.freeformCanvas?.width).toBe(630);
    expect(freeformTemplate.freeformCanvas?.elements[0].id).toBeTruthy();
    expect(freeformTemplate.freeformCanvas?.elements[0].content).toBe('{{title:"Name"}}');
  });

  it('selects generated cards only when their template still exists', () => {
    const template: TCGCardTemplate = reconstructMinimalTemplateObject({
      id: 'template-1',
      name: 'Template',
      rows: [],
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
      layoutMode: 'freeform',
      aspectRatio: '63:88',
      rows: [],
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
    expect(cards[0].template.layoutMode).toBe('freeform');
  });

  it('deleting a template also removes generated cards that depend on it', () => {
    const keptTemplate = reconstructMinimalTemplateObject({
      id: 'template-kept',
      name: 'Kept',
      rows: [],
    });
    const deletedTemplate = reconstructMinimalTemplateObject({
      id: 'template-deleted',
      name: 'Deleted',
      rows: [],
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
      hasSeededDefaultTemplates: true,
    });

    useAppStore.getState().deleteTemplate('template-deleted');

    expect(useAppStore.getState().templates.map(t => t.id)).toEqual(['template-kept']);
    expect(useAppStore.getState().storedCards.map(card => card.uniqueId)).toEqual(['card-kept']);
    expect(useAppStore.getState().singleCardGeneratorSelectedTemplateId).toBe('template-kept');
    expect(useAppStore.getState().editingCardUniqueId).toBeNull();
    expect(useAppStore.getState().isEditDialogOpen).toBe(false);
  });

  it('seeds default templates only once', () => {
    useAppStore.setState({
      templates: [],
      hasSeededDefaultTemplates: false,
      singleCardGeneratorSelectedTemplateId: null,
    });

    useAppStore.getState()._rehydrateCallback();

    expect(useAppStore.getState().templates).toHaveLength(DEFAULT_TEMPLATES_DATA.length);
    expect(useAppStore.getState().hasSeededDefaultTemplates).toBe(true);

    useAppStore.setState({
      templates: [],
      singleCardGeneratorSelectedTemplateId: null,
      hasSeededDefaultTemplates: true,
    });

    useAppStore.getState()._rehydrateCallback();

    expect(useAppStore.getState().templates).toEqual([]);
    expect(useAppStore.getState().singleCardGeneratorSelectedTemplateId).toBeNull();
  });
});
