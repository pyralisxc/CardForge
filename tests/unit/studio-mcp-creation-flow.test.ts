import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const route = read('src/app/mcp/route.ts');
const projectDocument = read('src/features/project/model/projectDocument.ts');
const revisions = read('src/features/studio-documents/server/developerTemplateDrafts.ts');
const validation = read('src/features/studio-documents/server/templateDraftSchema.ts');
const creationLibrary = read('src/features/studio-documents/server/studioCreationLibrary.ts');
const agentTools = read('src/features/studio-documents/server/mcpAgentTemplateToolsCore.ts');
const schemas = read('src/features/studio-documents/server/mcpToolInputSchemas.ts');
const outputSchemas = read('src/features/studio-documents/server/mcpToolOutputSchemas.ts');
const pluginSkills = read('src/features/studio-documents/server/mcpPluginSkills.ts');
const manifest = read('plugins/cardforge-studio/manifest.json');
const submission = read('plugins/cardforge-studio/SUBMISSION.md');

describe('Studio MCP creative production flow', () => {
  it('exposes a conversation-to-plan-to-preview-to-revision workflow instead of one-shot creation', () => {
    expect(route).toContain("'get_studio_creation_guide'");
    expect(route).toContain("'create_editable_template'");
    expect(route).toContain("'preview_template_draft'");
    expect(route).toContain("'update_editable_template'");
    expect(route).toContain("'continue_template_in_pipeline'");
    expect(route).toContain('Establish the purpose, audience, deliverable');
    expect(route).toContain('Agree on visual direction');
    expect(route).toContain('Show the production plan to the user');
    expect(route).toContain('Revise and re-preview until the user is satisfied');
  });

  it('exposes exact-contract set, individual-card, bulk-card, and maintenance authoring through one Studio document', () => {
    expect(agentTools).toContain("'get_card_generation_contract'");
    expect(agentTools).toContain("'preview_card_set'");
    expect(agentTools).toContain("'upsert_card_set'");
    expect(agentTools).toContain("'upsert_card'");
    expect(agentTools).toContain("'upsert_cards_bulk'");
    expect(agentTools).toContain("'delete_card'");
    expect(agentTools).toContain("'delete_card_set'");
  });

  it('supports revision-safe cloud collaboration and account-aware capability discovery', () => {
    expect(agentTools).toContain("'list_cloud_sets'");
    expect(agentTools).toContain("'checkout_cloud_set'");
    expect(agentTools).toContain("'commit_cloud_set'");
    expect(agentTools).toContain("'get_cardforge_capabilities'");
    expect(agentTools).toContain('expectedRevision');
    expect(agentTools).toContain('expectedCloudRevision');
  });

  it('resolves quality once, inventories high-value visual slots, and locks accepted planning', () => {
    expect(route).toContain('Resolve one quality target before building the plan');
    expect(route).toContain('simple, professional, or premium');
    expect(route).toContain('Inventory every meaningful visual slot');
    expect(route).toContain('hero or main art');
    expect(route).toContain('planning is locked');
    expect(route).toContain('Reopen planning only when');
    expect(route).toContain('qualityTargets');
  });

  it('teaches frame-first composition and visible-slot artwork verification directly through MCP', () => {
    expect(route).toContain('Treat an existing selected frame as structural artwork');
    expect(route).toContain('Do not redraw its visible boxes');
    expect(route).toContain('successful upload is not proof of correct placement');
    expect(route).toContain('verify the intended visible image slot');
  });

  it('keeps the MCP input vocabulary native, rich, closed, and production-plan aware', () => {
    expect(schemas).toContain('createTemplateInputSchema');
    expect(schemas).toContain('updateTemplateInputSchema');
    expect(schemas).toContain('pipelineInputSchema');
    expect(schemas).toContain('searchStudioLibraryInputSchema');
    expect(outputSchemas).toContain('studioCreationGuideOutputSchema');
    expect(outputSchemas).toContain('editableTemplateOutputSchema');
    expect(outputSchemas).toContain('pipelineHandoffOutputSchema');
    expect(manifest).toContain('CardForge Studio');
    expect(submission).toContain('native MCP');
  });

  it('exposes native frame and border recipes instead of forcing the model to recreate them by hand', () => {
    expect(creationLibrary).toContain('FRAME_COMPOSITION_RECIPES');
    expect(creationLibrary).toContain('templateUpdates: style.templateUpdates');
    expect(creationLibrary).toContain('cardBorderImageSource: template.cardBorderImageSource');
  });

  it('validates plan bindings and keeps unresolved custom media explicit until CardForge embeds it', () => {
    expect(validation).toContain('Planned editable field');
    expect(validation).toContain('matching template field contract');
    expect(validation).toContain('Planned asset target');
    expect(validation).toContain("asset.source === 'custom-generated'");
    expect(validation).toContain('requires a usable assetUrl');
    expect(validation).toContain('Pixel output size must match the native freeform canvas dimensions');
    expect(route).toContain('Keep custom-generated requirements status needed at creation');
    expect(agentTools).toContain('attachDeveloperTemplateDraftAsset');
  });

  it('persists the production plan and sets in the canonical project while revising through optimistic document authority', () => {
    expect(projectDocument).toContain('productionPlan?: ProjectProductionPlan');
    expect(projectDocument).toContain('const productionPlan = normalizeProjectProductionPlan(value.productionPlan)');
    expect(projectDocument).toContain('const normalizedProductionPlan = normalizeProjectProductionPlan(productionPlan)');
    expect(projectDocument).toContain('cardSets: CardSet[]');
    expect(revisions).toContain('updateDeveloperTemplateDraft');
    expect(revisions).toContain('preserveEmbeddedTemplateAssets');
    expect(revisions).toContain('expectedRevision');
    expect(revisions).toContain('productionPlan: preserved.productionPlan');
  });

  it('keeps Pipeline continuation as an owner-reviewed draft and carries private Studio art with it', () => {
    expect(route).toContain("'continue_template_in_pipeline'");
    expect(route).not.toContain("'publish_template'");
    expect(revisions).toContain('materializeTemplateForPipelineReview');
    expect(revisions).toContain('MAX_PIPELINE_EMBEDDED_TEMPLATE_ASSET_BYTES');
    expect(revisions).toContain('createTemplatePipelineDraft');
  });
});
