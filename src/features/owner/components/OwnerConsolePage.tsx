"use client";

import dynamic from 'next/dynamic';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TooltipProvider } from '@/components/ui/tooltip';
import { OwnerConsoleSummary } from '@/features/owner/components/OwnerConsoleSummary';
import { useOwnerConsole } from '@/features/owner/hooks/useOwnerConsole';

const panelFallback = () => <div className="min-h-48 animate-pulse border border-[#5f4526] bg-[#15100a]" />;

const OwnerReadinessPanel = dynamic(
  () => import('./OwnerReadinessPanel').then((module) => module.OwnerReadinessPanel),
  { loading: panelFallback },
);
const OwnerOperationsPanel = dynamic(
  () => import('./OwnerOperationsPanel').then((module) => module.OwnerOperationsPanel),
  { loading: panelFallback },
);
const OwnerPublicContentPanel = dynamic(
  () => import('./OwnerPublicContentPanel').then((module) => module.OwnerPublicContentPanel),
  { loading: panelFallback },
);
const OwnerAccessPanel = dynamic(
  () => import('./OwnerAccessPanel').then((module) => module.OwnerAccessPanel),
  { loading: panelFallback },
);
const OwnerLegalPanel = dynamic(
  () => import('./OwnerLegalPanel').then((module) => module.OwnerLegalPanel),
  { loading: panelFallback },
);
const OwnerDeveloperProgramPanel = dynamic(
  () => import('@/features/developer-assets/client/owner').then((module) => module.OwnerDeveloperProgramPanel),
  { loading: panelFallback },
);

const tabClassName = "rounded-none border border-transparent px-4 py-2 text-[#c7b288] data-[state=active]:border-[#d8b365] data-[state=active]:bg-[#2a1b0d] data-[state=active]:text-[#ffe7ad]";

export function OwnerConsolePage() {
  const {
    isLoading,
    isSlowLoad,
    lastOwnerSaveAt,
    loadError,
    payload,
    retry,
    updateConsole,
  } = useOwnerConsole();

  if (!payload && isLoading) {
    return (
      <main className="min-h-screen bg-[#0c0b09] text-[#f7ead0]">
        <section className="mx-auto max-w-7xl px-5 py-6 md:px-8">
          <div className="border border-[#6d4f2b] bg-[#15100a] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-xs uppercase tracking-[0.18em] text-[#a98a55]">Owner console</p><h1 className="font-serif text-2xl text-[#fff1c7]">Loading workstation</h1></div>
              <div className="h-2 w-32 animate-pulse bg-[#4a3823]" />
            </div>
            {isSlowLoad ? <p className="mt-4 border border-[#8c6436] bg-[#1b1209] p-3 text-sm leading-6 text-[#f0bd75]">This is taking longer than expected. The console should recover automatically.</p> : null}
          </div>
        </section>
      </main>
    );
  }

  if (!payload) {
    return (
      <main className="min-h-screen bg-[#0c0b09] text-[#f7ead0]">
        <section className="mx-auto max-w-7xl px-5 py-6 md:px-8">
          <div className="border border-[#7d3d32] bg-[#1b0d09] p-6 text-[#ffd0c6]">
            <h1 className="font-serif text-3xl text-[#fff1c7]">Owner console unavailable</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6">{loadError ?? 'Owner access is required. Sign in with the owner account or set trusted owner metadata.'}</p>
            <Button type="button" className="mt-5 bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]" onClick={retry}>Retry owner console</Button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <TooltipProvider>
      <main className="min-h-screen bg-[#0c0b09] text-[#f7ead0]">
        <section className="mx-auto max-w-7xl space-y-4 px-5 py-6 md:px-8">
          <OwnerConsoleSummary payload={payload} lastOwnerSaveAt={lastOwnerSaveAt} />
          <Tabs defaultValue="operations" className="space-y-4">
            <TabsList className="flex h-auto flex-wrap justify-start gap-2 rounded-none border border-[#5f4526] bg-[#100c08] p-2">
              <TabsTrigger value="readiness" className={tabClassName}>Launch Readiness</TabsTrigger>
              <TabsTrigger value="operations" className={tabClassName}>Operations</TabsTrigger>
              <TabsTrigger value="copy" className={tabClassName}>Site Copy</TabsTrigger>
              <TabsTrigger value="site" className={tabClassName}>Site Mechanics</TabsTrigger>
              <TabsTrigger value="access" className={tabClassName}>Access & Promos</TabsTrigger>
              <TabsTrigger value="developer" className={tabClassName}>Contributor Program</TabsTrigger>
              <TabsTrigger value="legal" className={tabClassName}>Legal & Secrets</TabsTrigger>
            </TabsList>
            <TabsContent value="readiness" className="mt-0"><OwnerReadinessPanel consolePayload={payload.console} onConsoleChange={updateConsole} /></TabsContent>
            <TabsContent value="operations" className="mt-0"><OwnerOperationsPanel payload={payload} /></TabsContent>
            <TabsContent value="copy" className="mt-0"><OwnerPublicContentPanel consolePayload={payload.console} mode="copy" onConsoleChange={updateConsole} /></TabsContent>
            <TabsContent value="site" className="mt-0"><OwnerPublicContentPanel consolePayload={payload.console} mode="mechanics" onConsoleChange={updateConsole} /></TabsContent>
            <TabsContent value="access" className="mt-0"><OwnerAccessPanel consolePayload={payload.console} onConsoleChange={updateConsole} /></TabsContent>
            <TabsContent value="developer" className="mt-0"><OwnerDeveloperProgramPanel /></TabsContent>
            <TabsContent value="legal" className="mt-0"><OwnerLegalPanel consolePayload={payload.console} onConsoleChange={updateConsole} /></TabsContent>
          </Tabs>
        </section>
      </main>
    </TooltipProvider>
  );
}
