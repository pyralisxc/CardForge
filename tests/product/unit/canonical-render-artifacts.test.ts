import { describe, expect, it } from 'vitest';

import {
  createStudioRenderArtifactDescriptor,
  type RenderArtifactDescriptor,
} from '@/features/render-artifacts/model';
import { getRenderArtifactId } from '@/features/render-artifacts/server';

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
});
