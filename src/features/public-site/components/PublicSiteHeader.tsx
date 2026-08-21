"use client";

import { type ReactNode, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, LogIn, Menu } from 'lucide-react';

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { BusinessIdentity } from '@/features/business-identity/client';
import { DEFAULT_PUBLIC_SITE_CONFIGURATION, type PublicSiteConfiguration } from '../model/siteConfiguration';
import { PUBLIC_NAVIGATION } from '../model/publicNavigation';
import { FounderSocialLinks } from './FounderSocialLinks';
import { useSiteContent } from './PublicSitePresentationContext';
import { useBrandPresentation } from '@/features/brand-presentation/client';
import { useFounderProfile } from './FounderProfileContext';

export interface PublicSiteHeaderProps {
  accountSlot?: ReactNode;
  businessIdentity: Pick<BusinessIdentity, 'brandName'>;
  currentPath?: string;
  siteConfiguration?: PublicSiteConfiguration;
}

const linkClassName = (active: boolean) => [
  'inline-flex min-h-11 items-center border-b-2 border-transparent px-1 text-base font-semibold text-[var(--public-muted-text)] transition-colors hover:text-[var(--public-ivory)]',
  active ? 'border-[var(--public-brass)] text-[var(--public-ivory)]' : '',
].join(' ');

export function PublicSiteHeader({
  accountSlot,
  businessIdentity,
  currentPath,
  siteConfiguration = DEFAULT_PUBLIC_SITE_CONFIGURATION,
}: PublicSiteHeaderProps) {
  const founderProfile = useFounderProfile();
  const brand = useBrandPresentation();
  const siteContent = useSiteContent();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const hasVisibleAccountNavigation = siteConfiguration.primaryNavigation.some(
    (item) => item.visible && item.href === '/account',
  );

  return (
    <header className="border-b border-[var(--public-border)] bg-[var(--public-charcoal)] text-[var(--public-ivory)]">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center gap-3 px-5 md:px-8">
        <Link
          href="/"
          prefetch={false}
          className="inline-flex min-h-11 min-w-0 items-center gap-3 rounded-[var(--public-radius)] text-[var(--public-ivory)]"
        >
          <span className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-[var(--public-radius)] border border-[var(--public-border)] bg-[var(--public-surface-raised)] shadow-[0_0_22px_rgba(217,164,65,0.1)]">
            <Image
              src={brand.markUrl}
              alt=""
              fill
              priority
              unoptimized
              className="object-contain p-1.5"
            />
          </span>
          <span className="truncate font-[var(--public-font-display)] text-lg font-semibold tracking-wide md:text-xl">
            {businessIdentity.brandName}
          </span>
        </Link>

        <nav aria-label="Primary navigation" className="ml-auto hidden items-center gap-5 xl:flex">
          {siteConfiguration.primaryNavigation.filter((item) => item.visible).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              aria-current={currentPath === item.href ? 'page' : undefined}
              className={linkClassName(currentPath === item.href)}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden xl:block">
          <FounderSocialLinks profile={founderProfile} brandName={businessIdentity.brandName} compact />
        </div>

        <Link
          href={siteConfiguration.primaryCtaHref}
          prefetch={false}
          className="ml-auto hidden min-h-11 items-center justify-center gap-2 rounded-[var(--public-radius)] bg-[var(--public-brass)] px-5 text-base font-bold text-[var(--public-charcoal)] shadow-[var(--public-shadow)] transition-colors hover:bg-[#e4bd68] xl:inline-flex"
        >
          {siteConfiguration.primaryCtaLabel}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>

        {!accountSlot ? (
          <Link
            href="/sign-in"
            prefetch={false}
            className="hidden min-h-11 items-center justify-center gap-2 rounded-[var(--public-radius)] border border-[var(--public-border)] px-4 text-base font-bold text-[var(--public-ivory)] transition-colors hover:border-[var(--public-brass)] hover:text-[var(--public-brass)] xl:inline-flex"
          >
            <LogIn className="h-4 w-4" aria-hidden="true" /> Sign in
          </Link>
        ) : null}

        {accountSlot ? (
          <div className="cardforge-public-auth-status hidden shrink-0 xl:block">
            {accountSlot}
          </div>
        ) : null}

        <Dialog open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <DialogTrigger asChild>
            <button
              type="button"
              aria-label="Open menu"
              aria-expanded={mobileMenuOpen}
              aria-controls="public-mobile-navigation"
              className="ml-auto inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--public-radius)] border border-[var(--public-border)] text-[var(--public-ivory)] transition-colors hover:border-[var(--public-brass)] hover:text-[var(--public-brass)] xl:hidden"
            >
              <Menu className="h-6 w-6" aria-hidden="true" />
            </button>
          </DialogTrigger>
          <DialogContent
            id="public-mobile-navigation"
            overlayClassName="cardforge-public-tokens"
            className="cardforge-public-tokens cardforge-public-mobile-menu left-auto right-0 top-0 h-svh max-w-sm translate-x-0 translate-y-0 content-start gap-6 overflow-y-auto rounded-none border-y-0 border-l border-r-0 border-[var(--public-border)] bg-[var(--public-charcoal)] p-6 text-[var(--public-ivory)] shadow-[var(--public-shadow)]"
          >
            <div className="pr-12">
              <DialogTitle className="font-[var(--public-font-display)] text-2xl text-[var(--public-ivory)]">
                Navigation
              </DialogTitle>
              <DialogDescription className="mt-2 text-base text-[var(--public-muted-text)]">
                {siteContent['shell.mobile.description']}
              </DialogDescription>
            </div>
            <nav aria-label="Mobile navigation" className="grid content-start gap-1">
              {siteConfiguration.primaryNavigation.filter((item) => item.visible).map((item) => (
                <DialogClose key={item.href} asChild>
                  <Link
                    href={item.href}
                    prefetch={false}
                    aria-current={currentPath === item.href ? 'page' : undefined}
                    className="inline-flex min-h-11 items-center rounded-[var(--public-radius)] px-3 text-base font-semibold text-[var(--public-ivory)] hover:bg-[var(--public-surface-raised)] hover:text-[var(--public-brass)]"
                  >
                    {item.label}
                  </Link>
                </DialogClose>
              ))}
              {!hasVisibleAccountNavigation ? (
                <DialogClose asChild>
                  <Link
                    href={accountSlot ? '/account' : '/sign-in'}
                    prefetch={false}
                    className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--public-radius)] border border-[var(--public-border)] px-5 text-base font-bold text-[var(--public-ivory)] hover:border-[var(--public-brass)] hover:text-[var(--public-brass)]"
                  >
                    <LogIn className="h-4 w-4" aria-hidden="true" /> {accountSlot ? 'Account' : 'Sign in'}
                  </Link>
                </DialogClose>
              ) : null}
              <DialogClose asChild>
                <Link
                  href={siteConfiguration.primaryCtaHref}
                  prefetch={false}
                  className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--public-radius)] bg-[var(--public-brass)] px-5 text-base font-bold text-[var(--public-charcoal)]"
                >
                  {siteConfiguration.primaryCtaLabel}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </DialogClose>
            </nav>
            <section className="border-t border-[var(--public-border)] pt-5" aria-labelledby="mobile-developer-heading">
              <h2 id="mobile-developer-heading" className="text-base font-semibold text-[var(--public-ivory)]">
                {siteContent['shell.mobile.developer.heading']}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--public-muted-text)]">
                {siteContent['shell.mobile.developer.body']}
              </p>
              <DialogClose asChild>
                <Link
                  href={PUBLIC_NAVIGATION.founder.href}
                  prefetch={false}
                  className="mt-2 inline-flex min-h-11 items-center font-bold text-[var(--public-brass)]"
                >
                  {PUBLIC_NAVIGATION.founder.label}
                </Link>
              </DialogClose>
            </section>
            <div className="border-t border-[var(--public-border)] pt-5">
              <p className="mb-3 text-base font-semibold text-[var(--public-ivory)]">Follow {businessIdentity.brandName}</p>
              <FounderSocialLinks profile={founderProfile} brandName={businessIdentity.brandName} />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </header>
  );
}
