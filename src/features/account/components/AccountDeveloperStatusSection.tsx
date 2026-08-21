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
    <section className="border border-[var(--cf-accent)] bg-[var(--cf-surface-raised)] p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] md:p-5">
      <div className="flex items-center gap-3 text-[var(--cf-accent-strong)]">
        {isOwner ? <Crown className="h-5 w-5" aria-hidden="true" /> : <Wrench className="h-5 w-5" aria-hidden="true" />}
        <h3 className="font-serif text-xl text-[var(--cf-text-strong)]">{isOwner ? 'Owner & developer access' : 'Developer Program access'}</h3>
      </div>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--cf-text-muted)]">
        {isOwner
          ? 'Manage the live CardForge product and use the contributor workspace for reviewable shared-library work.'
          : 'Use your private contributor workspace to prepare and submit shared CardForge assets for owner review.'}
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        {isOwner ? (
          <Button asChild className="bg-[var(--cf-accent-strong)] text-[var(--cf-accent-contrast)] hover:brightness-110">
            <Link href="/owner" prefetch={false}>Open Owner Console <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        ) : null}
        <Button asChild variant="outline" className="border-[var(--cf-accent)] bg-transparent text-[var(--cf-accent-text)] hover:bg-[var(--cf-surface-hover)] hover:text-[var(--cf-text-strong)]">
          <Link href="/developer/cockpit" prefetch={false}>Open Developer Cockpit <ArrowRight className="ml-2 h-4 w-4" /></Link>
        </Button>
      </div>
    </section>
  );
}