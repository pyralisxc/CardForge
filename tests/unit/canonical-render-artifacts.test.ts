import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  createStudioRenderArtifactDescriptor,
  type RenderArtifactDescriptor,
} from '@/features/render-artifacts/model';
import { getRenderArtifactId } from '@/features/render-artifacts/server';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('canonical CardForge render artifacts', () => {
  it('binds cached pixels to source revision, render profile, subject, and renderer contract', () => {
    const base = createStudioRenderArtifactDescriptor({
      sourceId: 'a5135947-2a6a-43a8-98bc-bfcbe4b8b8b7',
      sourceRevision: 32,
      kind: 'card-preview',
      subjectId: 'cof-basic-rock',
      face: 'front',
      profile: 'virtual-150',
    });
    const changedRevision = { ...base, sourceRevision: 33 } satisfies RenderArtifactDescriptor;
    const changedProfile = { ...base, profile: 'print-300' } satisfies RenderArtifactDescriptor;
    const changedRenderer = { ...base, rendererVersion: `${base.rendererVersion}-next` } satisfies RenderArtifactDescriptor;

    expect(getRenderArtifactId(base)).not.toBe(getRenderArtifactId(changedRevision));
    expect(getRenderArtifactId(base)).not.toBe(getRenderArtifactId(changedProfile));
    expect(getRenderArtifactId(base)).not.toBe(getRenderArtifactId(changedRenderer));
  });

  it('keeps Template interpretation in the canonical browser renderer and limits compositors to finished pixels', () => {
    const browserRenderer = readSource('src/features/render-artifacts/server/canonicalBrowserRenderer.ts');
    const contactSheet = readSource('src/features/render-artifacts/server/contactSheet.ts');
    const nativeExport = readSource('src/features/card-generator/lib/cardPreviewExport.tsx');

    expect(browserRenderer).toContain("url.pathname === '/mcp-template-preview'");
    expect(browserRenderer).toContain("url.pathname === '/mcp-card-set-preview'");
    expect(browserRenderer).toContain("import('@sparticuz/chromium')");
    expect(browserRenderer).toContain("import('puppeteer-core')");
    expect(browserRenderer).toContain('expectedCount > 12');
    expect(nativeExport).toContain('createCardFaceExportRenderer');
    expect(nativeExport).toContain('renderCardToPngBlob');
    expect(contactSheet).toContain('cards: Buffer[]');
    expect(contactSheet).toContain("import sharp from 'sharp'");
    expect(contactSheet).not.toContain('TCGCardTemplate');
    expect(contactSheet).not.toContain('CardPreview');
  });

  it('returns native MCP images without preview widgets or frame permissions', () => {
    const templateTools = readSource('src/features/studio-documents/server/mcpAgentTemplateToolsCore.ts');
    const cardTools = readSource('src/features/studio-documents/server/mcpAgentCardTools.ts');
    const resultHelpers = readSource('src/features/studio-documents/server/mcpRenderArtifactResults.ts');
    const combined = `${templateTools}\n${cardTools}`;

    expect(resultHelpers).toContain("type: 'image' as const");
    expect(resultHelpers).toContain("mimeType: artifact.mimeType");
    expect(combined).toContain('renderArtifactImageContent');
    expect(combined).not.toContain("'openai/outputTemplate'");
    expect(combined).not.toContain('frameDomains:');
    expect(combined).not.toContain('registerResource(');
  });

  it('bounds expensive cache misses and gives MCP enough execution time for the canonical browser', () => {
    const studioArtifacts = readSource('src/features/studio-documents/server/studioRenderArtifacts.ts');
    const route = readSource('src/app/mcp/route.ts');

    expect(route).toContain('export const maxDuration = 120;');
    expect(studioArtifacts).toContain("action: 'studio-ai-render'");
    expect(studioArtifacts).toContain('limit: 60');
    expect(studioArtifacts).toContain('windowSeconds: 3600');
    expect(studioArtifacts.indexOf('if (cached) return cached;')).toBeLessThan(
      studioArtifacts.indexOf('await consumeUncachedRenderBudget(ownerUserId);'),
    );
  });

  it('stores render derivatives privately and purges them with expired assistant work', () => {
    const migration = readSource('supabase/migrations/20260823041000_canonical_render_artifacts.sql');
    const purge = readSource('supabase/functions/purge-assistant-drafts/index.ts');
    const store = readSource('src/features/render-artifacts/server/renderArtifactStore.ts');

    expect(migration).toContain("'cardforge-render-artifacts'");
    expect(migration).toContain('public,');
    expect(migration).toContain('false,');
    expect(migration).toContain("array['image/png']::text[]");
    expect(store).toContain('upsert: false');
    expect(store).toContain("cacheControl: '31536000'");
    expect(purge).toContain('RENDER_ARTIFACT_BUCKET');
    expect(purge).toContain('await removePrefixObjects(RENDER_ARTIFACT_BUCKET, prefix);');
    expect(purge).toContain('.filter((object) => Boolean(object.name))');
  });

  it('teaches agents that render review and Studio installation are separate evidence', () => {
    const capabilities = readSource('src/features/studio-documents/server/mcpAccountWorkflowTools.ts');
    const submission = readSource('plugins/cardforge-studio/SUBMISSION.md');

    expect(capabilities).toContain('nativeRenderArtifacts: true');
    expect(capabilities).toContain("renderReviewMode: 'canonical CardForge PNGs returned directly in chat'");
    expect(capabilities).toContain('Preview tools never prove that a revision was installed in Studio');
    expect(submission).toContain('native MCP `image/png` content');
    expect(submission).toContain('requires no frame-domain or widget CSP permissions');
    expect(submission).not.toContain('preview UIs are model-only');
  });
});
