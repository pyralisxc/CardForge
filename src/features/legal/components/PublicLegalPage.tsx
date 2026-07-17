import Link from 'next/link';
import React from 'react';
import { Hammer } from 'lucide-react';

import {
  formatBusinessIdentityDescription,
  type BusinessIdentity,
} from '@/features/business-identity/client';
import type { LegalDocument } from '@/features/legal/client';
import { LegalDocumentBody } from './LegalDocumentBody';

const trustLinks = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/creator-pass-terms', label: 'Creator Pass' },
  { href: '/supporter-terms', label: 'Supporters' },
  { href: '/refund', label: 'Refunds' },
  { href: '/developer-terms', label: 'Developers' },
  { href: '/accessibility', label: 'Accessibility' },
  { href: '/contact', label: 'Contact' },
] as const;

const formatPublishedDate = (value: string | null) => {
  if (!value) return 'Owner-editable draft';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Owner-editable draft';
  return `Last updated ${date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}`;
};

export function PublicLegalPage({
  children,
  businessIdentity,
  document,
}: {
  children?: React.ReactNode;
  businessIdentity: BusinessIdentity;
  document: LegalDocument;
}) {
  return (
    <main className="min-h-screen bg-[#0c0b09] text-[#f7ead0]">
      <header className="border-b border-[#5f4526] bg-[#120e09]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5 md:px-8">
          <Link href="/" prefetch={false} className="flex items-center gap-3 text-[#f9e7b7]">
            <span className="grid h-10 w-10 place-items-center border border-[#d7b469]/70 bg-[#1c130b] text-[#f2c15d]">
              <Hammer className="h-5 w-5" />
            </span>
            <span className="font-serif text-xl font-semibold">{businessIdentity.brandName}</span>
          </Link>
          <nav className="flex flex-wrap justify-end gap-4 text-sm text-[#dbc79e]">
            <Link href="/developer" prefetch={false} className="hover:text-[#fff3ca]">Developers</Link>
            <Link href="/account" prefetch={false} className="hover:text-[#fff3ca]">Account</Link>
          </nav>
        </div>
      </header>

      <article className="mx-auto max-w-5xl px-5 py-12 md:px-8">
        <p className="text-sm uppercase tracking-[0.2em] text-[#e2aa4a]">CardForge trust center</p>
        <h1 className="mt-4 font-serif text-4xl text-[#fff1c7] md:text-5xl">{document.title}</h1>
        <p className="mt-3 text-sm text-[#baa67e]">{formatPublishedDate(document.publishedAt)}</p>
        <div className="mt-8">
          <LegalDocumentBody body={document.body} />
        </div>
        {children}
        <div className="mt-8 border border-[#5f4526] bg-[#100c08] p-5 text-sm leading-6 text-[#c7b288]">
          <p className="mb-3 text-xs uppercase tracking-[0.16em] text-[#d8b365]">Business contact</p>
          <p>{formatBusinessIdentityDescription(businessIdentity)}</p>
          <p>Legal operator: {businessIdentity.legalOperatorName}</p>
          <p>Jurisdiction: {businessIdentity.jurisdictionState}, {businessIdentity.jurisdictionCountry}</p>
          <p>Support email: <a className="text-[#ffe7ad] underline" href={`mailto:${businessIdentity.supportEmail}`}>{businessIdentity.supportEmail}</a></p>
          <p>Legal and privacy email: <a className="text-[#ffe7ad] underline" href={`mailto:${businessIdentity.legalEmail}`}>{businessIdentity.legalEmail}</a></p>
          {businessIdentity.supportPhone ? <p>Support phone: {businessIdentity.supportPhone}</p> : null}
        </div>
        <nav className="mt-8 flex flex-wrap gap-3 text-sm text-[#dbc79e]" aria-label="Trust center pages">
          {trustLinks.map((link) => (
            <Link key={link.href} href={link.href} prefetch={false} className="border border-[#5f4526] bg-[#120e09] px-3 py-2 hover:border-[#d8b365] hover:text-[#fff3ca]">
              {link.label}
            </Link>
          ))}
        </nav>
        <p className="mt-6 text-xs leading-5 text-[#8f7b57]">
          These pages are product-facing policy text for CardForge's beta launch and should be reviewed by a qualified attorney before paid production use.
        </p>
      </article>
    </main>
  );
}
