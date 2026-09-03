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
  preserveCreatorLaunchIntent,
  readCreatorHistorySnapshot,
  type CreatorHistorySnapshot,
} from '@/features/desk/model/creatorHistory';

describe('Desk creator history', () => {
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

  it('preserves pending MCP and Template launch intents while Desk history initializes', () => {
    expect(preserveCreatorLaunchIntent(
      '/account?focus=set%3Aset-1&tool=design',
      '/account?tool=design&document=document-1&revision=5&returnTo=%2Faccount%3Fsection%3Dlibrary',
    )).toBe('/account?focus=set%3Aset-1&tool=design&document=document-1&revision=5&returnTo=%2Faccount%3Fsection%3Dlibrary');

    expect(preserveCreatorLaunchIntent(
      '/account?tool=design',
      '/account?tool=design&editTemplate=template-1',
    )).toBe('/account?tool=design&editTemplate=template-1');
  });
});
