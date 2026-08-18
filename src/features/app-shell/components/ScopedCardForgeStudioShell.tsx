"use client";

import { useEffect, useState } from 'react';

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
      <div className="min-h-screen bg-[#0c0b09] text-[#f7ead0]">
        <main className="grid min-h-screen place-items-center px-5 py-12">
          <div className="grid max-w-md justify-items-center gap-4 text-center" role="status" aria-live="polite">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#e4aa43] border-t-transparent" aria-hidden="true" />
            <div>
              <h1 className="font-serif text-2xl font-semibold text-[#fff1c7]">Restoring your Studio workspace</h1>
              <p className="mt-2 text-sm leading-6 text-[#cbb58b]">
                CardForge is loading the workspace saved for this account before starting the editor.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <CardForgeStudioShell
      businessIdentity={businessIdentity}
      initialDeveloperAccess={initialDeveloperAccess}
    />
  );
}
