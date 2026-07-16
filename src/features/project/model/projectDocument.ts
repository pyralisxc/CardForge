import type { StoredDisplayCard } from '@/domain/cards';
import { reconstructMinimalTemplateObject, type AppearanceStylePreset, type CardAssetOption, type TCGCardTemplate } from '@/domain/templates';
import type { ExportMode, PaperSize, PdfDuplexLayout } from '@/domain/rendering';

const PROJECT_DOCUMENT_VERSION = 1;

export const CUSTOM_TEXTURE_ASSETS_STORAGE_KEY = 'cardforge-maker-custom-textures';
export const CUSTOM_DIVIDER_ASSETS_STORAGE_KEY = 'cardforge-maker-custom-dividers';
export const CUSTOM_ICON_ASSETS_STORAGE_KEY = 'cardforge-maker-custom-icons';
export const CUSTOM_IMAGE_ASSETS_STORAGE_KEY = 'cardforge-maker-custom-images';

export interface ProjectDocumentExportSettings {
  selectedPaperSize?: PaperSize;
  pdfMarginMm?: number;
  pdfCardSpacingMm?: number;
  pdfIncludeCutLines?: boolean;
  pdfDuplexLayout?: PdfDuplexLayout;
  exportMode?: ExportMode;
  exportDpi?: number;
}

export interface ProjectDocumentCustomAssets {
  [CUSTOM_TEXTURE_ASSETS_STORAGE_KEY]: CardAssetOption[];
  [CUSTOM_DIVIDER_ASSETS_STORAGE_KEY]: CardAssetOption[];
  [CUSTOM_ICON_ASSETS_STORAGE_KEY]: CardAssetOption[];
  [CUSTOM_IMAGE_ASSETS_STORAGE_KEY]: CardAssetOption[];
}

export interface ProjectDocumentV1 {
  version: 1;
  userTemplates: TCGCardTemplate[];
  storedCards: StoredDisplayCard[];
  appearanceStyles: AppearanceStylePreset[];
  exportSettings: ProjectDocumentExportSettings;
  customAssets: ProjectDocumentCustomAssets;
}

export interface CreateProjectDocumentInput extends ProjectDocumentExportSettings {
  userTemplates: TCGCardTemplate[];
  storedCards: StoredDisplayCard[];
  appearanceStyles: AppearanceStylePreset[];
  customTextureAssets?: CardAssetOption[];
  customDividerAssets?: CardAssetOption[];
  customIconAssets?: CardAssetOption[];
  customImageAssets?: CardAssetOption[];
}

export interface ProjectDocumentStatePatch extends ProjectDocumentExportSettings {
  userTemplates: TCGCardTemplate[];
  storedCards: StoredDisplayCard[];
  appearanceStyles: AppearanceStylePreset[];
  customAssets: ProjectDocumentCustomAssets;
}

export type ParseProjectDocumentResult =
  | { success: true; document: ProjectDocumentV1 }
  | { success: false; error: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? value as T[] : []);

const isLikelyTemplate = (value: unknown): value is Partial<TCGCardTemplate> => {
  if (!isRecord(value)) return false;
  if (Array.isArray(value.data) || typeof value.templateId === 'string' || typeof value.uniqueId === 'string') return false;
  return (
    typeof value.name === 'string'
    || typeof value.aspectRatio === 'string'
    || isRecord(value.freeformCanvas)
    || Array.isArray(value.fieldContracts)
  );
};

const isLikelyStoredCard = (value: unknown): value is Partial<StoredDisplayCard> => (
  isRecord(value)
  && typeof value.templateId === 'string'
  && (isRecord(value.data) || typeof value.uniqueId === 'string')
);

const isLikelyBulkContract = (value: unknown): boolean => (
  isRecord(value)
  && typeof value.contractVersion === 'number'
  && typeof value.templateId === 'string'
  && Array.isArray(value.fields)
);

const isScalarBulkCell = (value: unknown): boolean => (
  value === null
  || value === undefined
  || typeof value === 'string'
  || typeof value === 'number'
  || typeof value === 'boolean'
);

const isLikelyBulkDataRow = (value: unknown): boolean => (
  isRecord(value)
  && Object.keys(value).length > 0
  && !isLikelyTemplate(value)
  && !isLikelyStoredCard(value)
  && Object.values(value).every(isScalarBulkCell)
);

const getUnsupportedProjectDocumentReason = (value: unknown): string => {
  const storedCardOnlyMessage = 'Generated-output JSON needs its matching templates. Import a full CardForge project export.';

  if (isLikelyBulkContract(value)) {
    return 'This is a bulk contract JSON file, not a project import. Use it as the source of truth beside Bulk Import data, or import a CardForge project export here.';
  }

  if (Array.isArray(value)) {
    if (value.length > 0 && value.every(isLikelyStoredCard)) {
      return storedCardOnlyMessage;
    }
    if (value.length > 0 && value.every(isLikelyBulkDataRow)) {
      return 'This looks like bulk data rows. Paste or upload this JSON in Generator > Bulk Import instead of the Layout Studio project importer.';
    }
  }

  if (isRecord(value)) {
    const state = isRecord(value.state) ? value.state : value;
    const storedCards = asArray<StoredDisplayCard>(state.storedCards);
    const userTemplates = normalizeTemplates(state.userTemplates);
    if (storedCards.length > 0 && userTemplates.length === 0) {
      return storedCardOnlyMessage;
    }
  }

  return 'Unsupported project document format. Import a CardForge project export.';
};

const normalizeTemplates = (value: unknown): TCGCardTemplate[] => (
  asArray<Partial<TCGCardTemplate>>(value)
    .filter(isLikelyTemplate)
    .map((template) => reconstructMinimalTemplateObject({ ...template, templateSource: 'user' }))
);

const normalizeCustomAssets = (value: unknown): ProjectDocumentCustomAssets => {
  const customAssets = isRecord(value) ? value : {};
  const modernTextures = customAssets[CUSTOM_TEXTURE_ASSETS_STORAGE_KEY];
  const modernDividers = customAssets[CUSTOM_DIVIDER_ASSETS_STORAGE_KEY];
  const modernIcons = customAssets[CUSTOM_ICON_ASSETS_STORAGE_KEY];
  const modernImages = customAssets[CUSTOM_IMAGE_ASSETS_STORAGE_KEY];

  return {
    [CUSTOM_TEXTURE_ASSETS_STORAGE_KEY]: asArray<CardAssetOption>(modernTextures),
    [CUSTOM_DIVIDER_ASSETS_STORAGE_KEY]: asArray<CardAssetOption>(modernDividers),
    [CUSTOM_ICON_ASSETS_STORAGE_KEY]: asArray<CardAssetOption>(modernIcons),
    [CUSTOM_IMAGE_ASSETS_STORAGE_KEY]: asArray<CardAssetOption>(modernImages),
  };
};

const normalizeProjectDocument = (value: unknown): ProjectDocumentV1 | null => {
  if (!isRecord(value) || value.version !== PROJECT_DOCUMENT_VERSION) return null;
  if (!Array.isArray(value.userTemplates) && !Array.isArray(value.storedCards) && !Array.isArray(value.appearanceStyles)) return null;

  return {
    version: PROJECT_DOCUMENT_VERSION,
    userTemplates: normalizeTemplates(value.userTemplates),
    storedCards: asArray<StoredDisplayCard>(value.storedCards),
    appearanceStyles: asArray<AppearanceStylePreset>(value.appearanceStyles),
    exportSettings: isRecord(value.exportSettings) ? value.exportSettings : {},
    customAssets: normalizeCustomAssets(value.customAssets),
  };
};

export const createProjectDocumentFromState = ({
  userTemplates,
  storedCards,
  appearanceStyles,
  selectedPaperSize,
  pdfMarginMm,
  pdfCardSpacingMm,
  pdfIncludeCutLines,
  pdfDuplexLayout,
  exportMode,
  exportDpi,
  customTextureAssets = [],
  customDividerAssets = [],
  customIconAssets = [],
  customImageAssets = [],
}: CreateProjectDocumentInput): ProjectDocumentV1 => ({
  version: PROJECT_DOCUMENT_VERSION,
  userTemplates,
  storedCards,
  appearanceStyles,
  exportSettings: {
    selectedPaperSize,
    pdfMarginMm,
    pdfCardSpacingMm,
    pdfIncludeCutLines,
    pdfDuplexLayout,
    exportMode,
    exportDpi,
  },
  customAssets: {
    [CUSTOM_TEXTURE_ASSETS_STORAGE_KEY]: customTextureAssets,
    [CUSTOM_DIVIDER_ASSETS_STORAGE_KEY]: customDividerAssets,
    [CUSTOM_ICON_ASSETS_STORAGE_KEY]: customIconAssets,
    [CUSTOM_IMAGE_ASSETS_STORAGE_KEY]: customImageAssets,
  },
});

export const applyProjectDocumentToState = (document: ProjectDocumentV1): ProjectDocumentStatePatch => ({
  userTemplates: document.userTemplates,
  storedCards: document.storedCards,
  appearanceStyles: document.appearanceStyles,
  ...document.exportSettings,
  customAssets: normalizeCustomAssets(document.customAssets),
});

export const parseProjectDocumentFile = (contents: string): ParseProjectDocumentResult => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to parse JSON.';
    return {
      success: false,
      error: `Invalid project document JSON: ${message}`,
    };
  }

  const document = normalizeProjectDocument(parsed);
  if (document) {
    return {
      success: true,
      document,
    };
  }

  return {
    success: false,
    error: getUnsupportedProjectDocumentReason(parsed),
  };
};
