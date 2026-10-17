import { createMcpHandler } from 'mcp-handler';

import { getMcpOwnerAccess } from './mcpOwnerAccess';
import { registerOwnerReadTools } from './mcpOwnerTools';
import { createOwnerMcpToolError } from './mcpOwnerToolError';

export const CARDFORGE_OWNER_MCP_CONTRACT_VERSION = '1.8.0';

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
      'Start by reading current site state, provider readiness, and accountable Owner activity before recommending operational changes. get_owner_workspace_health, get_owner_analytics and get_owner_mcp_usage use the same native browser readers; preserve configuration, missing metrics and provider warnings.',
      'Never imply that Preview state is live production state.',
      'Do not claim provider configuration or availability beyond the provider-readiness projection returned by CardForge.',
      'Owner tools use native feature commands. get_owner_site_configuration and publish_owner_site_configuration cover full public settings; get_owner_presentation_editor and publish_owner_presentation cover Identity, Founder, Experience, roadmap settings/status and immutable legal publication. get_owner_site_media, publish_owner_site_media and restore_owner_site_media share browser media commands. Read exact revisions before proposing a publication, omit revision fields from edited values, and never replay a committed receipt. publish_owner_site_copy changes one copy block; get_owner_site_fields and publish_owner_site_field support CTA labels, navigation labels and announcement text. Each publication requires the exact canonical revision previously read.',
      'For page design requests, inspect get_owner_homepage_design then use the focused publish_owner_homepage_section or publish_owner_homepage_block commands with the exact settings revision. Preserve other sections. Use the existing Owner media commands for every uploaded image and do not mistake a fallback image for a current product screenshot.',
      'First-party pages live in get_owner_site_configuration.settings.pages. publish_owner_site_page saves or removes exactly one page while preserving others. Set published false to keep it out of public routes, navigation and client props. Existing account, Plans, Roadmap and legal routes remain code/provider-owned. The same trusted blocks, managed media and safe internal actions render every composed page.',
      'When the Owner asks for a supported homepage walkthrough change, inspect with get_owner_homepage_showcase, then publish_owner_homepage_showcase with the exact settingsRevision. The focused tool preserves other sections and demonstration Sets; no separate revision dashboard or routine human approval ceremony is required for reversible Preview changes. Screenshot selection references existing media slots; actual images must be published separately with Owner media tools, never guessed or represented as captured browser state.',
      'Before any site-copy publication, read the current Owner snapshot, preserve its exact updatedAt revision, explain the proposed public change, and never retry a conflict against stale state.',
      'In production, describe publish_owner_site_copy as a live publication. In Preview or another non-production environment, describe it as staging-only and never imply that production changed.',
      'CardForge Studio is a separate creator plugin. Do not use Owner tools as a substitute for Template, Set, card, or connected-project authoring.',
    ].join(' '),
    maxSubscriptions: 0,
  },
);
