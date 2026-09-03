import { ExternalLink, PlugZap } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type {
  OwnerConnectedService,
  OwnerConnectedServiceStatus,
} from '@/features/owner/lib/ownerOperations';

const statusClassNames: Record<OwnerConnectedServiceStatus, string> = {
  ready: 'border-[var(--cf-success-border)] bg-[#132010] text-[var(--cf-success)]',
  attention: 'border-[var(--cf-warning-border)] bg-[#211506] text-[var(--cf-warning)]',
  disabled: 'border-[var(--cf-border)] bg-[var(--cf-surface)] text-[var(--cf-text-muted)]',
  reference: 'border-[#4b607a] bg-[#101823] text-[#b9d2ee]',
};

export function OwnerConnectedServicesPanel({ services }: { services: OwnerConnectedService[] }) {
  const readyCount = services.filter((service) => service.status === 'ready').length;

  return (
    <section className="border border-[var(--cf-border-strong)] bg-[var(--cf-surface)] p-6" aria-labelledby="connected-services-heading">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 text-[var(--cf-accent-strong)]">
            <PlugZap className="h-5 w-5" />
            <h2 id="connected-services-heading" className="font-serif text-2xl text-[var(--cf-text-strong)]">Connected services</h2>
          </div>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--cf-text-muted)]">
            This is CardForge&apos;s provider map. Open the owning dashboard to change provider state; Owner operations report readiness without copying credentials.
          </p>
        </div>
        <div className="border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] px-4 py-3 text-sm text-[var(--cf-accent-text)]">
          {readyCount} ready / {services.length} tracked
        </div>
      </div>

      <div className="mt-5 overflow-x-auto border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)]">
        <div className="hidden min-w-[54rem] grid-cols-[9rem_11rem_minmax(12rem,1fr)_10rem_auto] gap-3 border-b border-[var(--cf-border-subtle)] px-4 py-3 text-[10px] uppercase tracking-[0.14em] text-[var(--cf-text-subtle)] md:grid">
          <span>Category</span><span>Service</span><span>Connected identity</span><span>Status</span><span>Dashboard</span>
        </div>
        {services.map((service) => (
          <details key={service.id} className="group border-b border-[#342719] last:border-b-0">
            <summary className="grid min-h-14 cursor-pointer list-none gap-2 px-4 py-3 transition-colors hover:bg-[#1b140c] md:min-w-[54rem] md:grid-cols-[9rem_11rem_minmax(12rem,1fr)_10rem_auto] md:items-center md:gap-3">
              <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--cf-text-subtle)]">{service.category}</span>
              <span className="font-semibold text-[var(--cf-accent-text)]">{service.name}</span>
              <span className="min-w-0 truncate text-xs text-[var(--cf-text-subtle)]" title={service.identifier}>{service.identifier}</span>
              <span className={`border px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] ${statusClassNames[service.status]}`}>
                {service.statusLabel}
              </span>
              <Button asChild size="sm" variant="outline"><a href={service.dashboardUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>Open <ExternalLink className="ml-2 h-4 w-4" /></a></Button>
            </summary>
            <div className="grid gap-3 border-t border-[#342719] bg-[var(--cf-surface)] p-4 text-sm md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <p className="leading-6 text-[#d9c28f] md:col-span-2">{service.purpose}</p>
              <dl className="grid gap-3 text-xs leading-5 md:contents">
              <div className="border-l-2 border-[var(--cf-border)] pl-3">
                <dt className="uppercase tracking-[0.12em] text-[var(--cf-text-subtle)]">Ownership</dt>
                <dd className="mt-1 text-[var(--cf-text-muted)]">{service.ownership}</dd>
              </div>
              <div className="border-l-2 border-[var(--cf-danger-border)] pl-3">
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
