"use client";

import { X } from 'lucide-react';
import { Component, useCallback, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

import type { CreatorToolPresentation } from '../interactionSession';
import styles from './EnvironmentFoundation.module.css';

interface EnvironmentToolLayerProps {
  id: string;
  eyebrow: string;
  title: string;
  summary: string;
  closeLabel: string;
  children: ReactNode;
  onClose: () => void;
  dirty?: boolean;
  onDirtyCloseRequest?: () => void;
  onCrash?: (error: Error) => void;
  manageHistory?: boolean;
  presentation?: CreatorToolPresentation;
  railOwned?: boolean;
}

const activeToolLayers: string[] = [];

const isTopToolLayer = (id: string) => activeToolLayers.at(-1) === id;

class ToolLayerErrorBoundary extends Component<{
  children: ReactNode;
  onCrash?: (error: Error) => void;
}, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    this.props.onCrash?.(error);
  }

  render() {
    if (this.state.error) {
      return (
        <div role="alert" className={styles.toolFailure}>
          This tool stopped unexpectedly. Your workspace is still open; close the tool and try again.
        </div>
      );
    }
    return this.props.children;
  }
}

export function EnvironmentToolLayer({
  id,
  eyebrow,
  title,
  summary,
  closeLabel,
  children,
  onClose,
  dirty = false,
  onDirtyCloseRequest,
  onCrash,
  manageHistory = true,
  presentation = 'sheet',
  railOwned = false,
}: EnvironmentToolLayerProps) {
  const workspace = presentation === 'floating' || presentation === 'inline';
  const modal = presentation === 'provider-handoff';
  const headerOwnedByRail = railOwned && !modal;
  const panelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const historyOwnedRef = useRef(false);
  const historyInitializedRef = useRef<string | null>(null);
  const [pendingNavigation, setPendingNavigation] = useState<HTMLElement | null>(null);
  const discardNavigationRef = useRef(false);
  const dirtyRef = useRef(dirty);
  const onCloseRef = useRef(onClose);
  const onDirtyCloseRequestRef = useRef(onDirtyCloseRequest);
  dirtyRef.current = dirty;
  onCloseRef.current = onClose;
  onDirtyCloseRequestRef.current = onDirtyCloseRequest;

  const requestClose = useCallback(() => {
    if (dirtyRef.current) {
      onDirtyCloseRequestRef.current?.();
      return;
    }
    onCloseRef.current();
  }, []);

  const closeFromControl = useCallback(() => {
    if (dirtyRef.current) {
      onDirtyCloseRequestRef.current?.();
      return;
    }
    if (manageHistory && historyOwnedRef.current && window.history.state?.cardforgeToolLayer === id) {
      window.history.back();
      return;
    }
    onCloseRef.current();
  }, [id, manageHistory]);

  useEffect(() => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    activeToolLayers.push(id);
    if (manageHistory) {
      const state = { ...window.history.state, cardforgeToolLayer: id };
      // React may replay effect setup. Reattach this same entry instead of
      // leaving a second tool URL behind in the user's Back history.
      if (historyInitializedRef.current === id) window.history.replaceState(state, '');
      else window.history.pushState(state, '');
      historyInitializedRef.current = id;
      historyOwnedRef.current = true;
    }
    if (modal) closeButtonRef.current?.focus();

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isTopToolLayer(id) || !dirtyRef.current || discardNavigationRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    const onNavigate = (event: MouseEvent) => {
      if (!isTopToolLayer(id) || !dirtyRef.current || discardNavigationRef.current || !(event.target instanceof Element)) return;
      const action = event.target.closest<HTMLElement>('a[href], button, [role="tab"], [role="menuitem"]');
      if (!action || panelRef.current?.contains(action)
        || action.hasAttribute('data-tool-safe-action') || action.dataset.environmentAction?.includes('.close-')
        || action.closest('[role="alertdialog"], [role="dialog"], [data-radix-popper-content-wrapper], [data-desk-context-rail]')) return;
      event.preventDefault();
      event.stopPropagation();
      setPendingNavigation(action);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isTopToolLayer(id)) return;
      if (event.key === 'Escape') {
        if (
          event.defaultPrevented
          || Array.from(document.querySelectorAll<HTMLElement>('[data-radix-popper-content-wrapper], [role="listbox"], [role="menu"], [role="alertdialog"]'))
            .some((element) => element.getClientRects().length > 0)
        ) return;
        event.preventDefault();
        closeFromControl();
        return;
      }
      if (!modal || event.key !== 'Tab' || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const onPopState = () => {
      if (!isTopToolLayer(id)) return;
      if (dirtyRef.current) {
        window.history.pushState({ ...window.history.state, cardforgeToolLayer: id }, '');
        historyOwnedRef.current = true;
        onDirtyCloseRequestRef.current?.();
        return;
      }
      historyOwnedRef.current = false;
      requestClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('click', onNavigate, true);
    window.addEventListener('beforeunload', onBeforeUnload);
    if (manageHistory) window.addEventListener('popstate', onPopState);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('click', onNavigate, true);
      window.removeEventListener('beforeunload', onBeforeUnload);
      if (manageHistory) window.removeEventListener('popstate', onPopState);
      const index = activeToolLayers.lastIndexOf(id);
      if (index >= 0) activeToolLayers.splice(index, 1);
      if (historyOwnedRef.current && window.history.state?.cardforgeToolLayer === id) {
        const parentToolLayer = activeToolLayers.at(-1);
        const nextState = { ...window.history.state };
        if (parentToolLayer) nextState.cardforgeToolLayer = parentToolLayer;
        else delete nextState.cardforgeToolLayer;
        window.history.replaceState(nextState, '');
      }
      returnFocusRef.current?.focus();
    };
  }, [closeFromControl, id, manageHistory, modal, requestClose]);

  return (
    <><div className={`${styles.toolLayer} ${workspace ? styles.toolLayerWorkspace : ''}`} role={modal ? 'dialog' : 'region'} aria-modal={modal || undefined} aria-labelledby={id} data-presentation={presentation} data-desk-tool-surface>
      {modal ? <button type="button" className={styles.toolScrim} aria-hidden="true" tabIndex={-1} onClick={closeFromControl} /> : <div className={styles.toolSceneReveal} aria-hidden="true" />}
      <section ref={panelRef} className={`${styles.toolPanel} ${workspace ? styles.toolPanelWorkspace : ''}`}>
        <header className={`${styles.toolHeader} ${workspace ? styles.toolHeaderWorkspace : ''} ${headerOwnedByRail ? styles.toolHeaderRailOwned : ''}`}>
          <div>
            <p className={styles.toolEyebrow}>{eyebrow}</p>
            <h2 id={id} className={styles.toolTitle}>{title}</h2>
            <p className={styles.toolSummary}>{summary}</p>
          </div>
          {headerOwnedByRail ? null : <button ref={closeButtonRef} type="button" className={styles.toolClose} onClick={closeFromControl} aria-label={closeLabel}>
            <X aria-hidden="true" />
          </button>}
        </header>
        <div className={`${styles.toolContent} ${workspace ? styles.toolContentWorkspace : ''}`}>
          <ToolLayerErrorBoundary onCrash={onCrash}>{children}</ToolLayerErrorBoundary>
        </div>
      </section>
    </div>
    <AlertDialog open={Boolean(pendingNavigation)} onOpenChange={(open) => { if (!open) setPendingNavigation(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leave with unsaved changes?</AlertDialogTitle>
          <AlertDialogDescription>Your saved work stays unchanged. Keep editing to save this draft before leaving.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep editing</AlertDialogCancel>
          <AlertDialogAction onClick={() => {
            const action = pendingNavigation;
            discardNavigationRef.current = true;
            dirtyRef.current = false;
            setPendingNavigation(null);
            action?.click();
            requestAnimationFrame(() => { discardNavigationRef.current = false; });
          }}>Discard and continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog></>
  );
}
