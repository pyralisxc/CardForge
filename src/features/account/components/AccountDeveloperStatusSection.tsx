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
    <section className="border border-[#8a642f] bg-[#1b1209] p-4 shadow-[inset_0_0_0_1px_rgba(255,224,157,0.08)] md:p-5">
      <div className="flex items-center gap-3 text-[#f0c568]">
        {isOwner ? <Crown className="h-5 w-5" aria-hidden="true" /> : <Wrench className="h-5 w-5" aria-hidden="true" />}
        <h3 className="font-serif text-xl text-[#fff1c7]">{isOwner ? 'Owner & developer access' : 'Developer Program access'}</h3>
      </div>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[#d5be8c]">
        {isOwner
          ? 'Manage the live CardForge product and use the contributor workspace for reviewable shared-library work.'
          : 'Use your private contributor workspace to prepare and submit shared CardForge assets for owner review.'}
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        {isOwner ? (
          <Button asChild className="bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]">
            <Link href="/owner" prefetch={false}>Open Owner Console <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        ) : null}
        <Button asChild variant="outline" className="border-[#d8b365]/70 bg-transparent text-[#f8e3b0] hover:bg-[#2a1b0d] hover:text-[#fff1c7]">
          <Link href="/developer/cockpit" prefetch={false}>Open Developer Cockpit <ArrowRight className="ml-2 h-4 w-4" /></Link>
        </Button>
      </div>
    </section>
  );
}
