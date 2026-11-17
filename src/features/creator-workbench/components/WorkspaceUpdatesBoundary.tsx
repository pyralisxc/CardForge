"use client";

import { useCallback, useRef, type ReactNode } from 'react';
import type { DisplayCard } from '@/domain/rendering';
import { loadCardForgeStudioBootstrap } from '@/features/pipeline/client';
import { PUBLISHED_FONTS_OBSERVED_EVENT } from '@/features/pipeline/client/catalog';
import { CardPreview } from '@/features/card-rendering/client';
import { useEditorPreferences } from '@/features/editor-preferences/client';
import { WorkspaceUpdatesProvider } from '@/features/project/client/ui';
import { getProjectPersistenceScope, type ProjectPersistenceScope } from '@/features/project/client/persistence-workspace';
const renderPreview = (card: DisplayCard, face: 'front' | 'back', targetWidthPx: number, highlightedElementId?: string) => (
  <CardPreview card={card} face={face} targetWidthPx={targetWidthPx} highlightedElementId={highlightedElementId} />
);

export function WorkspaceUpdatesBoundary({ scope, children }: { scope: ProjectPersistenceScope; children: ReactNode }) {
  const preferences = useEditorPreferences(scope);
  const sourceObservation = useRef(0);
  const loadSources = useCallback(async (signal?: AbortSignal) => {
    const observation = ++sourceObservation.current;
    const result = await loadCardForgeStudioBootstrap({ fresh: true, signal });
    signal?.throwIfAborted();
    if (scope !== getProjectPersistenceScope()) throw new Error('The active account changed. Reopen Updates.');
    if (!Array.isArray(result?.templates?.defaults) || !Array.isArray(result?.fonts?.fonts)) throw new Error('The published catalog returned an invalid response.');
    if (observation === sourceObservation.current) {
      window.dispatchEvent(new CustomEvent(PUBLISHED_FONTS_OBSERVED_EVENT, { detail: { scope, fonts: result.fonts.fonts } }));
    }
    return result.templates.defaults;
  }, [scope]);
  return <WorkspaceUpdatesProvider key={scope} scope={scope} loadSources={loadSources} renderPreview={renderPreview} preferences={{
    ready: preferences.preferencesReady,
    notificationsEnabled: preferences.updateNotificationsEnabled !== false,
    automaticChecks: preferences.automaticUpdateChecks !== false,
    intervalSeconds: preferences.updateCheckIntervalSeconds ?? 900,
    error: preferences.preferenceReadError ?? preferences.preferenceWriteError,
    retry: preferences.retryPreferenceRead,
    setNotificationsEnabled: preferences.setUpdateNotificationsEnabled,
    setAutomaticChecks: preferences.setAutomaticUpdateChecks,
    setIntervalSeconds: preferences.setUpdateCheckIntervalSeconds,
  }}>{children}</WorkspaceUpdatesProvider>;
}
