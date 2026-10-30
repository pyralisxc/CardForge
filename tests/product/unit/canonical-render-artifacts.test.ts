import { describe, expect, it } from 'vitest';

import {
  createStudioRenderArtifactDescriptor,
  type RenderArtifactDescriptor,
} from '@/features/render-artifacts/model';
import { getRenderArtifactId } from '@/features/render-artifacts/server';

describe('canonical CardForge render artifacts', () => {
  it.each(['2026-08-23.1', '2026-10-17.1', '2026-10-18.1'])('does not reuse pixels from renderer %s before texture, vector, or authored-font corrections', (rendererVersion) => {
    const current = createStudioRenderArtifactDescriptor({
      sourceId: 'a5135947-2a6a-43a8-98bc-bfcbe4b8b8b7',
      sourceRevision: 32,
      kind: 'template-preview',
      subjectId: 'rectangular-finite-texture',
      face: 'front',
      profile: 'virtual-150',
    });
    const previous = { ...current, rendererVersion };

    expect(getRenderArtifactId(current)).not.toBe(getRenderArtifactId(previous));
  });

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
