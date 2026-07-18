"use client";

import React from 'react';
import Link from 'next/link';

import type { BusinessIdentity } from '@/features/business-identity/client';
import { PUBLIC_NAVIGATION } from '../model/publicNavigation';
import { FounderSocialLinks } from './FounderSocialLinks';
import { useFounderProfile } from './FounderProfileContext';

export interface PublicSiteFooterProps {
  businessIdentity: BusinessIdentity;
}

export function PublicSiteFooter({ businessIdentity }: PublicSiteFooterProps) {
  const founderProfile = useFounderProfile();
  return (
    <footer className="border-t border-[var(--public-border)] bg-[#090806] px-5 py-6 text-[var(--public-muted-text)] md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 border-b border-[#352716] pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="font-[var(--public-font-display)] text-lg font-semibold text-[var(--public-ivory)]">{businessIdentity.brandName}</p>
            <p className="mt-1 text-sm">Operated by {businessIdentity.legalOperatorName} in {businessIdentity.jurisdictionState}.</p>
          </div>
          <FounderSocialLinks profile={founderProfile} compact />
        </div>

        <nav aria-label="Footer links" className="grid grid-cols-2 gap-x-6 gap-y-5 py-5 sm:grid-cols-4">
          {PUBLIC_NAVIGATION.footerGroups.map((group) => (
            <section key={group.label}>
              <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#cbb58b]">{group.label}</h2>
              <div className="mt-2 grid gap-1">
                {group.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    prefetch={false}
                    className="inline-flex min-h-9 items-center text-sm hover:text-[var(--public-ivory)]"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </nav>

        <p className="border-t border-[#352716] pt-4 text-sm">
          &copy; {new Date().getFullYear()} {businessIdentity.copyrightHolder}. CardForge Studio is an independent product built with care.
        </p>
      </div>
    </footer>
  );
}
