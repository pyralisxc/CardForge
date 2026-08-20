import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Studio MCP creative production flow', () => {
  const route = readSource('src/app/mcp/route.ts');
  const schemas = readSource('src/features/studio-documents/server/mcpToolInputSchemas.ts');
  const agentSchemas = [
    readSource('src/features/studio-documents/server/agentTemplateToolSchemas.ts'),
    readSource('src/features/studio-documents/server/mcpCardToolSchemas.ts'),
  ].join('\n');
  const agentTools = [
    readSource('src/features/studio-documents/server/mcpAgentTemplateTools.ts'),
    readSource('src/features/studio-documents/server/mcpAgentTemplateToolsCore.ts'),
    readSource('src/features/studio-documents/server/mcpAgentCardTools.ts'),
  ].join('\n');
  const creationLibrary = readSource('src/features/studio-documents/server/studioCreationLibrary.ts');
  const validation = readSource('src/features/studio-documents/templateDraftSchema.ts');
  const revisions = [
    readSource('src/features/studio-documents/server/developerTemplateDrafts.ts'),
    readSource('src/features/studio-documents/server/developerCardSetDrafts.ts'),
  ].join('\n');
  const projectDocument = readSource('src/features/project/model/projectDocument.ts');
  const generatorFieldInput = readSource('src/features/card-generator/components/GeneratorFieldInput.tsx');

  it('exposes a conversation-to-plan-to-preview-to-revision workflow instead of one-shot creation', () => {
    expect(route).toContain("'get_studio_creation_guide'");
    expect(route).toContain("'search_studio_library'");
    expect(route).toContain("'create_editable_template'");
    expect(route).toContain("'get_editable_template'");
    expect(route).toContain("'update_editable_template'");
    expect(route).toContain('Act as a design director and production planner');
    expect(route).toContain('get approval unless the user already explicitly delegated');
    expect(route).toContain('attach_template_artwork');
    expect(route).toContain('preview_template_draft');
    expect(agentTools).toContain("'attach_template_artwork'");
    expect(agentTools).toContain("'preview_template_draft'");
  });

  it('exposes exact-contract set, individual-card, and bulk-card authoring through the same Studio document', () => {
    expect(agentTools).toContain("'get_card_generation_contract'");
    expect(agentTools).toContain("'upsert_card_set'");
    expect(agentTools).toContain("'upsert_card'");
    expect(agentTools).toContain("'upsert_cards'");
    expect(agentTools).toContain("'attach_card_artwork'");
    expect(agentTools).toContain("'preview_card_set'");
    expect(agentTools).toContain('Never guess card columns or image keys');
    expect(revisions).toContain('createBulkImportContract');
    expect(revisions).toContain('extractTemplateFieldDefinitions');
    expect(revisions).toContain('updateStudioDocument({');
    expect(projectDocument).toContain('cardSets: CardSet[]');
    expect(projectDocument).toContain('activeCardSetId?: string');
  });

  it('resolves quality once, inventories high-value visual slots, and locks accepted planning', () => {
    expect(route).toContain("id: 'simple'");
    expect(route).toContain("id: 'professional'");
    expect(route).toContain("id: 'premium'");
    expect(route).toContain('ask one concise quality question');
    expect(route).toContain('inventory every meaningful visual slot');
    expect(route).toContain('hero/main art');
    expect(route).toContain('fieldContract with type image');
    expect(route).toContain('productionPlan.editableFieldKeys');
    expect(route).toContain('PROJECT_ASSET_BINDINGS');
    expect(route).toContain('planningLocked: true');
    expect(route).toContain('treat its production plan as locked');
    expect(route).toContain('Do not ask for the same approval');
    expect(route).toContain('materially changes purpose, deliverable, output size, quality target');
    expect(route).toContain('do not use placeholder art unless the user explicitly asks');
    expect(schemas).toContain("enum: ['text', 'structuredRows', 'image']");
    expect(generatorFieldInput).toContain("field.isImage && onImageUpload");
    expect(generatorFieldInput).toContain('Image URL or Upload');
    expect(generatorFieldInput).toContain('Upload image for ${field.label}');
    expect(generatorFieldInput).toContain('Image tools');
  });

  it('teaches frame-first composition and visible-slot artwork verification directly through MCP', () => {
    expect(route).toContain('use that frame as the composition skeleton');
    expect(route).toContain('Do not recreate those same regions with redundant decorative borders or opaque panels');
    expect(route).toContain('For fixed main artwork, target the actual native image element and use binding element.image');
    expect(route).toContain('A successful upload is not proof of correct placement');
    expect(route).toContain('asset bindings, image-element source states, bordered text ids, and composition warnings');
    expect(route).toContain('installs or updates the same Template in the user personal local Template library');
    expect(route).toContain("version: '0.3.3'");
  });

  it('keeps the MCP input vocabulary native, rich, closed, and production-plan aware', () => {
    expect(schemas).toContain("required: ['title', 'productionPlan', 'template']");
    expect(schemas).toContain("required: ['id', 'type', 'name', 'x', 'y', 'width', 'height', 'zIndex']");
    expect(schemas).toContain("required: ['name', 'aspectRatio', 'freeformCanvas']");
    expect(schemas).toContain('fieldContracts');
    expect(schemas).toContain('appearance: appearanceSchema');
    expect(schemas).toContain('shapeRole');
    expect(schemas).toContain('imageObjectPositionX');
    expect(schemas).toContain('imageScale');
    expect(schemas).not.toContain('additionalProperties: true');
    expect(agentSchemas).toContain('additionalProperties: false');
    expect(agentSchemas).toContain('PROJECT_ASSET_BINDINGS');
    expect(agentSchemas).toContain('maxItems: 100');
    expect(route).not.toContain('fromJsonSchema');
  });

  it('exposes native frame and border recipes instead of forcing the model to recreate them by hand', () => {
    expect(creationLibrary).toContain("'frame-kit'");
    expect(creationLibrary).toContain('templateFrameKitItem');
    expect(creationLibrary).toContain('appearance: style.appearance');
    expect(creationLibrary).toContain('elementUpdates: style.updates');
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
    expect(projectDocument).toContain('productionPlan: normalizeProjectProductionPlan(value.productionPlan)');
    expect(projectDocument).toContain('cardSets: CardSet[]');
    expect(revisions).toContain('updateDeveloperTemplateDraft');
    expect(revisions).toContain('preserveEmbeddedTemplateAssets');
    expect(revisions).toContain('expectedRevision');
    expect(revisions).toContain('productionPlan: preserved.productionPlan');
  });
});
