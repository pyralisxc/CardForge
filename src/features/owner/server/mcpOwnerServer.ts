import { registerOwnerStudioDependencyTools } from './mcpStudioDependencyTools';
import { registerOwnerPeopleInboxTools } from './mcpPeopleInboxTools';
import { registerOwnerProgramRoutingTools } from './mcpProgramRoutingTools';
import { registerOwnerMediaRevisionTools } from './mcpMediaRevisionTools';
import { registerOwnerReviewRevisionTools } from './mcpReviewRevisionTools';
import { registerPublishedClassificationTools } from './mcpPublishedClassificationTools';
import { createMcpHandler } from 'mcp-handler';
import { createApiErrorResponse } from '@/infrastructure/http/apiResponses';
import { AccountToolAccessError } from '@/features/account/server';
import { registerOwnerPipelineDecisionTools } from './mcpOwnerPipelineDecisionTools';

import { getMcpOwnerAccess } from './mcpOwnerAccess';
import { registerOwnerReadTools } from './mcpOwnerTools';
import { createOwnerMcpToolError } from './mcpOwnerToolError';

export const CARDFORGE_OWNER_MCP_CONTRACT_VERSION = '1.16.0';

const ownerMcpHandler = createMcpHandler(
  (server) => {
    const options = {
      server,
      getAccess: getMcpOwnerAccess,
      toolError: createOwnerMcpToolError,
    };
    registerOwnerReadTools(options);
    registerOwnerPipelineDecisionTools(options);
    registerPublishedClassificationTools(options);
    registerOwnerReviewRevisionTools(options);
    registerOwnerMediaRevisionTools(options);
    registerOwnerProgramRoutingTools(options);
    registerOwnerPeopleInboxTools(options);
    registerOwnerStudioDependencyTools(options);
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
      'After website adoption, Owner MCP must use owner_website_editions, owner_website_create_edition, owner_website_revision and owner_website_save_revision for unpublished drafts; only owner_website_activate_revision explicitly publishes. Legacy website snapshot/config/copy/media readers redirect to authoritative edition revision reads after adoption; owner_website_save_operation_status reconciles uncertain Save by operation ID. Legacy site publish commands fail before media uploads and must not be used after adoption.',
      'Owner tools use native feature commands. get_owner_site_configuration and publish_owner_site_configuration cover full public settings; get_owner_presentation_editor and publish_owner_presentation cover Identity, Founder, Experience, roadmap settings/status, versioned website update notes and immutable legal publication. get_owner_site_media, publish_owner_site_media and restore_owner_site_media share browser media commands. Read exact revisions before proposing a publication, omit revision fields from edited values, and never replay a committed receipt. publish_owner_site_copy changes one copy block; get_owner_site_fields and publish_owner_site_field support CTA labels, navigation labels and announcement text. Each publication requires the exact canonical revision previously read.',
      'For page design requests, inspect get_owner_homepage_design then use the focused publish_owner_homepage_section or publish_owner_homepage_block commands with the exact settings revision. Preserve other sections. Use the existing Owner media commands for every uploaded image and do not mistake a fallback image for a current product screenshot.',
      'First-party pages live in get_owner_site_configuration.settings.pages. publish_owner_site_page saves or removes exactly one page while preserving others. Set published false to keep it out of public routes, navigation and client props. Existing account, Plans, Roadmap and legal routes remain code/provider-owned. The same trusted blocks, managed media and safe internal actions render every composed page.',
      'When the Owner asks for a supported homepage walkthrough change, inspect with get_owner_homepage_showcase, then publish_owner_homepage_showcase with the exact settingsRevision. The focused tool preserves other sections and demonstration Sets; no separate revision dashboard or routine human approval ceremony is required for reversible Preview changes. Screenshot selection references existing media slots; actual images must be published separately with Owner media tools, never guessed or represented as captured browser state.',
      'Before any site-copy publication, read the current Owner snapshot, preserve its exact updatedAt revision, explain the proposed public change, and never retry a conflict against stale state.',
      'In production, describe publish_owner_site_copy as a live publication. In Preview or another non-production environment, describe it as staging-only and never imply that production changed.',
      'For exact Pipeline review use get_pipeline_source_review_evidence, get_pipeline_editorial_review and get_pipeline_publication_decision before their paired record/save tools. Preserve native evidence versions, quality criteria and consequential publication rules. A committed receipt remains committed after refresh/activity warnings; uncertain writes require exact readback, never blind replay. These Owner decision tools are not exposed by Studio.',
      'Read get_pipeline_published_classification before save_pipeline_published_classification. Preserve its native expected publication identity and all seven previous classification values; taxonomy changes do not publish or create revisions. Unknown outcomes require exact readback, never automatic replay.',
      'For Template or Style corrections read the exact get_pipeline_template_review_base / get_pipeline_style_review_base, then use the corresponding create_pipeline_*_review_revision with its original payload ID, complete expectedBase and saved submissionKey. Preserve native fingerprint/idempotent receipt semantics. On uncertainty use get_pipeline_*_review_receipt with the same actor-bound key; do not fabricate absence or replay automatically. These create unpublished reviews, never publication or media copies.',
      'Managed texture presentation reviews use get_pipeline_media_presentation_base, get_pipeline_media_presentation_receipt and create_pipeline_media_presentation_revision. Preserve the existing UUID key and complete saved presentation; server/native service alone owns candidate UUID and byte-copy identity. Unknown outcomes require receipt-only reconciliation, never blind copy/replay. Cleanup flags concern the current invocation and never prove global orphan cleanup.',
      'Pipeline program settings and Studio routing have separate get/save tools. Program Save runs a consequential global governed rebalance that may change status, access, vote-driven Trash and registry publication; it is not merely a draft settings edit. Routing changes registry placement only. Neither command has caller CAS, versions or operation keys; preserve existing policy and reconcile unknown acknowledgement by exact reads without replay or causal inference from matching state.',
      'get_owner_people and get_owner_inbox expose private Owner-only canonical reads, including exact identity. Inbox search/counts cover the latest 50 window unless an exact request is read. save_owner_inbox_status only closes/reopens a request; it sends no message and changes no People authority. Preserve committed/uncertain receipts and never infer absence from provider failure or causal commit from matching readback. No People mutation, send/reply or deletion tool is added by this slice.',
      'CardForge Studio is a separate creator plugin. Do not use Owner tools as a substitute for Template, Set, card, or connected-project authoring.',
    ].join(' '),
    maxSubscriptions: 0,
  },
);

// Gate discovery as well as invocation: a linked non-Owner cannot list Owner tools.
export const cardForgeOwnerMcpHandler = async (request: Request): Promise<Response> => {
  try {
    await getMcpOwnerAccess();
  } catch (error) {
    const status = error instanceof AccountToolAccessError ? error.status : 503;
    return createApiErrorResponse(status, status === 401 ? 'sign_in_required' : status === 403 ? 'owner_access_required' : 'owner_account_unavailable',
      error instanceof AccountToolAccessError ? error.message : 'CardForge Owner access is unavailable.');
  }
  return ownerMcpHandler(request);
};
