import React from 'react';
import Link from 'next/link';

import type { BusinessIdentity } from '@/features/business-identity/client';
import { PUBLIC_NAVIGATION } from '../model/publicNavigation';

export interface PublicSiteFooterProps {
  businessIdentity: BusinessIdentity;
}

export function PublicSiteFooter({ businessIdentity }: PublicSiteFooterProps) {
  return (
    <footer className="border-t border-[var(--public-border)] bg-[var(--public-charcoal)] px-5 py-10 text-[var(--public-muted-text)] md:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[minmax(15rem,1.2fr)_2fr]">
        <div>
          <p className="font-[var(--public-font-display)] text-xl font-semibold text-[var(--public-ivory)]">
            {businessIdentity.brandName}
          </p>
          <p className="mt-3 max-w-sm text-base leading-7">
            Build reusable card systems, connect structured data, and review complete sets.
          </p>
          <p className="mt-5 text-base leading-7">
            Operated by {businessIdentity.legalOperatorName}, an independent sole proprietor based in{' '}
            {businessIdentity.jurisdictionState}. &copy; {new Date().getFullYear()}{' '}
            {businessIdentity.copyrightHolder}.
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {PUBLIC_NAVIGATION.footerGroups.map((group) => (
            <div key={group.label}>
              <h2 className="text-base font-bold uppercase tracking-[0.14em] text-[var(--public-brass)]">
                {group.label}
              </h2>
              <nav aria-label={`${group.label} links`} className="mt-3 grid gap-1">
                {group.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    prefetch={false}
                    className="inline-flex min-h-11 items-center rounded-[var(--public-radius)] text-base hover:text-[var(--public-ivory)]"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
