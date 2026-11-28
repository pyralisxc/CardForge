"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { readProjectPreferenceSafely, updateProjectPreference } from '@/features/project/client/persistence-preferences';
import type { ProjectPersistenceScope } from '@/features/project/client/persistence-workspace';
import type { AccountLibraryKind, AccountLibrarySource } from '../model/accountLibrary';

export interface LibraryViewState {
  query: string; kinds: AccountLibraryKind[]; sources: AccountLibrarySource[]; types: string[]; tags: string[];
  tagMatch: 'any' | 'all'; updatesOnly: boolean; sort: 'recent' | 'name' | 'kind' | 'updates';
}
export type LibrarySavedView = Omit<LibraryViewState, 'query'> & { id: string; name: string; query?: string; scope: 'personal' | 'published' | 'pipeline'; sharedType: string };
interface LibraryPreferences { saved: LibrarySavedView[]; active?: LibraryViewState }
const validState = (value: unknown): value is LibraryViewState => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.query === 'string'
    && [item.kinds, item.sources, item.types, item.tags].every((entries) => Array.isArray(entries) && entries.every((entry) => typeof entry === 'string'))
    && (item.tagMatch === 'any' || item.tagMatch === 'all') && typeof item.updatesOnly === 'boolean'
    && typeof item.sort === 'string' && ['recent', 'name', 'kind', 'updates'].includes(item.sort);
};
const validPreferences = (value: unknown): value is LibraryPreferences => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return Array.isArray(item.saved) && item.saved.every((entry) => (
    entry && typeof entry === 'object' && typeof entry.id === 'string' && typeof entry.name === 'string'
    && ['personal', 'published', 'pipeline'].includes(entry.scope) && typeof entry.sharedType === 'string'
    && (entry.query === undefined || typeof entry.query === 'string') && validState({ ...entry, query: entry.query ?? '' })
  )) && (item.active === undefined || validState(item.active));
};
const unpack = (value: unknown): LibraryPreferences => {
  if (value === null) return { saved: [] };
  if (!validPreferences(value)) throw new Error('Saved Library views are unavailable');
  return value;
};

export function useLibrarySavedViews(scope: ProjectPersistenceScope, enabled: boolean) {
  const key = `library-views:v1:${scope}`;
  const scopeEpoch = useRef({ scope, epoch: 0 });
  if (scopeEpoch.current.scope !== scope) scopeEpoch.current = { scope, epoch: scopeEpoch.current.epoch + 1 };
  const token = `${key}:${scopeEpoch.current.epoch}`;
  const activeToken = useRef(token); activeToken.current = token;
  const [preferences, setPreferences] = useState<LibraryPreferences>({ saved: [] });
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const queue = useRef(Promise.resolve());
  useEffect(() => {
    let cancelled = false; setReadyKey(null); setPreferences({ saved: [] });
    if (!enabled) return () => { cancelled = true; };
    void readProjectPreferenceSafely<unknown>(key).then((result) => {
      if (cancelled || result.kind === 'unavailable') return;
      try { setPreferences(unpack(result.kind === 'available' ? result.value : null)); setReadyKey(token); } catch { /* preserve unreadable data */ }
    });
    return () => { cancelled = true; };
  }, [enabled, key, token]);
  const save = useCallback(async (view: Omit<LibrarySavedView, 'id'>) => {
    if (!enabled || activeToken.current !== token || !view.name.trim()) return false;
    if (readyKey !== token) {
      const result = await readProjectPreferenceSafely<unknown>(key);
      if (activeToken.current === token && result.kind !== 'unavailable') {
        try { setPreferences(unpack(result.kind === 'available' ? result.value : null)); setReadyKey(token); } catch { /* allow retry without overwriting */ }
      }
      return false;
    }
    try {
      const next = await updateProjectPreference<LibraryPreferences>(key, (current) => {
        const existing = unpack(current);
        return { ...existing, saved: [...existing.saved.filter((item) => item.scope !== view.scope || item.name.toLocaleLowerCase() !== view.name.toLocaleLowerCase()),
          { ...view, id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${view.name}` }] };
      });
      if (activeToken.current !== token) return false;
      setPreferences(next); return true;
    } catch { return false; }
  }, [enabled, key, readyKey, token]);
  const saveActive = useCallback((active: LibraryViewState) => {
    if (!enabled || readyKey !== token) return;
    queue.current = queue.current.catch(() => {}).then(async () => {
      if (activeToken.current !== token) return;
      await updateProjectPreference<LibraryPreferences>(key, (current) => ({ ...unpack(current), active }));
    }).catch(() => {});
  }, [enabled, key, readyKey, token]);
  return { views: enabled && readyKey === token ? preferences.saved : [], active: enabled && readyKey === token ? preferences.active : undefined, ready: enabled && readyKey === token, save, saveActive };
}
