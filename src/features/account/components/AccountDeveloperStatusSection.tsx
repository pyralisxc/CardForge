import Link from 'next/link';
import { ArrowRight, Crown, Wrench } from 'lucide-react';

import { Button } from '@/components/ui/button';

export function AccountDeveloperStatusSection({
  isOwner,
  isDeveloper,
}: {
  isOwner: boolean;
  isDeveloper: boolean;
}) {
  if (!isOwner && !isDeveloper) return null;

  return (
    <section>
      <div className="flex items-center gap-3 border-b border-[var(--cf-border)] pb-4 text-[var(--cf-accent-strong)]">
        {isOwner ? <Crown className="h-5 w-5" aria-hidden="true" /> : <Wrench className="h-5 w-5" aria-hidden="true" />}
        <div>
          <h3 className="text-sm font-semibold text-[var(--cf-text-strong)]">{isOwner ? 'Owner & developer access' : 'Developer Program access'}</h3>
          <p className="mt-1 text-xs text-[var(--cf-text-muted)]">{isOwner ? 'Operational and contributor permissions are active.' : 'Contributor permissions are active.'}</p>
        </div>
      </div>
      <div className="divide-y divide-[var(--cf-border-subtle)] border-b border-[var(--cf-border)]">
        {isOwner ? (
          <div className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div><p className="text-sm font-semibold text-[var(--cf-text-strong)]">Owner Console</p><p className="mt-1 text-xs text-[var(--cf-text-muted)]">Manage live product operations, governance, people, and growth.</p></div>
            <Button asChild size="sm" className="bg-[var(--cf-accent-strong)] text-[var(--cf-accent-contrast)] hover:brightness-110"><Link href="/owner" prefetch={false}>Open console <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div><p className="text-sm font-semibold text-[var(--cf-text-strong)]">Developer Cockpit</p><p className="mt-1 text-xs text-[var(--cf-text-muted)]">Prepare reviewable shared-library work and contribution proposals.</p></div>
          <Button asChild size="sm" variant="outline" className="border-[var(--cf-accent)] bg-transparent text-[var(--cf-accent-text)] hover:bg-[var(--cf-surface-hover)] hover:text-[var(--cf-text-strong)]"><Link href="/developer/cockpit" prefetch={false}>Open cockpit <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
        </div>
      </div>
    </section>
  );
}
