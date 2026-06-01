import type {
  AppearanceStylePreset,
  PaperSize,
  PdfDuplexLayout,
  StoredDisplayCard,
  TCGCardTemplate,
} from '@/types';
import type { CardAssetOption } from '@/lib/cardAssets';
import type { ExportMode } from '@/lib/printValidation';
import { reconstructMinimalTemplateObject } from '@/lib/templateModel';

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
    || isRecord(value.backCanvas)
    || Array.isArray(value.fieldContracts)
  );
};

const normalizeTemplates = (value: unknown): TCGCardTemplate[] => (
  asArray<Partial<TCGCardTemplate>>(value)
    .filter(isLikelyTemplate)
    .map((template) => reconstructMinimalTemplateObject({ ...template, templateSource: 'user' }))
);

const emptyProjectDocument = (): ProjectDocumentV1 => ({
  version: PROJECT_DOCUMENT_VERSION,
  userTemplates: [],
  storedCards: [],
  appearanceStyles: [],
  exportSettings: {},
  customAssets: normalizeCustomAssets(undefined),
});

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

const normalizeLocalImportDocument = (value: unknown): ProjectDocumentV1 | null => {
  if (isLikelyTemplate(value)) {
    return {
      ...emptyProjectDocument(),
      userTemplates: [reconstructMinimalTemplateObject({ ...value, templateSource: 'user' })],
    };
  }

  if (Array.isArray(value)) {
    const userTemplates = normalizeTemplates(value);
    if (userTemplates.length > 0) {
      return {
        ...emptyProjectDocument(),
        userTemplates,
      };
    }
    return null;
  }

  if (!isRecord(value)) return null;

  const state = isRecord(value.state) ? value.state : value;
  const userTemplates = normalizeTemplates(state.userTemplates);
  const storedCards = asArray<StoredDisplayCard>(state.storedCards);
  const appearanceStyles = asArray<AppearanceStylePreset>(state.appearanceStyles);
  const exportSettingsSource = isRecord(state.exportSettings) ? state.exportSettings : state;

  if (userTemplates.length === 0 && storedCards.length === 0 && appearanceStyles.length === 0) return null;

  return {
    version: PROJECT_DOCUMENT_VERSION,
    userTemplates,
    storedCards,
    appearanceStyles,
    exportSettings: isRecord(exportSettingsSource) ? {
      selectedPaperSize: exportSettingsSource.selectedPaperSize as PaperSize | undefined,
      pdfMarginMm: exportSettingsSource.pdfMarginMm as number | undefined,
      pdfCardSpacingMm: exportSettingsSource.pdfCardSpacingMm as number | undefined,
      pdfIncludeCutLines: exportSettingsSource.pdfIncludeCutLines as boolean | undefined,
      pdfDuplexLayout: exportSettingsSource.pdfDuplexLayout as PdfDuplexLayout | undefined,
      exportMode: exportSettingsSource.exportMode as ExportMode | undefined,
      exportDpi: exportSettingsSource.exportDpi as number | undefined,
    } : {},
    customAssets: normalizeCustomAssets(state.customAssets),
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

  const localImportDocument = normalizeLocalImportDocument(parsed);
  if (localImportDocument) {
    return {
      success: true,
      document: localImportDocument,
    };
  }

  return {
    success: false,
    error: 'Unsupported project document format. Import a CardForge project export or local template JSON.',
  };
};
