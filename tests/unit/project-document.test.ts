import { describe, expect, it } from 'vitest';
import type { AppearanceStylePreset, PaperSize, StoredDisplayCard, TCGCardTemplate } from '@/types';
import type { CardAssetOption } from '@/lib/cardAssets';
import type { ExportMode } from '@/lib/printValidation';
import {
  createProjectDocumentFromState,
  applyProjectDocumentToState,
  isLegacyStoredCardSet,
  parseProjectDocumentFile,
  type ProjectDocumentV1,
} from '@/lib/projectDocument';

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

const storedCard: StoredDisplayCard = {
  uniqueId: 'card-1',
  templateId: 'user-template-1',
  data: {
    cardName: 'Rift Adept',
    '__cardforgeFieldStyle.cardName.textColor': '#00ffaa',
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

describe('project document serialization', () => {
  it('creates a versioned local-first project document from app state', () => {
    const document = createProjectDocumentFromState({
      userTemplates: [template],
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
    });

    expect(document).toEqual<ProjectDocumentV1>({
      version: 1,
      userTemplates: [template],
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
        'cardforge-maker-custom-icons': [],
        'cardforge-maker-custom-images': [],
      },
    });
  });

  it('applies a project document as a partial state while preserving card template references', () => {
    const state = applyProjectDocumentToState({
      version: 1,
      userTemplates: [template],
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
    expect(parsed.document.storedCards).toEqual([storedCard]);
  });

  it('parses legacy stored card array JSON into a project document', () => {
    const parsed = parseProjectDocumentFile(JSON.stringify([storedCard]));

    expect(parsed.success).toBe(true);
    if (!parsed.success) throw new Error(parsed.error);
    expect(parsed.isLegacy).toBe(true);
    expect(parsed.document).toMatchObject({
      version: 1,
      userTemplates: [],
      storedCards: [storedCard],
      appearanceStyles: [],
      customAssets: {
        'cardforge-maker-custom-textures': [],
        'cardforge-maker-custom-dividers': [],
        'cardforge-maker-custom-icons': [],
        'cardforge-maker-custom-images': [],
      },
    });
  });

  it('identifies only legacy stored card arrays as legacy card sets', () => {
    expect(isLegacyStoredCardSet([storedCard])).toBe(true);
    expect(isLegacyStoredCardSet([])).toBe(true);
    expect(isLegacyStoredCardSet([{ templateId: 'missing-data' }])).toBe(false);
    expect(isLegacyStoredCardSet({ version: 1, storedCards: [storedCard] })).toBe(false);
  });

  it('returns a failure result with a clear message for invalid JSON', () => {
    const parsed = parseProjectDocumentFile('{not valid json');

    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error('Expected invalid JSON to fail');
    expect(parsed.error).toContain('Invalid project document JSON');
  });

  it('reads legacy custom asset keys without persisting those names in the modern document', () => {
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
      'cardforge-maker-custom-textures': [textureAsset],
      'cardforge-maker-custom-dividers': [dividerAsset],
      'cardforge-maker-custom-icons': [],
      'cardforge-maker-custom-images': [],
    });
  });
});
