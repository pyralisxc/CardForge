import { createMcpHandler } from 'mcp-handler';

import { getMcpOwnerAccess } from './mcpOwnerAccess';
import { registerOwnerReadTools } from './mcpOwnerTools';
import { createOwnerMcpToolError } from './mcpOwnerToolError';

export const CARDFORGE_OWNER_MCP_CONTRACT_VERSION = '1.3.0';

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
      'Owner tools use native feature commands. get_owner_site_configuration and publish_owner_site_configuration cover full public settings; get_owner_presentation_editor and publish_owner_presentation cover Identity, Founder and Experience. Read exact revisions before proposing a publication, omit revision fields from edited values, and never replay a committed receipt. publish_owner_site_copy changes one copy block; get_owner_site_fields and publish_owner_site_field support CTA labels, navigation labels and announcement text. Each publication requires the exact canonical revision previously read.',
      'Before any site-copy publication, read the current Owner snapshot, preserve its exact updatedAt revision, explain the proposed public change, and never retry a conflict against stale state.',
      'In production, describe publish_owner_site_copy as a live publication. In Preview or another non-production environment, describe it as staging-only and never imply that production changed.',
      'CardForge Studio is a separate creator plugin. Do not use Owner tools as a substitute for Template, Set, card, or connected-project authoring.',
    ].join(' '),
    maxSubscriptions: 0,
  },
);
