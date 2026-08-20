import { describe, expect, it } from 'vitest';
import type { CardSet, StoredDisplayCard } from '@/domain/cards';
import type { AppearanceStylePreset, TCGCardTemplate } from '@/domain/templates';
import type { PaperSize } from '@/domain/rendering';
import type { CardAssetOption } from '@/features/developer-assets/lib/cardAssets';
import type { ExportMode } from '@/features/card-generator/lib/printValidation';
import {
  createProjectDocumentFromState,
  applyProjectDocumentToState,
  parseProjectDocumentFile,
  type ProjectDocumentV1,
} from '@/features/project/client';

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
  frontTemplateId: 'user-template-1',
  backingTemplateId: 'back-template-1',
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
});
