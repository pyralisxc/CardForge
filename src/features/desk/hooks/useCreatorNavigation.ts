"use client";

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  closeCreatorContext,
  createCreatorInteractionSession,
  focusCreatorArtifact,
  focusCreatorSet,
  openCreatorTool,
  setCreatorToolDirty,
  selectCreatorDeskSets,
  type CreatorInteractionSession,
} from '@/features/app-shell/client/environment';

import {
  createCreatorHistoryState,
  createCreatorHref,
  createCreatorInitialSession,
  createCreatorTool,
  preserveCreatorLaunchIntent,
  readCreatorHistorySnapshot,
  type DeskContextualToolId,
  type CreatorHistorySnapshot,
} from '../model/creatorHistory';

interface CreatorNavigationOptions {
  initialFocusedWorkId?: string | null;
  initialFocusedArtifactId?: string | null;
}

export function useCreatorNavigation({ initialFocusedWorkId, initialFocusedArtifactId }: CreatorNavigationOptions) {
  const [focusedWorkId, setFocusedWorkId] = useState<string | null>(initialFocusedWorkId ?? null);
  const [inspectorWorkId, setInspectorWorkId] = useState<string | null>(null);
  const [interactionSession, setInteractionSession] = useState<CreatorInteractionSession>(() => (
    createCreatorInitialSession(initialFocusedWorkId, initialFocusedArtifactId)
  ));
  const [dirtyCloseRequested, setDirtyCloseRequested] = useState(false);
  const initializedRef = useRef(false);
  const bypassDirtyCloseRef = useRef(false);
  const pendingPopSnapshotRef = useRef<CreatorHistorySnapshot | null>(null);
  const currentRef = useRef<CreatorHistorySnapshot>({
    version: 1,
    focusedWorkId: initialFocusedWorkId ?? null,
    inspectorWorkId: null,
    session: interactionSession,
  });
  currentRef.current = { version: 1, focusedWorkId, inspectorWorkId, session: interactionSession };

  const applySnapshot = useCallback((snapshot: CreatorHistorySnapshot) => {
    setFocusedWorkId(snapshot.focusedWorkId);
    setInspectorWorkId(snapshot.inspectorWorkId);
    setInteractionSession(snapshot.session);
  }, []);

  const replaceSnapshot = useCallback((snapshot: CreatorHistorySnapshot) => {
    if (typeof window === 'undefined') return;
    window.history.replaceState(
      createCreatorHistoryState(window.history.state, snapshot),
      '',
      preserveCreatorLaunchIntent(createCreatorHref(snapshot), window.location.href),
    );
  }, []);

  const pushSnapshot = useCallback((snapshot: CreatorHistorySnapshot) => {
    if (typeof window === 'undefined') return;
    window.history.pushState(
      createCreatorHistoryState(window.history.state, snapshot),
      '',
      preserveCreatorLaunchIntent(createCreatorHref(snapshot), window.location.href),
    );
  }, []);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    const initial = currentRef.current;
    const restored = readCreatorHistorySnapshot(window.history.state);
    const currentHref = `${window.location.pathname}${window.location.search}`;
    if (
      restored
      && preserveCreatorLaunchIntent(createCreatorHref(restored), currentHref) === currentHref
    ) {
      applySnapshot(restored);
      replaceSnapshot(restored);
      return;
    }
    if (initial.focusedWorkId) {
      const desk: CreatorHistorySnapshot = {
        version: 1,
        focusedWorkId: null,
        inspectorWorkId: null,
        session: createCreatorInteractionSession(),
      };
      replaceSnapshot(desk);
      if (initial.session.focusPath.artifactId) {
        pushSnapshot({
          ...initial,
          session: createCreatorInitialSession(initial.focusedWorkId),
        });
      }
      pushSnapshot(initial);
      return;
    }
    replaceSnapshot(initial);
  }, [applySnapshot, pushSnapshot, replaceSnapshot]);

  useEffect(() => {
    if (!initializedRef.current) return;
    replaceSnapshot(currentRef.current);
  }, [focusedWorkId, inspectorWorkId, interactionSession, replaceSnapshot]);

  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      const current = currentRef.current;
      const activeTool = current.session.toolStack.at(-1);
      if (activeTool?.dirty && !bypassDirtyCloseRef.current) {
        pushSnapshot(current);
        setDirtyCloseRequested(true);
        return;
      }
      bypassDirtyCloseRef.current = false;
      const pending = pendingPopSnapshotRef.current;
      pendingPopSnapshotRef.current = null;
      const target = pending ?? readCreatorHistorySnapshot(event.state);
      if (target) {
        applySnapshot(target);
        if (pending) replaceSnapshot(target);
        return;
      }
      const closed = closeCreatorContext(current.session);
      applySnapshot({
        ...current,
        focusedWorkId: closed.closed === 'set-focus' ? null : current.focusedWorkId,
        inspectorWorkId: closed.closed === 'inspection' ? null : current.inspectorWorkId,
        session: closed.session,
      });
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [applySnapshot, pushSnapshot, replaceSnapshot]);

  const requestHistoryBack = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (readCreatorHistorySnapshot(window.history.state)) {
      window.history.back();
      return;
    }
    const current = currentRef.current;
    const closed = closeCreatorContext(current.session);
    const next = {
      ...current,
      focusedWorkId: closed.closed === 'set-focus' ? null : current.focusedWorkId,
      inspectorWorkId: closed.closed === 'inspection' ? null : current.inspectorWorkId,
      session: closed.session,
    };
    applySnapshot(next);
    replaceSnapshot(next);
  }, [applySnapshot, replaceSnapshot]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const session = currentRef.current.session;
      if (event.key !== 'Escape' || session.toolStack.length > 0 || !session.focusPath.setId) return;
      if (
        event.defaultPrevented
        || Array.from(document.querySelectorAll<HTMLElement>('[data-radix-popper-content-wrapper], [role="listbox"], [role="menu"]'))
          .some((element) => element.getClientRects().length > 0)
      ) return;
      event.preventDefault();
      requestHistoryBack();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [requestHistoryBack]);

  const focusWorkContext = useCallback((workId: string, setId: string | null) => {
    const current = currentRef.current;
    const deskSession = current.session.deskSelection.includes(workId)
      ? current.session
      : selectCreatorDeskSets(current.session, [workId], workId);
    const next: CreatorHistorySnapshot = {
      version: 1,
      focusedWorkId: workId,
      inspectorWorkId: null,
      session: setId ? focusCreatorSet(deskSession, setId) : createCreatorInteractionSession(),
    };
    replaceSnapshot(current);
    pushSnapshot(next);
    applySnapshot(next);
  }, [applySnapshot, pushSnapshot, replaceSnapshot]);

  const focusArtifactContext = useCallback((nextSession: CreatorInteractionSession) => {
    const current = currentRef.current;
    const artifactId = nextSession.focusPath.artifactId;
    if (!artifactId || !current.session.focusPath.setId || nextSession.focusPath.setId !== current.session.focusPath.setId) return;
    const next: CreatorHistorySnapshot = {
      ...current,
      inspectorWorkId: null,
      session: focusCreatorArtifact(nextSession, artifactId),
    };
    replaceSnapshot(current);
    pushSnapshot(next);
    applySnapshot(next);
  }, [applySnapshot, pushSnapshot, replaceSnapshot]);

  const restoreFocusedContext = useCallback((snapshot: Omit<CreatorHistorySnapshot, 'version'>) => {
    const next = { ...snapshot, version: 1 as const };
    if (currentRef.current.focusedWorkId === next.focusedWorkId && currentRef.current.session.toolStack.length === 0) {
      replaceSnapshot(next);
    } else {
      replaceSnapshot(currentRef.current);
      pushSnapshot(next);
    }
    applySnapshot(next);
  }, [applySnapshot, pushSnapshot, replaceSnapshot]);

  const openContextTool = useCallback((setId: string, toolId: DeskContextualToolId) => {
    const current = currentRef.current;
    let focused = current;
    if (current.focusedWorkId !== `set:${setId}` || current.session.focusPath.setId !== setId) {
      focused = {
        version: 1,
        focusedWorkId: `set:${setId}`,
        inspectorWorkId: null,
        session: focusCreatorSet(current.session, setId),
      };
      replaceSnapshot(current);
      pushSnapshot(focused);
    }
    const next = {
      ...focused,
      inspectorWorkId: null,
      session: openCreatorTool(focused.session, createCreatorTool(setId, toolId)),
    };
    pushSnapshot(next);
    applySnapshot(next);
  }, [applySnapshot, pushSnapshot, replaceSnapshot]);

  const closeContextTool = useCallback((nextSession?: CreatorInteractionSession) => {
    const current = currentRef.current;
    const activeTool = current.session.toolStack.at(-1);
    if (activeTool?.dirty) {
      setDirtyCloseRequested(true);
      return;
    }
    if (nextSession) {
      pendingPopSnapshotRef.current = { ...current, session: nextSession };
    }
    requestHistoryBack();
  }, [requestHistoryBack]);

  const confirmDirtyClose = useCallback(() => {
    bypassDirtyCloseRef.current = true;
    setDirtyCloseRequested(false);
    requestHistoryBack();
  }, [requestHistoryBack]);

  const setActiveToolDirty = useCallback((dirty: boolean) => {
    setInteractionSession((current) => {
      const activeTool = current.toolStack.at(-1);
      return activeTool ? setCreatorToolDirty(current, activeTool.instanceId, dirty) : current;
    });
  }, []);

  const resetToDesk = useCallback(() => {
    const next: CreatorHistorySnapshot = {
      version: 1,
      focusedWorkId: null,
      inspectorWorkId: null,
      session: createCreatorInteractionSession(),
    };
    applySnapshot(next);
    replaceSnapshot(next);
  }, [applySnapshot, replaceSnapshot]);

  return {
    closeContextTool,
    confirmDirtyClose,
    dirtyCloseRequested,
    focusArtifactContext,
    focusWorkContext,
    focusedWorkId,
    inspectorWorkId,
    interactionSession,
    openContextTool,
    requestHistoryBack,
    resetToDesk,
    restoreFocusedContext,
    setActiveToolDirty,
    setDirtyCloseRequested,
    setInspectorWorkId,
    setInteractionSession,
  };
}
