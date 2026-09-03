import { fromJsonSchema } from '@modelcontextprotocol/server';

import { GOOGLE_DRIVE_PROJECT_PROVIDER } from '@/features/project/server';

export interface CheckoutProjectInput {
  provider: typeof GOOGLE_DRIVE_PROJECT_PROVIDER;
  projectId: string;
  expectedProviderRevision?: string;
  expectedProjectRevision?: string;
}

export interface CommitProjectInput {
  documentId: string;
  expectedDocumentRevision: number;
  provider: typeof GOOGLE_DRIVE_PROJECT_PROVIDER;
  projectId: string;
  expectedProviderRevision: string;
  expectedProjectRevision: string;
}

const providerSchema = {
  type: 'string',
  enum: [GOOGLE_DRIVE_PROJECT_PROVIDER],
  description: 'Durable CardForge project-storage provider.',
} as const;

const projectIdSchema = {
  type: 'string',
  minLength: 8,
  maxLength: 255,
  description: 'Provider-owned stable project file id returned by list_connected_projects.',
} as const;

const providerRevisionSchema = {
  type: 'string',
  pattern: '^\\d{1,80}$',
  description: 'Exact provider revision previously read from the connected storage provider.',
} as const;

const projectRevisionSchema = {
  type: 'string',
  pattern: '^[a-f0-9]{64}$',
  description: 'Exact SHA-256 CardForge project revision previously read from the .cardforge package.',
} as const;

export const checkoutProjectInputSchema = fromJsonSchema<CheckoutProjectInput>({
  type: 'object',
  additionalProperties: false,
  required: ['provider', 'projectId'],
  properties: {
    provider: providerSchema,
    projectId: projectIdSchema,
    expectedProviderRevision: providerRevisionSchema,
    expectedProjectRevision: projectRevisionSchema,
  },
});

export const commitProjectInputSchema = fromJsonSchema<CommitProjectInput>({
  type: 'object',
  additionalProperties: false,
  required: [
    'documentId',
    'expectedDocumentRevision',
    'provider',
    'projectId',
    'expectedProviderRevision',
    'expectedProjectRevision',
  ],
  properties: {
    documentId: {
      type: 'string',
      format: 'uuid',
      description: 'Private revisioned agent working document created by checkout_project.',
    },
    expectedDocumentRevision: {
      type: 'integer',
      minimum: 1,
      description: 'Exact current agent working-document revision.',
    },
    provider: providerSchema,
    projectId: projectIdSchema,
    expectedProviderRevision: providerRevisionSchema,
    expectedProjectRevision: projectRevisionSchema,
  },
});

const projectSummarySchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'provider',
    'fileId',
    'workId',
    'name',
    'providerRevision',
    'projectRevision',
    'modifiedAt',
    'size',
    'webViewLink',
  ],
  properties: {
    provider: providerSchema,
    fileId: { type: 'string' },
    workId: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    name: { type: 'string' },
    providerRevision: providerRevisionSchema,
    projectRevision: { anyOf: [projectRevisionSchema, { type: 'null' }] },
    modifiedAt: { type: 'string' },
    size: { type: 'number', minimum: 0 },
    webViewLink: { anyOf: [{ type: 'string' }, { type: 'null' }] },
  },
} as const;

const connectionSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['provider', 'configured', 'connected', 'displayName', 'rootFolderId', 'status', 'statusNote', 'lastVerifiedAt'],
  properties: {
    provider: providerSchema,
    configured: { type: 'boolean' },
    connected: { type: 'boolean' },
    displayName: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    rootFolderId: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    status: { type: 'string', enum: ['active', 'error', 'unconfigured', 'disconnected'] },
    statusNote: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    lastVerifiedAt: { anyOf: [{ type: 'string' }, { type: 'null' }] },
  },
} as const;

export const connectedProjectListOutputSchema = fromJsonSchema<Record<string, unknown>>({
  type: 'object',
  additionalProperties: false,
  required: ['connection', 'projects', 'localProjectNote'],
  properties: {
    connection: connectionSchema,
    projects: { type: 'array', items: projectSummarySchema },
    localProjectNote: { type: 'string' },
  },
});

export const checkoutProjectOutputSchema = fromJsonSchema<Record<string, unknown>>({
  type: 'object',
  additionalProperties: false,
  required: ['source', 'documentId', 'documentRevision', 'openInStudioUrl', 'nextActions'],
  properties: {
    source: projectSummarySchema,
    documentId: { type: 'string' },
    documentRevision: { type: 'integer' },
    openInStudioUrl: { type: 'string' },
    nextActions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['action', 'reason'],
        properties: { action: { type: 'string' }, reason: { type: 'string' } },
      },
    },
  },
});

export const commitProjectOutputSchema = fromJsonSchema<Record<string, unknown>>({
  type: 'object',
  additionalProperties: false,
  required: ['source', 'documentId', 'documentRevision', 'previousProviderRevision', 'previousProjectRevision'],
  properties: {
    source: projectSummarySchema,
    documentId: { type: 'string' },
    documentRevision: { type: 'integer' },
    previousProviderRevision: providerRevisionSchema,
    previousProjectRevision: projectRevisionSchema,
  },
});
