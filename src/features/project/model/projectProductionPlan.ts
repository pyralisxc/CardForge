export const PROJECT_PRODUCTION_PLAN_VERSION = 1 as const;

export const PROJECT_PRODUCTION_DECISION_MODES = ['confirmed', 'delegated'] as const;
export type ProjectProductionDecisionMode = typeof PROJECT_PRODUCTION_DECISION_MODES[number];

export const PROJECT_ASSET_REQUIREMENT_KINDS = [
  'image',
  'texture',
  'divider',
  'icon',
  'frame',
  'border',
  'other',
] as const;
export type ProjectAssetRequirementKind = typeof PROJECT_ASSET_REQUIREMENT_KINDS[number];

export const PROJECT_ASSET_REQUIREMENT_SOURCES = [
  'cardforge-library',
  'cardforge-output',
  'custom-generated',
  'user-provided',
  'placeholder',
] as const;
export type ProjectAssetRequirementSource = typeof PROJECT_ASSET_REQUIREMENT_SOURCES[number];

export const PROJECT_ASSET_REQUIREMENT_STATUSES = ['selected', 'needed', 'placeholder'] as const;
export type ProjectAssetRequirementStatus = typeof PROJECT_ASSET_REQUIREMENT_STATUSES[number];

export const PROJECT_ASSET_BINDINGS = [
  'template.background',
  'template.border',
  'element.image',
  'element.background',
  'element.icon',
  'element.texture',
  'element.divider',
] as const;
export type ProjectAssetBinding = typeof PROJECT_ASSET_BINDINGS[number];

export const PROJECT_PRODUCTION_SIZE_UNITS = ['px', 'mm', 'in'] as const;
export type ProjectProductionSizeUnit = typeof PROJECT_PRODUCTION_SIZE_UNITS[number];

export interface ProjectProductionOutputSize {
  width: number;
  height: number;
  unit: ProjectProductionSizeUnit;
  aspectRatio?: string;
}

export interface ProjectProductionVisualDirection {
  summary: string;
  palette: string[];
  typography: string[];
  notes?: string;
}

export interface ProjectAssetRequirement {
  id: string;
  name: string;
  kind: ProjectAssetRequirementKind;
  role: string;
  source: ProjectAssetRequirementSource;
  quantity: number;
  status: ProjectAssetRequirementStatus;
  binding?: ProjectAssetBinding;
  assetId?: string;
  assetUrl?: string;
  embeddedAssetId?: string;
  prompt?: string;
  targetElementIds?: string[];
  width?: number;
  height?: number;
  notes?: string;
}

export interface ProjectProductionPlan {
  version: 1;
  decisionMode: ProjectProductionDecisionMode;
  purpose: string;
  deliverable: string;
  audience?: string;
  outputSize: ProjectProductionOutputSize;
  visualDirection: ProjectProductionVisualDirection;
  editableFieldKeys: string[];
  assets: ProjectAssetRequirement[];
  copyNotes?: string;
}

export interface ProjectProductionAssetSummary {
  totalRequirements: number;
  totalAssetInstances: number;
  imageInstances: number;
  selectedInstances: number;
  neededInstances: number;
  placeholderInstances: number;
  byKind: Partial<Record<ProjectAssetRequirementKind, number>>;
  bySource: Partial<Record<ProjectAssetRequirementSource, number>>;
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isOneOf = <T extends readonly string[]>(values: T, value: unknown): value is T[number] => (
  typeof value === 'string' && values.includes(value as T[number])
);

const cleanString = (value: unknown, maxLength: number): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const result = value.trim();
  return result.length > 0 && result.length <= maxLength ? result : undefined;
};

const cleanStringArray = (value: unknown, maxItems: number, maxLength: number): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, maxItems)
    .map((entry) => cleanString(entry, maxLength))
    .filter((entry): entry is string => Boolean(entry));
};

const cleanPositiveNumber = (value: unknown, max: number): number | undefined => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 && number <= max ? number : undefined;
};

const normalizeAssetRequirement = (value: unknown): ProjectAssetRequirement | null => {
  if (!isRecord(value)) return null;
  const id = cleanString(value.id, 255);
  const name = cleanString(value.name, 160);
  const role = cleanString(value.role, 160);
  const quantity = Number(value.quantity);
  if (
    !id
    || !name
    || !role
    || !isOneOf(PROJECT_ASSET_REQUIREMENT_KINDS, value.kind)
    || !isOneOf(PROJECT_ASSET_REQUIREMENT_SOURCES, value.source)
    || !isOneOf(PROJECT_ASSET_REQUIREMENT_STATUSES, value.status)
    || !Number.isInteger(quantity)
    || quantity < 1
    || quantity > 64
  ) return null;

  return {
    id,
    name,
    kind: value.kind,
    role,
    source: value.source,
    quantity,
    status: value.status,
    binding: isOneOf(PROJECT_ASSET_BINDINGS, value.binding) ? value.binding : undefined,
    assetId: cleanString(value.assetId, 255),
    assetUrl: cleanString(value.assetUrl, 20_000),
    embeddedAssetId: cleanString(value.embeddedAssetId, 255),
    prompt: cleanString(value.prompt, 4_000),
    targetElementIds: cleanStringArray(value.targetElementIds, 100, 255),
    width: cleanPositiveNumber(value.width, 20_000),
    height: cleanPositiveNumber(value.height, 20_000),
    notes: cleanString(value.notes, 4_000),
  };
};

export const normalizeProjectProductionPlan = (value: unknown): ProjectProductionPlan | undefined => {
  if (!isRecord(value) || value.version !== PROJECT_PRODUCTION_PLAN_VERSION) return undefined;
  const purpose = cleanString(value.purpose, 1_000);
  const deliverable = cleanString(value.deliverable, 500);
  const outputSize = isRecord(value.outputSize) ? value.outputSize : null;
  const visualDirection = isRecord(value.visualDirection) ? value.visualDirection : null;
  if (
    !purpose
    || !deliverable
    || !isOneOf(PROJECT_PRODUCTION_DECISION_MODES, value.decisionMode)
    || !outputSize
    || !visualDirection
    || !isOneOf(PROJECT_PRODUCTION_SIZE_UNITS, outputSize.unit)
  ) return undefined;

  const width = cleanPositiveNumber(outputSize.width, 20_000);
  const height = cleanPositiveNumber(outputSize.height, 20_000);
  const visualSummary = cleanString(visualDirection.summary, 2_000);
  if (!width || !height || !visualSummary) return undefined;

  const assets = Array.isArray(value.assets)
    ? value.assets.slice(0, 100).map(normalizeAssetRequirement).filter((asset): asset is ProjectAssetRequirement => Boolean(asset))
    : [];

  return {
    version: PROJECT_PRODUCTION_PLAN_VERSION,
    decisionMode: value.decisionMode,
    purpose,
    deliverable,
    audience: cleanString(value.audience, 1_000),
    outputSize: {
      width,
      height,
      unit: outputSize.unit,
      aspectRatio: cleanString(outputSize.aspectRatio, 40),
    },
    visualDirection: {
      summary: visualSummary,
      palette: cleanStringArray(visualDirection.palette, 16, 100),
      typography: cleanStringArray(visualDirection.typography, 16, 160),
      notes: cleanString(visualDirection.notes, 4_000),
    },
    editableFieldKeys: cleanStringArray(value.editableFieldKeys, 100, 255),
    assets,
    copyNotes: cleanString(value.copyNotes, 4_000),
  };
};

export const summarizeProjectProductionAssets = (
  plan: ProjectProductionPlan,
): ProjectProductionAssetSummary => {
  const summary: ProjectProductionAssetSummary = {
    totalRequirements: plan.assets.length,
    totalAssetInstances: 0,
    imageInstances: 0,
    selectedInstances: 0,
    neededInstances: 0,
    placeholderInstances: 0,
    byKind: {},
    bySource: {},
  };

  plan.assets.forEach((asset) => {
    summary.totalAssetInstances += asset.quantity;
    summary.byKind[asset.kind] = (summary.byKind[asset.kind] ?? 0) + asset.quantity;
    summary.bySource[asset.source] = (summary.bySource[asset.source] ?? 0) + asset.quantity;
    if (asset.kind === 'image') summary.imageInstances += asset.quantity;
    if (asset.status === 'selected') summary.selectedInstances += asset.quantity;
    if (asset.status === 'needed') summary.neededInstances += asset.quantity;
    if (asset.status === 'placeholder') summary.placeholderInstances += asset.quantity;
  });

  return summary;
};
