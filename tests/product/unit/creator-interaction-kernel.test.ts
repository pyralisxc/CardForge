import { describe, expect, it } from 'vitest';

import {
  closeCreatorContext,
  createCreatorInteractionSession,
  focusCreatorArtifact,
  focusCreatorSet,
  inspectCreatorArtifact,
  openCreatorTool,
  selectCreatorArtifacts,
  selectCreatorDeskSets,
  setCreatorToolDirty,
} from '@/features/app-shell/client/environment';

describe('creator interaction kernel', () => {
  it('owns focus, selection, inspection, camera, lens, and tools without ambiguity', () => {
    let session = createCreatorInteractionSession();
    session = focusCreatorSet(session, 'set-1');
    session = selectCreatorArtifacts(session, ['card-1', 'card-2']);
    session = focusCreatorArtifact(session, 'card-1');
    session = inspectCreatorArtifact(session, 'card-2');
    session = openCreatorTool(session, {
      instanceId: 'design-card-1',
      toolId: 'design',
      ownerFeature: 'template-editor',
      presentation: 'floating',
      targetIds: ['card-1'],
      dirty: false,
    });

    expect(session.focusPath).toEqual({ setId: 'set-1', artifactId: 'card-1' });
    expect(session.selection).toEqual(['card-1', 'card-2']);
    expect(session.inspectionTargetId).toBe('card-2');
    expect(session.toolStack).toHaveLength(1);
    session = setCreatorToolDirty(session, 'design-card-1', true);
    expect(session.toolStack[0]?.dirty).toBe(true);
  });

  it('unwinds tool, inspection, Artifact focus, then Set focus', () => {
    let session = createCreatorInteractionSession();
    session = focusCreatorSet(session, 'set-1');
    session = focusCreatorArtifact(session, 'card-1');
    session = inspectCreatorArtifact(session, 'card-2');
    session = openCreatorTool(session, {
      instanceId: 'generate-set-1',
      toolId: 'generate',
      ownerFeature: 'card-generator',
      presentation: 'sheet',
      targetIds: ['set-1'],
      dirty: false,
    });

    let result = closeCreatorContext(session);
    expect(result.closed).toBe('tool');
    result = closeCreatorContext(result.session);
    expect(result.closed).toBe('inspection');
    result = closeCreatorContext(result.session);
    expect(result.closed).toBe('artifact-focus');
    result = closeCreatorContext(result.session);
    expect(result.closed).toBe('set-focus');
  });

  it('keeps Desk Set selection separate from child Artifact selection', () => {
    let session = selectCreatorDeskSets(createCreatorInteractionSession(), ['set:one', 'set:two'], 'set:two');
    session = focusCreatorSet(session, 'one');
    session = selectCreatorArtifacts(session, ['card:one']);

    expect(session.deskSelection).toEqual(['set:one', 'set:two']);
    expect(session.selection).toEqual(['card:one']);

    const closed = closeCreatorContext(session);
    expect(closed.closed).toBe('set-focus');
    expect(closed.session.deskSelection).toEqual(['set:one', 'set:two']);
    expect(closed.session.deskSelectionAnchorId).toBe('set:two');
    expect(closed.session.selection).toEqual([]);
  });
});
