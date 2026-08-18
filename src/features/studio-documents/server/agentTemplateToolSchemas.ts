import { fromJsonSchema } from '@modelcontextprotocol/server';

import { PROJECT_ASSET_BINDINGS, type ProjectAssetBinding } from '@/features/project/server';
import {
  EMBEDDED_TEMPLATE_ASSET_MIME_TYPES,
  MAX_EMBEDDED_TEMPLATE_ASSET_BASE64_CHARS,
  type EmbeddedTemplateAssetMimeType,
} from './embeddedTemplateAssets';

export interface AttachTemplateAssetInput {
  documentId: string;
  expectedRevision: number;
  assetRequirementId: string;
  binding: ProjectAssetBinding;
  mimeType: EmbeddedTemplateAssetMimeType;
  data: string;
}

export const attachTemplateAssetInputSchema = fromJsonSchema<AttachTemplateAssetInput>({
  type: 'object',
  additionalProperties: false,
  required: ['documentId', 'expectedRevision', 'assetRequirementId', 'binding', 'mimeType', 'data'],
  properties: {
    documentId: { type: 'string', format: 'uuid' },
    expectedRevision: { type: 'integer', minimum: 1 },
    assetRequirementId: { type: 'string', minLength: 1, maxLength: 255 },
    binding: { type: 'string', enum: [...PROJECT_ASSET_BINDINGS] },
    mimeType: { type: 'string', enum: [...EMBEDDED_TEMPLATE_ASSET_MIME_TYPES] },
    data: {
      type: 'string',
      minLength: 1,
      maxLength: MAX_EMBEDDED_TEMPLATE_ASSET_BASE64_CHARS,
      description: 'Raw base64 image bytes only. Do not include a data: URL prefix.',
    },
  },
});

export interface PreviewTemplateDraftInput {
  documentId: string;
}

export const previewTemplateDraftInputSchema = fromJsonSchema<PreviewTemplateDraftInput>({
  type: 'object',
  additionalProperties: false,
  required: ['documentId'],
  properties: {
    documentId: { type: 'string', format: 'uuid' },
  },
});
