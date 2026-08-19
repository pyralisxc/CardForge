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

describe('agent Template install and chat preview architecture', () => {
  const handoff = readSource('src/features/studio-documents/hooks/useStudioDocumentHandoff.ts');
  const preview = readSource('src/features/studio-documents/components/TemplateDraftPreviewClient.tsx');
  const mcpTools = readSource('src/features/studio-documents/server/mcpAgentTemplateTools.ts');

  it('installs and revises one personal local Template without clearing the workspace', () => {
    const gptBranch = handoff.slice(
      handoff.indexOf("payload.document?.creationSource === 'gpt'"),
      handoff.indexOf('// Non-agent Studio documents retain project-open semantics.'),
    );
    expect(gptBranch).toContain('mergeProjectAssetListToStorage');
    expect(gptBranch).toContain('mergeUserTemplates([templateToInstall])');
    expect(gptBranch).toContain("templateLibrarySource: 'personal'");
    expect(gptBranch).toContain("title: existingTemplate ? 'Agent Template updated' : 'Agent Template installed'");
    expect(gptBranch).not.toContain('(Agent copy)');
    expect(gptBranch).not.toContain('nanoid');
    expect(gptBranch).not.toContain('useProjectStore.setState({');
    expect(gptBranch).not.toContain('mergeStoredCards(');
  });

  it('pins Studio installation to the exact previewed agent revision', () => {
    expect(handoff).toContain("parseRequestedRevision(url.searchParams.get('revision'))");
    expect(handoff).toContain('actualRevision !== requestedRevision');
    expect(mcpTools).toContain('&revision=${document.revision}');
  });

  it('uses the canonical CardPreview renderer and keeps PNG review available', () => {
    expect(preview).toContain("import { CardPreview } from '@/features/card-rendering/client'");
    expect(preview).toContain('<CardPreview');
    expect(preview).toContain('toPng(cardRef.current');
    expect(preview).toContain('/api/studio-document-preview?token=');
  });

  it('keeps generated image bytes out of preview results and reports production completeness', () => {
    expect(mcpTools).toContain("'attach_template_artwork'");
    expect(mcpTools).toContain("'preview_template_draft'");
    expect(mcpTools).toContain('createStudioDocumentPreviewToken');
    expect(mcpTools).not.toContain('structuredContent: { template');
    expect(mcpTools).toContain('remainingAssetRequirementIds');
    expect(mcpTools).toContain('productionReady');
    expect(mcpTools).toContain("'openai/outputTemplate'");
    expect(mcpTools).toContain("'openai/widgetDomain': publicOrigin");
    expect(mcpTools).toContain('frameDomains: [publicOrigin]');
  });
});
