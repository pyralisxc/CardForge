"use client";

import React from 'react';
import Link from 'next/link';

import type { BusinessIdentity } from '@/features/business-identity/client';
import { PUBLIC_FOOTER_LINKS } from '../model/publicNavigation';
import { FounderSocialLinks } from './FounderSocialLinks';
import { useFounderProfile } from './FounderProfileContext';

export interface PublicSiteFooterProps {
  businessIdentity: BusinessIdentity;
}

export function PublicSiteFooter({ businessIdentity }: PublicSiteFooterProps) {
  const founderProfile = useFounderProfile();
  return (
    <footer className="border-t border-[var(--public-border)] bg-[#090806] px-5 py-5 text-[var(--public-muted-text)] md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="font-[var(--public-font-display)] text-lg font-semibold text-[var(--public-ivory)]">
            {businessIdentity.brandName}
            </p>
            <p className="text-base">
              Operated by {businessIdentity.legalOperatorName} in {businessIdentity.jurisdictionState}.
            </p>
          </div>
          <nav aria-label="Footer links" className="flex flex-wrap gap-x-4 gap-y-1">
            {PUBLIC_FOOTER_LINKS.map((link) => (
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
          <FounderSocialLinks profile={founderProfile} compact />
        </div>
        <p className="border-t border-[#352716] pt-4 text-base">
          &copy; {new Date().getFullYear()} {businessIdentity.copyrightHolder}. CardForge Studio is an independent product built with care.
        </p>
      </div>
    </footer>
  );
}
