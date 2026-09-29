"use client";

import { useEffect, useState } from 'react';

import { deriveDeskArrivalPhase, type DeskArrivalPhase } from '../model/deskArrival';

export function useDeskArrival({
  scopeKey,
  acquisitionReady,
  compositionReady,
}: {
  scopeKey: string;
  acquisitionReady: boolean;
  compositionReady: boolean;
}) {
  const [presentation, setPresentation] = useState({ scopeKey, presented: false });
  const presented = presentation.scopeKey === scopeKey && presentation.presented;
  const phase: DeskArrivalPhase = deriveDeskArrivalPhase({ presented, acquisitionReady, compositionReady });

  useEffect(() => {
    if (presentation.scopeKey !== scopeKey) {
      setPresentation({ scopeKey, presented: false });
      return;
    }
    if (!presentation.presented && acquisitionReady && compositionReady) {
      setPresentation({ scopeKey, presented: true });
    }
  }, [acquisitionReady, compositionReady, presentation.presented, presentation.scopeKey, scopeKey]);

  return {
    phase,
    ready: phase === 'ready',
  };
}
