import { describe, expect, it } from 'vitest';

import {
  createCreatorInteractionSession,
  focusCreatorArtifact,
  focusCreatorSet,
  openCreatorTool,
  selectCreatorArtifacts,
  setCreatorCamera,
} from '@/features/app-shell/client/environment';
import {
  createCreatorHistoryState,
  createCreatorHref,
  createCreatorInitialSession,
  createCreatorTool,
  readCreatorHistorySnapshot,
  type CreatorHistorySnapshot,
} from '@/features/desk/model/creatorHistory';

describe('Home creator history', () => {
  it('hydrates an Artifact deep link into the focused Set interaction session', () => {
    expect(createCreatorInitialSession('set:set-1', 'card-2')).toMatchObject({
      focusPath: { setId: 'set-1', artifactId: 'card-2' },
      selection: ['card-2'],
    });
    expect(createCreatorInitialSession('working-draft:one', 'card-2')).toMatchObject({
      focusPath: { setId: null, artifactId: null },
      selection: [],
    });
  });

  it('round-trips the complete Set and tool context through a serializable history entry', () => {
    let session = focusCreatorSet(createCreatorInteractionSession(), 'set-1');
    session = selectCreatorArtifacts(session, ['card-1', 'card-2']);
    session = focusCreatorArtifact(session, 'card-1');
    session = setCreatorCamera(session, { x: 120, y: -40, zoom: 1.5 });
    session = openCreatorTool(session, createCreatorTool('set-1', 'design'));
    const snapshot: CreatorHistorySnapshot = {
      version: 1,
      focusedWorkId: 'set:set-1',
      inspectorWorkId: null,
      session,
    };

    const state = createCreatorHistoryState({ nextInternal: true }, snapshot);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    expect(readCreatorHistorySnapshot(state)).toEqual(snapshot);
    expect(createCreatorHref(snapshot)).toBe('/account?focus=set%3Aset-1&artifact=card-1&tool=design');
    expect(state).toMatchObject({ nextInternal: true });
  });

  it('rejects malformed browser state instead of inventing an empty creator context', () => {
    expect(readCreatorHistorySnapshot({ cardforgeCreatorContext: { version: 1, session: {} } })).toBeNull();
  });
});
