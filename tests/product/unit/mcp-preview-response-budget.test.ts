import { createHash } from 'node:crypto';

import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { templatePreviewOutputSchema, cardSetPreviewOutputSchema } from '@/features/studio-documents/server/mcpToolOutputSchemas';
import { selectiveCardPreviewOutputSchema } from '@/features/studio-documents/server/mcpWorkingDocumentOutputSchemas';
import { createStudioRenderArtifactDescriptor, MAX_RENDER_ARTIFACT_BYTES, type RenderArtifact } from '@/features/render-artifacts/model';
import {
  createRenderArtifactPreviewResult,
  MAX_MCP_PREVIEW_RESULT_BYTES,
  renderArtifactStructuredContent,
} from '@/features/studio-documents/server/mcpRenderArtifactResults';

const artifact = (bytes: Buffer, id = 'reference'): RenderArtifact => ({
  ...createStudioRenderArtifactDescriptor({
    sourceId: 'private-document', sourceRevision: 32, kind: 'template-preview',
    subjectId: id, face: 'front', profile: 'virtual-150',
  }),
  artifactId: id, mimeType: 'image/png', bytes, byteLength: bytes.length, cacheHit: true,
});
const png = async (width: number, height: number, channels: 3 | 4 = 3) => {
  const bytes = Buffer.alloc(width * height * channels);
  let seed = 12345;
  for (let i = 0; i < bytes.length; i++) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    bytes[i] = seed & 255;
  }
  return sharp(bytes, { raw: { width, height, channels } }).png({ compressionLevel: 0 }).toBuffer();
};
const resultFor = (artifacts: RenderArtifact[], extra: Record<string, unknown> = {}) => createRenderArtifactPreviewResult({
  artifacts,
  text: 'Canonical rendering succeeded at revision 32.',
  structuredContent: {
    renderArtifacts: artifacts.map(renderArtifactStructuredContent),
    openInStudioUrl: 'https://example.test/studio?document=private-document&revision=32',
    ...extra,
  },
});
const images = (result: Awaited<ReturnType<typeof resultFor>>) => result.content.filter((entry) => entry.type === 'image');
const size = (result: unknown) => Buffer.byteLength(JSON.stringify(result));
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

describe('bounded native MCP display responses', () => {
  it('bounds the observed 14 MB canonical-PNG failure shape without changing the artifact identity or bytes', async () => {
    const bytes = await png(1938, 2508);
    expect(bytes.length).toBeGreaterThan(13_939_374);
    expect(bytes.length).toBeLessThan(MAX_RENDER_ARTIFACT_BYTES);
    const canonical = artifact(bytes);
    const before = { metadata: renderArtifactStructuredContent(canonical), hash: digest(bytes) };
    expect(size({ content: [{ type: 'image', data: bytes.toString('base64'), mimeType: 'image/png' }] })).toBeGreaterThan(18_000_000);

    const result = await resultFor([canonical]);
    expect(size(result)).toBeLessThanOrEqual(MAX_MCP_PREVIEW_RESULT_BYTES);
    expect(images(result)).toHaveLength(1);
    expect(result.structuredContent.renderArtifacts).toEqual([before.metadata]);
    expect(digest(canonical.bytes)).toBe(before.hash);
    expect(result.structuredContent.openInStudioUrl).toContain('revision=32');
    expect(result.structuredContent.displayImages[0]).toMatchObject({ artifactId: canonical.artifactId, representation: 'reduced', mimeType: 'image/png' });
    expect(result.content[0]).toMatchObject({ type: 'text', text: expect.stringContaining('not byte-identical') });
  });

  it('shares one aggregate JSON/base64 budget across all 12 selected cards', async () => {
    const bytes = await png(500, 700, 4);
    const artifacts = Array.from({ length: 12 }, (_, index) => artifact(bytes, `card-${index}`));
    const result = await resultFor(artifacts, { diagnostics: 'x'.repeat(100_000) });
    expect(images(result)).toHaveLength(12);
    expect(result.structuredContent.displayImages.map((image) => image.artifactId)).toEqual(artifacts.map((image) => image.artifactId));
    expect(result.structuredContent.displayImages.every((image) => image.representation === 'reduced')).toBe(true);
    expect(size(result)).toBeLessThanOrEqual(MAX_MCP_PREVIEW_RESULT_BYTES);
  });

  it('leaves small PNG bytes exactly unchanged whenever their aggregate result fits', async () => {
    const bytes = await png(800, 1000);
    const small = await png(10, 20, 4);
    const result = await resultFor([artifact(bytes), artifact(small, 'small')]);
    expect(images(result).map((image) => Buffer.from(image.data, 'base64'))).toEqual([bytes, small]);
    expect(result.structuredContent.displayImages.map((image) => image.representation)).toEqual(['canonical', 'canonical']);
    expect(result.structuredContent.displayImages[0]).toMatchObject({ width: 800, height: 1000, byteLength: bytes.length });
  });

  it('preserves full-frame aspect, visible content and transparency when reducing deterministically', async () => {
    const width = 1200;
    const height = 1800;
    const raw = Buffer.alloc(width * height * 4);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      raw[index] = y < height / 2 ? 240 : 20;
      raw[index + 2] = y < height / 2 ? 20 : 240;
      raw[index + 3] = x < width / 4 ? 0 : 255;
    }
    const bytes = await sharp(raw, { raw: { width, height, channels: 4 } }).png({ compressionLevel: 0 }).toBuffer();
    const first = await resultFor([artifact(bytes)]);
    const second = await resultFor([artifact(bytes)]);
    const display = images(first)[0]!;
    expect(display).toEqual(images(second)[0]);
    const resized = sharp(Buffer.from(display.data, 'base64'));
    const metadata = await resized.metadata();
    expect(metadata.width).toBeLessThan(width);
    expect(metadata.height).toBeLessThan(height);
    expect(Math.abs(metadata.width! / metadata.height! - width / height)).toBeLessThan(1 / metadata.height!);
    expect(metadata.hasAlpha).toBe(true);
    const stats = await resized.stats();
    expect(stats.channels[3]).toMatchObject({ min: 0, max: 255 });
    const { data, info } = await resized.raw().toBuffer({ resolveWithObject: true });
    const top = (Math.floor(info.height / 4) * info.width + Math.floor(info.width * 3 / 4)) * 4;
    const bottom = (Math.floor(info.height * 3 / 4) * info.width + Math.floor(info.width * 3 / 4)) * 4;
    expect(data[top]).toBeGreaterThan(200);
    expect(data[bottom + 2]).toBeGreaterThan(200);
  });

  it('rejects malformed or truncated PNG data without claiming display success', async () => {
    await expect(resultFor([artifact(Buffer.alloc(0))])).rejects.toMatchObject({ status: 500 });
    await expect(resultFor([artifact(Buffer.from('not a PNG'))])).rejects.toMatchObject({ status: 500 });
    const bytes = await png(20, 30);
    await expect(resultFor([artifact(bytes.subarray(0, 90))])).rejects.toMatchObject({ status: 500 });
  });

  it('fails explicitly when non-image metadata exhausts the budget, without changing canonical metadata', async () => {
    const canonical = artifact(await png(20, 30));
    const before = renderArtifactStructuredContent(canonical);
    await expect(resultFor([canonical], { oversized: 'x'.repeat(MAX_MCP_PREVIEW_RESULT_BYTES) })).rejects.toMatchObject({ status: 413 });
    expect(renderArtifactStructuredContent(canonical)).toEqual(before);
  });

  it('fails explicitly if even a 1-pixel display cannot fit the remaining aggregate budget', async () => {
    const canonical = artifact(await png(20, 30));
    const successful = await resultFor([canonical]);
    const base = { content: [successful.content[0]], structuredContent: { ...successful.structuredContent, displayImages: [], padding: '' } };
    const padding = MAX_MCP_PREVIEW_RESULT_BYTES - 16_384 - size(base) - 4;
    await expect(resultFor([canonical], { padding: 'x'.repeat(padding) })).rejects.toMatchObject({ status: 413 });
  });

  it('matches all three strict preview output contracts and rejects misleading display metadata', async () => {
    const canonical = artifact(await png(20, 30));
    const metadata = renderArtifactStructuredContent(canonical);
    const common = { documentId: 'private-document', revision: 32, openInStudioUrl: 'https://example.test/studio?document=private-document&revision=32' };
    const cases: Array<[unknown, Record<string, unknown>]> = [
      [templatePreviewOutputSchema, {
        title: 'Reference', revision: common.revision, openInStudioUrl: common.openInStudioUrl,
        renderArtifact: metadata, productionReady: false, assetSummary: null,
        remainingAssetRequirementIds: [], remainingAssetCount: 0, composition: { renderHealth: 'rendered' },
      }],
      [cardSetPreviewOutputSchema, {
        ...common, set: { id: 'set' }, cards: [], artwork: {}, cardCount: 0,
        renderArtifact: metadata, previewSampleCount: 1,
        installation: { currentRevisionApplied: false, lastInstalledRevision: null, lastInstalledAt: null },
        retrySafety: { setId: 'set' }, capabilityVersion: '1.0.2', workflowStage: 'card_set_reviewed', nextActions: [],
      }],
      [selectiveCardPreviewOutputSchema, {
        ...common, setId: 'set', cardIds: ['card'], renderArtifacts: [metadata], renderHealth: { status: 'rendered', renderedCardIds: ['card'] },
      }],
    ];
    for (const [schema, structuredContent] of cases) {
      const result = await createRenderArtifactPreviewResult({ artifacts: [canonical], text: 'Rendered.', structuredContent });
      const validate = (schema as { '~standard': { validate: (value: unknown) => PromiseLike<{ issues?: unknown[] }> } })['~standard'].validate;
      expect((await validate(result.structuredContent)).issues).toBeUndefined();
      expect((await validate({ ...result.structuredContent, displayImages: [{ ...result.structuredContent.displayImages[0], representation: 'full-resolution-copy' }] })).issues).toBeDefined();
      expect((await validate({ ...result.structuredContent, displayImages: [{ ...result.structuredContent.displayImages[0], width: 0 }] })).issues).toBeDefined();
    }
  });

  it('allows an empty Set response without inventing an image', async () => {
    const result = await resultFor([]);
    expect(images(result)).toEqual([]);
    expect(result.structuredContent.displayImages).toEqual([]);
    expect(size(result)).toBeLessThan(MAX_MCP_PREVIEW_RESULT_BYTES);
  });
});
