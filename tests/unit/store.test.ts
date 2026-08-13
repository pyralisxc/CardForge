import { beforeEach, describe, expect, it } from 'vitest';
import { createDefaultFreeformCanvas, reconstructMinimalTemplateObject } from '@/domain/templates';
import {
  selectAllTemplates,
  selectGeneratedDisplayCards,
  useProjectStore,
} from '@/features/project/client';
import type { StoredDisplayCard } from '@/domain/cards';
import type { TCGCardTemplate } from '@/domain/templates';

describe('app store helpers', () => {
  beforeEach(() => {
    useProjectStore.setState({
      defaultTemplates: [],
      userTemplates: [],
      storedCards: [],
      activeCardSet: {
        id: 'active-card-set',
        name: 'Untitled Set',
        frontTemplateId: null,
        backingTemplateId: null,
      },
      singleCardGeneratorSelectedTemplateId: null,
      templateEditorSelectedTemplateId: null,
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

  it('drops legacy template-owned backing fields when reconstructing templates', () => {
    const template = reconstructMinimalTemplateObject({
      id: 'duplex-template',
      name: 'Duplex',
      aspectRatio: '63:88',
      backingTemplateId: 'legacy-back',
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
    } as unknown as Partial<TCGCardTemplate>);

    expect(template.freeformCanvas?.elements[0].content).toBe('Front');
    expect('backCanvas' in template).toBe(false);
    expect('backingTemplateId' in template).toBe(false);
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

  it('resolves a generated card backing from the stored card set snapshot', () => {
    const backingTemplate: TCGCardTemplate = reconstructMinimalTemplateObject({
      id: 'obsidian-back',
      name: 'Obsidian Back',
      templateUsage: 'back-preset',
      freeformCanvas: {
        width: 630,
        height: 880,
        elements: [{ id: 'back-mark', type: 'text', name: 'Back Mark', x: 0, y: 0, width: 200, height: 50, zIndex: 1, content: 'Static Back' }],
      },
    });
    const frontTemplate: TCGCardTemplate = reconstructMinimalTemplateObject({
      id: 'front-template',
      name: 'Front Template',
    });

    const cards = selectGeneratedDisplayCards({
      defaultTemplates: [backingTemplate],
      userTemplates: [frontTemplate],
      storedCards: [{
        uniqueId: 'card-with-back',
        templateId: 'front-template',
        backingTemplateId: 'obsidian-back',
        setId: 'set-1',
        setName: 'Arcane Deck',
        data: { cardName: 'Front Data' },
        backingData: { backTitle: 'Generated Back Data' },
      }],
    } as unknown as Parameters<typeof selectGeneratedDisplayCards>[0]);

    expect(cards).toHaveLength(1);
    expect(cards[0].template.id).toBe('front-template');
    expect(cards[0].setId).toBe('set-1');
    expect(cards[0].setName).toBe('Arcane Deck');
    expect(cards[0].backingTemplateId).toBe('obsidian-back');
    expect(cards[0].backingTemplate?.id).toBe('obsidian-back');
    expect(cards[0].backingTemplate?.freeformCanvas?.elements[0].content).toBe('Static Back');
    expect(cards[0].backingData).toEqual({ backTitle: 'Generated Back Data' });
  });

  it('clears a selected back when the front changes to an incompatible format', () => {
    const pokerFront = reconstructMinimalTemplateObject({ id: 'poker-front', name: 'Poker', formatId: 'poker' });
    const tarotFront = reconstructMinimalTemplateObject({ id: 'tarot-front', name: 'Tarot', formatId: 'tarot' });
    const pokerBack = reconstructMinimalTemplateObject({
      id: 'poker-back',
      name: 'Poker back',
      formatId: 'poker',
      templateUsage: 'back-preset',
    });
    useProjectStore.setState({
      defaultTemplates: [pokerFront, tarotFront, pokerBack],
      activeCardSet: {
        id: 'active-card-set',
        name: 'Set',
        frontTemplateId: 'poker-front',
        backingTemplateId: 'poker-back',
      },
      singleCardGeneratorSelectedTemplateId: 'poker-front',
    });

    useProjectStore.getState().setActiveCardSetFrontTemplateId('tarot-front');

    expect(useProjectStore.getState().activeCardSet).toMatchObject({
      frontTemplateId: 'tarot-front',
      backingTemplateId: null,
    });
  });

  it('rejects an incompatible back selection', () => {
    const pokerFront = reconstructMinimalTemplateObject({ id: 'poker-front', name: 'Poker', formatId: 'poker' });
    const tarotBack = reconstructMinimalTemplateObject({
      id: 'tarot-back',
      name: 'Tarot back',
      formatId: 'tarot',
      templateUsage: 'back-preset',
    });
    useProjectStore.setState({
      defaultTemplates: [pokerFront, tarotBack],
      activeCardSet: {
        id: 'active-card-set',
        name: 'Set',
        frontTemplateId: 'poker-front',
        backingTemplateId: null,
      },
      singleCardGeneratorSelectedTemplateId: 'poker-front',
    });

    useProjectStore.getState().setActiveCardSetBackingTemplateId('tarot-back');

    expect(useProjectStore.getState().activeCardSet.backingTemplateId).toBeNull();
  });

  it('repairs a stale card-set front when selecting a compatible visible back', () => {
    const pokerFront = reconstructMinimalTemplateObject({ id: 'poker-front', name: 'Poker', formatId: 'poker' });
    const pokerBack = reconstructMinimalTemplateObject({
      id: 'poker-back',
      name: 'Poker back',
      formatId: 'poker',
      templateUsage: 'back-preset',
    });
    useProjectStore.setState({
      defaultTemplates: [pokerFront, pokerBack],
      activeCardSet: {
        id: 'active-card-set',
        name: 'Set',
        frontTemplateId: null,
        backingTemplateId: null,
      },
      singleCardGeneratorSelectedTemplateId: 'poker-front',
    });

    useProjectStore.getState().setActiveCardSetBackingTemplateId('poker-back');

    expect(useProjectStore.getState().activeCardSet).toMatchObject({
      frontTemplateId: 'poker-front',
      backingTemplateId: 'poker-back',
    });
  });

  it('keeps the Generator set selection stable when Layout Studio opens a card back', () => {
    const pokerFront = reconstructMinimalTemplateObject({ id: 'poker-front', name: 'Poker', formatId: 'poker' });
    const pokerBack = reconstructMinimalTemplateObject({
      id: 'poker-back',
      name: 'Poker back',
      formatId: 'poker',
      templateUsage: 'back-preset',
    });
    useProjectStore.setState({
      defaultTemplates: [pokerFront, pokerBack],
      activeCardSet: {
        id: 'active-card-set',
        name: 'Set',
        frontTemplateId: 'poker-front',
        backingTemplateId: 'poker-back',
      },
      singleCardGeneratorSelectedTemplateId: 'poker-front',
      templateEditorSelectedTemplateId: 'poker-front',
    });

    useProjectStore.getState().setTemplateEditorSelectedTemplateId('poker-back');

    expect(useProjectStore.getState()).toMatchObject({
      singleCardGeneratorSelectedTemplateId: 'poker-front',
      templateEditorSelectedTemplateId: 'poker-back',
      activeCardSet: {
        frontTemplateId: 'poker-front',
        backingTemplateId: 'poker-back',
      },
    });
  });

  it('repairs legacy persisted state that used a card back as the Generator front selection', () => {
    const pokerFront = reconstructMinimalTemplateObject({ id: 'poker-front', name: 'Poker', formatId: 'poker' });
    const pokerBack = reconstructMinimalTemplateObject({
      id: 'poker-back',
      name: 'Poker back',
      formatId: 'poker',
      templateUsage: 'back-preset',
    });
    useProjectStore.setState({
      defaultTemplates: [pokerFront, pokerBack],
      activeCardSet: {
        id: 'active-card-set',
        name: 'Set',
        frontTemplateId: 'poker-back',
        backingTemplateId: 'poker-back',
      },
      singleCardGeneratorSelectedTemplateId: 'poker-back',
      templateEditorSelectedTemplateId: null,
    });

    useProjectStore.getState()._rehydrateCallback();

    expect(useProjectStore.getState()).toMatchObject({
      singleCardGeneratorSelectedTemplateId: 'poker-front',
      templateEditorSelectedTemplateId: 'poker-front',
      activeCardSet: {
        frontTemplateId: 'poker-front',
        backingTemplateId: 'poker-back',
      },
    });
  });

  it('retargets existing card backs without changing their front designs', () => {
    useProjectStore.setState({
      storedCards: [
        { uniqueId: 'card-1', templateId: 'front-1', backingTemplateId: 'back-old', data: {} },
        { uniqueId: 'card-2', templateId: 'front-2', backingTemplateId: null, data: {} },
      ],
    });

    useProjectStore.getState().retargetGeneratedCardsBackingTemplate('back-old', 'back-new');

    expect(useProjectStore.getState().storedCards).toEqual([
      { uniqueId: 'card-1', templateId: 'front-1', backingTemplateId: 'back-new', data: {} },
      { uniqueId: 'card-2', templateId: 'front-2', backingTemplateId: null, data: {} },
    ]);
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

  it('preserves generated output field style metadata through local storage shape and selectors', () => {
    const template: TCGCardTemplate = reconstructMinimalTemplateObject({
      id: 'styled-template',
      name: 'Styled Template',
      aspectRatio: '63:88',
      freeformCanvas: createDefaultFreeformCanvas(),
    });

    useProjectStore.setState({
      defaultTemplates: [template],
      userTemplates: [],
    });

    useProjectStore.getState().addGeneratedCards([{
      template,
      uniqueId: 'styled-card',
      data: {
        cardName: 'Avery',
        '__cardforgeFieldStyle.cardName.textColor': '#00ffaa',
      },
    }]);

    expect(useProjectStore.getState().storedCards).toEqual([{
      uniqueId: 'styled-card',
      templateId: 'styled-template',
      backingTemplateId: null,
      setId: 'active-card-set',
      setName: 'Untitled Set',
      data: {
        cardName: 'Avery',
        '__cardforgeFieldStyle.cardName.textColor': '#00ffaa',
      },
    }]);

    const cards = selectGeneratedDisplayCards(useProjectStore.getState());
    expect(cards[0].data['__cardforgeFieldStyle.cardName.textColor']).toBe('#00ffaa');
  });

  it('preserves generated output field style metadata when importing local stored cards', () => {
    const template: TCGCardTemplate = reconstructMinimalTemplateObject({
      id: 'import-template',
      name: 'Import Template',
      aspectRatio: '63:88',
      freeformCanvas: createDefaultFreeformCanvas(),
    });

    useProjectStore.setState({
      defaultTemplates: [template],
      userTemplates: [],
    });

    const result = useProjectStore.getState().setStoredCardsFromFile([{
      uniqueId: 'imported-styled-card',
      templateId: 'import-template',
      data: {
        cardName: 'Imported',
        '__cardforgeFieldStyle.cardName.fontWeight': 'font-semibold',
      },
    }]);

    expect(result).toEqual({ successCount: 1, skippedCount: 0 });
    expect(useProjectStore.getState().storedCards[0].data['__cardforgeFieldStyle.cardName.fontWeight']).toBe('font-semibold');
  });

  it('merges imported stored cards without clearing existing generated outputs', () => {
    const existingTemplate = reconstructMinimalTemplateObject({
      id: 'existing-template',
      name: 'Existing Template',
      aspectRatio: '63:88',
      freeformCanvas: createDefaultFreeformCanvas(),
    });
    const importedTemplate = reconstructMinimalTemplateObject({
      id: 'import-template',
      name: 'Import Template',
      aspectRatio: '63:88',
      freeformCanvas: createDefaultFreeformCanvas(),
    });

    useProjectStore.setState({
      defaultTemplates: [existingTemplate, importedTemplate],
      userTemplates: [],
      storedCards: [
        { uniqueId: 'existing-card', templateId: 'existing-template', data: { cardName: 'Kept' } },
        { uniqueId: 'updated-card', templateId: 'existing-template', data: { cardName: 'Old' } },
      ],
    });

    const result = useProjectStore.getState().mergeStoredCardsFromFile([
      { uniqueId: 'updated-card', templateId: 'import-template', data: { cardName: 'Updated' } },
      { uniqueId: 'new-card', templateId: 'import-template', data: { cardName: 'New' } },
      { uniqueId: 'missing-template-card', templateId: 'missing-template', data: {} },
    ]);

    expect(result).toEqual({ successCount: 2, skippedCount: 1 });
    expect(useProjectStore.getState().storedCards).toEqual([
      { uniqueId: 'existing-card', templateId: 'existing-template', data: { cardName: 'Kept' } },
      {
        uniqueId: 'updated-card',
        templateId: 'import-template',
        backingTemplateId: null,
        setId: 'active-card-set',
        setName: 'Untitled Set',
        data: { cardName: 'Updated' },
      },
      {
        uniqueId: 'new-card',
        templateId: 'import-template',
        backingTemplateId: null,
        setId: 'active-card-set',
        setName: 'Untitled Set',
        data: { cardName: 'New' },
      },
    ]);
  });

  it('can replace appearance styles for project import without using bootstrap merge semantics', () => {
    useProjectStore.setState({
      appearanceStyles: [
        { id: 'old-style', name: 'Old Style', kind: 'theme', targets: [], appearance: {} },
      ],
    });

    useProjectStore.getState().replaceAppearanceStylesFromFiles([
      { id: 'new-style', name: 'New Style', kind: 'theme', targets: [], appearance: {} },
    ]);

    expect(useProjectStore.getState().appearanceStyles).toEqual([
      { id: 'new-style', name: 'New Style', kind: 'theme', targets: [], appearance: {} },
    ]);
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

    useProjectStore.setState({
      defaultTemplates: [],
      userTemplates: [keptTemplate, deletedTemplate],
      storedCards: [
        { uniqueId: 'card-kept', templateId: 'template-kept', data: {} },
        { uniqueId: 'card-deleted', templateId: 'template-deleted', data: {} },
      ],
      singleCardGeneratorSelectedTemplateId: 'template-deleted',
      templateEditorSelectedTemplateId: 'template-deleted',
      editingCardUniqueId: 'card-deleted',
      isEditDialogOpen: true,
    });

    useProjectStore.getState().deleteTemplate('template-deleted');

    expect(selectAllTemplates(useProjectStore.getState()).map(t => t.id)).toEqual(['template-kept']);
    expect(useProjectStore.getState().storedCards.map(card => card.uniqueId)).toEqual(['card-kept']);
    expect(useProjectStore.getState().singleCardGeneratorSelectedTemplateId).toBe('template-kept');
    expect(useProjectStore.getState().templateEditorSelectedTemplateId).toBe('template-kept');
    expect(useProjectStore.getState().editingCardUniqueId).toBeNull();
    expect(useProjectStore.getState().isEditDialogOpen).toBe(false);
  });

  it('removes one generated output without clearing the rest', () => {
    useProjectStore.setState({
      storedCards: [
        { uniqueId: 'card-kept', templateId: 'template-kept', data: { cardName: 'Kept' } },
        { uniqueId: 'card-removed', templateId: 'template-kept', data: { cardName: 'Removed' } },
      ],
      editingCardUniqueId: 'card-removed',
      isEditDialogOpen: true,
    });

    useProjectStore.getState().removeGeneratedCard('card-removed');

    expect(useProjectStore.getState().storedCards).toEqual([
      { uniqueId: 'card-kept', templateId: 'template-kept', data: { cardName: 'Kept' } },
    ]);
    expect(useProjectStore.getState().editingCardUniqueId).toBeNull();
    expect(useProjectStore.getState().isEditDialogOpen).toBe(false);
  });

  it('updates default templates in place without creating a user copy', () => {
    const defaultTemplate = reconstructMinimalTemplateObject({
      id: 'default-template',
      name: 'Default',
      templateSource: 'default',
    });

    useProjectStore.setState({
      defaultTemplates: [defaultTemplate],
      userTemplates: [],
      storedCards: [
        { uniqueId: 'card-retargeted', templateId: 'default-template', data: { cardName: 'Updated' } },
      ],
    });

    const savedId = useProjectStore.getState().addOrUpdateTemplate({
      ...defaultTemplate,
      name: 'Default Updated',
      templateSource: 'default',
    }, 'default');

    expect(savedId).toBe('default-template');
    expect(useProjectStore.getState().defaultTemplates).toMatchObject([{ id: 'default-template', name: 'Default Updated', templateSource: 'default' }]);
    expect(useProjectStore.getState().userTemplates).toEqual([]);
    expect(useProjectStore.getState().storedCards).toEqual([
      { uniqueId: 'card-retargeted', templateId: 'default-template', data: { cardName: 'Updated' } },
    ]);
  });

  it('retargets only cards that used the protected source design', () => {
    useProjectStore.setState({
      storedCards: [
        { uniqueId: 'source-1', templateId: 'protected-source', data: { cardName: 'One' } },
        { uniqueId: 'source-2', templateId: 'protected-source', data: { cardName: 'Two' } },
        { uniqueId: 'other', templateId: 'other-template', data: { cardName: 'Other' } },
      ],
    });

    useProjectStore.getState().retargetGeneratedCardsTemplate('protected-source', 'personal-copy');

    expect(useProjectStore.getState().storedCards.map((card) => card.templateId)).toEqual([
      'personal-copy',
      'personal-copy',
      'other-template',
    ]);
  });

  it('merges bootstrap user templates without replacing browser-local templates', () => {
    const localTemplate = reconstructMinimalTemplateObject({
      id: 'local-template',
      name: 'Local Template',
      templateSource: 'user',
    });

    useProjectStore.setState({
      defaultTemplates: [],
      userTemplates: [localTemplate],
      singleCardGeneratorSelectedTemplateId: 'local-template',
    });

    const importedCount = useProjectStore.getState().mergeUserTemplatesFromFiles([
      {
        id: 'server-template',
        name: 'Server Template',
        templateSource: 'user',
      },
    ]);

    expect(importedCount).toBe(1);
    expect(useProjectStore.getState().userTemplates).toMatchObject([
      { id: 'local-template', name: 'Local Template', templateSource: 'user' },
      { id: 'server-template', name: 'Server Template', templateSource: 'user' },
    ]);
    expect(useProjectStore.getState().singleCardGeneratorSelectedTemplateId).toBe('local-template');
  });

  it('ignores empty bootstrap user template payloads to preserve browser-local templates', () => {
    const localTemplate = reconstructMinimalTemplateObject({
      id: 'local-template',
      name: 'Local Template',
      templateSource: 'user',
    });

    useProjectStore.setState({
      defaultTemplates: [],
      userTemplates: [localTemplate],
      singleCardGeneratorSelectedTemplateId: 'local-template',
    });

    const importedCount = useProjectStore.getState().mergeUserTemplatesFromFiles([]);

    expect(importedCount).toBe(0);
    expect(useProjectStore.getState().userTemplates).toMatchObject([
      { id: 'local-template', name: 'Local Template', templateSource: 'user' },
    ]);
  });

  it('_rehydrateCallback fixes selectedTemplateId if the template no longer exists', () => {
    const template = reconstructMinimalTemplateObject({ id: 'only-template', name: 'Only' });
    useProjectStore.setState({
      defaultTemplates: [template],
      userTemplates: [],
      singleCardGeneratorSelectedTemplateId: 'stale-id-that-no-longer-exists',
    });

    useProjectStore.getState()._rehydrateCallback();

    expect(useProjectStore.getState().singleCardGeneratorSelectedTemplateId).toBe('only-template');
  });

  it('normalizes the old template maker tab id for persisted browser state', () => {
    useProjectStore.getState().setActiveTab('template-maker-2');

    expect(useProjectStore.getState().activeTab).toBe('template-maker');
  });

  it('persists the selected physical PDF front/back layout option', () => {
    useProjectStore.getState().setPdfOptions({ duplexLayout: 'same-page' });

    expect(useProjectStore.getState().pdfDuplexLayout).toBe('same-page');

    useProjectStore.getState().setPdfOptions({ margin: 8 });

    expect(useProjectStore.getState().pdfMarginMm).toBe(8);
    expect(useProjectStore.getState().pdfDuplexLayout).toBe('same-page');
  });
});
