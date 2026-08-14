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

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {services.map((service) => (
          <article key={service.id} className="flex flex-col border border-[#4a3823] bg-[#100c08] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-[#8f7b57]">{service.category}</p>
                <h3 className="mt-1 font-serif text-xl text-[#fff1c7]">{service.name}</h3>
                <p className="mt-1 text-xs text-[#a98a75]">{service.identifier}</p>
              </div>
              <span className={`border px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] ${statusClassNames[service.status]}`}>
                {service.statusLabel}
              </span>
            </div>
            <p className="mt-4 text-sm leading-6 text-[#d9c28f]">{service.purpose}</p>
            <dl className="mt-4 grid gap-3 text-xs leading-5">
              <div className="border-l-2 border-[#5f4526] pl-3">
                <dt className="uppercase tracking-[0.12em] text-[#8f7b57]">Ownership</dt>
                <dd className="mt-1 text-[#c7b288]">{service.ownership}</dd>
              </div>
              <div className="border-l-2 border-[#7d3d32] pl-3">
                <dt className="uppercase tracking-[0.12em] text-[#b47768]">If removed</dt>
                <dd className="mt-1 text-[#d9b29f]">{service.removalImpact}</dd>
              </div>
            </dl>
            <div className="mt-auto pt-4">
              <Button asChild size="sm" variant="outline">
                <a href={service.dashboardUrl} target="_blank" rel="noreferrer">
                  Open {service.name} <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
