import Link from 'next/link';
import type { ReactNode } from 'react';

export default function ConductorLegalLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#1A1A1C] px-5 py-12 text-[#F6F3EA] sm:py-20">
      <div className="mx-auto max-w-3xl">
        <header className="mb-12 border-b border-[#B08D45]/40 pb-6">
          <Link href="/integrations/conductor/terms" className="text-lg font-semibold tracking-wide text-[#D2B66C]">Pyralis Conductor</Link>
          <p className="mt-2 text-sm text-[#F6F3EA]/75">Integration notices hosted on the CardForge domain</p>
        </header>
        {children}
        <nav aria-label="Conductor legal pages" className="mt-12 flex gap-5 border-t border-[#B08D45]/40 pt-6 text-sm">
          <Link className="underline underline-offset-4" href="/integrations/conductor/terms">Terms</Link>
          <Link className="underline underline-offset-4" href="/integrations/conductor/privacy">Privacy</Link>
          <a className="underline underline-offset-4" href="mailto:pyraliscameron@gmail.com">Contact</a>
        </nav>
      </div>
    </main>
  );
}
