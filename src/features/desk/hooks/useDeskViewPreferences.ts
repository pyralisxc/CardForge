"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';

import { readProjectPreferenceSafely, writeProjectPreference } from '@/features/project/client/persistence-preferences';
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
}

export interface DeskViewPreferences {
  views: DeskViewId[];
  types: string[];
  tags: string[];
  sources: AccountLibrarySource[];
  tagMatch: DeskTagMatch;
  saved: DeskSavedView[];
}

export const DEFAULT_DESK_VIEW_PREFERENCES: DeskViewPreferences = {
  views: ['my-work'], types: [], tags: [], sources: [], tagMatch: 'any', saved: [],
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
    } satisfies DeskSavedView];
  }).slice(0, 20) : [];
  return {
    views: views(record.views).length ? views(record.views) : ['my-work'],
    types: strings(record.types, 80),
    tags: strings(record.tags, 60),
    sources: sources(record.sources),
    tagMatch: record.tagMatch === 'all' ? 'all' : 'any',
    saved,
  };
};

/** Account-scoped filter state. A malformed/unreadable preference is never overwritten. */
export function useDeskViewPreferences(persistenceScope: ProjectPersistenceScope) {
  const key = `${DESK_VIEW_PREFERENCES_KEY}:${persistenceScope}`;
  const [preferences, setPreferences] = useState<DeskViewPreferences>(DEFAULT_DESK_VIEW_PREFERENCES);
  const [ready, setReady] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

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
      setReady(true);
    });
    return () => { cancelled = true; };
  }, [key]);

  const update = useCallback((next: DeskViewPreferences | ((current: DeskViewPreferences) => DeskViewPreferences)) => {
    if (!ready) return;
    setPreferences((current) => {
      const updated = normalizeDeskViewPreferences(typeof next === 'function' ? next(current) : next);
      void writeProjectPreference(key, updated);
      return updated;
    });
  }, [key, ready]);

  const reset = useCallback(() => update((current) => ({ ...DEFAULT_DESK_VIEW_PREFERENCES, saved: current.saved })), [update]);
  const saveCurrent = useCallback((name: string) => {
    const normalizedName = cleanText(name, 60);
    if (!normalizedName) return false;
    update((current) => ({
      ...current,
      saved: [...current.saved.filter((view) => view.name.toLocaleLowerCase() !== normalizedName.toLocaleLowerCase()), {
        id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${normalizedName}`,
        name: normalizedName,
        views: current.views,
        types: current.types,
        tags: current.tags,
        sources: current.sources,
        tagMatch: current.tagMatch,
      }].slice(-20),
    }));
    return true;
  }, [update]);
  const applySaved = useCallback((id: string) => update((current) => {
    const saved = current.saved.find((view) => view.id === id);
    return saved ? { ...current, ...saved } : current;
  }), [update]);

  return useMemo(() => ({ preferences, ready, unavailable, update, reset, saveCurrent, applySaved }), [applySaved, preferences, ready, reset, saveCurrent, unavailable, update]);
}
