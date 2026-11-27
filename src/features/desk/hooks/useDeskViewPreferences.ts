"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { readProjectPreferenceSafely, updateProjectPreference } from '@/features/project/client/persistence-preferences';
import type { ProjectPersistenceScope } from '@/features/project/client/persistence-workspace';
import type { AccountLibrarySource } from '@/features/storage-management/client';

export const DESK_VIEW_PREFERENCES_KEY = 'desk-view-preferences:v1';
export const DESK_VIEW_IDS = ['my-work', 'campaigns', 'my-published'] as const;
export type DeskViewId = typeof DESK_VIEW_IDS[number];
export type DeskTagMatch = 'any' | 'all';

export interface DeskSavedView {
  id: string;
  name: string;
  views: DeskViewId[];
  types: string[];
  tags: string[];
  sources: AccountLibrarySource[];
  tagMatch: DeskTagMatch;
  updatesOnly?: boolean;
  query?: string;
}

export interface DeskViewPreferences {
  query: string;
  views: DeskViewId[];
  types: string[];
  tags: string[];
  sources: AccountLibrarySource[];
  tagMatch: DeskTagMatch;
  updatesOnly?: boolean;
  saved: DeskSavedView[];
}

export const DEFAULT_DESK_VIEW_PREFERENCES: DeskViewPreferences = {
  query: '', views: ['my-work'], types: [], tags: [], sources: [], tagMatch: 'any', saved: [],
};

const cleanText = (value: unknown, maximum: number): string | null => (
  typeof value === 'string' ? value.trim().replace(/\s+/gu, ' ').slice(0, maximum) || null : null
);
const strings = (value: unknown, maximum: number): string[] => Array.from(new Set(
  Array.isArray(value) ? value.map((entry) => cleanText(entry, maximum)).filter((entry): entry is string => Boolean(entry)) : [],
));
const views = (value: unknown): DeskViewId[] => strings(value, 40).filter((entry): entry is DeskViewId => (DESK_VIEW_IDS as readonly string[]).includes(entry));
const sources = (value: unknown): AccountLibrarySource[] => strings(value, 40).filter((entry): entry is AccountLibrarySource => [
  'device', 'google-drive', 'local-folder', 'assistant-draft', 'campaign', 'pipeline',
].includes(entry));

export const normalizeDeskViewPreferences = (value: unknown): DeskViewPreferences => {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const saved = Array.isArray(record.saved) ? record.saved.flatMap((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const item = entry as Record<string, unknown>;
    const name = cleanText(item.name, 60);
    if (!name) return [];
    return [{
      id: cleanText(item.id, 100) ?? `saved-${index}`,
      name,
      views: views(item.views),
      types: strings(item.types, 80),
      tags: strings(item.tags, 60),
      sources: sources(item.sources),
      tagMatch: item.tagMatch === 'all' ? 'all' : 'any' as const,
      ...(item.updatesOnly === true ? { updatesOnly: true } : {}),
      ...(typeof item.query === 'string' ? { query: item.query } : {}),
    } satisfies DeskSavedView];
  }) : [];
  return {
    query: typeof record.query === 'string' ? record.query : '',
    views: views(record.views).length ? views(record.views) : ['my-work'],
    types: strings(record.types, 80),
    tags: strings(record.tags, 60),
    sources: sources(record.sources),
    tagMatch: record.tagMatch === 'all' ? 'all' : 'any',
    ...(record.updatesOnly === true ? { updatesOnly: true } : {}),
    saved,
  };
};

/** Account-scoped filter state. A malformed/unreadable preference is never overwritten. */
export function useDeskViewPreferences(persistenceScope: ProjectPersistenceScope) {
  const key = `${DESK_VIEW_PREFERENCES_KEY}:${persistenceScope}`;
  const scopeEpoch = useRef({ scope: persistenceScope, epoch: 0 });
  if (scopeEpoch.current.scope !== persistenceScope) scopeEpoch.current = { scope: persistenceScope, epoch: scopeEpoch.current.epoch + 1 };
  const token = `${key}:${scopeEpoch.current.epoch}`;
  const [preferences, setPreferences] = useState<DeskViewPreferences>(DEFAULT_DESK_VIEW_PREFERENCES);
  const [ready, setReady] = useState(false);
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const activeToken = useRef(token);
  activeToken.current = token;

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setUnavailable(false);
    setPreferences(DEFAULT_DESK_VIEW_PREFERENCES);
    void readProjectPreferenceSafely<unknown>(key).then((result) => {
      if (cancelled) return;
      if (result.kind === 'unavailable') {
        setUnavailable(true);
        return;
      }
      setPreferences(normalizeDeskViewPreferences(result.kind === 'available' ? result.value : null));
      setReadyKey(token);
      setReady(true);
    });
    return () => { cancelled = true; };
  }, [key, token]);

  const update = useCallback((next: DeskViewPreferences | ((current: DeskViewPreferences) => DeskViewPreferences)) => {
    if (!ready || readyKey !== token) return;
    setPreferences((current) => {
      const updated = normalizeDeskViewPreferences(typeof next === 'function' ? next(current) : next);
      void updateProjectPreference(key, (stored) => ({ ...updated, saved: normalizeDeskViewPreferences(stored).saved })).catch(() => {});
      return updated;
    });
  }, [key, ready, readyKey, token]);

  const reset = useCallback(() => update((current) => ({ ...DEFAULT_DESK_VIEW_PREFERENCES, saved: current.saved })), [update]);
  const saveCurrent = useCallback(async (name: string, query?: string) => {
    const normalizedName = cleanText(name, 60);
    if (!normalizedName || activeToken.current !== token) return false;
    if (!ready || readyKey !== token) {
      const result = await readProjectPreferenceSafely<unknown>(key);
      if (activeToken.current === token && result.kind !== 'unavailable') {
        setPreferences(normalizeDeskViewPreferences(result.kind === 'available' ? result.value : null));
        setReadyKey(token); setReady(true); setUnavailable(false);
      }
      return false;
    }
    const snapshot = preferences;
    try {
      const persisted = await updateProjectPreference(key, (stored) => {
        const current = normalizeDeskViewPreferences(stored);
        return { ...current, saved: [...current.saved.filter((view) => view.name.toLocaleLowerCase() !== normalizedName.toLocaleLowerCase()), {
        id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${normalizedName}`,
        name: normalizedName,
        views: snapshot.views, types: snapshot.types, tags: snapshot.tags,
        sources: snapshot.sources, tagMatch: snapshot.tagMatch,
        updatesOnly: snapshot.updatesOnly, ...(query !== undefined ? { query } : {}),
      }] };
      });
      if (activeToken.current !== token) return false;
      setPreferences((current) => ({ ...current, saved: normalizeDeskViewPreferences(persisted).saved }));
      return true;
    } catch { return false; }
  }, [key, preferences, ready, readyKey, token]);
  const applySaved = useCallback((id: string) => update((current) => {
    const saved = current.saved.find((view) => view.id === id);
    return saved ? { ...current, ...saved, updatesOnly: saved.updatesOnly } : current;
  }), [update]);

  return useMemo(() => ({ preferences: readyKey === token ? preferences : DEFAULT_DESK_VIEW_PREFERENCES, ready: ready && readyKey === token, unavailable, update, reset, saveCurrent, applySaved }), [applySaved, token, preferences, ready, readyKey, reset, saveCurrent, unavailable, update]);
}
