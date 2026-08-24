import { fromJsonSchema } from '@modelcontextprotocol/server';

import {
  EMBEDDED_TEMPLATE_ASSET_MIME_TYPES,
  MAX_EMBEDDED_TEMPLATE_ASSET_BASE64_CHARS,
  type EmbeddedTemplateAssetMimeType,
} from './embeddedTemplateAssets';
import type { ProjectAssetBinding } from '@/features/project/server';

export interface SparseElementPatch {
  elementId: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  opacity?: number;
  zIndex?: number;
  locked?: boolean;
  visible?: boolean;
  content?: string;
  textColor?: string;
  backgroundColor?: string;
  fontFamily?: string;
  fontSizePx?: number;
  fontWeight?: 'font-normal' | 'font-medium' | 'font-semibold' | 'font-bold';
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  fontStyle?: 'normal' | 'italic';
  imageObjectFit?: 'cover' | 'contain' | 'fill' | 'none';
  imageObjectPositionX?: string;
  imageObjectPositionY?: string;
  imageScale?: number;
  imageOffsetX?: number;
  imageOffsetY?: number;
  imageRotation?: number;
}

export interface SparseFieldContractPatch {
  action: 'upsert' | 'remove';
  key: string;
  elementId?: string;
  label?: string;
  type?: 'text' | 'structuredRows' | 'image';
  required?: boolean;
  multiline?: boolean;
  defaultValue?: string;
  description?: string;
  example?: string;
  maxLength?: number;
}

export interface SparseTemplatePatch {
  templateId: string;
  name?: string;
  description?: string;
  formatId?: string;
  trimWidthMm?: number;
  trimHeightMm?: number;
  elementPatches?: SparseElementPatch[];
  fieldContractPatches?: SparseFieldContractPatch[];
}

export interface SparseCardPatch {
  setId: string;
  cardId: string;
  fields?: Record<string, string | number>;
  backingFields?: Record<string, string | number>;
  unsetFields?: string[];
  unsetBackingFields?: string[];
}

export interface TemplateArtworkAttachment {
  templateId: string;
  binding: ProjectAssetBinding;
  targetElementIds?: string[];
  requirementId?: string;
  mimeType: EmbeddedTemplateAssetMimeType;
  data?: string;
  sourceUrl?: string;
  fileName?: string;
}

export interface PatchWorkingDocumentInput {
  documentId: string;
  expectedRevision: number;
  operationId?: string;
  templatePatches?: SparseTemplatePatch[];
  cardPatches?: SparseCardPatch[];
  templateArtworks?: TemplateArtworkAttachment[];
}

export interface PatchCardsInput {
  documentId: string;
  expectedRevision: number;
  operationId?: string;
  cards: SparseCardPatch[];
}

export interface AttachTemplateArtworksInput {
  documentId: string;
  expectedRevision: number;
  operationId?: string;
  artworks: TemplateArtworkAttachment[];
}

export interface ValidateWorkingDocumentInput {
  documentId: string;
}

export interface PreviewCardsInput {
  documentId: string;
  setId: string;
  cardIds: string[];
}

const documentId = {
  type: 'string',
  format: 'uuid',
  description: 'Current CardForge working document id.',
} as const;
const expectedRevision = {
  type: 'integer',
  minimum: 1,
  description: 'Exact current server revision. The entire compound transaction is rejected when stale.',
} as const;
const operationId = {
  type: 'string',
  minLength: 1,
  maxLength: 255,
  pattern: '^[A-Za-z0-9][A-Za-z0-9._:-]{0,254}$',
  description: 'Optional caller-generated idempotency/reconciliation key. Reuse the same value when checking whether a timed-out mutation committed.',
} as const;
const stableId = {
  type: 'string',
  minLength: 1,
  maxLength: 255,
} as const;
const scalarFields = {
  type: 'object',
  minProperties: 1,
  maxProperties: 200,
  additionalProperties: {
    oneOf: [
      { type: 'string', maxLength: 20000 },
      { type: 'number' },
    ],
  },
} as const;
const stringList = {
  type: 'array',
  maxItems: 200,
  uniqueItems: true,
  items: stableId,
} as const;

const elementPatch = {
  type: 'object',
  additionalProperties: false,
  required: ['elementId'],
  properties: {
    elementId: { ...stableId, description: 'Existing stable element id. CardForge never creates a replacement element from this operation.' },
    x: { type: 'number' },
    y: { type: 'number' },
    width: { type: 'number', exclusiveMinimum: 0 },
    height: { type: 'number', exclusiveMinimum: 0 },
    rotation: { type: 'number' },
    opacity: { type: 'number', minimum: 0, maximum: 1 },
    zIndex: { type: 'integer' },
    locked: { type: 'boolean' },
    visible: { type: 'boolean' },
    content: { type: 'string', maxLength: 50000 },
    textColor: { type: 'string', maxLength: 160 },
    backgroundColor: { type: 'string', maxLength: 160 },
    fontFamily: { type: 'string', maxLength: 255 },
    fontSizePx: { type: 'number', exclusiveMinimum: 0, maximum: 1000 },
    fontWeight: { type: 'string', enum: ['font-normal', 'font-medium', 'font-semibold', 'font-bold'] },
    textAlign: { type: 'string', enum: ['left', 'center', 'right', 'justify'] },
    fontStyle: { type: 'string', enum: ['normal', 'italic'] },
    imageObjectFit: { type: 'string', enum: ['cover', 'contain', 'fill', 'none'] },
    imageObjectPositionX: { type: 'string', maxLength: 100 },
    imageObjectPositionY: { type: 'string', maxLength: 100 },
    imageScale: { type: 'number', exclusiveMinimum: 0, maximum: 100 },
    imageOffsetX: { type: 'number' },
    imageOffsetY: { type: 'number' },
    imageRotation: { type: 'number' },
  },
} as const;

const fieldContractPatch = {
  type: 'object',
  additionalProperties: false,
  required: ['action', 'key'],
  properties: {
    action: { type: 'string', enum: ['upsert', 'remove'] },
    key: { ...stableId, description: 'Existing or intended field-contract key.' },
    elementId: stableId,
    label: { type: 'string', maxLength: 255 },
    type: { type: 'string', enum: ['text', 'structuredRows', 'image'] },
    required: { type: 'boolean' },
    multiline: { type: 'boolean' },
    defaultValue: { type: 'string', maxLength: 20000 },
    description: { type: 'string', maxLength: 4000 },
    example: { type: 'string', maxLength: 4000 },
    maxLength: { type: 'integer', minimum: 1, maximum: 100000 },
  },
} as const;

const templatePatch = {
  type: 'object',
  additionalProperties: false,
  required: ['templateId'],
  properties: {
    templateId: { ...stableId, description: 'Existing stable Template id. Missing ids fail instead of creating a Template.' },
    name: { type: 'string', minLength: 1, maxLength: 255 },
    description: { type: 'string', maxLength: 4000 },
    formatId: { type: 'string', minLength: 1, maxLength: 80 },
    trimWidthMm: { type: 'number', exclusiveMinimum: 0, maximum: 2000 },
    trimHeightMm: { type: 'number', exclusiveMinimum: 0, maximum: 2000 },
    elementPatches: { type: 'array', maxItems: 200, items: elementPatch },
    fieldContractPatches: { type: 'array', maxItems: 200, items: fieldContractPatch },
  },
} as const;

const cardPatch = {
  type: 'object',
  additionalProperties: false,
  required: ['setId', 'cardId'],
  properties: {
    setId: { ...stableId, description: 'Existing stable Set id.' },
    cardId: { ...stableId, description: 'Existing stable card id. Sparse patching has no creation path.' },
    fields: scalarFields,
    backingFields: scalarFields,
    unsetFields: { ...stringList, description: 'Explicit front-face fields to delete. Omitted fields remain unchanged.' },
    unsetBackingFields: { ...stringList, description: 'Explicit back-face fields to delete. Omitted fields remain unchanged.' },
  },
} as const;

const artworkSourceProperties = {
  mimeType: {
    type: 'string',
    enum: [...EMBEDDED_TEMPLATE_ASSET_MIME_TYPES],
    description: 'Declared source MIME. CardForge decodes and normalizes every source, including WebP, before storing it.',
  },
  data: {
    type: 'string',
    minLength: 1,
    maxLength: MAX_EMBEDDED_TEMPLATE_ASSET_BASE64_CHARS,
    description: 'Raw base64 image bytes without a data: prefix.',
  },
  sourceUrl: {
    type: 'string',
    format: 'uri',
    maxLength: 4096,
    description: 'Public HTTPS source that CardForge downloads once, validates, normalizes, and stores privately.',
  },
} as const;

const artworkAttachment = {
  type: 'object',
  additionalProperties: false,
  required: ['templateId', 'binding', 'mimeType'],
  oneOf: [
    { required: ['data'], not: { required: ['sourceUrl'] } },
    { required: ['sourceUrl'], not: { required: ['data'] } },
  ],
  properties: {
    templateId: { ...stableId, description: 'Existing stable Template id.' },
    binding: {
      type: 'string',
      enum: ['template.background', 'template.border', 'element.image', 'element.background', 'element.icon', 'element.texture', 'element.divider'],
      description: 'Exact native CardForge binding target.',
    },
    targetElementIds: { ...stringList, description: 'Existing target element ids for element.* bindings.' },
    requirementId: { ...stableId, description: 'Optional existing production-plan asset requirement to mark selected. Missing ids fail instead of creating requirements.' },
    fileName: { type: 'string', maxLength: 255 },
    ...artworkSourceProperties,
  },
} as const;

export const patchWorkingDocumentInputSchema = fromJsonSchema<PatchWorkingDocumentInput>({
  type: 'object',
  additionalProperties: false,
  required: ['documentId', 'expectedRevision'],
  anyOf: [
    { required: ['templatePatches'] },
    { required: ['cardPatches'] },
    { required: ['templateArtworks'] },
  ],
  properties: {
    documentId,
    expectedRevision,
    operationId,
    templatePatches: { type: 'array', minItems: 1, maxItems: 50, items: templatePatch },
    cardPatches: { type: 'array', minItems: 1, maxItems: 100, items: cardPatch },
    templateArtworks: { type: 'array', minItems: 1, maxItems: 64, items: artworkAttachment },
  },
});

export const patchCardsInputSchema = fromJsonSchema<PatchCardsInput>({
  type: 'object',
  additionalProperties: false,
  required: ['documentId', 'expectedRevision', 'cards'],
  properties: {
    documentId,
    expectedRevision,
    operationId,
    cards: { type: 'array', minItems: 1, maxItems: 100, items: cardPatch },
  },
});

export const attachTemplateArtworksInputSchema = fromJsonSchema<AttachTemplateArtworksInput>({
  type: 'object',
  additionalProperties: false,
  required: ['documentId', 'expectedRevision', 'artworks'],
  properties: {
    documentId,
    expectedRevision,
    operationId,
    artworks: { type: 'array', minItems: 1, maxItems: 64, items: artworkAttachment },
  },
});

export const validateWorkingDocumentInputSchema = fromJsonSchema<ValidateWorkingDocumentInput>({
  type: 'object',
  additionalProperties: false,
  required: ['documentId'],
  properties: { documentId },
});

export const previewCardsInputSchema = fromJsonSchema<PreviewCardsInput>({
  type: 'object',
  additionalProperties: false,
  required: ['documentId', 'setId', 'cardIds'],
  properties: {
    documentId,
    setId: stableId,
    cardIds: { type: 'array', minItems: 1, maxItems: 12, uniqueItems: true, items: stableId },
  },
});
