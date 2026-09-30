"use client";

import { useCallback, useEffect, useState, type SetStateAction } from 'react';

import { readProjectPreferenceSafely, writeProjectPreference } from '../persistence/preferences';

export const SPATIAL_WORKSPACE_PREFERENCE_KEY = 'cardforge:spatial-workspace';

type SpatialWorkspacePreferences = {
  showGrid: boolean;
  snapToGrid: boolean;
};

const DEFAULT_SPATIAL_PREFERENCES: SpatialWorkspacePreferences = {
  showGrid: true,
  snapToGrid: false,
};

export function useSpatialWorkspacePreferences() {
  const [preferences, setPreferences] = useState(DEFAULT_SPATIAL_PREFERENCES);
  const [ready, setReady] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setUnavailable(false);
    setPreferences(DEFAULT_SPATIAL_PREFERENCES);
    void readProjectPreferenceSafely<Partial<SpatialWorkspacePreferences>>(SPATIAL_WORKSPACE_PREFERENCE_KEY).then((result) => {
      if (cancelled) return;
      if (result.kind === 'unavailable') {
        setUnavailable(true);
        return;
      }
      const stored = result.kind === 'available' ? result.value : null;
      setPreferences({
        showGrid: typeof stored?.showGrid === 'boolean' ? stored.showGrid : DEFAULT_SPATIAL_PREFERENCES.showGrid,
        snapToGrid: typeof stored?.snapToGrid === 'boolean' ? stored.snapToGrid : DEFAULT_SPATIAL_PREFERENCES.snapToGrid,
      });
      setReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  const update = useCallback((next: SetStateAction<SpatialWorkspacePreferences>) => {
    setPreferences((current) => {
      const resolved = typeof next === 'function' ? next(current) : next;
      void writeProjectPreference(SPATIAL_WORKSPACE_PREFERENCE_KEY, resolved);
      return resolved;
    });
  }, []);

  const setShowGrid = useCallback((next: SetStateAction<boolean>) => {
    update((current) => ({
      ...current,
      showGrid: typeof next === 'function' ? next(current.showGrid) : next,
    }));
  }, [update]);

  const setSnapToGrid = useCallback((next: SetStateAction<boolean>) => {
    update((current) => ({
      ...current,
      snapToGrid: typeof next === 'function' ? next(current.snapToGrid) : next,
    }));
  }, [update]);

  return {
    showGrid: preferences.showGrid,
    snapToGrid: preferences.snapToGrid,
    ready,
    unavailable,
    setShowGrid,
    setSnapToGrid,
  };
}
