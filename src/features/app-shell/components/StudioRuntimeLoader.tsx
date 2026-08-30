"use client";

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

import type { ContributorAccessSessionState } from '@/features/contributor-access/client';
import type { ProjectPersistenceScope } from '@/features/project/client';

export type StudioRuntimeBusinessIdentity = {
  brandName: string;
  copyrightHolder: string;
};

type IdleCapableWindow = Window & typeof globalThis & {
  requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
  cancelIdleCallback?: (handle: number) => void;
};

const DeferredStudioShell = dynamic(
  () => import('./ScopedCardForgeStudioShell').then((module) => module.ScopedCardForgeStudioShell),
  { ssr: false },
);

export function StudioRuntimeLoader({
  businessIdentity,
  initialContributorAccess,
  persistenceScope,
}: {
  businessIdentity: StudioRuntimeBusinessIdentity;
  initialContributorAccess: ContributorAccessSessionState;
  persistenceScope: ProjectPersistenceScope;
}) {
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
        initialContributorAccess={initialContributorAccess}
        persistenceScope={persistenceScope}
      />
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--cf-canvas)] text-[var(--cf-text)]">
      <header className="cardforge-studio-workspace-nav flex min-h-14 items-center gap-3 border-b border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] px-3 py-1.5 lg:px-5">
        <div className="grid h-8 w-8 place-items-center border border-[var(--cf-accent)]/70 bg-[var(--cf-surface-raised)] text-xs font-bold text-[var(--cf-accent-strong)]">CF</div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--cf-accent-strong)]">Studio</p>
          <p className="truncate text-sm font-semibold text-[var(--cf-text-strong)]">{businessIdentity.brandName}</p>
        </div>
      </header>
      <main className="grid flex-1 place-items-center px-5 py-12">
        <div className="grid max-w-md justify-items-center gap-4 text-center" role="status" aria-live="polite">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-[var(--cf-accent-strong)] border-t-transparent" aria-hidden="true" />
          <div>
            <h1 className="font-serif text-2xl font-semibold text-[var(--cf-text-strong)]">Opening CardForge Studio</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--cf-text-muted)]">
              Your CardForge session is ready. The editor is loading separately so the page can become responsive first.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
