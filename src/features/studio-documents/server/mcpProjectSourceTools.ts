import { fromJsonSchema } from '@modelcontextprotocol/server';
import { createMcpHandler } from 'mcp-handler';

import type { DeveloperCockpitAccess } from '@/features/developer-access/server';
import { observeMcpToolExecution } from '@/features/mcp-usage/server';
import {
  GOOGLE_DRIVE_PROJECT_PROVIDER,
  listGoogleDriveProjects,
  ProjectStorageProviderError,
} from '@/features/project/server';
import { StudioDocumentStoreError } from './StudioDocumentStoreError';
import {
  checkoutConnectedProjectForAgent,
  commitAgentWorkingProjectToSource,
} from './mcpProjectSourceBridge';

interface CheckoutProjectInput {
  provider: typeof GOOGLE_DRIVE_PROJECT_PROVIDER;
  projectId: string;
  expectedProviderRevision?: string;
  expectedProjectRevision?: string;
}

interface CommitProjectInput {
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

const checkoutProjectInputSchema = fromJsonSchema<CheckoutProjectInput>({
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

const commitProjectInputSchema = fromJsonSchema<CommitProjectInput>({
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
  required: ['provider', 'fileId', 'name', 'providerRevision', 'projectRevision', 'modifiedAt', 'size', 'webViewLink'],
  properties: {
    provider: providerSchema,
    fileId: { type: 'string' },
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

const connectedProjectListOutputSchema = fromJsonSchema<Record<string, unknown>>({
  type: 'object',
  additionalProperties: false,
  required: ['connection', 'projects', 'localProjectNote'],
  properties: {
    connection: connectionSchema,
    projects: { type: 'array', items: projectSummarySchema },
    localProjectNote: { type: 'string' },
  },
});

const checkoutProjectOutputSchema = fromJsonSchema<Record<string, unknown>>({
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

const commitProjectOutputSchema = fromJsonSchema<Record<string, unknown>>({
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

type RegistrationCallback = Parameters<typeof createMcpHandler>[0];
type McpRegistrationServer = Parameters<RegistrationCallback>[0];
type ToolErrorResult = {
  isError: boolean;
  content: Array<{ type: 'text'; text: string }>;
  _meta?: Record<string, unknown>;
};

export const registerProjectSourceTools = ({
  server,
  publicOrigin,
  getAccess,
  toolError,
}: {
  server: McpRegistrationServer;
  publicOrigin: string;
  getAccess: () => Promise<DeveloperCockpitAccess>;
  toolError: (error: unknown) => ToolErrorResult;
}) => {
  const projectError = (error: unknown): ToolErrorResult => {
    if (error instanceof ProjectStorageProviderError || error instanceof StudioDocumentStoreError) {
      return { isError: true, content: [{ type: 'text', text: error.message }] };
    }
    return toolError(error);
  };
  const runObserved = async <Result>({
    toolName,
    input,
    execute,
  }: {
    toolName: string;
    input: unknown;
    execute: (access: DeveloperCockpitAccess) => Promise<Result>;
  }): Promise<Result | ToolErrorResult> => {
    try {
      const access = await getAccess();
      return await observeMcpToolExecution({
        ownerUserId: access.user.id,
        toolName,
        input,
        execute: async () => execute(access),
      });
    } catch (error) {
      return projectError(error);
    }
  };
  const studioUrl = (documentId: string, revision: number) => (
    `${publicOrigin}/studio?document=${encodeURIComponent(documentId)}&revision=${revision}`
  );

  server.registerTool(
    'list_connected_projects',
    {
      title: 'List connected CardForge projects',
      description: 'Use when the user refers to a CardForge project stored in connected personal storage such as Google Drive. Lists only provider files CardForge is authorized to access. Browser/local-folder projects are intentionally not server-readable unless the user checks them into a reachable source first.',
      outputSchema: connectedProjectListOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async () => runObserved({
      toolName: 'list_connected_projects',
      input: {},
      execute: async (access) => {
        if (!access.entitlement.isSignedIn || !access.entitlement.accountUserId) {
          throw new StudioDocumentStoreError('A linked CardForge account is required to list connected projects.', 401);
        }
        const result = await listGoogleDriveProjects(access.entitlement.accountUserId);
        const structuredContent = {
          ...result,
          localProjectNote: 'Projects stored only in browser IndexedDB or a local filesystem folder cannot be read by the remote MCP while that device is unavailable. Save them to connected storage or explicitly hand them to a temporary CardForge agent workspace first.',
        };
        return {
          content: [{
            type: 'text',
            text: result.connection.connected
              ? `Found ${result.projects.length} CardForge project${result.projects.length === 1 ? '' : 's'} in the connected Google Drive.`
              : result.connection.configured
                ? 'Google Drive project storage is available but is not connected to this CardForge account.'
                : 'Google Drive project storage is installed but not yet configured by the CardForge owner.',
          }],
          structuredContent,
        };
      },
    }),
  );

  server.registerTool(
    'checkout_project',
    {
      title: 'Check out a connected CardForge project',
      description: 'Create a private revision-safe agent working document from a connected durable .cardforge project. The source project remains unchanged until commit_project. Prefer exact provider and CardForge revisions returned by list_connected_projects.',
      inputSchema: checkoutProjectInputSchema,
      outputSchema: checkoutProjectOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ provider, projectId, expectedProviderRevision, expectedProjectRevision }) => runObserved({
      toolName: 'checkout_project',
      input: { provider, projectId, expectedProviderRevision, expectedProjectRevision },
      execute: async (access) => {
        const result = await checkoutConnectedProjectForAgent({
          access,
          provider,
          projectId,
          expectedProviderRevision,
          expectedProjectRevision,
        });
        return {
          content: [{
            type: 'text',
            text: `Checked out connected project “${result.source.name}” at provider revision ${result.source.providerRevision} into private CardForge working document ${result.workingDocument.id} revision ${result.workingDocument.revision}. The source file is unchanged until commit_project.`,
          }],
          structuredContent: {
            source: result.source,
            documentId: result.workingDocument.id,
            documentRevision: result.workingDocument.revision,
            openInStudioUrl: studioUrl(result.workingDocument.id, result.workingDocument.revision),
            nextActions: [
              { action: 'preview_card_set', reason: 'Review stable current card ids and the canonical CardForge render before changing an existing set.' },
              { action: 'get_card_generation_contract', reason: 'Load the current Template field contract before creating or revising cards.' },
              { action: 'commit_project', reason: 'After review, explicitly commit this working document back to the exact connected source revisions.' },
            ],
          },
        };
      },
    }),
  );

  server.registerTool(
    'commit_project',
    {
      title: 'Commit a working project to connected storage',
      description: 'Write one reviewed private agent working document back to the connected project it was checked out from. Requires exact working-document, provider, and CardForge source revisions. CardForge refuses stale commits rather than intentionally overwriting newer provider content.',
      inputSchema: commitProjectInputSchema,
      outputSchema: commitProjectOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async ({
      documentId,
      expectedDocumentRevision,
      provider,
      projectId,
      expectedProviderRevision,
      expectedProjectRevision,
    }) => runObserved({
      toolName: 'commit_project',
      input: {
        documentId,
        expectedDocumentRevision,
        provider,
        projectId,
        expectedProviderRevision,
        expectedProjectRevision,
      },
      execute: async (access) => {
        const result = await commitAgentWorkingProjectToSource({
          access,
          documentId,
          expectedDocumentRevision,
          provider,
          projectId,
          expectedProviderRevision,
          expectedProjectRevision,
        });
        return {
          content: [{
            type: 'text',
            text: `Committed working document revision ${result.documentRevision} to “${result.source.name}”. The connected source advanced from provider revision ${result.previousProviderRevision} to ${result.source.providerRevision}.`,
          }],
          structuredContent: {
            source: result.source,
            documentId: result.documentId,
            documentRevision: result.documentRevision,
            previousProviderRevision: result.previousProviderRevision,
            previousProjectRevision: result.previousProjectRevision,
          },
        };
      },
    }),
  );
};
