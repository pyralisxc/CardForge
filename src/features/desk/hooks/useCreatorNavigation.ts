"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { confirmSetWorkspaceForOutput, useProjectStore } from '@/features/project/client/workspace';
import { useToast } from '@/components/ui/use-toast';

import {
  closeCreatorContext,
  createCreatorInteractionSession,
  focusCreatorArtifact,
  focusCreatorSet,
  hasBlockingKeyboardLayer,
  isEditableKeyboardTarget,
  openCreatorTool,
  setCreatorToolDirty,
  selectCreatorDeskSets,
  type CreatorInteractionSession,
} from '@/features/app-shell/client/environment';

import {
  createCreatorDeskSnapshot,
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
  toolLayerOwnsHistory?: boolean;
  transitionToDesk?: (commit: () => void) => void;
  initialFocusedWorkId?: string | null;
  initialFocusedArtifactId?: string | null;
}

export function useCreatorNavigation({ initialFocusedWorkId, initialFocusedArtifactId, transitionToDesk, toolLayerOwnsHistory = false }: CreatorNavigationOptions) {
  const { toast } = useToast();
  const outputAttemptRef = useRef(0);
  const navigationEpochRef = useRef(0);
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; outputAttemptRef.current += 1; }; }, []);
  const externalHistoryRef = useRef(toolLayerOwnsHistory);
  externalHistoryRef.current = toolLayerOwnsHistory;
  const [navigationReady, setNavigationReady] = useState(false);
  const [focusedWorkId, setFocusedWorkId] = useState<string | null>(initialFocusedWorkId ?? null);
  const [inspectorWorkId, setInspectorWorkId] = useState<string | null>(null);
  const [interactionSession, setInteractionSession] = useState<CreatorInteractionSession>(() => (
    createCreatorInitialSession(initialFocusedWorkId, initialFocusedArtifactId)
  ));
  const [dirtyCloseTarget, setDirtyCloseTarget] = useState<'tool' | 'desk' | null>(null);
  const dirtyCloseRequested = dirtyCloseTarget !== null;
  const dirtyCloseToDesk = dirtyCloseTarget === 'desk';
  const setDirtyCloseRequested = useCallback((open: boolean) => {
    setDirtyCloseTarget(open ? 'tool' : null);
  }, []);
  const previousFocusedWorkIdRef = useRef(focusedWorkId);
  const toolReturnFocusRef = useRef(new Map<string, { element: HTMLElement; setId: string | null; artifactId: string | null }>());
  const previousToolsRef = useRef(interactionSession.toolStack);
  useEffect(() => {
    const currentIds = new Set(interactionSession.toolStack.map((tool) => tool.instanceId));
    const closed = previousToolsRef.current.filter((tool) => !currentIds.has(tool.instanceId));
    previousToolsRef.current = interactionSession.toolStack;
    const targets = closed.reverse().flatMap((tool) => {
      const target = toolReturnFocusRef.current.get(tool.instanceId);
      toolReturnFocusRef.current.delete(tool.instanceId);
      return target && target.setId === interactionSession.focusPath.setId && target.artifactId === interactionSession.focusPath.artifactId ? [target.element] : [];
    });
    if (!targets.length) return;
    const frame = requestAnimationFrame(() => {
      for (const original of targets) {
        const element = original.id ? document.getElementById(original.id) : original;
        if (element?.isConnected && !element.closest('[inert]')) { element.focus({ preventScroll: true }); break; }
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [interactionSession.toolStack, interactionSession.focusPath.setId, interactionSession.focusPath.artifactId]);
  const initializedRef = useRef(false);
  // The router can replace entry metadata during commit, before restoration effects run.
  const [entrySnapshot] = useState(() => typeof window === 'undefined'
    ? null
    : readCreatorHistorySnapshot(window.history.state));
  const bypassDirtyCloseRef = useRef(false);
  const pendingPopSnapshotRef = useRef<CreatorHistorySnapshot | null>(null);
  const currentRef = useRef<CreatorHistorySnapshot>({
    version: 1,
    focusedWorkId: initialFocusedWorkId ?? null,
    inspectorWorkId: null,
    session: interactionSession,
  });
  currentRef.current = { version: 1, focusedWorkId, inspectorWorkId, session: interactionSession };
  const [outputRestoreFailed, setOutputRestoreFailed] = useState(false);
  const [pendingOutputRestore, setPendingOutputRestore] = useState<{ restored: CreatorHistorySnapshot; prior: CreatorHistorySnapshot; epoch: number } | null>(null);
  const confirmOutput = useCallback(async (setId: string, origin: CreatorHistorySnapshot, assertCurrent: () => void = () => {}): Promise<boolean> => {
    const attempt = ++outputAttemptRef.current;
    const epoch = navigationEpochRef.current;
    // Camera and lens can change while the restored Desk fits its viewport;
    // only work, selection and tool context determine this handoff's identity.
    const contextKey = (snapshot: CreatorHistorySnapshot) => JSON.stringify([
      snapshot.focusedWorkId, snapshot.session.focusPath, snapshot.session.deskSelection,
      snapshot.session.deskSelectionAnchorId, snapshot.session.selection,
      snapshot.session.inspectionTargetId, snapshot.session.toolStack,
    ]);
    const context = contextKey(origin);
    const check = () => {
      if (!mountedRef.current || outputAttemptRef.current !== attempt || navigationEpochRef.current !== epoch
        || contextKey(currentRef.current) !== context) {
        throw new Error('The selection changed while saving. Return to the Set and retry Output.');
      }
      assertCurrent();
    };
    try { await confirmSetWorkspaceForOutput(setId, check); check(); return true; }
    catch (error) {
      if (mountedRef.current && outputAttemptRef.current === attempt && navigationEpochRef.current === epoch) {
        const reason = error instanceof Error ? error.message : 'The browser could not confirm your save.';
        toast({ title: 'Output not opened', description: `${reason} Your edits remain here; retry Output.`, variant: 'destructive' });
      }
      return false;
    }
  }, [toast]);

  useEffect(() => {
    const previousWorkId = previousFocusedWorkIdRef.current;
    previousFocusedWorkIdRef.current = focusedWorkId;
    if (focusedWorkId || !previousWorkId) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById(`set-${previousWorkId}`)?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [focusedWorkId]);

  const applySnapshot = useCallback((snapshot: CreatorHistorySnapshot) => {
    if (currentRef.current.session.toolStack.at(-1)?.toolId === 'design'
      && snapshot.session.toolStack.at(-1)?.toolId !== 'design') {
      useProjectStore.getState().closeEditDialog();
    }
    navigationEpochRef.current += 1;
    currentRef.current = snapshot;
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

  // Only committed Set-to-Desk departures transfer visible ownership. Requests
  // that merely open a dirty confirmation never reach this boundary.
  const commitReturnSnapshot = useCallback((snapshot: CreatorHistorySnapshot, replaceHistory = false) => {
    const commit = () => {
      applySnapshot(snapshot);
      if (replaceHistory) replaceSnapshot(snapshot);
    };
    if (currentRef.current.session.focusPath.setId && !snapshot.session.focusPath.setId && transitionToDesk) {
      transitionToDesk(commit);
    } else commit();
  }, [applySnapshot, replaceSnapshot, transitionToDesk]);

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
    const restored = readCreatorHistorySnapshot(window.history.state) ?? entrySnapshot;
    const currentHref = `${window.location.pathname}${window.location.search}`;
    if (
      restored
      && preserveCreatorLaunchIntent(createCreatorHref(restored), currentHref) === currentHref
    ) {
      const restoredTool = restored.session.toolStack.at(-1);
      if (restoredTool?.toolId === 'output' && restored.session.focusPath.setId) {
        const prior = { ...restored, session: { ...restored.session, toolStack: restored.session.toolStack.slice(0, -1) } };
        applySnapshot(prior);
        setPendingOutputRestore({ restored, prior, epoch: navigationEpochRef.current });
        return;
      }
      applySnapshot(restored);
      replaceSnapshot(restored);
      setNavigationReady(true);
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
      setNavigationReady(true);
      return;
    }
    replaceSnapshot(initial);
    setNavigationReady(true);
  }, [applySnapshot, entrySnapshot, pushSnapshot, replaceSnapshot]);

  useEffect(() => {
    if (!pendingOutputRestore) return;
    const { restored, prior, epoch } = pendingOutputRestore;
    const setId = restored.session.focusPath.setId;
    if (!setId) return;
    let cancelled = false;
    void confirmOutput(setId, prior).then((confirmed) => {
      if (cancelled) return;
      setPendingOutputRestore(null);
      if (navigationEpochRef.current !== epoch) { setNavigationReady(true); return; }
      if (confirmed) { applySnapshot(restored); replaceSnapshot(restored); }
      else { replaceSnapshot(prior); setOutputRestoreFailed(true); }
      setNavigationReady(true);
    });
    return () => { cancelled = true; };
  }, [pendingOutputRestore, confirmOutput, applySnapshot, replaceSnapshot]);

  useEffect(() => {
    if (!navigationReady) return;
    replaceSnapshot(currentRef.current);
  }, [focusedWorkId, inspectorWorkId, interactionSession, navigationReady, replaceSnapshot]);

  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      // The in-place governance layer owns its pushed entry and dirty/uncertain Back decision.
      if (externalHistoryRef.current) return;
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
        if (target.session.toolStack.at(-1)?.toolId === 'output' && target.session.focusPath.setId) {
          replaceSnapshot(current);
          void confirmOutput(target.session.focusPath.setId, current).then((confirmed) => {
            if (confirmed) { commitReturnSnapshot(target); replaceSnapshot(target); }
          });
          return;
        }
        commitReturnSnapshot(target, Boolean(pending));
        return;
      }
      const closed = closeCreatorContext(current.session);
      commitReturnSnapshot({
        ...current,
        focusedWorkId: closed.closed === 'set-focus' ? null : current.focusedWorkId,
        inspectorWorkId: closed.closed === 'inspection' ? null : current.inspectorWorkId,
        session: closed.session,
      });
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [commitReturnSnapshot, confirmOutput, pushSnapshot, replaceSnapshot, setDirtyCloseRequested]);

  const requestHistoryBack = useCallback(() => {
    if (typeof window === 'undefined') return;
    const current = currentRef.current;
    if (current.session.toolStack.at(-1)?.dirty && !bypassDirtyCloseRef.current) {
      setDirtyCloseRequested(true);
      return;
    }
    if (readCreatorHistorySnapshot(window.history.state)) {
      window.history.back();
      return;
    }
    bypassDirtyCloseRef.current = false;
    const closed = closeCreatorContext(current.session);
    const next = {
      ...current,
      focusedWorkId: closed.closed === 'set-focus' ? null : current.focusedWorkId,
      inspectorWorkId: closed.closed === 'inspection' ? null : current.inspectorWorkId,
      session: closed.session,
    };
    commitReturnSnapshot(next, true);
  }, [commitReturnSnapshot, setDirtyCloseRequested]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const session = currentRef.current.session;
      if (event.key !== 'Escape' || session.toolStack.length > 0 || !session.focusPath.setId) return;
      if (
        event.defaultPrevented || isEditableKeyboardTarget(event.target) || hasBlockingKeyboardLayer()
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

  const openContextTool = useCallback(async (setId: string, toolId: DeskContextualToolId, targetIds: readonly string[] = [], assertCurrent?: () => void) => {
    const current = currentRef.current;
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const triggerId = active?.closest('[role="menu"]')?.getAttribute('aria-labelledby');
    const returnFocus = (triggerId ? document.getElementById(triggerId) : null) ?? active;
    if (toolId === 'output') {
      if (!await confirmOutput(setId, current, assertCurrent)) return false;
    }
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
    const tool = createCreatorTool(setId, toolId, targetIds);
    if (returnFocus && returnFocus !== document.body && !focused.session.toolStack.some((entry) => entry.instanceId === tool.instanceId)) {
      toolReturnFocusRef.current.set(tool.instanceId, { element: returnFocus, setId: focused.session.focusPath.setId, artifactId: focused.session.focusPath.artifactId });
    }
    const next = {
      ...focused,
      inspectorWorkId: null,
      session: openCreatorTool(focused.session, tool),
    };
    pushSnapshot(next);
    applySnapshot(next);
    return true;
  }, [applySnapshot, confirmOutput, pushSnapshot, replaceSnapshot]);

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
  }, [requestHistoryBack, setDirtyCloseRequested]);

  const returnToDesk = useCallback(() => {
    const next = createCreatorDeskSnapshot(currentRef.current);
    pendingPopSnapshotRef.current = null;
    bypassDirtyCloseRef.current = false;
    setDirtyCloseTarget(null);
    commitReturnSnapshot(next, true);
  }, [commitReturnSnapshot]);

  const returnToSet = useCallback(() => {
    const current = currentRef.current;
    const closed = closeCreatorContext(current.session);
    if (closed.closed !== 'artifact-focus') return;
    const next: CreatorHistorySnapshot = { ...current, session: closed.session };
    pendingPopSnapshotRef.current = null;
    bypassDirtyCloseRef.current = false;
    applySnapshot(next);
    replaceSnapshot(next);
  }, [applySnapshot, replaceSnapshot]);

  const requestDeskReturn = useCallback(() => {
    const current = currentRef.current;
    if (!current.focusedWorkId && !current.inspectorWorkId && !current.session.toolStack.length) return;
    // A direct return leaves every nested tool, not just the topmost one.
    if (current.session.toolStack.some((tool) => tool.dirty)) {
      setDirtyCloseTarget('desk');
      return;
    }
    returnToDesk();
  }, [returnToDesk]);

  const confirmDirtyClose = useCallback(() => {
    if (dirtyCloseTarget === 'desk') {
      returnToDesk();
      return;
    }
    bypassDirtyCloseRef.current = true;
    setDirtyCloseTarget(null);
    requestHistoryBack();
  }, [dirtyCloseTarget, requestHistoryBack, returnToDesk]);

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
    navigationReady,
    outputRestoreFailed,
    closeContextTool,
    confirmDirtyClose,
    dirtyCloseRequested,
    dirtyCloseToDesk,
    focusArtifactContext,
    focusWorkContext,
    focusedWorkId,
    inspectorWorkId,
    interactionSession,
    openContextTool,
    requestHistoryBack,
    requestDeskReturn,
    resetToDesk,
    returnToSet,
    restoreFocusedContext,
    setActiveToolDirty,
    setDirtyCloseRequested,
    setInspectorWorkId,
    setInteractionSession,
  };
}
