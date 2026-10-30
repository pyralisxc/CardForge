import sharp from 'sharp';

import {
  renderArtifactMetadata,
  type RenderArtifact,
} from '@/features/render-artifacts/server';

import { StudioDocumentStoreError } from './StudioDocumentStoreError';

// A whole tool result, not a per-image allowance. Leave ample room below the
// host's 4.5 MB response cap for the MCP/JSON-RPC or streaming envelope.
export const MAX_MCP_PREVIEW_RESULT_BYTES = 3_750_000;
const DISPLAY_METADATA_RESERVE_BYTES = 16_384;
const DISPLAY_NOTICE = 'Native images are bounded displays of the canonical PNG artifacts. displayImages identifies unchanged canonical bytes or reduced displays that are not byte-identical to the full artifacts. Canonical artifact metadata and the exact-revision CardForge link remain unchanged.';

type DisplayImage = {
  artifactId: string;
  representation: 'canonical' | 'reduced';
  mimeType: 'image/png';
  byteLength: number;
  width: number;
  height: number;
};
type ImageContent = { type: 'image'; data: string; mimeType: 'image/png' };
type TextContent = { type: 'text'; text: string };

const resultBytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value), 'utf8');
const base64Length = (byteLength: number) => 4 * Math.ceil(byteLength / 3);
const budgetError = () => new StudioDocumentStoreError(
  'This preview exceeds the MCP response budget. Request fewer selected cards or open this exact revision in Studio. Stored canonical artifacts and authored work are unchanged.',
  413,
);

// Keep small exact images when possible, then fairly divide the remaining
// aggregate base64 budget. The allocation is stable in the requested order.
const allocateDisplayBudgets = (sizes: number[], budget: number): number[] => {
  const allocations = sizes.map(() => 0);
  let pending = sizes.map((_, index) => index);
  while (pending.length > 0) {
    const share = Math.floor(budget / pending.length);
    if (share < 4) throw budgetError();
    const exact = pending.filter((index) => sizes[index]! <= share);
    if (exact.length === 0) {
      for (const index of pending) allocations[index] = share;
      break;
    }
    for (const index of exact) {
      allocations[index] = sizes[index]!;
      budget -= sizes[index]!;
    }
    pending = pending.filter((index) => !exact.includes(index));
  }
  return allocations;
};

const displayArtifact = async (artifact: RenderArtifact, base64Budget: number) => {
  try {
    const image = sharp(artifact.bytes, { failOn: 'warning' });
    const metadata = await image.metadata();
    if (metadata.format !== 'png' || !metadata.width || !metadata.height) throw new Error('Expected a canonical PNG.');
    if (base64Length(artifact.bytes.length) <= base64Budget) {
      // Metadata alone does not detect a truncated PNG. Validate decoding while
      // retaining the original bytes rather than needlessly transcoding them.
      await image.stats();
      return { bytes: artifact.bytes, width: metadata.width, height: metadata.height, representation: 'canonical' as const };
    }
    const originalEdge = Math.max(metadata.width, metadata.height);
    const byteBudget = Math.floor(base64Budget / 4) * 3;
    let edge = Math.max(1, Math.floor(originalEdge * Math.min(0.9, Math.sqrt(byteBudget / artifact.bytes.length) * 0.9)));
    while (true) {
      const { data, info } = await image.clone()
        .resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true })
        .png({ compressionLevel: 9, adaptiveFiltering: true })
        .toBuffer({ resolveWithObject: true });
      if (base64Length(data.length) <= base64Budget) {
        return { bytes: data, width: info.width, height: info.height, representation: 'reduced' as const };
      }
      if (edge === 1) break;
      // Always retry from canonical pixels, never from a previously reduced image.
      edge = Math.max(1, Math.floor(edge * 0.75));
    }
  } catch {
    throw new StudioDocumentStoreError(
      'The canonical preview PNG could not be decoded or reduced for MCP display. Stored canonical artifacts and authored work are unchanged; retry the preview or inspect this revision in Studio.',
      500,
    );
  }
  throw budgetError();
};

export const createRenderArtifactPreviewResult = async <T extends Record<string, unknown>>({
  artifacts,
  text,
  structuredContent,
}: {
  artifacts: RenderArtifact[];
  text: string;
  structuredContent: T;
}) => {
  const content: Array<TextContent | ImageContent> = [{ type: 'text', text: `${text} ${DISPLAY_NOTICE}` }];
  const displayImages: DisplayImage[] = [];
  const result = { content, structuredContent: { ...structuredContent, displayImages } };
  const available = MAX_MCP_PREVIEW_RESULT_BYTES - resultBytes(result) - DISPLAY_METADATA_RESERVE_BYTES;
  if (available < 0) throw budgetError();
  const allocations = allocateDisplayBudgets(artifacts.map((artifact) => base64Length(artifact.bytes.length)), available);
  for (const [index, artifact] of artifacts.entries()) {
    const display = await displayArtifact(artifact, allocations[index]!);
    content.push({ type: 'image', data: display.bytes.toString('base64'), mimeType: 'image/png' });
    displayImages.push({
      artifactId: artifact.artifactId,
      representation: display.representation,
      mimeType: 'image/png',
      byteLength: display.bytes.length,
      width: display.width,
      height: display.height,
    });
  }
  // Include all text, structured metadata, JSON punctuation and base64 expansion.
  // Never send a result over budget, including unusually large diagnostics/ids.
  if (resultBytes(result) > MAX_MCP_PREVIEW_RESULT_BYTES) throw budgetError();
  return result;
};

export const renderArtifactStructuredContent = (artifact: RenderArtifact) => (
  renderArtifactMetadata(artifact)
);
