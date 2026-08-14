import { ExternalLink, PlugZap } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type {
  OwnerConnectedService,
  OwnerConnectedServiceStatus,
} from '@/features/owner/lib/ownerConsole';

const statusClassNames: Record<OwnerConnectedServiceStatus, string> = {
  ready: 'border-[#5f7f54] bg-[#132010] text-[#bde3a8]',
  attention: 'border-[#8c6436] bg-[#211506] text-[#f0bd75]',
  disabled: 'border-[#5f4526] bg-[#15100a] text-[#c7b288]',
  reference: 'border-[#4b607a] bg-[#101823] text-[#b9d2ee]',
};

export function OwnerConnectedServicesPanel({ services }: { services: OwnerConnectedService[] }) {
  const readyCount = services.filter((service) => service.status === 'ready').length;

  return (
    <section className="border border-[#6d4f2b] bg-[#15100a] p-6" aria-labelledby="connected-services-heading">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 text-[#e2aa4a]">
            <PlugZap className="h-5 w-5" />
            <h2 id="connected-services-heading" className="font-serif text-2xl text-[#fff1c7]">Connected services</h2>
          </div>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-[#c7b288]">
            This is CardForge&apos;s provider map. Open the owning dashboard to change provider state; this console reports readiness without copying credentials.
          </p>
        </div>
        <div className="border border-[#5f4526] bg-[#100c08] px-4 py-3 text-sm text-[#ffe7ad]">
          {readyCount} ready / {services.length} tracked
        </div>
      </div>

      <div className="mt-5 overflow-x-auto border border-[#4a3823] bg-[#100c08]">
        <div className="hidden min-w-[54rem] grid-cols-[9rem_11rem_minmax(12rem,1fr)_10rem_auto] gap-3 border-b border-[#4a3823] px-4 py-3 text-[10px] uppercase tracking-[0.14em] text-[#8f7b57] md:grid">
          <span>Category</span><span>Service</span><span>Connected identity</span><span>Status</span><span>Dashboard</span>
        </div>
        {services.map((service) => (
          <details key={service.id} className="group border-b border-[#342719] last:border-b-0">
            <summary className="grid min-h-14 cursor-pointer list-none gap-2 px-4 py-3 transition-colors hover:bg-[#1b140c] md:min-w-[54rem] md:grid-cols-[9rem_11rem_minmax(12rem,1fr)_10rem_auto] md:items-center md:gap-3">
              <span className="text-[10px] uppercase tracking-[0.14em] text-[#8f7b57]">{service.category}</span>
              <span className="font-semibold text-[#ffe7ad]">{service.name}</span>
              <span className="min-w-0 truncate text-xs text-[#a98a75]" title={service.identifier}>{service.identifier}</span>
              <span className={`border px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] ${statusClassNames[service.status]}`}>
                {service.statusLabel}
              </span>
              <Button asChild size="sm" variant="outline"><a href={service.dashboardUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>Open <ExternalLink className="ml-2 h-4 w-4" /></a></Button>
            </summary>
            <div className="grid gap-3 border-t border-[#342719] bg-[#15100a] p-4 text-sm md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <p className="leading-6 text-[#d9c28f] md:col-span-2">{service.purpose}</p>
              <dl className="grid gap-3 text-xs leading-5 md:contents">
              <div className="border-l-2 border-[#5f4526] pl-3">
                <dt className="uppercase tracking-[0.12em] text-[#8f7b57]">Ownership</dt>
                <dd className="mt-1 text-[#c7b288]">{service.ownership}</dd>
              </div>
              <div className="border-l-2 border-[#7d3d32] pl-3">
                <dt className="uppercase tracking-[0.12em] text-[#b47768]">If removed</dt>
                <dd className="mt-1 text-[#d9b29f]">{service.removalImpact}</dd>
              </div>
              </dl>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
