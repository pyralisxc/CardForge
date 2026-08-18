"use client";

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

import type { DeveloperAccessSessionState } from '@/features/developer-access/client';
import { setProjectPersistenceScope, type ProjectPersistenceScope } from '@/features/project/client';

export type StudioRuntimeBusinessIdentity = {
  brandName: string;
  copyrightHolder: string;
};

type IdleCapableWindow = Window & typeof globalThis & {
  requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
  cancelIdleCallback?: (handle: number) => void;
};

const DeferredStudioShell = dynamic(
  () => import('./CardForgeStudioShell').then((module) => module.CardForgeStudioShell),
  { ssr: false },
);

export function StudioRuntimeLoader({
  businessIdentity,
  initialDeveloperAccess,
  persistenceScope,
}: {
  businessIdentity: StudioRuntimeBusinessIdentity;
  initialDeveloperAccess: DeveloperAccessSessionState;
  persistenceScope: ProjectPersistenceScope;
}) {
  // The heavy Studio bundle owns the Zustand workspace store. Set the account scope
  // before that bundle is allowed to load so automatic hydration cannot touch legacy
  // browser-global project state.
  setProjectPersistenceScope(persistenceScope);

  const [shouldLoadRuntime, setShouldLoadRuntime] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let idleId: number | null = null;
    const browser = window as IdleCapableWindow;

    const startRuntime = () => {
      if (!cancelled) setShouldLoadRuntime(true);
    };

    if (typeof browser.requestIdleCallback === 'function') {
      idleId = browser.requestIdleCallback(startRuntime, { timeout: 800 });
    } else {
      timeoutId = setTimeout(startRuntime, 75);
    }

    return () => {
      cancelled = true;
      if (idleId !== null && typeof browser.cancelIdleCallback === 'function') {
        browser.cancelIdleCallback(idleId);
      }
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, []);

  if (shouldLoadRuntime) {
    return (
      <DeferredStudioShell
        businessIdentity={businessIdentity}
        initialDeveloperAccess={initialDeveloperAccess}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0c0b09] text-[#f7ead0]">
      <header className="border-b border-[#5f4526] bg-[#120e09] px-4 py-4 shadow-[0_10px_30px_rgba(0,0,0,0.28)]">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <div className="grid h-10 w-10 place-items-center border border-[#d7b469]/70 bg-[#1c130b] text-sm font-bold text-[#f2c15d]">CF</div>
          <div>
            <p className="font-serif text-xl font-semibold text-[#fff1c7]">{businessIdentity.brandName}</p>
            <p className="text-xs uppercase tracking-[0.16em] text-[#bda878]">Studio</p>
          </div>
        </div>
      </header>
      <main className="mx-auto grid min-h-[70vh] max-w-7xl place-items-center px-5 py-12">
        <div className="grid max-w-md justify-items-center gap-4 text-center" role="status" aria-live="polite">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#e4aa43] border-t-transparent" aria-hidden="true" />
          <div>
            <h1 className="font-serif text-2xl font-semibold text-[#fff1c7]">Opening CardForge Studio</h1>
            <p className="mt-2 text-sm leading-6 text-[#cbb58b]">
              Your CardForge session is ready. The editor is loading separately so the page can become responsive first.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
