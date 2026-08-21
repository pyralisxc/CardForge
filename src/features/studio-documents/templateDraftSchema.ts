import { z } from 'zod';

import {
  CARDFORGE_FREEFORM_ELEMENT_TYPES,
  CARDFORGE_FREEFORM_SHAPE_KINDS,
} from '@/domain/templates';
import {
  PROJECT_ASSET_REQUIREMENT_KINDS,
  PROJECT_ASSET_REQUIREMENT_SOURCES,
  PROJECT_ASSET_REQUIREMENT_STATUSES,
  PROJECT_PRODUCTION_DECISION_MODES,
  PROJECT_PRODUCTION_PLAN_VERSION,
  PROJECT_PRODUCTION_SIZE_UNITS,
} from '@/features/project/client/model';

const boundedString = (max: number) => z.string().max(max);
const boundedTrimmedString = (max: number) => z.string().trim().min(1).max(max);

const appearanceGradientStopSchema = z.object({
  id: boundedTrimmedString(255),
  color: boundedString(255),
  position: z.number().finite().min(0).max(100),
  opacity: z.number().finite().min(0).max(1).optional(),
}).strict();

const appearanceGradientSchema = z.object({
  type: z.enum(['linear', 'radial', 'none']),
  angle: z.number().finite().optional(),
  stops: z.array(appearanceGradientStopSchema).max(32),
}).strict();

const appearanceTextureSchema = z.object({
  kind: z.enum(['none', 'parchment', 'foil', 'etched', 'grain', 'hatch', 'uploaded']),
  intensity: z.number().finite().min(0).max(100).optional(),
  scale: z.number().finite().positive().max(10_000).optional(),
  imageSource: boundedString(20_000).optional(),
  assetSource: boundedString(20_000).optional(),
  assetKind: z.enum(['texture', 'divider', 'border', 'frame']).optional(),
  blendMode: boundedString(100).optional(),
  textureScale: z.number().finite().positive().max(10_000).optional(),
  textureOpacity: z.number().finite().min(0).max(100).optional(),
  tileMode: z.enum(['repeat', 'stretch', 'contain']).optional(),
}).strict();

const appearanceBorderSchema = z.object({
  kind: z.enum(['none', 'solid', 'double', 'etched', 'relic', 'foil']),
  color: boundedString(255).optional(),
  secondaryColor: boundedString(255).optional(),
  width: z.number().finite().min(0).max(100).optional(),
  radius: z.number().finite().min(0).max(10_000).optional(),
  innerWidth: z.number().finite().min(0).max(100).optional(),
  outerWidth: z.number().finite().min(0).max(100).optional(),
}).strict();

const appearanceEffectsSchema = z.object({
  shadow: z.number().finite().min(0).max(100).optional(),
  glow: z.number().finite().min(0).max(100).optional(),
  bevel: z.number().finite().min(0).max(100).optional(),
  innerHighlight: z.number().finite().min(0).max(100).optional(),
  overlayOpacity: z.number().finite().min(0).max(100).optional(),
}).strict();

export const templateDraftAppearanceSchema = z.object({
  assetSource: boundedString(20_000).optional(),
  assetKind: z.enum(['texture', 'divider', 'border', 'frame']).optional(),
  blendMode: boundedString(100).optional(),
  textureScale: z.number().finite().positive().max(10_000).optional(),
  textureOpacity: z.number().finite().min(0).max(100).optional(),
  tileMode: z.enum(['repeat', 'stretch', 'contain']).optional(),
  dividerAsset: boundedString(20_000).optional(),
  shapeRole: z.enum(['basic', 'panel', 'artFrame', 'rulesBox', 'titlePlate', 'statGem', 'costOrb', 'divider']).optional(),
  material: z.object({
    name: boundedString(255).optional(),
    baseColor: boundedString(255).optional(),
    textColor: boundedString(255).optional(),
    fillColor: boundedString(255).optional(),
    strokeColor: boundedString(255).optional(),
    gradient: appearanceGradientSchema.optional(),
    texture: appearanceTextureSchema.optional(),
  }).strict().optional(),
  border: appearanceBorderSchema.optional(),
  effects: appearanceEffectsSchema.optional(),
  rawCss: z.object({
    backgroundImage: boundedString(20_000).optional(),
    borderImageSource: boundedString(20_000).optional(),
  }).strict().optional(),
}).strict();

export const templateDraftElementSchema = z.object({
  id: boundedTrimmedString(255),
  type: z.enum(CARDFORGE_FREEFORM_ELEMENT_TYPES),
  name: boundedTrimmedString(160),
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().positive().max(20_000),
  height: z.number().finite().positive().max(20_000),
  rotation: z.number().finite().optional(),
  flipX: z.boolean().optional(),
  flipY: z.boolean().optional(),
  opacity: z.number().finite().min(0).max(1).optional(),
  zIndex: z.number().finite(),
  locked: z.boolean().optional(),
  parentId: boundedString(255).optional(),
  visible: z.boolean().optional(),
  content: boundedString(20_000).optional(),
  imageSource: boundedString(20_000).optional(),
  iconImageSource: boundedString(20_000).optional(),
  iconName: boundedString(255).optional(),
  shapeKind: z.enum(CARDFORGE_FREEFORM_SHAPE_KINDS).optional(),
  shapeRole: z.enum(['basic', 'panel', 'artFrame', 'rulesBox', 'titlePlate', 'statGem', 'costOrb', 'divider']).optional(),
  textColor: boundedString(255).optional(),
  backgroundColor: boundedString(255).optional(),
  backgroundImageUrl: boundedString(20_000).optional(),
  fontFamily: boundedString(255).optional(),
  fontSize: z.enum(['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl']).optional(),
  fontSizePx: z.number().finite().positive().max(1000).optional(),
  fontWeight: z.enum(['font-normal', 'font-medium', 'font-semibold', 'font-bold']).optional(),
  textAlign: z.enum(['left', 'center', 'right', 'justify']).optional(),
  fontStyle: z.enum(['normal', 'italic']).optional(),
  writingMode: z.enum(['horizontal-tb', 'vertical-rl', 'vertical-lr']).optional(),
  letterSpacing: boundedString(100).optional(),
  lineHeight: boundedString(100).optional(),
  textTransform: z.enum(['none', 'uppercase', 'lowercase', 'capitalize']).optional(),
  textDecoration: z.enum(['none', 'underline', 'line-through']).optional(),
  generatorFieldKind: z.enum(['text', 'structuredRows']).optional(),
  generatorFieldRequired: z.boolean().optional(),
  textAutoFit: z.boolean().optional(),
  textMinFontSizePx: z.number().finite().positive().max(1000).optional(),
  padding: boundedString(100).optional(),
  borderColor: boundedString(255).optional(),
  borderWidth: boundedString(100).optional(),
  borderRadius: boundedString(100).optional(),
  minHeight: boundedString(100).optional(),
  imageObjectFit: z.enum(['cover', 'contain', 'fill', 'none']).optional(),
  imageObjectPositionX: boundedString(100).optional(),
  imageObjectPositionY: boundedString(100).optional(),
  imageScale: z.number().finite().positive().max(100).optional(),
  imageOffsetX: z.number().finite().optional(),
  imageOffsetY: z.number().finite().optional(),
  imageRotation: z.number().finite().optional(),
  fillColor: boundedString(255).optional(),
  strokeColor: boundedString(255).optional(),
  strokeWidth: z.number().finite().min(0).max(100).optional(),
  appearance: templateDraftAppearanceSchema.optional(),
}).strict().superRefine((element, context) => {
  if (element.type === 'shape' && !element.shapeKind) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['shapeKind'],
      message: 'Shape elements require a native CardForge shapeKind.',
    });
  }
});

const templateFieldContractSchema = z.object({
  key: boundedTrimmedString(255),
  elementId: boundedString(255).optional(),
  label: boundedString(255).optional(),
  type: z.enum(['text', 'structuredRows', 'image']).optional(),
  required: z.boolean().optional(),
  multiline: z.boolean().optional(),
  defaultValue: boundedString(20_000).optional(),
  description: boundedString(2_000).optional(),
  example: boundedString(20_000).optional(),
  maxLength: z.number().int().positive().max(100_000).optional(),
  allowedFormatting: z.array(z.enum(['bold', 'italic', 'underline', 'color', 'highlight', 'lists', 'rulesMarkers'])).max(16).optional(),
  textAutoFit: z.boolean().optional(),
  minFontSizePx: z.number().finite().positive().max(1000).optional(),
  textColor: boundedString(255).optional(),
  fontFamily: boundedString(255).optional(),
  fontSizePx: z.number().finite().positive().max(1000).optional(),
  fontWeight: z.enum(['font-normal', 'font-medium', 'font-semibold', 'font-bold']).optional(),
  fontStyle: z.enum(['normal', 'italic']).optional(),
  textDecoration: z.enum(['none', 'underline', 'line-through']).optional(),
  textAlign: z.enum(['left', 'center', 'right', 'justify']).optional(),
  writingMode: z.enum(['horizontal-tb', 'vertical-rl', 'vertical-lr']).optional(),
  lineHeight: boundedString(100).optional(),
  letterSpacing: boundedString(100).optional(),
}).strict();

export const templateDraftSchema = z.object({
  id: boundedTrimmedString(255).nullable().optional(),
  name: boundedTrimmedString(160),
  aspectRatio: boundedTrimmedString(40),
  formatId: z.enum(['poker', 'bridge', 'tarot', 'us-business', 'event-badge', 'ttrpg-reference', 'custom']).optional(),
  trimWidthMm: z.number().finite().positive().max(10_000).optional(),
  trimHeightMm: z.number().finite().positive().max(10_000).optional(),
  templateUsage: z.enum(['standard', 'back-preset']).optional(),
  templateCategory: boundedString(160).optional(),
  templateDescription: boundedString(4_000).optional(),
  frameStyle: boundedString(255).optional(),
  baseBackgroundColor: boundedString(255).optional(),
  baseTextColor: boundedString(255).optional(),
  cardBackgroundImageUrl: boundedString(20_000).optional(),
  cardBorderImageSource: boundedString(20_000).optional(),
  defaultElementBorderColor: boundedString(255).optional(),
  cardBorderColor: boundedString(255).optional(),
  cardBorderWidth: boundedString(100).optional(),
  cardBorderStyle: z.enum(['solid', 'dashed', 'dotted', 'double', 'none', '_default_']).optional(),
  cardBorderRadius: boundedString(100).optional(),
  appearance: templateDraftAppearanceSchema.optional(),
  fieldContracts: z.array(templateFieldContractSchema).max(100).optional(),
  freeformCanvas: z.object({
    width: z.number().finite().min(1).max(5000),
    height: z.number().finite().min(1).max(5000),
    gridSize: z.number().finite().positive().max(1000).optional(),
    elements: z.array(templateDraftElementSchema).max(200),
  }).strict(),
}).strict();

const productionAssetRequirementSchema = z.object({
  id: boundedTrimmedString(255),
  name: boundedTrimmedString(160),
  kind: z.enum(PROJECT_ASSET_REQUIREMENT_KINDS),
  role: boundedTrimmedString(160),
  source: z.enum(PROJECT_ASSET_REQUIREMENT_SOURCES),
  quantity: z.number().int().min(1).max(64),
  status: z.enum(PROJECT_ASSET_REQUIREMENT_STATUSES),
  assetId: boundedString(255).optional(),
  assetUrl: boundedString(20_000).optional(),
  prompt: boundedString(4_000).optional(),
  targetElementIds: z.array(boundedTrimmedString(255)).max(100).optional(),
  width: z.number().finite().positive().max(20_000).optional(),
  height: z.number().finite().positive().max(20_000).optional(),
  notes: boundedString(4_000).optional(),
}).strict().superRefine((asset, context) => {
  if (asset.source === 'cardforge-library' && asset.status === 'selected' && !asset.assetId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['assetId'],
      message: 'Selected CardForge library assets require the library asset id.',
    });
  }
  if (asset.source === 'custom-generated' && asset.status === 'selected' && !asset.assetUrl) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['assetUrl'],
      message: 'A selected custom-generated asset requires a usable assetUrl; otherwise keep it needed.',
    });
  }
  if (asset.source === 'placeholder' && asset.status !== 'placeholder') {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['status'],
      message: 'Placeholder asset requirements must use placeholder status.',
    });
  }
});

export const projectProductionPlanSchema = z.object({
  version: z.literal(PROJECT_PRODUCTION_PLAN_VERSION),
  decisionMode: z.enum(PROJECT_PRODUCTION_DECISION_MODES),
  purpose: boundedTrimmedString(1_000),
  deliverable: boundedTrimmedString(500),
  audience: boundedString(1_000).optional(),
  outputSize: z.object({
    width: z.number().finite().positive().max(20_000),
    height: z.number().finite().positive().max(20_000),
    unit: z.enum(PROJECT_PRODUCTION_SIZE_UNITS),
    aspectRatio: boundedString(40).optional(),
  }).strict(),
  visualDirection: z.object({
    summary: boundedTrimmedString(2_000),
    palette: z.array(boundedString(100)).max(16),
    typography: z.array(boundedString(160)).max(16),
    notes: boundedString(4_000).optional(),
  }).strict(),
  editableFieldKeys: z.array(boundedTrimmedString(255)).max(100),
  assets: z.array(productionAssetRequirementSchema).max(100),
  copyNotes: boundedString(4_000).optional(),
}).strict();

export const gptTemplateDraftInputSchema = z.object({
  title: boundedTrimmedString(160),
  productionPlan: projectProductionPlanSchema,
  template: templateDraftSchema,
}).strict().superRefine((input, context) => {
  const elements = input.template.freeformCanvas.elements;
  const elementIds = new Set<string>();
  elements.forEach((element, index) => {
    if (elementIds.has(element.id)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['template', 'freeformCanvas', 'elements', index, 'id'],
        message: `Duplicate element id "${element.id}".`,
      });
    }
    elementIds.add(element.id);
    if (element.parentId && !elements.some((candidate) => candidate.id === element.parentId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['template', 'freeformCanvas', 'elements', index, 'parentId'],
        message: `Parent element "${element.parentId}" does not exist.`,
      });
    }
  });

  const fieldContracts = input.template.fieldContracts ?? [];
  const fieldKeys = new Set(fieldContracts.map((field) => field.key));
  const duplicateFieldKeys = fieldContracts.filter((field, index) => (
    fieldContracts.findIndex((candidate) => candidate.key === field.key) !== index
  ));
  duplicateFieldKeys.forEach((field) => {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['template', 'fieldContracts'],
      message: `Duplicate field contract key "${field.key}".`,
    });
  });
  fieldContracts.forEach((field, index) => {
    if (field.elementId && !elementIds.has(field.elementId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['template', 'fieldContracts', index, 'elementId'],
        message: `Field contract target "${field.elementId}" does not exist.`,
      });
    }
  });
  input.productionPlan.editableFieldKeys.forEach((key, index) => {
    if (!fieldKeys.has(key)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['productionPlan', 'editableFieldKeys', index],
        message: `Planned editable field "${key}" needs a matching template field contract.`,
      });
    }
  });
  input.productionPlan.assets.forEach((asset, assetIndex) => {
    (asset.targetElementIds ?? []).forEach((targetId, targetIndex) => {
      if (!elementIds.has(targetId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['productionPlan', 'assets', assetIndex, 'targetElementIds', targetIndex],
          message: `Planned asset target "${targetId}" does not exist in the canvas.`,
        });
      }
    });
  });

  if (input.productionPlan.outputSize.unit === 'px') {
    if (
      input.productionPlan.outputSize.width !== input.template.freeformCanvas.width
      || input.productionPlan.outputSize.height !== input.template.freeformCanvas.height
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['productionPlan', 'outputSize'],
        message: 'Pixel output size must match the native freeform canvas dimensions.',
      });
    }
  }
});

export type GptTemplateDraftInput = z.infer<typeof gptTemplateDraftInputSchema>;
