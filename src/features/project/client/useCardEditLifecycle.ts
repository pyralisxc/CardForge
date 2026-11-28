'use client';

import { useCallback, useRef, useState } from 'react';
import type { DisplayCard } from '@/domain/rendering';
import type { ProjectPersistenceScope } from '../persistence/projectPersistenceScope';
import { beginProjectCardEdit, saveProjectCardEdit, type ProjectCardEditSession } from './cardEditSession';

export type CardEditSaveOutcome = { kind: 'saved' } | { kind: 'stale' | 'unavailable'; message: string };
const staleMessage = 'This card, Template or account changed while you were editing. Your draft is still open; copy your changes and reopen the current card.';

/** One session and outcome owner; surfaces retain their own presentation and return focus. */
export function useCardEditLifecycle(scope: ProjectPersistenceScope) {
  const currentScope = useRef({ scope, epoch: 0 });
  if (currentScope.current.scope !== scope) currentScope.current = { scope, epoch: currentScope.current.epoch + 1 };
  const epoch = currentScope.current.epoch;
  const [state, setState] = useState<{ epoch: number; session: ProjectCardEditSession | null; dirty: boolean; closing: boolean }>({ epoch, session: null, dirty: false, closing: false });
  const session = state.epoch === epoch ? state.session : null;
  const dirty = Boolean(session && state.dirty);
  const closing = Boolean(session && state.closing);
  const clear = useCallback(() => {
    if (currentScope.current.epoch === epoch) setState({ epoch, session: null, dirty: false, closing: false });
  }, [epoch]);
  const begin = useCallback((setId: string, cardId: string): boolean => {
    if (currentScope.current.epoch !== epoch) return false;
    const next = beginProjectCardEdit(setId, cardId);
    if (!next || next.scope !== scope) return false;
    setState({ epoch, session: next, dirty: false, closing: false });
    return true;
  }, [epoch, scope]);
  const setDirty = useCallback((next: boolean) => {
    if (currentScope.current.epoch !== epoch) return;
    setState((current) => current.epoch === epoch && current.session && !current.closing && current.dirty !== next ? { ...current, dirty: next } : current);
  }, [epoch]);
  const requestClose = useCallback((): 'closed' | 'confirm-discard' => {
    if (dirty) return 'confirm-discard';
    clear(); return 'closed';
  }, [clear, dirty]);
  const beginClosing = useCallback((): boolean => {
    if (!session || dirty || closing || currentScope.current.epoch !== epoch) return false;
    setState((current) => current.epoch === epoch && current.session ? { ...current, closing: true } : current);
    return true;
  }, [closing, dirty, epoch, session]);
  const save = useCallback((card: DisplayCard): CardEditSaveOutcome => {
    if (!session || currentScope.current.epoch !== epoch) return { kind: 'stale', message: staleMessage };
    try {
      if (!saveProjectCardEdit(session, card)) return { kind: 'stale', message: staleMessage };
      setState((current) => current.epoch === epoch && current.session ? { ...current, dirty: false, closing: true } : current);
      return { kind: 'saved' };
    } catch (error) {
      return { kind: 'unavailable', message: error instanceof Error ? error.message : 'The card could not be updated.' };
    }
  }, [epoch, session]);
  return { session, dirty, closing, begin, beginClosing, setDirty, requestClose, clear, save };
}
