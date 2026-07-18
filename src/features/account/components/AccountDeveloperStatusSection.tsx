import Link from 'next/link';
import { ArrowRight, Crown } from 'lucide-react';

import { Button } from '@/components/ui/button';

export function AccountDeveloperStatusSection({ isOwner }: { isOwner: boolean }) {
  if (!isOwner) return null;

  return (
    <section className="border border-[#8a642f] bg-[#1b1209] p-4 shadow-[inset_0_0_0_1px_rgba(255,224,157,0.08)]">
      <div className="flex items-center gap-3 text-[#f0c568]">
        <Crown className="h-5 w-5" aria-hidden="true" />
        <h2 className="font-serif text-xl text-[#fff1c7]">Owner tools</h2>
      </div>
      <p className="mt-3 text-sm leading-5 text-[#d5be8c]">Manage the public CardForge site and launch settings.</p>
      <Button asChild className="mt-5 bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]">
        <Link href="/owner" prefetch={false}>Open Owner Console <ArrowRight className="ml-2 h-4 w-4" /></Link>
      </Button>
    </section>
  );
}
