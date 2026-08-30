"use client";

import Link from 'next/link';
import Image from 'next/image';
import { LibraryBig, Menu } from 'lucide-react';
import { AccountControls } from '@/features/account/client/auth';
import type { BrowserStorageSaveStatus } from '@/features/project/client';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { STUDIO_NAVIGATION } from '@/features/public-site/client';
import { useBrandPresentation } from '@/features/brand-presentation/client';

interface StudioHeaderProps {
  authConfigured: boolean;
  currentPath?: string;
  isLoadingAccount: boolean;
  isSignedIn: boolean;
  modeLabel: string;
  saveStatus: BrowserStorageSaveStatus;
  onRefreshEntitlement: () => void;
  contributorLibraryHref?: '/account?section=library&scope=pipeline' | null;
}

export function StudioHeader({
  authConfigured,
  currentPath = '/studio',
  isLoadingAccount,
  isSignedIn,
  modeLabel,
  saveStatus,
  onRefreshEntitlement,
  contributorLibraryHref,
}: StudioHeaderProps) {
  const brand = useBrandPresentation();
  return (
    <header className="cardforge-studio-header border-b border-[var(--cf-border)] bg-[var(--cf-surface-inset)] px-4 py-4 text-[var(--cf-text)] shadow-[0_10px_30px_rgba(0,0,0,0.28)] no-print">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
        <Link href="/" prefetch={false} className="flex min-w-0 flex-1 items-center gap-2 text-[var(--cf-text-strong)] sm:gap-3 xl:flex-none">
          <span className="cardforge-studio-brand-mark relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden border border-[var(--cf-accent)] bg-[var(--cf-surface-raised)] text-[var(--cf-accent-strong)] shadow-[0_0_24px_rgba(0,0,0,0.2)] sm:h-10 sm:w-10">
            <Image src={brand.markUrl} alt="" fill priority unoptimized className="object-contain p-1.5" />
          </span>
          <h1 className="cardforge-studio-title truncate font-serif text-base font-semibold sm:text-xl sm:tracking-wide md:text-2xl">{brand.brandName}</h1>
        </Link>
        <nav className="cardforge-studio-nav ml-4 hidden flex-1 items-center gap-4 text-sm text-[var(--cf-text-muted)] xl:flex" aria-label="Global navigation">
          {STUDIO_NAVIGATION.map((item) => {
            const isActive = currentPath === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                aria-current={isActive ? 'page' : undefined}
                className={`border-b border-transparent py-1 transition hover:text-[var(--cf-text-strong)] ${
                  isActive ? 'border-[var(--cf-accent)] text-[var(--cf-text-strong)]' : ''
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        {contributorLibraryHref ? (
          <Link
            href={contributorLibraryHref}
            prefetch={false}
            className="hidden min-h-10 items-center gap-2 border border-[var(--cf-accent)] bg-[var(--cf-surface-raised)] px-3 text-sm font-semibold text-[var(--cf-accent-text)] transition hover:border-[var(--cf-accent-strong)] hover:text-[var(--cf-text-strong)] 2xl:inline-flex"
          >
            <LibraryBig className="h-4 w-4" aria-hidden="true" /> Contributor Library
          </Link>
        ) : null}
        <div className="cardforge-studio-account ml-auto">
          <AccountControls
            authConfigured={authConfigured}
            isLoadingAccount={isLoadingAccount}
            isSignedIn={isSignedIn}
            modeLabel={modeLabel}
            onRefreshEntitlement={onRefreshEntitlement}
          />
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label="Open global navigation"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center border border-[var(--cf-border-strong)] bg-[var(--cf-surface-inset)] text-[var(--cf-text)] hover:bg-[var(--cf-surface-hover)] xl:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[min(88vw,22rem)] border-[var(--cf-border)] bg-[var(--cf-surface-inset)] text-[var(--cf-text)]">
            <SheetHeader className="text-left">
              <SheetTitle className="font-serif text-2xl text-[var(--cf-text-strong)]">{brand.brandName} navigation</SheetTitle>
              <SheetDescription className="text-[var(--cf-text-muted)]">Move between the Studio, account, and public {brand.brandName} pages.</SheetDescription>
            </SheetHeader>
            <nav className="mt-6 grid gap-2" aria-label="Compact global navigation">
              {contributorLibraryHref ? (
                <SheetClose asChild>
                  <Link
                    href={contributorLibraryHref}
                    prefetch={false}
                    className="mb-2 inline-flex min-h-11 items-center gap-2 border border-[var(--cf-accent)] bg-[var(--cf-surface-raised)] px-3 text-base font-semibold text-[var(--cf-accent-text)] hover:border-[var(--cf-accent-strong)] hover:text-[var(--cf-text-strong)]"
                  >
                    <LibraryBig className="h-4 w-4" aria-hidden="true" /> Contributor Library
                  </Link>
                </SheetClose>
              ) : null}
              {STUDIO_NAVIGATION.map((item) => {
                const isActive = currentPath === item.href;
                return (
                  <SheetClose key={item.href} asChild>
                    <Link
                      href={item.href}
                      prefetch={false}
                      aria-current={isActive ? 'page' : undefined}
                      className={`inline-flex min-h-11 items-center border-l-2 px-3 text-base font-semibold transition-colors hover:bg-[var(--cf-surface-hover)] hover:text-[var(--cf-text-strong)] ${
                        isActive ? 'border-[var(--cf-accent)] bg-[var(--cf-surface-raised)] text-[var(--cf-text-strong)]' : 'border-transparent text-[var(--cf-text-muted)]'
                      }`}
                    >
                      {item.label}
                    </Link>
                  </SheetClose>
                );
              })}
            </nav>
          </SheetContent>
        </Sheet>
        <p className={`order-4 w-full text-xs xl:order-none xl:w-auto ${
          saveStatus === 'failed' ? 'text-[var(--cf-danger)]' : saveStatus === 'saving' ? 'text-[var(--cf-warning)]' : 'text-[var(--cf-success)]'
        }`} role="status" aria-live="polite">
          {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'failed' ? 'Save failed' : 'Saved in this browser'}
        </p>
      </div>
    </header>
  );
}
