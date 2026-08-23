import {
  fromJsonSchema,
  type JsonSchemaType,
} from '@modelcontextprotocol/server';

const objectValue: JsonSchemaType = {
  type: 'object',
  additionalProperties: true,
};
const nullableObjectValue: JsonSchemaType = {
  anyOf: [objectValue, { type: 'null' }],
};
const objectList: JsonSchemaType = {
  type: 'array',
  items: objectValue,
};
const stringList: JsonSchemaType = {
  type: 'array',
  items: { type: 'string' },
};
const workflowActions: JsonSchemaType = {
  type: 'array',
  items: {
    type: 'object',
    additionalProperties: false,
    required: ['action', 'reason'],
    properties: {
      action: { type: 'string' },
      reason: { type: 'string' },
    },
  },
};
const retrySafety: JsonSchemaType = {
  type: 'object',
  additionalProperties: false,
  required: ['setId'],
  properties: {
    setId: { type: ['string', 'null'] },
    stableCardIds: stringList,
    rule: { type: 'string' },
  },
};

const objectOutput = (
  required: string[],
  properties: Record<string, JsonSchemaType>,
) => fromJsonSchema<Record<string, unknown>>({
  type: 'object',
  additionalProperties: false,
  required,
  properties,
});

const workflowProperties = {
  capabilityVersion: { type: 'string' } satisfies JsonSchemaType,
  workflowStage: { type: 'string' } satisfies JsonSchemaType,
  nextActions: workflowActions,
};

export const studioCreationGuideOutputSchema = objectOutput(
  ['workflow', 'canvas', 'planning', 'quality'],
  {
    workflow: stringList,
    canvas: objectValue,
    planning: objectValue,
    quality: objectValue,
  },
);

export const studioLibrarySearchOutputSchema = objectOutput(['items'], {
  items: objectList,
});

export const editableTemplateSummaryOutputSchema = objectOutput(
  ['document', 'productionPlan', 'openInStudioUrl'],
  {
    document: {
      type: 'object',
      additionalProperties: false,
      required: ['id', 'title', 'creationSource', 'revision', 'createdAt', 'updatedAt'],
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        creationSource: { type: 'string' },
        revision: { type: 'integer' },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' },
      },
    },
    productionPlan: nullableObjectValue,
    openInStudioUrl: { type: 'string', format: 'uri' },
  },
);

export const editableTemplateListOutputSchema = objectOutput(['documents', 'hasMore'], {
  documents: objectList,
  hasMore: { type: 'boolean' },
});

export const editableTemplateOutputSchema = objectOutput(
  ['document', 'planningLocked', 'planningDecisionMode', 'editableImageFieldKeys', 'openInStudioUrl'],
  {
    document: objectValue,
    planningLocked: { type: 'boolean' },
    planningDecisionMode: { type: ['string', 'null'] },
    editableImageFieldKeys: stringList,
    openInStudioUrl: { type: 'string', format: 'uri' },
  },
);

export const pipelineHandoffOutputSchema = objectOutput(
  ['draftId', 'openInPipelineUrl'],
  {
    draftId: { type: 'string' },
    openInPipelineUrl: { type: 'string', format: 'uri' },
  },
);

export const accountCapabilitiesOutputSchema = objectOutput(
  ['account', 'studio', 'developer', 'guidance'],
  {
    account: objectValue,
    studio: objectValue,
    developer: objectValue,
    guidance: objectValue,
  },
);

export const agentWorkingDocumentListOutputSchema = objectOutput(['documents'], {
  documents: objectList,
});

export const agentInstallStatusOutputSchema = objectOutput(
  [
    'documentId', 'title', 'revision', 'lastInstalledRevision',
    'lastInstalledAt', 'lastInstallSummary', 'currentRevisionApplied',
  ],
  {
    documentId: { type: 'string' },
    title: { type: 'string' },
    revision: { type: 'integer', minimum: 1 },
    lastInstalledRevision: { type: ['integer', 'null'], minimum: 1 },
    lastInstalledAt: { type: ['string', 'null'] },
    lastInstallSummary: { type: ['string', 'null'] },
    currentRevisionApplied: { type: 'boolean' },
  },
);

export const cardGenerationContractOutputSchema = objectOutput(
  [
    'documentId', 'revision', 'frontTemplateId', 'frontFields', 'backFields',
    'bulkContract', 'exampleJson', 'retrySafety', 'capabilityVersion',
    'workflowStage', 'nextActions',
  ],
  {
    documentId: { type: 'string' },
    revision: { type: 'integer' },
    set: nullableObjectValue,
    frontTemplateId: { type: 'string' },
    backingTemplateId: { type: ['string', 'null'] },
    frontFields: objectList,
    backFields: objectList,
    bulkContract: objectValue,
    exampleJson: {},
    retrySafety,
    ...workflowProperties,
  },
);

export const cardSetWriteOutputSchema = objectOutput(
  [
    'documentId', 'revision', 'openInStudioUrl', 'retrySafety',
    'capabilityVersion', 'workflowStage', 'nextActions',
  ],
  {
    documentId: { type: 'string' },
    revision: { type: 'integer' },
    set: nullableObjectValue,
    openInStudioUrl: { type: 'string', format: 'uri' },
    retrySafety,
    ...workflowProperties,
  },
);

export const cardWriteOutputSchema = objectOutput(
  [
    'documentId', 'revision', 'set', 'cardIds', 'artwork', 'cardCount',
    'openInStudioUrl', 'retrySafety', 'capabilityVersion', 'workflowStage', 'nextActions',
  ],
  {
    documentId: { type: 'string' },
    revision: { type: 'integer' },
    set: objectValue,
    cardIds: stringList,
    artwork: objectList,
    cardCount: { type: 'integer', minimum: 0 },
    openInStudioUrl: { type: 'string', format: 'uri' },
    retrySafety,
    ...workflowProperties,
  },
);

export const cardDeleteOutputSchema = objectOutput(
  ['documentId', 'revision', 'setId', 'deletedCardIds', 'openInStudioUrl'],
  {
    documentId: { type: 'string' },
    revision: { type: 'integer' },
    setId: { type: 'string' },
    deletedCardIds: stringList,
    openInStudioUrl: { type: 'string', format: 'uri' },
  },
);

export const cardMoveOutputSchema = objectOutput(
  ['documentId', 'revision', 'sourceSet', 'targetSet', 'movedCardIds', 'openInStudioUrl'],
  {
    documentId: { type: 'string' },
    revision: { type: 'integer' },
    sourceSet: objectValue,
    targetSet: objectValue,
    movedCardIds: stringList,
    openInStudioUrl: { type: 'string', format: 'uri' },
  },
);

export const cardSetDeleteOutputSchema = objectOutput(
  ['documentId', 'revision', 'deletedSetId', 'deletedCardIds', 'activeSetId', 'openInStudioUrl'],
  {
    documentId: { type: 'string' },
    revision: { type: 'integer' },
    deletedSetId: { type: 'string' },
    deletedCardIds: stringList,
    activeSetId: { type: ['string', 'null'] },
    openInStudioUrl: { type: 'string', format: 'uri' },
  },
);

export const cardSetPreviewOutputSchema = objectOutput(
  [
    'documentId', 'revision', 'set', 'cards', 'artwork', 'cardCount',
    'renderArtifact', 'previewSampleCount', 'installation', 'openInStudioUrl',
    'retrySafety', 'capabilityVersion', 'workflowStage', 'nextActions',
  ],
  {
    documentId: { type: 'string' },
    revision: { type: 'integer' },
    set: objectValue,
    cards: { type: 'array', items: {} },
    artwork: objectValue,
    cardCount: { type: 'integer', minimum: 0 },
    renderArtifact: { anyOf: [objectValue, { type: 'null' }] },
    previewSampleCount: { type: 'integer', minimum: 0, maximum: 12 },
    installation: {
      type: 'object',
      additionalProperties: false,
      required: ['currentRevisionApplied', 'lastInstalledRevision', 'lastInstalledAt'],
      properties: {
        currentRevisionApplied: { type: 'boolean' },
        lastInstalledRevision: { type: ['integer', 'null'], minimum: 1 },
        lastInstalledAt: { type: ['string', 'null'] },
      },
    },
    openInStudioUrl: { type: 'string', format: 'uri' },
    retrySafety,
    ...workflowProperties,
  },
);

export const cloudSetListOutputSchema = objectOutput(['sets', 'used', 'limit'], {
  sets: objectList,
  used: { type: 'integer', minimum: 0 },
  limit: { type: 'integer', minimum: 0 },
});

export const cloudSetOutputSchema = objectOutput(
  ['summary', 'set', 'templates', 'cards', 'cardPage', 'artwork'],
  {
    summary: objectValue,
    set: {},
    templates: {},
    cards: {},
    cardPage: {
      type: 'object',
      additionalProperties: false,
      required: ['offset', 'limit', 'returned', 'total', 'hasMore', 'nextOffset'],
      properties: {
        offset: { type: 'integer', minimum: 0 },
        limit: { type: 'integer', minimum: 1 },
        returned: { type: 'integer', minimum: 0 },
        total: { type: 'integer', minimum: 0 },
        hasMore: { type: 'boolean' },
        nextOffset: { type: ['integer', 'null'], minimum: 0 },
      },
    },
    artwork: {
      type: 'object',
      additionalProperties: false,
      required: ['count', 'files', 'note'],
      properties: {
        count: { type: 'integer', minimum: 0 },
        files: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['id', 'mimeType', 'size'],
            properties: {
              id: { type: 'string' },
              mimeType: { type: 'string' },
              size: { type: 'integer', minimum: 0 },
            },
          },
        },
        note: { type: 'string' },
      },
    },
  },
);

export const cloudSetCheckoutOutputSchema = objectOutput(
  ['cloudSet', 'set', 'documentId', 'documentRevision', 'sourceCloudRevision', 'openInStudioUrl', 'nextActions'],
  {
    cloudSet: objectValue,
    set: objectValue,
    documentId: { type: 'string' },
    documentRevision: { type: 'integer', minimum: 1 },
    sourceCloudRevision: { type: 'integer', minimum: 1 },
    openInStudioUrl: { type: 'string', format: 'uri' },
    nextActions: workflowActions,
  },
);

export const cloudSetCommitOutputSchema = objectOutput(
  ['summary', 'documentId', 'documentRevision', 'previousCloudRevision', 'cloudRevision'],
  {
    summary: objectValue,
    documentId: { type: 'string' },
    documentRevision: { type: 'integer', minimum: 1 },
    previousCloudRevision: { type: 'integer', minimum: 1 },
    cloudRevision: { type: 'integer', minimum: 1 },
  },
);

export const cloudSetDeleteOutputSchema = objectOutput(
  ['deletedSetId', 'deletedRevision', 'deletedName'],
  {
    deletedSetId: { type: 'string' },
    deletedRevision: { type: 'integer', minimum: 1 },
    deletedName: { type: 'string' },
  },
);

export const templateArtworkOutputSchema = objectOutput(
  [
    'documentId', 'revision', 'assetRequirementId', 'binding', 'targetElementIds',
    'composition', 'productionReady', 'assetSummary', 'remainingAssetRequirementIds',
  ],
  {
    documentId: { type: 'string' },
    revision: { type: 'integer' },
    assetRequirementId: { type: 'string' },
    binding: { type: 'string' },
    targetElementIds: stringList,
    composition: objectValue,
    productionReady: { type: 'boolean' },
    assetSummary: nullableObjectValue,
    remainingAssetRequirementIds: stringList,
  },
);

export const templatePreviewOutputSchema = objectOutput(
  [
    'title', 'revision', 'renderArtifact', 'openInStudioUrl', 'productionReady',
    'assetSummary', 'remainingAssetRequirementIds', 'remainingAssetCount', 'composition',
  ],
  {
    title: { type: 'string' },
    revision: { type: 'integer' },
    renderArtifact: objectValue,
    openInStudioUrl: { type: 'string', format: 'uri' },
    productionReady: { type: 'boolean' },
    assetSummary: nullableObjectValue,
    remainingAssetRequirementIds: stringList,
    remainingAssetCount: { type: 'integer', minimum: 0 },
    composition: objectValue,
  },
);