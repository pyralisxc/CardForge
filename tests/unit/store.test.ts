import { beforeEach, describe, expect, it } from 'vitest';
import {
  reconstructMinimalTemplateObject,
  createDefaultFreeformCanvas,
  selectAllTemplates,
  selectGeneratedDisplayCards,
  useAppStore,
} from '@/store/appStore';
import type { StoredDisplayCard, TCGCardTemplate } from '@/types';

describe('app store helpers', () => {
  beforeEach(() => {
    useAppStore.setState({
      defaultTemplates: [],
      userTemplates: [],
      storedCards: [],
      singleCardGeneratorSelectedTemplateId: null,
      editingCardUniqueId: null,
      isEditDialogOpen: false,
      pdfDuplexLayout: 'separate-pages',
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

  it('preserves a duplex back canvas when reconstructing templates', () => {
    const template = reconstructMinimalTemplateObject({
      id: 'duplex-template',
      name: 'Duplex',
      aspectRatio: '63:88',
      freeformCanvas: {
        width: 630,
        height: 880,
        elements: [{ id: 'front-el', type: 'text', name: 'Front Title', x: 0, y: 0, width: 200, height: 50, zIndex: 1, content: 'Front' }],
      },
      backCanvas: {
        width: 630,
        height: 880,
        elements: [{ id: 'back-el', type: 'text', name: 'Back Title', x: 10, y: 10, width: 200, height: 50, zIndex: 1, content: 'Back' }],
      },
    });

    expect(template.freeformCanvas?.elements[0].content).toBe('Front');
    expect(template.backCanvas?.elements[0].content).toBe('Back');
    expect(template.backCanvas?.width).toBe(630);
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
      defaultTemplates: [],
      userTemplates: [template],
      storedCards,
    } as unknown as Parameters<typeof selectGeneratedDisplayCards>[0]);

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
      defaultTemplates: [template],
      userTemplates: [],
      storedCards,
    } as unknown as Parameters<typeof selectGeneratedDisplayCards>[0]);

    expect(cards).toHaveLength(1);
    expect(cards[0].template.freeformCanvas).toBeDefined();
  });

  it('preserves per-card style overrides on generated card selectors', () => {
    const template: TCGCardTemplate = reconstructMinimalTemplateObject({
      id: 'style-template',
      name: 'Style Template',
      aspectRatio: '63:88',
      freeformCanvas: createDefaultFreeformCanvas(),
    });
    const storedCards: StoredDisplayCard[] = [
      {
        uniqueId: 'styled-card',
        templateId: 'style-template',
        data: { cardName: 'Styled' },
        styleOverrides: { cardName: { fontSizePx: 44, fontFamily: 'font-serif' } },
      },
    ];

    const cards = selectGeneratedDisplayCards({
      defaultTemplates: [template],
      userTemplates: [],
      storedCards,
    } as unknown as Parameters<typeof selectGeneratedDisplayCards>[0]);

    expect(cards[0].styleOverrides?.cardName?.fontSizePx).toBe(44);
    expect(cards[0].styleOverrides?.cardName?.fontFamily).toBe('font-serif');
  });

  it('retains and selects at least 1000 generated cards for the release batch floor', () => {
    const template: TCGCardTemplate = reconstructMinimalTemplateObject({
      id: 'bulk-floor-template',
      name: 'Bulk Floor',
      aspectRatio: '63:88',
      freeformCanvas: createDefaultFreeformCanvas(),
    });
    const storedCards: StoredDisplayCard[] = Array.from({ length: 1000 }, (_, index) => ({
      uniqueId: `bulk-floor-${index + 1}`,
      templateId: 'bulk-floor-template',
      data: { cardName: `Bulk Card ${index + 1}` },
    }));

    const cards = selectGeneratedDisplayCards({
      defaultTemplates: [template],
      userTemplates: [],
      storedCards,
    } as unknown as Parameters<typeof selectGeneratedDisplayCards>[0]);

    expect(cards).toHaveLength(1000);
    expect(cards[0].data.cardName).toBe('Bulk Card 1');
    expect(cards[999].data.cardName).toBe('Bulk Card 1000');
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
      defaultTemplates: [],
      userTemplates: [keptTemplate, deletedTemplate],
      storedCards: [
        { uniqueId: 'card-kept', templateId: 'template-kept', data: {} },
        { uniqueId: 'card-deleted', templateId: 'template-deleted', data: {} },
      ],
      singleCardGeneratorSelectedTemplateId: 'template-deleted',
      editingCardUniqueId: 'card-deleted',
      isEditDialogOpen: true,
    });

    useAppStore.getState().deleteTemplate('template-deleted');

    expect(selectAllTemplates(useAppStore.getState()).map(t => t.id)).toEqual(['template-kept']);
    expect(useAppStore.getState().storedCards.map(card => card.uniqueId)).toEqual(['card-kept']);
    expect(useAppStore.getState().singleCardGeneratorSelectedTemplateId).toBe('template-kept');
    expect(useAppStore.getState().editingCardUniqueId).toBeNull();
    expect(useAppStore.getState().isEditDialogOpen).toBe(false);
  });

  it('retargets generated cards when a saved default becomes a user template copy', () => {
    const defaultTemplate = reconstructMinimalTemplateObject({
      id: 'default-template',
      name: 'Default',
      templateSource: 'default',
    });
    const userCopy = reconstructMinimalTemplateObject({
      id: 'user-copy-template',
      name: 'Default Copy',
      templateSource: 'user',
    });

    useAppStore.setState({
      defaultTemplates: [defaultTemplate],
      userTemplates: [userCopy],
      storedCards: [
        { uniqueId: 'card-retargeted', templateId: 'default-template', data: { cardName: 'Updated' } },
        { uniqueId: 'card-untouched', templateId: 'other-template', data: { cardName: 'Other' } },
      ],
    });

    useAppStore.getState().retargetGeneratedCardsTemplate('default-template', 'user-copy-template');

    expect(useAppStore.getState().storedCards).toEqual([
      { uniqueId: 'card-retargeted', templateId: 'user-copy-template', data: { cardName: 'Updated' } },
      { uniqueId: 'card-untouched', templateId: 'other-template', data: { cardName: 'Other' } },
    ]);
  });

  it('keeps persisted-only user templates as fallback when loading file-backed templates', () => {
    const persistedOnlyTemplate = reconstructMinimalTemplateObject({
      id: 'persisted-only-template',
      name: 'Persisted Only',
      templateSource: 'user',
    });
    const fileBackedTemplate = reconstructMinimalTemplateObject({
      id: 'file-backed-template',
      name: 'File Backed',
      templateSource: 'user',
    });

    useAppStore.setState({
      userTemplates: [persistedOnlyTemplate],
      singleCardGeneratorSelectedTemplateId: 'persisted-only-template',
    });

    useAppStore.getState().setUserTemplatesFromFiles([fileBackedTemplate]);

    const state = useAppStore.getState();
    expect(state.userTemplates.map(template => template.id)).toEqual([
      'file-backed-template',
      'persisted-only-template',
    ]);
    expect(state.singleCardGeneratorSelectedTemplateId).toBe('persisted-only-template');
  });

  it('lets file-backed user templates win conflicts over persisted fallbacks', () => {
    const cachedTemplate = reconstructMinimalTemplateObject({
      id: 'shared-template',
      name: 'Cached Draft',
      templateSource: 'user',
      freeformCanvas: {
        width: 630,
        height: 880,
        elements: [{ id: 'cached-el', type: 'text', name: 'Cached', x: 0, y: 0, width: 120, height: 40, zIndex: 1, content: 'Cached' }],
      },
    });
    const fileTemplate = reconstructMinimalTemplateObject({
      id: 'shared-template',
      name: 'Server Copy',
      templateSource: 'user',
      freeformCanvas: {
        width: 630,
        height: 880,
        elements: [{ id: 'file-el', type: 'text', name: 'File', x: 0, y: 0, width: 120, height: 40, zIndex: 1, content: 'File' }],
      },
    });

    useAppStore.setState({
      userTemplates: [cachedTemplate],
      singleCardGeneratorSelectedTemplateId: 'shared-template',
    });

    useAppStore.getState().setUserTemplatesFromFiles([fileTemplate]);

    const [mergedTemplate] = useAppStore.getState().userTemplates;
    expect(useAppStore.getState().userTemplates).toHaveLength(1);
    expect(mergedTemplate.name).toBe('Server Copy');
    expect(mergedTemplate.freeformCanvas?.elements[0].id).toBe('file-el');
    expect(useAppStore.getState().singleCardGeneratorSelectedTemplateId).toBe('shared-template');
  });

  it('_rehydrateCallback fixes selectedTemplateId if the template no longer exists', () => {
    const template = reconstructMinimalTemplateObject({ id: 'only-template', name: 'Only' });
    useAppStore.setState({
      defaultTemplates: [template],
      userTemplates: [],
      singleCardGeneratorSelectedTemplateId: 'stale-id-that-no-longer-exists',
    });

    useAppStore.getState()._rehydrateCallback();

    expect(useAppStore.getState().singleCardGeneratorSelectedTemplateId).toBe('only-template');
  });

  it('normalizes the old template maker tab id for persisted browser state', () => {
    useAppStore.getState().setActiveTab('template-maker-2');

    expect(useAppStore.getState().activeTab).toBe('template-maker');
  });

  it('persists the selected physical PDF front/back layout option', () => {
    useAppStore.getState().setPdfOptions({ duplexLayout: 'same-page' });

    expect(useAppStore.getState().pdfDuplexLayout).toBe('same-page');

    useAppStore.getState().setPdfOptions({ margin: 8 });

    expect(useAppStore.getState().pdfMarginMm).toBe(8);
    expect(useAppStore.getState().pdfDuplexLayout).toBe('same-page');
  });
});
