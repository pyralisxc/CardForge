import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Studio MCP creative production flow', () => {
  const route = readSource('src/app/mcp/route.ts');
  const schemas = readSource('src/features/studio-documents/server/mcpToolInputSchemas.ts');
  const validation = readSource('src/features/studio-documents/templateDraftSchema.ts');
  const revisions = readSource('src/features/studio-documents/server/developerTemplateDrafts.ts');
  const projectDocument = readSource('src/features/project/model/projectDocument.ts');

  it('exposes a conversation-to-plan-to-revision workflow instead of one-shot creation', () => {
    expect(route).toContain("'get_studio_creation_guide'");
    expect(route).toContain("'search_studio_library'");
    expect(route).toContain("'create_editable_template'");
    expect(route).toContain("'get_editable_template'");
    expect(route).toContain("'update_editable_template'");
    expect(route).toContain('Act as a design director and production planner');
    expect(route).toContain('get approval unless the user already explicitly delegated');
    expect(route).toContain('Do not claim custom-generated art');
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
    expect(route).not.toContain('fromJsonSchema');
  });

  it('validates plan bindings and refuses to pretend unresolved custom media is attached', () => {
    expect(validation).toContain('Planned editable field');
    expect(validation).toContain('matching template field contract');
    expect(validation).toContain('Planned asset target');
    expect(validation).toContain("asset.source === 'custom-generated'");
    expect(validation).toContain('requires a usable assetUrl');
    expect(validation).toContain('Pixel output size must match the native freeform canvas dimensions');
  });

  it('persists the production plan in the canonical project and revises through existing optimistic document authority', () => {
    expect(projectDocument).toContain('productionPlan?: ProjectProductionPlan');
    expect(projectDocument).toContain('productionPlan: normalizeProjectProductionPlan(value.productionPlan)');
    expect(revisions).toContain('updateDeveloperTemplateDraft');
    expect(revisions).toContain('updateStudioDocument({');
    expect(revisions).toContain('expectedRevision');
    expect(revisions).toContain('productionPlan: input.productionPlan');
  });
});
