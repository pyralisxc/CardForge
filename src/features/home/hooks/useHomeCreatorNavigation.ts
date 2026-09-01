"use client";

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  closeCreatorContext,
  createCreatorInteractionSession,
  focusCreatorSet,
  openCreatorTool,
  setCreatorToolDirty,
  type CreatorInteractionSession,
} from '@/features/app-shell/client/environment';

import {
  createHomeCreatorHistoryState,
  createHomeCreatorHref,
  createHomeCreatorTool,
  readHomeCreatorHistorySnapshot,
  type HomeContextualToolId,
  type HomeCreatorHistorySnapshot,
} from '../model/homeCreatorHistory';

interface HomeCreatorNavigationOptions {
  initialFocusedWorkId?: string | null;
}

const initialSession = (focusedWorkId?: string | null): CreatorInteractionSession => {
  const session = createCreatorInteractionSession();
  return focusedWorkId?.startsWith('set:')
    ? focusCreatorSet(session, focusedWorkId.slice(4))
    : session;
};

export function useHomeCreatorNavigation({ initialFocusedWorkId }: HomeCreatorNavigationOptions) {
  const [focusedWorkId, setFocusedWorkId] = useState<string | null>(initialFocusedWorkId ?? null);
  const [inspectorWorkId, setInspectorWorkId] = useState<string | null>(null);
  const [interactionSession, setInteractionSession] = useState<CreatorInteractionSession>(() => initialSession(initialFocusedWorkId));
  const [dirtyCloseRequested, setDirtyCloseRequested] = useState(false);
  const initializedRef = useRef(false);
  const bypassDirtyCloseRef = useRef(false);
  const pendingPopSnapshotRef = useRef<HomeCreatorHistorySnapshot | null>(null);
  const currentRef = useRef<HomeCreatorHistorySnapshot>({
    version: 1,
    focusedWorkId: initialFocusedWorkId ?? null,
    inspectorWorkId: null,
    session: initialSession(initialFocusedWorkId),
  });
  currentRef.current = { version: 1, focusedWorkId, inspectorWorkId, session: interactionSession };

  const applySnapshot = useCallback((snapshot: HomeCreatorHistorySnapshot) => {
    setFocusedWorkId(snapshot.focusedWorkId);
    setInspectorWorkId(snapshot.inspectorWorkId);
    setInteractionSession(snapshot.session);
  }, []);

  const replaceSnapshot = useCallback((snapshot: HomeCreatorHistorySnapshot) => {
    if (typeof window === 'undefined') return;
    window.history.replaceState(
      createHomeCreatorHistoryState(window.history.state, snapshot),
      '',
      createHomeCreatorHref(snapshot),
    );
  }, []);

  const pushSnapshot = useCallback((snapshot: HomeCreatorHistorySnapshot) => {
    if (typeof window === 'undefined') return;
    window.history.pushState(
      createHomeCreatorHistoryState(window.history.state, snapshot),
      '',
      createHomeCreatorHref(snapshot),
    );
  }, []);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    const initial = currentRef.current;
    if (initial.focusedWorkId) {
      const desk: HomeCreatorHistorySnapshot = {
        version: 1,
        focusedWorkId: null,
        inspectorWorkId: null,
        session: createCreatorInteractionSession(),
      };
      replaceSnapshot(desk);
      pushSnapshot(initial);
      return;
    }
    replaceSnapshot(initial);
  }, [pushSnapshot, replaceSnapshot]);

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
      const target = pending ?? readHomeCreatorHistorySnapshot(event.state);
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
    if (readHomeCreatorHistorySnapshot(window.history.state)) {
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
      event.preventDefault();
      requestHistoryBack();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [requestHistoryBack]);

  const focusWorkContext = useCallback((workId: string, setId: string | null) => {
    const current = currentRef.current;
    const next: HomeCreatorHistorySnapshot = {
      version: 1,
      focusedWorkId: workId,
      inspectorWorkId: null,
      session: setId ? focusCreatorSet(current.session, setId) : createCreatorInteractionSession(),
    };
    replaceSnapshot(current);
    pushSnapshot(next);
    applySnapshot(next);
  }, [applySnapshot, pushSnapshot, replaceSnapshot]);

  const restoreFocusedContext = useCallback((snapshot: Omit<HomeCreatorHistorySnapshot, 'version'>) => {
    const next = { ...snapshot, version: 1 as const };
    if (currentRef.current.focusedWorkId === next.focusedWorkId && currentRef.current.session.toolStack.length === 0) {
      replaceSnapshot(next);
    } else {
      replaceSnapshot(currentRef.current);
      pushSnapshot(next);
    }
    applySnapshot(next);
  }, [applySnapshot, pushSnapshot, replaceSnapshot]);

  const openContextTool = useCallback((setId: string, toolId: HomeContextualToolId) => {
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
      session: openCreatorTool(focused.session, createHomeCreatorTool(setId, toolId)),
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
    const next: HomeCreatorHistorySnapshot = {
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
