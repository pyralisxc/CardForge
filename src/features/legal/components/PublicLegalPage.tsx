import Link from 'next/link';
import React from 'react';

import {
  formatBusinessIdentityDescription,
  type BusinessIdentity,
} from '@/features/business-identity/client';
import type { LegalDocument } from '@/features/legal/client';
import { PublicSiteShell } from '@/features/public-site/client/shell';
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
    <PublicSiteShell
      businessIdentity={businessIdentity}
      currentPath={`/${document.slug}`}
      mainClassName="bg-[var(--public-obsidian)] text-[var(--public-text)]"
    >
      <article className="mx-auto max-w-5xl px-5 py-[var(--public-space)] md:px-8">
        <p className="text-base font-bold text-[var(--public-brass)]">CardForge trust center</p>
        <h1 className="mt-3 font-[var(--public-font-display)] text-4xl font-semibold text-[var(--public-ivory)] md:text-5xl">
          {document.title}
        </h1>
        <p className="mt-3 text-base text-[var(--public-muted-text)]">{formatPublishedDate(document.publishedAt)}</p>
        <div className="mt-8 [&>div]:text-base">
          <LegalDocumentBody body={document.body} />
        </div>
        {children}
        <div className="mt-10 rounded-[var(--public-radius)] border border-[var(--public-border)] bg-[var(--public-surface)] p-5 text-base leading-7 text-[var(--public-text)]">
          <p className="mb-3 text-base font-bold text-[var(--public-brass)]">Business contact</p>
          <p>{formatBusinessIdentityDescription(businessIdentity)}</p>
          <p>Legal operator: {businessIdentity.legalOperatorName}</p>
          <p>Jurisdiction: {businessIdentity.jurisdictionState}, {businessIdentity.jurisdictionCountry}</p>
          <p>Support email: <a className="font-semibold underline" href={`mailto:${businessIdentity.supportEmail}`}>{businessIdentity.supportEmail}</a></p>
          <p>Legal and privacy email: <a className="font-semibold underline" href={`mailto:${businessIdentity.legalEmail}`}>{businessIdentity.legalEmail}</a></p>
          {businessIdentity.supportPhone ? <p>Support phone: {businessIdentity.supportPhone}</p> : null}
        </div>
        <nav className="mt-8 flex flex-wrap gap-3 text-base" aria-label="Trust center pages">
          {trustLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              prefetch={false}
              className="inline-flex min-h-11 items-center rounded-[var(--public-radius)] border border-[var(--public-border)] bg-[var(--public-surface)] px-4 font-semibold text-[var(--public-text)] hover:border-[var(--public-brass)]"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </article>
    </PublicSiteShell>
  );
}
