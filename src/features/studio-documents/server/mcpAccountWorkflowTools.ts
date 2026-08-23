import { fromJsonSchema } from '@modelcontextprotocol/server';
import { createMcpHandler } from 'mcp-handler';

import { hasContributionScope, type DeveloperCockpitAccess } from '@/features/developer-access/server';
import { observeMcpToolExecution } from '@/features/mcp-usage/server';
import {
  accountCapabilitiesOutputSchema,
  agentInstallStatusOutputSchema,
  agentWorkingDocumentListOutputSchema,
} from './mcpToolOutputSchemas';
import { getStudioDocumentRetentionHours } from './studioDocumentAccess';
import { getStudioDocument, listStudioDocuments } from './studioDocumentStore';

type RegistrationCallback = Parameters<typeof createMcpHandler>[0];
type McpRegistrationServer = Parameters<RegistrationCallback>[0];
type ToolErrorResult = {
  isError: boolean;
  content: Array<{ type: 'text'; text: string }>;
};

interface InstallStatusInput {
  documentId: string;
}

const installStatusInputSchema = fromJsonSchema<InstallStatusInput>({
  type: 'object',
  additionalProperties: false,
  required: ['documentId'],
  properties: {
    documentId: {
      type: 'string',
      format: 'uuid',
      description: 'Private CardForge agent working document id.',
    },
  },
});

export const registerAccountWorkflowTools = ({
  server,
  getAccess,
  toolError,
}: {
  server: McpRegistrationServer;
  getAccess: () => Promise<DeveloperCockpitAccess>;
  toolError: (error: unknown) => ToolErrorResult;
}) => {
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
      return toolError(error);
    }
  };

  server.registerTool(
    'get_cardforge_capabilities',
    {
      title: 'Get the linked CardForge account capabilities',
      description: 'Read the signed-in user’s current CardForge tier, cloud capacity, owner/developer role, and contribution scopes. Use before assuming that a developer, owner, paid, or cloud capability is available. Normal Studio/card tools remain available to signed-in customers even when developer contribution tools are not.',
      outputSchema: accountCapabilitiesOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async () => runObserved({
      toolName: 'get_cardforge_capabilities',
      input: {},
      execute: async (access) => {
        const contribution = {
          canSubmitLibrary: hasContributionScope(access.scopes, 'library.submit'),
          canPublishLibrary: hasContributionScope(access.scopes, 'library.publish'),
        };
        return {
          content: [{
            type: 'text',
            text: access.isOwner
              ? 'This linked CardForge account is an owner account. Customer Studio tools and all granted owner/developer contribution scopes may be used.'
              : access.isDeveloper
                ? 'This linked CardForge account is a developer account. Customer Studio tools plus its granted contribution scopes may be used.'
                : `This linked CardForge account is a normal ${access.entitlement.accessMode} customer account. Use customer Studio/card/cloud tools; do not imply owner or developer powers.`,
          }],
          structuredContent: {
            account: {
              accessMode: access.entitlement.accessMode,
              paidPlan: access.entitlement.paidPlan,
              isOwner: access.isOwner,
              isDeveloper: access.isDeveloper,
              isSignedIn: access.entitlement.isSignedIn,
              accessExpiresAt: access.entitlement.accessExpiresAt,
            },
            studio: {
              canUseAgentStudio: access.scopes.includes('studio.ai.create'),
              canExportClean: access.entitlement.canExportClean,
              cloudSetLimit: access.entitlement.capabilities.cloudSetLimit,
              projectCapabilities: access.entitlement.capabilities,
              nativeRenderArtifacts: true,
              renderReviewMode: 'canonical CardForge PNGs returned directly in chat',
            },
            developer: {
              scopes: access.scopes,
              ...contribution,
            },
            guidance: {
              normalCustomerTools: ['Template creation/revision', 'card and Set creation/revision', 'cloud Set read/checkout/commit/delete'],
              gatedContributionTools: 'Forge Review, shared-library publication, and owner-only publication actions remain scope-gated even though the same MCP server can describe them.',
              renderGuidance: 'Preview tools never prove that a revision was installed in Studio. They render the exact server revision; use get_agent_install_status separately when local application state matters.',
            },
          },
        };
      },
    }),
  );

  server.registerTool(
    'list_agent_working_documents',
    {
      title: 'List resumable CardForge agent working documents',
      description: 'Find private CardForge agent working documents from earlier turns so the agent can resume an existing Template/Set revision instead of creating another draft. Includes exact revision and last acknowledged Studio installation state.',
      outputSchema: agentWorkingDocumentListOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async () => runObserved({
      toolName: 'list_agent_working_documents',
      input: {},
      execute: async (access) => {
        const documents = (await listStudioDocuments(
          access.user.id,
          await getStudioDocumentRetentionHours(access.entitlement),
        )).filter((document) => document.creationSource === 'gpt');
        return {
          content: [{
            type: 'text',
            text: documents.length === 0
              ? 'No resumable CardForge agent working documents are currently retained for this account.'
              : `Found ${documents.length} resumable CardForge agent working document${documents.length === 1 ? '' : 's'}. Reuse the existing document id and current revision when continuing work.`,
          }],
          structuredContent: {
            documents: documents.map((document) => ({
              id: document.id,
              title: document.title,
              revision: document.revision,
              updatedAt: document.updatedAt,
              expiresAt: document.expiresAt,
              lastInstalledRevision: document.lastInstalledRevision,
              lastInstalledAt: document.lastInstalledAt,
              lastInstallSummary: document.lastInstallSummary,
              currentRevisionApplied: document.lastInstalledRevision === document.revision,
            })),
          },
        };
      },
    }),
  );

  server.registerTool(
    'get_agent_install_status',
    {
      title: 'Check whether an agent revision was applied in CardForge Studio',
      description: 'Read the current server revision and the latest revision acknowledged as installed/applied by a browser Studio workspace. Use this instead of claiming that a successful MCP write automatically changed what the user is currently seeing.',
      inputSchema: installStatusInputSchema,
      outputSchema: agentInstallStatusOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async ({ documentId }) => runObserved({
      toolName: 'get_agent_install_status',
      input: { documentId },
      execute: async (access) => {
        const document = await getStudioDocument(
          access.user.id,
          documentId,
          await getStudioDocumentRetentionHours(access.entitlement),
        );
        const currentRevisionApplied = document.lastInstalledRevision === document.revision;
        return {
          content: [{
            type: 'text',
            text: currentRevisionApplied
              ? `CardForge Studio acknowledged agent revision ${document.revision} as applied at ${document.lastInstalledAt ?? 'an unknown time'}.`
              : `The agent working document is revision ${document.revision}; the latest Studio acknowledgement is revision ${document.lastInstalledRevision ?? 'none'}. Do not tell the user the current revision is visible until they apply its revision-bound Studio link.`,
          }],
          structuredContent: {
            documentId: document.id,
            title: document.title,
            revision: document.revision,
            lastInstalledRevision: document.lastInstalledRevision,
            lastInstalledAt: document.lastInstalledAt,
            lastInstallSummary: document.lastInstallSummary,
            currentRevisionApplied,
          },
        };
      },
    }),
  );
};