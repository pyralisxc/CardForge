import {
  reconcileCardSets,
  resolveActiveCardSet,
  type CardSet,
  type StoredDisplayCard,
} from '@/domain/cards';
import {
  reconstructMinimalTemplateObject,
  validateNativeTemplateStructure,
  type AppearanceStylePreset,
  type CardAssetOption,
  type TCGCardTemplate,
} from '@/domain/templates';
import type { ExportMode, PaperSize, PdfDuplexLayout } from '@/domain/rendering';
import {
  normalizeProjectProductionPlan,
  type ProjectProductionPlan,
} from './projectProductionPlan';
import { normalizeProjectFontAssets, type ProjectFontAsset } from './projectFont';

const PROJECT_DOCUMENT_VERSION = 1;
const PROJECT_FALLBACK_SET: CardSet = {
  id: 'active-card-set',
  name: 'Untitled Set',
  frontTemplateId: null,
  backingTemplateId: null,
};

export const CUSTOM_TEXTURE_ASSETS_STORAGE_KEY = 'cardforge-maker-custom-textures';
export const CUSTOM_DIVIDER_ASSETS_STORAGE_KEY = 'cardforge-maker-custom-dividers';
export const CUSTOM_ICON_ASSETS_STORAGE_KEY = 'cardforge-maker-custom-icons';
export const CUSTOM_IMAGE_ASSETS_STORAGE_KEY = 'cardforge-maker-custom-images';
export const CUSTOM_FONT_ASSETS_STORAGE_KEY = 'cardforge-maker-custom-fonts';

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

export interface ProjectDocumentMcpOperationReceipt {
  operationId: string;
  requestHash: string;
  revision: number;
  changedTemplateIds: string[];
  changedElementIds: string[];
  changedCardIds: string[];
  changedAssetRequirementIds: string[];
  warnings: string[];
  canonicalRenderingRecommended: boolean;
}

export interface ProjectDocumentV1 {
  version: 1;
  userTemplates: TCGCardTemplate[];
  cardSets: CardSet[];
  activeCardSetId?: string;
  storedCards: StoredDisplayCard[];
  appearanceStyles: AppearanceStylePreset[];
  exportSettings: ProjectDocumentExportSettings;
  customAssets: ProjectDocumentCustomAssets;
  customFonts?: ProjectFontAsset[];
  productionPlan?: ProjectProductionPlan;
  mcpOperationReceipts?: ProjectDocumentMcpOperationReceipt[];
}

export interface CreateProjectDocumentInput extends ProjectDocumentExportSettings {
  userTemplates: TCGCardTemplate[];
  cardSets?: CardSet[];
  activeCardSetId?: string | null;
  storedCards: StoredDisplayCard[];
  appearanceStyles: AppearanceStylePreset[];
  customTextureAssets?: CardAssetOption[];
  customDividerAssets?: CardAssetOption[];
  customIconAssets?: CardAssetOption[];
  customImageAssets?: CardAssetOption[];
  customFonts?: ProjectFontAsset[];
  productionPlan?: ProjectProductionPlan;
}

export interface ProjectDocumentStatePatch extends ProjectDocumentExportSettings {
  userTemplates: TCGCardTemplate[];
  cardSets: CardSet[];
  activeCardSetId: string;
  storedCards: StoredDisplayCard[];
  appearanceStyles: AppearanceStylePreset[];
  customAssets: ProjectDocumentCustomAssets;
  customFonts: ProjectFontAsset[];
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

const getInvalidTemplateReason = (value: unknown): string | null => {
  if (!Array.isArray(value)) return null;
  for (let index = 0; index < value.length; index += 1) {
    const template = value[index];
    if (!isLikelyTemplate(template)) continue;
    const reason = validateNativeTemplateStructure(template);
    if (reason) return `Template ${index + 1} cannot be opened safely. ${reason}`;
  }
  return null;
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
  const storedCardOnlyMessage = 'Card JSON needs its matching card designs. Import a full CardForge project file.';

  if (isLikelyBulkContract(value)) {
    return 'This JSON file is for a card list, not a project file. Add it in Make Cards → Use a list, or import a full CardForge project file here.';
  }

  if (Array.isArray(value)) {
    if (value.length > 0 && value.every(isLikelyStoredCard)) {
      return storedCardOnlyMessage;
    }
    if (value.length > 0 && value.every(isLikelyBulkDataRow)) {
      return 'This looks like a card list. Paste or upload it in Make Cards → Use a list instead of importing it as a project file.';
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

const normalizeMcpOperationReceipts = (value: unknown): ProjectDocumentMcpOperationReceipt[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const receipts = value.slice(-32).flatMap((entry): ProjectDocumentMcpOperationReceipt[] => {
    if (!isRecord(entry)
      || typeof entry.operationId !== 'string'
      || typeof entry.requestHash !== 'string'
      || !Number.isInteger(entry.revision)
      || !Array.isArray(entry.changedTemplateIds)
      || !Array.isArray(entry.changedElementIds)
      || !Array.isArray(entry.changedCardIds)
      || !Array.isArray(entry.changedAssetRequirementIds)
      || !Array.isArray(entry.warnings)
      || typeof entry.canonicalRenderingRecommended !== 'boolean') return [];
    const stringArray = (candidate: unknown[]) => candidate.filter((item): item is string => typeof item === 'string').slice(0, 200);
    return [{
      operationId: entry.operationId.slice(0, 255),
      requestHash: entry.requestHash.slice(0, 128),
      revision: Number(entry.revision),
      changedTemplateIds: stringArray(entry.changedTemplateIds),
      changedElementIds: stringArray(entry.changedElementIds),
      changedCardIds: stringArray(entry.changedCardIds),
      changedAssetRequirementIds: stringArray(entry.changedAssetRequirementIds),
      warnings: stringArray(entry.warnings).map((warning) => warning.slice(0, 4000)),
      canonicalRenderingRecommended: entry.canonicalRenderingRecommended,
    }];
  });
  return receipts.length > 0 ? receipts : undefined;
};

const normalizeProjectDocument = (value: unknown): ProjectDocumentV1 | null => {
  if (!isRecord(value) || value.version !== PROJECT_DOCUMENT_VERSION) return null;
  if (!Array.isArray(value.userTemplates) && !Array.isArray(value.storedCards) && !Array.isArray(value.appearanceStyles)) return null;

  const storedCards = asArray<StoredDisplayCard>(value.storedCards);
  const cardSets = reconcileCardSets({
    cardSets: asArray<unknown>(value.cardSets),
    storedCards,
    fallback: PROJECT_FALLBACK_SET,
  });
  const activeCardSet = resolveActiveCardSet({
    cardSets,
    preferredId: typeof value.activeCardSetId === 'string' ? value.activeCardSetId : storedCards[0]?.setId,
    fallback: PROJECT_FALLBACK_SET,
  });
  const customFonts = normalizeProjectFontAssets(value.customFonts);
  const productionPlan = normalizeProjectProductionPlan(value.productionPlan);
  const mcpOperationReceipts = normalizeMcpOperationReceipts(value.mcpOperationReceipts);

  return {
    version: PROJECT_DOCUMENT_VERSION,
    userTemplates: normalizeTemplates(value.userTemplates),
    cardSets,
    activeCardSetId: activeCardSet.id,
    storedCards,
    appearanceStyles: asArray<AppearanceStylePreset>(value.appearanceStyles),
    exportSettings: isRecord(value.exportSettings) ? value.exportSettings : {},
    customAssets: normalizeCustomAssets(value.customAssets),
    ...(customFonts.length > 0 ? { customFonts } : {}),
    ...(productionPlan ? { productionPlan } : {}),
    ...(mcpOperationReceipts ? { mcpOperationReceipts } : {}),
  };
};

export const createProjectDocumentFromState = ({
  userTemplates,
  cardSets = [],
  activeCardSetId,
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
  customFonts = [],
  productionPlan,
}: CreateProjectDocumentInput): ProjectDocumentV1 => {
  const normalizedSets = reconcileCardSets({ cardSets, storedCards, fallback: PROJECT_FALLBACK_SET });
  const activeCardSet = resolveActiveCardSet({
    cardSets: normalizedSets,
    preferredId: activeCardSetId,
    fallback: PROJECT_FALLBACK_SET,
  });
  const normalizedFonts = normalizeProjectFontAssets(customFonts);
  const normalizedProductionPlan = normalizeProjectProductionPlan(productionPlan);
  return {
    version: PROJECT_DOCUMENT_VERSION,
    userTemplates,
    cardSets: normalizedSets,
    activeCardSetId: activeCardSet.id,
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
    ...(normalizedFonts.length > 0 ? { customFonts: normalizedFonts } : {}),
    ...(normalizedProductionPlan ? { productionPlan: normalizedProductionPlan } : {}),
  };
};

export const applyProjectDocumentToState = (document: ProjectDocumentV1): ProjectDocumentStatePatch => ({
  userTemplates: document.userTemplates,
  cardSets: document.cardSets,
  activeCardSetId: document.activeCardSetId ?? document.cardSets[0]?.id ?? PROJECT_FALLBACK_SET.id,
  storedCards: document.storedCards,
  appearanceStyles: document.appearanceStyles,
  ...document.exportSettings,
  customAssets: normalizeCustomAssets(document.customAssets),
  customFonts: normalizeProjectFontAssets(document.customFonts),
});

export const parseProjectDocumentValue = (parsed: unknown): ParseProjectDocumentResult => {
  if (isRecord(parsed) && parsed.version === PROJECT_DOCUMENT_VERSION) {
    const invalidTemplateReason = getInvalidTemplateReason(parsed.userTemplates);
    if (invalidTemplateReason) {
      return {
        success: false,
        error: invalidTemplateReason,
      };
    }
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

  return parseProjectDocumentValue(parsed);
};
