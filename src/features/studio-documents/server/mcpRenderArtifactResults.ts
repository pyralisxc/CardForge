import {
  renderArtifactMetadata,
  type RenderArtifact,
} from '@/features/render-artifacts/model';

export const renderArtifactImageContent = (artifact: RenderArtifact) => ({
  type: 'image' as const,
  data: artifact.bytes.toString('base64'),
  mimeType: artifact.mimeType,
});

export const renderArtifactStructuredContent = (artifact: RenderArtifact) => (
  renderArtifactMetadata(artifact)
);
