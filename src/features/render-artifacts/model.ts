export const CARDFORGE_RENDERER_CONTRACT_VERSION = '2026-08-23.1';
export const CARDFORGE_RENDER_ARTIFACT_BUCKET = 'cardforge-render-artifacts';
export const MAX_RENDER_ARTIFACT_BYTES = 16 * 1024 * 1024;

export type RenderArtifactKind = 'template-preview' | 'card-preview' | 'set-contact-sheet';
export type RenderArtifactFace = 'front' | 'back' | 'none';

export interface RenderArtifactDescriptor {
  sourceKind: 'studio-document';
  sourceId: string;
  sourceRevision: number;
  kind: RenderArtifactKind;
  subjectId: string;
  face: RenderArtifactFace;
  profile: string;
  rendererVersion: string;
}

export interface RenderArtifactMetadata extends RenderArtifactDescriptor {
  artifactId: string;
  mimeType: 'image/png';
  byteLength: number;
  cacheHit: boolean;
}

export interface RenderArtifact extends RenderArtifactMetadata {
  bytes: Buffer;
}

export const createStudioRenderArtifactDescriptor = (
  input: Omit<RenderArtifactDescriptor, 'sourceKind' | 'rendererVersion'>,
): RenderArtifactDescriptor => ({
  ...input,
  sourceKind: 'studio-document',
  rendererVersion: CARDFORGE_RENDERER_CONTRACT_VERSION,
});

export const renderArtifactMetadata = (artifact: RenderArtifact): RenderArtifactMetadata => ({
  sourceKind: artifact.sourceKind,
  sourceId: artifact.sourceId,
  sourceRevision: artifact.sourceRevision,
  kind: artifact.kind,
  subjectId: artifact.subjectId,
  face: artifact.face,
  profile: artifact.profile,
  rendererVersion: artifact.rendererVersion,
  artifactId: artifact.artifactId,
  mimeType: artifact.mimeType,
  byteLength: artifact.byteLength,
  cacheHit: artifact.cacheHit,
});
