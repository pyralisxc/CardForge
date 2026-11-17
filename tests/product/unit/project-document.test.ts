import { describe, expect, it } from 'vitest';
import type { CardSet, StoredDisplayCard } from '@/domain/cards';
import type { AppearanceStylePreset, TCGCardTemplate } from '@/domain/templates';
import type { PaperSize } from '@/domain/rendering';
import type { CardAssetOption } from '@/features/pipeline/lib/cardAssets';
import type { ExportMode } from '@/features/card-generator/lib/printValidation';
import { createProjectDocumentFromState, applyProjectDocumentToState, instantiateProjectDocumentCopy, isolateProjectDocumentToSet, parseProjectDocumentFile, type ProjectDocumentV1 } from '@/features/project/client/package-document';
import { materializeProjectTemplateOwnership, parseProjectDocumentValue } from '@/features/project/model/projectDocument';

const template: TCGCardTemplate = {
  id: 'user-template-1',
  name: 'User Template',
  aspectRatio: '63:88',
  templateSource: 'user',
  freeformCanvas: {
    width: 630,
    height: 880,
    elements: [],
  },
};

const cardSet: CardSet = {
  id: 'set-1',
  name: 'Rift Set',
};

const storedCard: StoredDisplayCard = {
  uniqueId: 'card-1',
  templateId: 'user-template-1',
  setId: cardSet.id,
  setName: cardSet.name,
  data: {
    cardName: 'Rift Adept',
    '__cardforgeFieldStyle.cardName.textColor': '#00ffaa',
  },
  backingTemplateId: 'back-template-1',
  backingData: {
    backTitle: 'Rift Adept sigil',
    '__cardforgeImageField.backArtwork.fit': 'contain',
  },
};

const paperSize: PaperSize = {
  name: 'Letter',
  widthMm: 215.9,
  heightMm: 279.4,
};

const style: AppearanceStylePreset = {
  id: 'style-1',
  name: 'Foil',
  kind: 'material',
  targets: ['template'],
  appearance: {
    material: {
      baseColor: '#101820',
    },
  },
};

const textureAsset: CardAssetOption = {
  id: 'custom-texture',
  name: 'Custom Texture',
  url: 'data:image/svg+xml;base64,PHN2Zy8+',
  kind: 'texture',
  tileMode: 'repeat',
  seamless: true,
  allowedTargets: ['template'],
};

const dividerAsset: CardAssetOption = {
  id: 'custom-divider',
  name: 'Custom Divider',
  url: 'data:image/svg+xml;base64,PHN2Zy8+',
  kind: 'divider',
  tileMode: 'stretch',
  seamless: false,
  allowedTargets: ['divider'],
};

const iconAsset: CardAssetOption = {
  id: 'custom-icon',
  name: 'Custom Icon',
  url: 'data:image/svg+xml;base64,PHN2Zy8+',
  kind: 'icon',
  tileMode: 'stretch',
  seamless: false,
  allowedTargets: ['icon'],
};

const imageAsset: CardAssetOption = {
  id: 'custom-image',
  name: 'Custom Image',
  url: 'data:image/png;base64,AAAA',
  kind: 'image',
  tileMode: 'stretch',
  seamless: false,
  allowedTargets: ['image'],
};

describe('project document serialization', () => {
  it('creates a versioned local-first project document from app state', () => {
    const document = createProjectDocumentFromState({
      userTemplates: [template],
      cardSets: [cardSet],
      activeCardSetId: cardSet.id,
      storedCards: [storedCard],
      appearanceStyles: [style],
      selectedPaperSize: paperSize,
      pdfMarginMm: 7,
      pdfCardSpacingMm: 2,
      pdfIncludeCutLines: true,
      pdfDuplexLayout: 'same-page',
      exportMode: 'virtual' as ExportMode,
      exportDpi: 450,
      customTextureAssets: [textureAsset],
      customDividerAssets: [dividerAsset],
      customIconAssets: [iconAsset],
      customImageAssets: [imageAsset],
    });

    expect(document).toEqual<ProjectDocumentV1>({
      version: 4,
      userTemplates: [template],
      cardSets: [cardSet],
      activeCardSetId: cardSet.id,
      storedCards: [storedCard],
      appearanceStyles: [style],
      exportSettings: {
        selectedPaperSize: paperSize,
        pdfMarginMm: 7,
        pdfCardSpacingMm: 2,
        pdfIncludeCutLines: true,
        pdfDuplexLayout: 'same-page',
        exportMode: 'virtual',
        exportDpi: 450,
      },
      customAssets: {
        'cardforge-maker-custom-textures': [textureAsset],
        'cardforge-maker-custom-dividers': [dividerAsset],
        'cardforge-maker-custom-icons': [iconAsset],
        'cardforge-maker-custom-images': [imageAsset],
      },
    });
  });

  it('materializes legacy prepared and both-face snapshots per Set while retaining sources and deferred references', () => {
    const source = {
      version: 2 as const,
      userTemplates: [
        { ...template, id: 'shared-front', templateLineageId: 'front-lineage', templateRevisionId: 'front-r1', templateContributorName: 'Creator' },
        { ...template, id: 'shared-back', templateUsage: 'back-preset' as const, templateLineageId: 'back-lineage', templateRevisionId: 'back-r1' },
        { ...template, id: 'prepared', name: 'Prepared', templateLineageId: 'prepared-lineage', templateRevisionId: 'prepared-r1' },
      ],
      cardSets: [
        { id: 'set-a', name: 'A', templateIds: ['shared-front', 'shared-back', 'prepared', 'missing'] },
        { id: 'set-b', name: 'B', templateIds: ['shared-front', 'shared-back', 'prepared', 'missing'] },
      ],
      activeCardSetId: 'set-a',
      storedCards: [
        { uniqueId: 'card-a', setId: 'set-a', templateId: 'shared-front', backingTemplateId: 'shared-back', data: { title: 'A' }, backingData: { mark: 'back A' } },
        { uniqueId: 'card-b', setId: 'set-b', templateId: 'shared-front', backingTemplateId: 'shared-back', data: { title: 'B' }, backingData: { mark: 'back B' } },
      ],
      appearanceStyles: [],
      exportSettings: {},
      customAssets: {
        'cardforge-maker-custom-textures': [], 'cardforge-maker-custom-dividers': [],
        'cardforge-maker-custom-icons': [], 'cardforge-maker-custom-images': [],
      },
    };
    const original = structuredClone(source);
    let ordinal = 0;
    const { document, templateIdsBySet } = materializeProjectTemplateOwnership(source, () => `copy-${++ordinal}`);

    expect(document.version).toBe(4);
    expect(document.userTemplates.slice(0, 3)).toEqual(original.userTemplates);
    for (const setId of ['set-a', 'set-b']) {
      const mapping = templateIdsBySet.get(setId)!;
      expect(mapping.get('shared-front')).not.toBe('shared-front');
      expect(mapping.get('shared-back')).not.toBe('shared-back');
      expect(mapping.get('prepared')).not.toBe('prepared');
      expect(mapping.has('missing')).toBe(false);
      expect(document.cardSets.find((set) => set.id === setId)?.templateIds).toContain('missing');
    }
    expect(templateIdsBySet.get('set-a')!.get('shared-front')).not.toBe(templateIdsBySet.get('set-b')!.get('shared-front'));
    expect(document.storedCards).toMatchObject([
      { uniqueId: 'card-a', templateId: templateIdsBySet.get('set-a')!.get('shared-front'), backingTemplateId: templateIdsBySet.get('set-a')!.get('shared-back'), data: { title: 'A' }, backingData: { mark: 'back A' } },
      { uniqueId: 'card-b', templateId: templateIdsBySet.get('set-b')!.get('shared-front'), backingTemplateId: templateIdsBySet.get('set-b')!.get('shared-back'), data: { title: 'B' }, backingData: { mark: 'back B' } },
    ]);
    expect(document.userTemplates.find((item) => item.id === templateIdsBySet.get('set-a')!.get('shared-front'))).toMatchObject({
      templateLineageId: templateIdsBySet.get('set-a')!.get('shared-front'),
      templateOriginLineageId: 'front-lineage',
      templateOriginRevisionId: 'front-r1',
      templateContributorName: 'Creator',
    });
    expect(source).toEqual(original);
  });

  it('preserves opaque legacy Template fields until acquisition can refuse lossy conversion', () => {
    const elements = [
      {
        id: 'opaque-late',
        name: 'Late element',
        type: 'shape',
        x: 10,
        y: 20,
        width: 30,
        height: 40,
        zIndex: 20,
        futureElementData: { owner: 'late', lateOnly: true },
      },
      {
        id: 'opaque-early',
        name: 'Early element',
        type: 'shape',
        x: 50,
        y: 60,
        width: 70,
        height: 80,
        zIndex: 5,
        futureElementData: { owner: 'early', earlyOnly: true },
      },
    ];
    const source = {
      version: 2 as const,
      userTemplates: [{
        ...template,
        futureAuthoredData: { decision: 'keep', nested: ['authored'] },
        freeformCanvas: { width: 630, height: 880, elements },
      }],
      cardSets: [{ id: 'opaque-set', name: 'Opaque', templateIds: [template.id!] }],
      activeCardSetId: 'opaque-set',
      storedCards: [],
      appearanceStyles: [],
      exportSettings: {},
      customAssets: {
        'cardforge-maker-custom-textures': [], 'cardforge-maker-custom-dividers': [],
        'cardforge-maker-custom-icons': [], 'cardforge-maker-custom-images': [],
      },
    };
    const original = structuredClone(source);
    const parsed = parseProjectDocumentValue(source);

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect((parsed.document.userTemplates[0] as TCGCardTemplate & { futureAuthoredData?: unknown }).futureAuthoredData)
      .toEqual({ decision: 'keep', nested: ['authored'] });
    expect(parsed.document.userTemplates[0]!.freeformCanvas?.elements.map((element) => [
      element.id,
      (element as typeof element & { futureElementData?: unknown }).futureElementData,
    ])).toEqual([
      ['opaque-early', { owner: 'early', earlyOnly: true }],
      ['opaque-late', { owner: 'late', lateOnly: true }],
    ]);
    expect(() => materializeProjectTemplateOwnership(parsed.document)).toThrow(/cannot preserve during Set acquisition/i);
    expect(parseProjectDocumentValue({ ...source, version: 3 })).toMatchObject({ success: false });
    expect(source).toEqual(original);
  });

  it('retains unknown legacy document-root fields so ownership conversion can refuse them', () => {
    const source = {
      version: 2 as const,
      userTemplates: [template],
      cardSets: [{ id: 'opaque-root-set', name: 'Opaque root', templateIds: [template.id!] }],
      activeCardSetId: 'opaque-root-set',
      storedCards: [],
      appearanceStyles: [],
      exportSettings: {},
      customAssets: {
        'cardforge-maker-custom-textures': [], 'cardforge-maker-custom-dividers': [],
        'cardforge-maker-custom-icons': [], 'cardforge-maker-custom-images': [],
      },
      futureDependency: { keep: ['unrecognized root content'] },
    };
    const original = structuredClone(source);
    const parsed = parseProjectDocumentValue(source);

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect((parsed.document as ProjectDocumentV1 & { futureDependency?: unknown }).futureDependency)
      .toEqual(source.futureDependency);
    expect(() => materializeProjectTemplateOwnership(parsed.document)).toThrow(/unsupported creative fields/i);
    expect(source).toEqual(original);
  });

  it('applies a project document as a partial state while preserving set and card template references', () => {
    const state = applyProjectDocumentToState({
      version: 1,
      userTemplates: [template],
      cardSets: [cardSet],
      activeCardSetId: cardSet.id,
      storedCards: [storedCard],
      appearanceStyles: [style],
      exportSettings: {
        selectedPaperSize: paperSize,
        pdfMarginMm: 7,
        pdfCardSpacingMm: 2,
        pdfIncludeCutLines: true,
        pdfDuplexLayout: 'same-page',
        exportMode: 'physical',
        exportDpi: 300,
      },
      customAssets: {
        'cardforge-maker-custom-textures': [textureAsset],
        'cardforge-maker-custom-dividers': [dividerAsset],
        'cardforge-maker-custom-icons': [],
        'cardforge-maker-custom-images': [],
      },
    });

    expect(state.userTemplates).toEqual([template]);
    expect(state.cardSets).toEqual([cardSet]);
    expect(state.activeCardSetId).toBe(cardSet.id);
    expect(state.storedCards).toEqual([storedCard]);
    expect(state.storedCards?.[0].templateId).toBe(state.userTemplates?.[0].id);
    expect(state.selectedPaperSize).toEqual(paperSize);
    expect(state.pdfDuplexLayout).toBe('same-page');
    expect(state.customAssets?.['cardforge-maker-custom-textures']).toEqual([textureAsset]);
  });

  it('instantiates a portable Set as independently owned work without a second package format', () => {
    let sequence = 0;
    const copied = instantiateProjectDocumentCopy({
      version: 1,
      userTemplates: [template],
      cardSets: [{
        ...cardSet,
        organization: {
          arrangement: 'manual',
          groupBy: 'tag',
          sort: 'manual',
          tags: [{ id: 'tag-heroes', label: 'Heroes' }],
          positions: { [storedCard.uniqueId]: { x: 32, y: 48 } },
        },
      }],
      activeCardSetId: cardSet.id,
      storedCards: [{ ...storedCard, backingTemplateId: null, tagIds: ['tag-heroes'] }],
      appearanceStyles: [style],
      exportSettings: {},
      customAssets: {
        'cardforge-maker-custom-textures': [textureAsset],
        'cardforge-maker-custom-dividers': [],
        'cardforge-maker-custom-icons': [],
        'cardforge-maker-custom-images': [],
      },
      mcpOperationReceipts: [{
        operationId: 'published-operation', requestHash: 'hash', revision: 1,
        changedTemplateIds: [], changedElementIds: [], changedCardIds: [], changedAssetRequirementIds: [],
        warnings: [], canonicalRenderingRecommended: false,
      }],
    }, (kind) => `${kind}-copy-${sequence += 1}`);

    expect(copied.cardSets[0]?.id).not.toBe(cardSet.id);
    expect(copied.storedCards[0]?.uniqueId).not.toBe(storedCard.uniqueId);
    expect(copied.storedCards[0]?.setId).toBe(copied.cardSets[0]?.id);
    expect(copied.cardSets[0]?.templateIds).toContain(copied.storedCards[0]?.templateId);
    expect(copied.userTemplates.some((item) => item.id === copied.storedCards[0]?.templateId)).toBe(true);
    expect(copied.cardSets[0]?.organization?.tags[0]?.id).not.toBe('tag-heroes');
    expect(copied.storedCards[0]?.tagIds).toEqual([copied.cardSets[0]?.organization?.tags[0]?.id]);
    expect(copied.cardSets[0]?.organization?.positions).toEqual({
      [copied.storedCards[0]!.uniqueId]: { x: 32, y: 48 },
    });
    expect(copied.userTemplates[0]).toMatchObject({ templateSource: 'user', templateLibrarySource: 'personal', templateRegistryStatus: 'localOnly' });
    expect(copied.appearanceStyles[0]).toMatchObject({ librarySource: 'local', registryStatus: 'localOnly' });
    expect(copied.customAssets['cardforge-maker-custom-textures'][0]).toMatchObject({ librarySource: 'local', registryStatus: 'localOnly' });
    expect(copied.mcpOperationReceipts).toBeUndefined();
  });

  it('parses modern project document JSON', () => {
    const parsed = parseProjectDocumentFile(JSON.stringify({
      version: 1,
      userTemplates: [template],
      cardSets: [cardSet],
      activeCardSetId: cardSet.id,
      storedCards: [storedCard],
      appearanceStyles: [style],
      exportSettings: {
        selectedPaperSize: paperSize,
        pdfMarginMm: 7,
        pdfCardSpacingMm: 2,
        pdfIncludeCutLines: true,
        pdfDuplexLayout: 'same-page',
        exportMode: 'physical',
        exportDpi: 300,
      },
      customAssets: {
        'cardforge-maker-custom-textures': [textureAsset],
        'cardforge-maker-custom-dividers': [dividerAsset],
      },
    }));

    expect(parsed.success).toBe(true);
    if (!parsed.success) throw new Error(parsed.error);
    expect(parsed.document.version).toBe(1);
    expect(parsed.document.cardSets).toEqual([cardSet]);
    expect(parsed.document.activeCardSetId).toBe(cardSet.id);
    expect(parsed.document.storedCards).toEqual([storedCard]);
    expect(parsed.document.customAssets).toEqual({
      'cardforge-maker-custom-textures': [textureAsset],
      'cardforge-maker-custom-dividers': [dividerAsset],
      'cardforge-maker-custom-icons': [],
      'cardforge-maker-custom-images': [],
    });
  });

  it('returns a failure result with a clear message for invalid JSON', () => {
    const parsed = parseProjectDocumentFile('{not valid json');

    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error('Expected invalid JSON to fail');
    expect(parsed.error).toContain('Invalid project document JSON');
  });

  it('rejects standalone template JSON because project imports use project exports only', () => {
    const parsed = parseProjectDocumentFile(JSON.stringify(template));

    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error('Expected standalone template JSON to fail');
    expect(parsed.error).toContain('CardForge project export');
  });

  it('rejects template arrays because project imports use project exports only', () => {
    const secondTemplate = { ...template, id: 'user-template-2', name: 'Second User Template' };
    const parsed = parseProjectDocumentFile(JSON.stringify([template, secondTemplate]));

    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error('Expected template array JSON to fail');
    expect(parsed.error).toContain('CardForge project export');
  });

  it('rejects stored-card arrays because cards need matching card designs', () => {
    const parsed = parseProjectDocumentFile(JSON.stringify([storedCard]));

    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error('Expected old stored-card JSON to fail');
    expect(parsed.error).toContain('Card JSON needs its matching card designs');
    expect(parsed.error).toContain('full CardForge project file');
  });

  it('rejects persisted card snapshots without matching card designs', () => {
    const parsed = parseProjectDocumentFile(JSON.stringify({
      state: {
        storedCards: [storedCard],
      },
      version: 1,
    }));

    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error('Expected generated-output-only snapshot to fail');
    expect(parsed.error).toContain('Card JSON needs its matching card designs');
  });

  it('routes a card-list JSON file away from the project importer', () => {
    const parsed = parseProjectDocumentFile(JSON.stringify({
      contractVersion: 1,
      templateId: 'user-template-1',
      templateName: 'User Template',
      fields: [
        {
          key: 'Name',
          label: 'Name',
          type: 'text',
          required: true,
        },
      ],
    }));

    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error('Expected bulk contract JSON to fail');
    expect(parsed.error).toContain('card list');
    expect(parsed.error).toContain('Make Cards → Use a list');
  });

  it('routes card-list rows away from the project importer', () => {
    const parsed = parseProjectDocumentFile(JSON.stringify([
      {
        Name: 'Rift Adept',
        Cost: 3,
        Rules: '[ability] Flying',
      },
    ]));

    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error('Expected bulk row JSON to fail');
    expect(parsed.error).toContain('card list');
    expect(parsed.error).toContain('Make Cards → Use a list');
  });

  it('rejects persisted local workspace snapshots because project imports use project exports only', () => {
    const parsed = parseProjectDocumentFile(JSON.stringify({
      state: {
        userTemplates: [template],
        storedCards: [storedCard],
        appearanceStyles: [style],
        selectedPaperSize: paperSize,
        pdfMarginMm: 7,
      },
      version: 1,
    }));

    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error('Expected workspace snapshot JSON to fail');
    expect(parsed.error).toContain('CardForge project export');
  });

  it('ignores unsupported custom asset keys instead of remapping old names', () => {
    const parsed = parseProjectDocumentFile(JSON.stringify({
      version: 1,
      userTemplates: [],
      storedCards: [],
      appearanceStyles: [],
      exportSettings: {},
      customAssets: {
        'cardforge-maker2-custom-textures': [textureAsset],
        'cardforge-maker2-custom-dividers': [dividerAsset],
      },
    }));

    expect(parsed.success).toBe(true);
    if (!parsed.success) throw new Error(parsed.error);
    expect(parsed.document.customAssets).toEqual({
      'cardforge-maker-custom-textures': [],
      'cardforge-maker-custom-dividers': [],
      'cardforge-maker-custom-icons': [],
      'cardforge-maker-custom-images': [],
    });
  });

  it('isolates one Set and assigns legacy unowned cards when creating a new durable location', () => {
    const secondSet: CardSet = {
      id: 'set-2',
      name: 'Second Set',
    };
    const document = createProjectDocumentFromState({
      userTemplates: [template],
      cardSets: [cardSet, secondSet],
      activeCardSetId: cardSet.id,
      storedCards: [storedCard, { ...storedCard, uniqueId: 'legacy-card', setId: undefined }],
      appearanceStyles: [style],
    });

    const isolated = isolateProjectDocumentToSet(document, cardSet.id);

    expect(isolated.cardSets).toEqual([cardSet]);
    expect(isolated.activeCardSetId).toBe(cardSet.id);
    expect(isolated.storedCards.map((card) => [card.uniqueId, card.setId])).toEqual([
      ['card-1', cardSet.id],
      ['legacy-card', cardSet.id],
    ]);
    expect(isolated.userTemplates).toEqual([template]);
  });
});

// Native admission must inspect the same complete literal document that this
// canonical decoder owns; it cannot treat omitted renderer state as empty.
it('preserves source-contained Studio border-none geometry without inventing artwork', () => {
  const literal = { version: 1, userTemplates: [{ ...template, appearance: { border: { kind: 'none', width: 0 } },
    freeformCanvas: { width: 300, height: 450, elements: [{ id: 'literal-shape', name: 'Literal', type: 'shape',
      x: 0, y: 0, width: 100, height: 100, zIndex: 0, appearance: { border: { kind: 'none', width: 0 } } }] } }],
    storedCards: [], cardSets: [], appearanceStyles: [], exportSettings: {}, customAssets: {} };
  const result = parseProjectDocumentFile(JSON.stringify(literal));
  expect(result.success).toBe(true);
  if (!result.success) throw new Error(result.error);
  expect(result.document.userTemplates[0].appearance?.border).toEqual({ kind: 'none', width: 0 });
  expect(result.document.userTemplates[0].freeformCanvas?.elements[0].appearance?.border).toEqual({ kind: 'none', width: 0 });
  expect(result.document.userTemplates[0].freeformCanvas?.elements).toHaveLength(1);
  expect(result.document.storedCards).toEqual([]);
  expect(Object.values(result.document.customAssets).flat()).toEqual([]);
});
