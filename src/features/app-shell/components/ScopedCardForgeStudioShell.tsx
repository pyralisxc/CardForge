"use client";

import { useEffect, useState } from 'react';

import { CardForgeWorkspaceState } from '@/components/ui/cardforge-presentation';
import {
  hydrateProjectWorkspaceForScope,
  type ProjectPersistenceScope,
} from '@/features/project/client';
import { CardForgeStudioShell, type StudioBusinessIdentity } from './CardForgeStudioShell';
import type { DeveloperAccessSessionState } from '@/features/developer-access/client';

export function ScopedCardForgeStudioShell({
  businessIdentity,
  initialDeveloperAccess,
  persistenceScope,
}: {
  businessIdentity: StudioBusinessIdentity;
  initialDeveloperAccess: DeveloperAccessSessionState;
  persistenceScope: ProjectPersistenceScope;
}) {
  const [isWorkspaceReady, setIsWorkspaceReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsWorkspaceReady(false);

    void hydrateProjectWorkspaceForScope(persistenceScope)
      .catch((error) => {
        console.error('Unable to hydrate the scoped CardForge workspace.', error);
      })
      .finally(() => {
        if (!cancelled) setIsWorkspaceReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [persistenceScope]);

  if (!isWorkspaceReady) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--cf-canvas)] px-5 py-12 text-[var(--cf-text)]">
        <CardForgeWorkspaceState
          state="loading"
          message="Restoring your Studio workspace. CardForge is loading the workspace saved for this account before starting the editor."
          className="grid min-h-0 w-full max-w-md place-items-center text-center"
        />
      </main>
    );
  }

  return (
    <div className="cardforge-application-viewport cardforge-studio-workspace">
      <CardForgeStudioShell
        businessIdentity={businessIdentity}
        initialDeveloperAccess={initialDeveloperAccess}
      />
    </div>
  );
}
