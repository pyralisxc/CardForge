import type {
  AppearanceStylePreset,
  PaperSize,
  PdfDuplexLayout,
  StoredDisplayCard,
  TCGCardTemplate,
} from '@/types';
import type { CardAssetOption } from '@/lib/cardAssets';
import type { ExportMode } from '@/lib/printValidation';

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

  return {
    version: PROJECT_DOCUMENT_VERSION,
    userTemplates: asArray<TCGCardTemplate>(value.userTemplates),
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
    error: 'Unsupported project document format. Import a current cardforge-studio-project.json export.',
  };
};
