import Link from 'next/link';
import { Hammer } from 'lucide-react';

import type { LegalDocument, OwnerSettings } from '@/lib/ownerConsole';

export function PublicLegalPage({
  document,
  settings,
}: {
  document: LegalDocument;
  settings: OwnerSettings;
}) {
  return (
    <main className="min-h-screen bg-[#0c0b09] text-[#f7ead0]">
      <header className="border-b border-[#5f4526] bg-[#120e09]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5 md:px-8">
          <Link href="/" prefetch={false} className="flex items-center gap-3 text-[#f9e7b7]">
            <span className="grid h-10 w-10 place-items-center border border-[#d7b469]/70 bg-[#1c130b] text-[#f2c15d]">
              <Hammer className="h-5 w-5" />
            </span>
            <span className="font-serif text-xl font-semibold">{settings.businessName}</span>
          </Link>
          <Link href="/account" prefetch={false} className="text-sm text-[#dbc79e] hover:text-[#fff3ca]">Account</Link>
        </div>
      </header>

      <article className="mx-auto max-w-5xl px-5 py-12 md:px-8">
        <p className="text-sm uppercase tracking-[0.2em] text-[#e2aa4a]">CardForge legal</p>
        <h1 className="mt-4 font-serif text-4xl text-[#fff1c7] md:text-5xl">{document.title}</h1>
        <div className="mt-8 space-y-5 border border-[#5f4526] bg-[#15100a] p-6 text-sm leading-7 text-[#d2bd91] md:p-8">
          {document.body.split(/\n{2,}/).map((paragraph, index) => (
            <p key={`${document.slug}-${index}`}>{paragraph}</p>
          ))}
        </div>
        <div className="mt-8 border border-[#5f4526] bg-[#100c08] p-5 text-sm leading-6 text-[#c7b288]">
          <p>Business: {settings.businessName}</p>
          <p>Owner/contact: {settings.ownerName}</p>
          <p>Support email: <a className="text-[#ffe7ad] underline" href={`mailto:${settings.supportEmail}`}>{settings.supportEmail}</a></p>
          {settings.supportPhone ? <p>Support phone: {settings.supportPhone}</p> : null}
        </div>
      </article>
    </main>
  );
}
