"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { readProjectPreferenceSafely, updateProjectPreference } from '@/features/project/client/persistence-preferences';
import type { ProjectPersistenceScope } from '@/features/project/client/persistence-workspace';

const keyForScope = (scope: ProjectPersistenceScope) => `desk-membership:v1:${scope}`;
type Membership = { key: string; status: 'loading' | 'ready' | 'unavailable'; ids: string[] };
const validIds = (value: unknown): value is string[] => Array.isArray(value) && value.every((id) => typeof id === 'string');

/** Device placement only. Project data and provider bindings remain Project's responsibility. */
export function useDeskMembership(scope: ProjectPersistenceScope, workspaceReady: boolean, localSetIds: string[]) {
  const key = keyForScope(scope);
  const [state, setState] = useState<Membership>({ key, status: 'loading', ids: [] });
  const current = useRef<Membership>({ key, status: 'loading', ids: [] });
  const pending = useRef<Promise<unknown>>(Promise.resolve());
  const channel = useRef<BroadcastChannel | null>(null);
  const initialIds = useRef(localSetIds);
  initialIds.current = localSetIds;

  useEffect(() => {
    let cancelled = false;
    const loading: Membership = { key, status: 'loading', ids: [] };
    current.current = loading;
    setState(loading);
    if (!workspaceReady) return () => { cancelled = true; };
    void (async () => {
      const result = await readProjectPreferenceSafely<unknown>(key);
      if (cancelled) return;
      if (result.kind === 'unavailable' || (result.kind === 'available' && !validIds(result.value))) {
        const unavailable: Membership = { key, status: 'unavailable', ids: [] };
        current.current = unavailable;
        setState(unavailable);
        return;
      }
      let ids = Array.from(new Set(result.kind === 'missing' ? initialIds.current : result.value as string[]));
      if (result.kind === 'missing') {
        try {
          ids = await updateProjectPreference(key, (current) => {
            if (current === null) return ids;
            if (!validIds(current)) throw new Error('Desk placement is unreadable.');
            return current;
          });
        } catch {
          if (!cancelled) {
            const unavailable: Membership = { key, status: 'unavailable', ids: [] };
            current.current = unavailable;
            setState(unavailable);
          }
          return;
        }
      }
      if (cancelled) return;
      const ready: Membership = { key, status: 'ready', ids };
      current.current = ready;
      setState(ready);
    })();
    return () => { cancelled = true; };
  }, [key, workspaceReady]);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    let updates: BroadcastChannel;
    try { updates = new BroadcastChannel(`cardforge:${key}`); } catch { return; }
    channel.current = updates;
    updates.onmessage = () => {
      const refresh = pending.current.catch(() => undefined).then(async () => {
        const result = await readProjectPreferenceSafely<unknown>(key);
        if (current.current.key !== key || current.current.status !== 'ready' || result.kind !== 'available' || !validIds(result.value)) return;
        const next: Membership = { key, status: 'ready', ids: result.value };
        current.current = next;
        setState(next);
      });
      pending.current = refresh;
    };
    return () => { if (channel.current === updates) channel.current = null; updates.close(); };
  }, [key]);

  const change = useCallback((id: string, include: boolean): Promise<void> => {
    const operation = pending.current.catch(() => undefined).then(async () => {
      const previous = current.current;
      if (previous.key !== key || previous.status !== 'ready') throw new Error('Desk placement is unavailable. Your device work was left unchanged.');
      let ids: string[];
      try {
        ids = await updateProjectPreference(key, (current) => {
          if (!validIds(current)) throw new Error('Desk placement is unreadable.');
          return include ? Array.from(new Set([...current, id])) : current.filter((entry) => entry !== id);
        });
      } catch (error) {
        if (current.current.key === key) {
          const unavailable: Membership = { ...previous, status: 'unavailable' };
          current.current = unavailable;
          setState(unavailable);
        }
        throw error;
      }
      if (current.current.key !== key) throw new Error('The workspace account changed while updating Desk.');
      const next: Membership = { key, status: 'ready', ids };
      current.current = next;
      setState(next);
      try { channel.current?.postMessage('changed'); } catch { /* The committed placement remains authoritative. */ }
    });
    pending.current = operation;
    return operation;
  }, [key]);

  return {
    status: state.key === key ? state.status : 'loading' as const,
    ids: state.key === key ? state.ids : [],
    add: useCallback((id: string) => change(id, true), [change]),
    remove: useCallback((id: string) => change(id, false), [change]),
  };
}
