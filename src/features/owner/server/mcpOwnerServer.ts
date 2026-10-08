import { createMcpHandler } from 'mcp-handler';

import { getMcpOwnerAccess } from './mcpOwnerAccess';
import { registerOwnerReadTools } from './mcpOwnerTools';
import { createOwnerMcpToolError } from './mcpOwnerToolError';

export const CARDFORGE_OWNER_MCP_CONTRACT_VERSION = '1.0.0';

export const cardForgeOwnerMcpHandler = createMcpHandler(
  (server) => {
    registerOwnerReadTools({
      server,
      getAccess: getMcpOwnerAccess,
      toolError: createOwnerMcpToolError,
    });
  },
  {
    serverInfo: {
      name: 'cardforge-owner',
      version: CARDFORGE_OWNER_MCP_CONTRACT_VERSION,
    },
    instructions: [
      'Operate CardForge as its authenticated Owner rather than editing repository source.',
      'Treat runtime Owner state as canonical for live public presentation and Git as canonical for code capabilities.',
      'Start by reading current site state, provider readiness, and accountable Owner activity before recommending operational changes.',
      'Never imply that Preview state is live production state.',
      'Do not claim provider configuration or availability beyond the provider-readiness projection returned by CardForge.',
      'This initial Owner surface is read-only apart from aggregate MCP usage telemetry. Do not tell the user that the plugin can publish live changes until explicit mutation tools are added.',
      'CardForge Studio is a separate creator plugin. Do not use Owner tools as a substitute for Template, Set, card, or connected-project authoring.',
    ].join(' '),
    maxSubscriptions: 0,
  },
);
