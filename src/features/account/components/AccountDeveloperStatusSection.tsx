import Link from 'next/link';
import { ArrowRight, Crown, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';

export function AccountDeveloperStatusSection({
  authSetupIncomplete,
  isDeveloper,
  isOwner,
  ownerSource,
  showAccountLinks = false,
  showStatusPanels = true,
}: {
  authSetupIncomplete: boolean;
  isDeveloper: boolean;
  isOwner: boolean;
  ownerSource: string;
  showAccountLinks?: boolean;
  showStatusPanels?: boolean;
}) {
  return (
    <>
      {showStatusPanels && isOwner ? (
        <div className="border border-[#8a642f] bg-[#1b1209] p-4 shadow-[inset_0_0_0_1px_rgba(255,224,157,0.08)]">
          <div className="flex items-center gap-3 text-[#f0c568]"><Crown className="h-5 w-5" /><h2 className="font-serif text-xl text-[#fff1c7]">Owner Forge</h2></div>
          <p className="mt-3 text-sm leading-5 text-[#d5be8c]">Business profile, legal pages, provider readiness, contributor rules, and asset tier command are unlocked.</p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row lg:flex-col">
            <Button asChild className="bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]"><Link href="/owner" prefetch={false}>Open Owner Console <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
            <span className="text-xs uppercase tracking-[0.16em] text-[#a98a55]">Source: {ownerSource === 'clerk_private_metadata' ? 'trusted private role' : 'server owner allowlist'}</span>
          </div>
        </div>
      ) : null}
      {showStatusPanels && authSetupIncomplete ? (
        <div className="border border-[#7d5a2e] bg-[#181009] p-4">
          <div className="flex items-center gap-3 text-[#e2aa4a]"><ShieldCheck className="h-5 w-5" /><h2 className="font-serif text-xl text-[#fff1c7]">Clerk test path</h2></div>
          <ol className="mt-4 space-y-2 text-sm leading-5 text-[#c7b288]">
            <li>Add <code className="text-[#f6d98e]">CLERK_SECRET_KEY</code> to <code className="text-[#f6d98e]">.env.local</code>.</li>
            <li>Restart <code className="text-[#f6d98e]">npm run dev</code> so middleware and account APIs pick it up.</li>
            <li>Sign in here, then set <code className="text-[#f6d98e]">cardforgeAccess</code> in Clerk private metadata for dev or paid tests.</li>
          </ol>
        </div>
      ) : null}
      {showAccountLinks ? (
        <div className="grid gap-3 md:grid-cols-3">
          <StatusLink href="/roadmap" eyebrow="Public priorities" title="Roadmap and feature voting" copy="Vote on compact feature ideas and follow the living launch path for the forge." />
          <StatusLink href="/developer" eyebrow="Forge Review" title={isDeveloper ? 'Open developer hub' : 'Join the forge'} copy="Review assets, submit work, or learn the standards for contributing to the shared library." />
          <StatusLink href={isOwner ? '/owner' : '/contact'} eyebrow={isOwner ? 'Library Command' : 'Support'} title={isOwner ? 'Open owner console' : 'Questions or access help'} copy={isOwner ? 'Configure launch rules, access caps, legal pages, and library mechanics.' : 'Reach out about accounts, beta access, exports, or developer review.'} />
        </div>
      ) : null}
    </>
  );
}

function StatusLink({ href, eyebrow, title, copy }: { href: string; eyebrow: string; title: string; copy: string }) {
  return (
    <Link href={href} prefetch={false} className="border border-[#5f4526] bg-[#15100a] p-4 transition hover:border-[#d8b365] hover:bg-[#1b1209]">
      <p className="text-xs uppercase tracking-[0.16em] text-[#a98a55]">{eyebrow}</p>
      <h2 className="mt-2 font-serif text-xl text-[#fff1c7]">{title}</h2>
      <p className="mt-2 text-sm leading-5 text-[#c7b288]">{copy}</p>
    </Link>
  );
}
