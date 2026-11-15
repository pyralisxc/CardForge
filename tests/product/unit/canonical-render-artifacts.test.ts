import { describe, expect, it } from 'vitest';

import {
  createStudioRenderArtifactDescriptor,
  type RenderArtifactDescriptor,
} from '@/features/render-artifacts/model';
import { getRenderArtifactId } from '@/features/render-artifacts/server';

describe('canonical CardForge render artifacts', () => {
  it('binds cached pixels to every source and rendering input', () => {
    const base = createStudioRenderArtifactDescriptor({
      sourceId: 'a5135947-2a6a-43a8-98bc-bfcbe4b8b8b7',
      sourceRevision: 32,
      kind: 'card-preview',
      subjectId: 'cof-basic-rock',
      face: 'front',
      profile: 'virtual-150',
    });
    const variants = [
      { ...base, sourceKind: 'pipeline-revision' },
      { ...base, sourceId: '17fd3b36-9098-4fe0-8b96-abbb6b8dd89e' },
      { ...base, sourceRevision: 33 },
      { ...base, kind: 'template-preview' },
      { ...base, subjectId: 'another-card' },
      { ...base, face: 'back' },
      { ...base, profile: 'print-300' },
      { ...base, rendererVersion: `${base.rendererVersion}-next` },
    ] satisfies RenderArtifactDescriptor[];
    for (const variant of variants) expect(getRenderArtifactId(variant)).not.toBe(getRenderArtifactId(base));
  });
});
