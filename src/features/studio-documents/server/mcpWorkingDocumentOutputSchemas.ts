import { fromJsonSchema, type JsonSchemaType } from '@modelcontextprotocol/server';

const stringList: JsonSchemaType = { type: 'array', items: { type: 'string' } };
const objectList: JsonSchemaType = { type: 'array', items: { type: 'object', additionalProperties: true } };
const objectValue: JsonSchemaType = { type: 'object', additionalProperties: true };

export const workingDocumentPatchOutputSchema = fromJsonSchema<Record<string, unknown>>({
  type: 'object',
  additionalProperties: false,
  required: [
    'documentId', 'revision', 'changedTemplateIds', 'changedElementIds', 'changedCardIds',
    'changedAssetRequirementIds', 'warnings', 'canonicalRenderingRecommended', 'replayed', 'openInStudioUrl',
  ],
  properties: {
    documentId: { type: 'string' },
    revision: { type: 'integer', minimum: 1 },
    operationId: { type: ['string', 'null'] },
    replayed: { type: 'boolean' },
    changedTemplateIds: stringList,
    changedElementIds: stringList,
    changedCardIds: stringList,
    changedAssetRequirementIds: stringList,
    warnings: stringList,
    canonicalRenderingRecommended: { type: 'boolean' },
    openInStudioUrl: { type: 'string', format: 'uri' },
  },
});

export const workingDocumentValidationOutputSchema = fromJsonSchema<Record<string, unknown>>({
  type: 'object',
  additionalProperties: false,
  required: ['documentId', 'revision', 'valid', 'issues', 'canonicalRenderingRecommended', 'openInStudioUrl'],
  properties: {
    documentId: { type: 'string' },
    revision: { type: 'integer', minimum: 1 },
    valid: { type: 'boolean' },
    issues: objectList,
    canonicalRenderingRecommended: { type: 'boolean' },
    openInStudioUrl: { type: 'string', format: 'uri' },
  },
});

export const workingDocumentOperationStatusOutputSchema = fromJsonSchema<Record<string, unknown>>({
  type: 'object',
  additionalProperties: false,
  required: ['documentId', 'currentRevision', 'operationId', 'status', 'receipt'],
  properties: {
    documentId: { type: 'string' },
    currentRevision: { type: 'integer', minimum: 1 },
    operationId: { type: 'string' },
    status: { type: 'string', enum: ['committed', 'unknown'] },
    receipt: { anyOf: [objectValue, { type: 'null' }] },
  },
});

export const selectiveCardPreviewOutputSchema = fromJsonSchema<Record<string, unknown>>({
  type: 'object',
  additionalProperties: false,
  required: ['documentId', 'revision', 'setId', 'cardIds', 'renderArtifacts', 'renderHealth', 'openInStudioUrl'],
  properties: {
    documentId: { type: 'string' },
    revision: { type: 'integer', minimum: 1 },
    setId: { type: 'string' },
    cardIds: stringList,
    renderArtifacts: objectList,
    renderHealth: {
      type: 'object',
      additionalProperties: false,
      required: ['status', 'renderedCardIds'],
      properties: {
        status: { type: 'string', enum: ['rendered'] },
        renderedCardIds: stringList,
      },
    },
    openInStudioUrl: { type: 'string', format: 'uri' },
  },
});
