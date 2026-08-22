import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { TCGCardTemplate } from '@/domain/templates';
import type { ProjectProductionPlan } from '@/features/project/server';
import {
  bindEmbeddedTemplateAsset,
  normalizeEmbeddedTemplateAsset,
  preserveEmbeddedTemplateAssets,
} from '@/features/studio-documents/server/embeddedTemplateAssets';
import {
  createStudioDocumentPreviewToken,
  readStudioDocumentPreviewToken,
} from '@/features/studio-documents/server/studioDocumentPreviewToken';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const makeTemplate = (imageSource = 'artworkUrl'): TCGCardTemplate => ({
  id: 'gpt-template-1',
  name: 'Agent Template',
  aspectRatio: '1:1',
  templateSource: 'user',
  templateLibrarySource: 'personal',
  freeformCanvas: {
    width: 1000,
    height: 1000,
    elements: [{
      id: 'hero-art',
      type: 'image',
      name: 'Hero art',
      x: 100,
      y: 100,
      width: 800,
      height: 600,
      zIndex: 1,
      imageSource,
      content: imageSource,
    }],
  },
});

const makePlan = (asset: ProjectProductionPlan['assets'][number]): ProjectProductionPlan => ({
  version: 1,
  decisionMode: 'confirmed',
  purpose: 'Review an agent-created Template.',
  deliverable: 'Editable CardForge Template',
  outputSize: { width: 1000, height: 1000, unit: 'px' },
  visualDirection: { summary: 'Focused art-forward layout.', palette: [], typography: [] },
  editableFieldKeys: [],
  assets: [asset],
});

describe('agent Template embedded artwork', () => {
  it('normalizes a real raster image to an embedded WebP data URI', async () => {
    const png = await sharp({
      create: {
        width: 2,
        height: 2,
        channels: 4,
        background: { r: 220, g: 160, b: 40, alpha: 1 },
      },
    }).png().toBuffer();
    const result = await normalizeEmbeddedTemplateAsset({
      data: png.toString('base64'),
      mimeType: 'image/png',
    });

    expect(result.dataUri).toMatch(/^data:image\/webp;base64,/);
    expect(result.width).toBe(2);
    expect(result.height).toBe(2);
    expect(result.byteCount).toBeGreaterThan(0);
  });

  it('binds image bytes into the native Template rather than a parallel media object', () => {
    const dataUri = 'data:image/webp;base64,AAAA';
    const template = bindEmbeddedTemplateAsset({
      template: makeTemplate(),
      binding: 'element.image',
      targetElementIds: ['hero-art'],
      dataUri,
    });

    expect(template.freeformCanvas?.elements[0]).toMatchObject({
      imageSource: dataUri,
      content: dataUri,
    });
  });

  it('preserves already attached artwork when the agent revises the same draft', () => {
    const dataUri = 'data:image/webp;base64,AAAA';
    const currentPlan = makePlan({
      id: 'hero',
      name: 'Hero art',
      kind: 'image',
      role: 'Primary art',
      source: 'custom-generated',
      quantity: 1,
      status: 'selected',
      binding: 'element.image',
      embeddedAssetId: 'hero',
      targetElementIds: ['hero-art'],
    });
    const nextPlan = makePlan({
      id: 'hero',
      name: 'Hero art',
      kind: 'image',
      role: 'Primary art',
      source: 'custom-generated',
      quantity: 1,
      status: 'selected',
      assetUrl: 'embedded://hero',
      targetElementIds: ['hero-art'],
    });

    const result = preserveEmbeddedTemplateAssets({
      currentTemplate: makeTemplate(dataUri),
      nextTemplate: makeTemplate('artworkUrl'),
      currentPlan,
      nextPlan,
    });

    expect(result.template.freeformCanvas?.elements[0].imageSource).toBe(dataUri);
    expect(result.productionPlan.assets[0]).toMatchObject({
      status: 'selected',
      binding: 'element.image',
      embeddedAssetId: 'hero',
    });
    expect(result.productionPlan.assets[0].assetUrl).toBeUndefined();
  });

  it('preserves content-addressed private artwork when the agent revises a stored draft', () => {
    const assetReference = `cardforge-studio-asset://${'a'.repeat(64)}`;
    const currentPlan = makePlan({
      id: 'hero',
      name: 'Hero art',
      kind: 'image',
      role: 'Primary art',
      source: 'custom-generated',
      quantity: 1,
      status: 'selected',
      binding: 'element.image',
      embeddedAssetId: 'hero',
      targetElementIds: ['hero-art'],
    });
    const nextPlan = makePlan({
      id: 'hero',
      name: 'Hero art',
      kind: 'image',
      role: 'Primary art',
      source: 'custom-generated',
      quantity: 1,
      status: 'selected',
      targetElementIds: ['hero-art'],
    });

    const result = preserveEmbeddedTemplateAssets({
      currentTemplate: makeTemplate(assetReference),
      nextTemplate: makeTemplate('artworkUrl'),
      currentPlan,
      nextPlan,
    });

    expect(result.template.freeformCanvas?.elements[0].imageSource).toBe(assetReference);
    expect(result.productionPlan.assets[0].embeddedAssetId).toBe('hero');
  });
});

describe('agent Template preview tokens', () => {
  const previousClerkSecret = process.env.CLERK_SECRET_KEY;

  beforeEach(() => {
    process.env.CLERK_SECRET_KEY = 'sk_test_cardforge_preview_token_contract';
  });

  afterEach(() => {
    if (previousClerkSecret === undefined) delete process.env.CLERK_SECRET_KEY;
    else process.env.CLERK_SECRET_KEY = previousClerkSecret;
  });

  it('binds preview access to owner, document, revision, and a practical review window', () => {
    const now = 1_800_000_000_000;
    const token = createStudioDocumentPreviewToken({
      documentId: '3463b910-38e9-4056-966d-795babbc0f4e',
      ownerUserId: 'user_example',
      revision: 4,
      now,
    });

    expect(readStudioDocumentPreviewToken(token, now)).toMatchObject({
      documentId: '3463b910-38e9-4056-966d-795babbc0f4e',
      ownerUserId: 'user_example',
      revision: 4,
    });
    expect(readStudioDocumentPreviewToken(token, now + 90 * 60 * 1000)).not.toBeNull();
    expect(readStudioDocumentPreviewToken(`${token}x`, now)).toBeNull();
    expect(readStudioDocumentPreviewToken(token, now + 121 * 60 * 1000)).toBeNull();
  });
});

describe('agent Studio install and chat preview architecture', () => {
  const handoff = readSource('src/features/studio-documents/hooks/useStudioDocumentHandoff.ts');
  const templatePreview = readSource('src/features/studio-documents/components/TemplateDraftPreviewClient.tsx');
  const setPreview = readSource('src/features/studio-documents/components/CardSetDraftPreviewClient.tsx');
  const nativeExport = readSource('src/features/card-generator/lib/cardPreviewExport.tsx');
  const mcpTools = [
    readSource('src/features/studio-documents/server/mcpAgentTemplateTools.ts'),
    readSource('src/features/studio-documents/server/mcpAgentTemplateToolsCore.ts'),
    readSource('src/features/studio-documents/server/mcpAgentCardTools.ts'),
    readSource('src/features/studio-documents/server/mcpCloudSetTools.ts'),
    readSource('src/features/studio-documents/server/mcpAccountWorkflowTools.ts'),
  ].join('\n');
  const pluginSkill = readSource('plugins/cardforge-studio/skills/create-editable-template/SKILL.md');
  const cardSkill = readSource('plugins/cardforge-studio/skills/create-cards-and-sets/SKILL.md');

  it('installs personal agent Templates without clearing unrelated local workspace state', () => {
    const gptBranch = handoff.slice(
      handoff.indexOf("payload.document?.creationSource === 'gpt'"),
      handoff.indexOf('// Non-agent Studio documents retain project-open semantics.'),
    );
    expect(gptBranch).toContain('mergeProjectAssetListToStorage');
    expect(gptBranch).toContain("template.templateLibrarySource !== 'official'");
    expect(gptBranch).toContain('mergeUserTemplates(personalTemplates.map');
    expect(gptBranch).toContain("templateLibrarySource: 'personal'");
    expect(gptBranch).not.toContain('(Agent copy)');
    expect(gptBranch).not.toContain('nanoid');
    expect(gptBranch).not.toContain('useProjectStore.setState({');
  });

  it('installs agent-created Sets/cards in place and lands finished work in Sets', () => {
    const gptBranch = handoff.slice(
      handoff.indexOf("payload.document?.creationSource === 'gpt'"),
      handoff.indexOf('// Non-agent Studio documents retain project-open semantics.'),
    );
    expect(gptBranch).toContain('mergeCardSetsFromFiles');
    expect(gptBranch).toContain('mergeStoredCards(patch.storedCards)');
    expect(gptBranch).toContain("cardResult.successCount > 0 ? 'sets' : 'template-maker'");
    expect(gptBranch).toContain("title: 'Agent revision applied'");
  });

  it('pins Studio installation to an exact revision and acknowledges the applied revision', () => {
    expect(handoff).toContain("parseRequestedRevision(url.searchParams.get('revision'))");
    expect(handoff).toContain('actualRevision !== requestedRevision');
    expect(handoff).toContain('handoffKey(documentId, requestedRevision)');
    expect(handoff).toContain('/installation');
    expect(mcpTools).toContain("'get_agent_install_status'");
  });

  it('exports the exact Template through the canonical native PNG pipeline for in-chat review', () => {
    expect(templatePreview).toContain("import { renderCardToPngBlob } from '@/features/card-generator/client'");
    expect(templatePreview).toContain("renderCardToPngBlob(card, 'virtual', 150)");
    expect(templatePreview).toContain("type: 'cardforge-template-export'");
    expect(templatePreview).toContain('window.parent.postMessage');
    expect(templatePreview).not.toContain("import { CardPreview } from '@/features/card-rendering/client'");
    expect(templatePreview).not.toContain("from 'html-to-image'");
    expect(templatePreview).toContain('/api/studio-document-preview?token=');
    expect(nativeExport).toContain('export async function renderCardToPngBlob');
    expect(nativeExport).toContain('return await renderer.renderToBlob(card, face)');
    expect(mcpTools).toContain('id="preview-image"');
    expect(mcpTools).toContain("payload.type !== 'cardforge-template-export'");
  });

  it('renders representative Set cards through the same native exporter before completion', () => {
    expect(setPreview).toContain("import { renderCardToPngBlob } from '@/features/card-generator/client'");
    expect(setPreview).toContain("renderCardToPngBlob(card, 'virtual', 150)");
    expect(setPreview).toContain('MAX_RENDERED_PREVIEW_CARDS = 12');
    expect(mcpTools).toContain("SET_PREVIEW_RESOURCE_URI = 'ui://cardforge/card-set-preview.html'");
    expect(mcpTools).toContain("'openai/outputTemplate': SET_PREVIEW_RESOURCE_URI");
    expect(mcpTools).toContain('/mcp-card-set-preview?token=');
    expect(mcpTools).toContain('Do not call a Set visually finished from field diagnostics alone');
  });

  it('reports native image bindings and composition warnings to the Template agent', () => {
    expect(mcpTools).toContain('const compositionDiagnostics');
    expect(mcpTools).toContain('assetBindings');
    expect(mcpTools).toContain('imageElements');
    expect(mcpTools).toContain('borderedTextElementIds');
    expect(mcpTools).toContain('targetElementIds');
    expect(mcpTools).toContain('composition: compositionDiagnostics(document)');
    expect(mcpTools).toContain('Asset ${asset.id} is selected but image element ${targetId} still has ${target.sourceState} artwork.');
  });

  it('exposes exact-contract revision-safe card maintenance and editable cloud Set tools', () => {
    expect(mcpTools).toContain("'get_card_generation_contract'");
    expect(mcpTools).toContain("'upsert_card_set'");
    expect(mcpTools).toContain("'upsert_card'");
    expect(mcpTools).toContain("'upsert_cards'");
    expect(mcpTools).toContain("'delete_cards'");
    expect(mcpTools).toContain("'move_cards'");
    expect(mcpTools).toContain("'delete_card_set'");
    expect(mcpTools).toContain("'checkout_cloud_set'");
    expect(mcpTools).toContain("'commit_cloud_set'");
    expect(mcpTools).toContain("'delete_cloud_set'");
    expect(mcpTools).toContain('writeMode revise');
    expect(mcpTools).not.toContain("'attach_card_artwork'");
  });

  it('teaches the agent cloud collaboration, stable revision ids, and visual verification', () => {
    expect(cardSkill).toContain('`checkout_cloud_set`');
    expect(cardSkill).toContain('`commit_cloud_set`');
    expect(cardSkill).toContain('`writeMode: revise`');
    expect(cardSkill).toContain('native CardForge-rendered representative cards');
    expect(cardSkill).toContain('Never tell the user a revision is visible locally without that evidence.');
  });

  it('teaches frame-first composition and exact main-art binding in the Template skill', () => {
    expect(pluginSkill).toContain('## Core composition rule');
    expect(pluginSkill).toContain('do **not** add another decorative border');
    expect(pluginSkill).toContain('`binding: element.image`');
    expect(pluginSkill).toContain('call `preview_template_draft`');
    expect(pluginSkill).toContain('same normal personal local Template');
  });

  it('keeps generated image bytes out of model-facing Template preview results and constrains widgets', () => {
    expect(mcpTools).toContain("'attach_template_artwork'");
    expect(mcpTools).toContain("'preview_template_draft'");
    expect(mcpTools).toContain('createStudioDocumentPreviewToken');
    expect(mcpTools).not.toContain('structuredContent: { template');
    expect(mcpTools).toContain('remainingAssetRequirementIds');
    expect(mcpTools).toContain('productionReady');
    expect(mcpTools).toContain("'openai/outputTemplate'");
    expect(mcpTools).toContain("'openai/widgetDomain': publicOrigin");
    expect(mcpTools).toContain('domain: publicOrigin');
    expect(mcpTools).toContain('connectDomains: []');
    expect(mcpTools).toContain('resourceDomains: []');
    expect(mcpTools).toContain('frameDomains: [publicOrigin]');
  });
});
