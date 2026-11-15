"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const activeToolLayers: string[] = [];
const isTopToolLayer = (id: string) => activeToolLayers.at(-1) === id;

interface EnvironmentToolLifecycleOptions {
  id: string;
  active?: boolean;
  dirty?: boolean;
  closeBlocked?: boolean;
  onClose: () => void;
  onDirtyCloseRequest?: () => void;
  panelRef: RefObject<HTMLElement | null>;
  closeButtonRef: RefObject<HTMLElement | null>;
  modal?: boolean;
  manageHistory?: boolean;
}

export function useEnvironmentToolLifecycle({
  id,
  active = true,
  dirty = false,
  closeBlocked = false,
  onClose,
  onDirtyCloseRequest,
  panelRef,
  closeButtonRef,
  modal = false,
  manageHistory = true,
}: EnvironmentToolLifecycleOptions) {
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const historyOwnedRef = useRef(false);
  const historyInitializedRef = useRef<string | null>(null);
  const [pendingNavigation, setPendingNavigation] = useState<HTMLElement | null>(null);
  const discardNavigationRef = useRef(false);
  const dirtyRef = useRef(dirty);
  const closeBlockedRef = useRef(closeBlocked);
  closeBlockedRef.current = closeBlocked;
  const onCloseRef = useRef(onClose);
  const onDirtyCloseRequestRef = useRef(onDirtyCloseRequest);
  dirtyRef.current = dirty;
  onCloseRef.current = onClose;
  onDirtyCloseRequestRef.current = onDirtyCloseRequest;

  const confirmedCloseRef = useRef(false);
  const closeConfirmed = useCallback(() => {
    if (confirmedCloseRef.current) return;
    confirmedCloseRef.current = true;
    if (manageHistory && historyOwnedRef.current && window.history.state?.cardforgeToolLayer === id) {
      window.history.back();
      return;
    }
    onCloseRef.current();
  }, [id, manageHistory]);

  const closeFromControl = useCallback(() => {
    if (dirtyRef.current || closeBlockedRef.current) {
      onDirtyCloseRequestRef.current?.();
      return;
    }
    closeConfirmed();
  }, [closeConfirmed]);

  useEffect(() => {
    if (!active) { historyInitializedRef.current = null; return; }
    confirmedCloseRef.current = false;
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
      if (!isTopToolLayer(id) || (!dirtyRef.current && !closeBlockedRef.current) || discardNavigationRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    const onNavigate = (event: MouseEvent) => {
      if (!isTopToolLayer(id) || (!dirtyRef.current && !closeBlockedRef.current) || discardNavigationRef.current || !(event.target instanceof Element)) return;
      const action = event.target.closest<HTMLElement>('a[href], button, [role="tab"], [role="menuitem"]');
      if (!action || panelRef.current?.contains(action)
        || action.hasAttribute('data-tool-safe-action') || action.dataset.environmentAction?.includes('.close-')
        || action.closest('[role="alertdialog"], [role="dialog"], [data-radix-popper-content-wrapper], [data-desk-context-rail]')) return;
      event.preventDefault();
      event.stopPropagation();
      if (closeBlockedRef.current) { onDirtyCloseRequestRef.current?.(); return; }
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
      if (!confirmedCloseRef.current && (dirtyRef.current || closeBlockedRef.current)) {
        window.history.pushState({ ...window.history.state, cardforgeToolLayer: id }, '');
        historyOwnedRef.current = true;
        onDirtyCloseRequestRef.current?.();
        return;
      }
      historyOwnedRef.current = false;
      onCloseRef.current();
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
  }, [active, closeButtonRef, closeFromControl, id, manageHistory, modal, panelRef]);
  const navigationPrompt = active ? (
    <AlertDialog open={Boolean(pendingNavigation)} onOpenChange={(open) => { if (!open) setPendingNavigation(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leave with unsaved changes?</AlertDialogTitle>
          <AlertDialogDescription>Your saved work stays unchanged. Keep editing to save this draft before leaving.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep editing</AlertDialogCancel>
          <AlertDialogAction disabled={closeBlocked} onClick={() => {
            if (closeBlockedRef.current) { onDirtyCloseRequestRef.current?.(); return; }
            const action = pendingNavigation;
            discardNavigationRef.current = true;
            dirtyRef.current = false;
            setPendingNavigation(null);
            action?.click();
            requestAnimationFrame(() => { discardNavigationRef.current = false; });
          }}>Discard and continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ) : null;
  return { closeFromControl, closeConfirmed, navigationPrompt };
}
