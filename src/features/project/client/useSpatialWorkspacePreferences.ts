"use client";

import { useCallback, useEffect, useState, type SetStateAction } from 'react';

import { readProjectPreference, writeProjectPreference } from '../persistence/preferences';

export const SPATIAL_WORKSPACE_PREFERENCE_KEY = 'cardforge:spatial-workspace';

type SpatialWorkspacePreferences = {
  showGrid: boolean;
  snapToGrid: boolean;
};

const DEFAULT_SPATIAL_PREFERENCES: SpatialWorkspacePreferences = {
  showGrid: true,
  snapToGrid: true,
};

export function useSpatialWorkspacePreferences() {
  const [preferences, setPreferences] = useState(DEFAULT_SPATIAL_PREFERENCES);

  useEffect(() => {
    let cancelled = false;
    void readProjectPreference<Partial<SpatialWorkspacePreferences>>(SPATIAL_WORKSPACE_PREFERENCE_KEY).then((stored) => {
      if (cancelled || !stored) return;
      setPreferences({
        showGrid: typeof stored.showGrid === 'boolean' ? stored.showGrid : DEFAULT_SPATIAL_PREFERENCES.showGrid,
        snapToGrid: typeof stored.snapToGrid === 'boolean' ? stored.snapToGrid : DEFAULT_SPATIAL_PREFERENCES.snapToGrid,
      });
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
    setShowGrid,
    setSnapToGrid,
  };
}
