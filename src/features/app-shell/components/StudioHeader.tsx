"use client";

import Link from 'next/link';
import Image from 'next/image';
import { Code2, Menu } from 'lucide-react';
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
  developerCockpitHref?: '/developer/cockpit' | null;
}

export function StudioHeader({
  authConfigured,
  currentPath = '/studio',
  isLoadingAccount,
  isSignedIn,
  modeLabel,
  saveStatus,
  onRefreshEntitlement,
  developerCockpitHref,
}: StudioHeaderProps) {
  const brand = useBrandPresentation();
  return (
    <header className="cardforge-studio-header border-b border-[#5f4526] bg-[#120e09] px-4 py-4 text-[#f7ead0] shadow-[0_10px_30px_rgba(0,0,0,0.28)] no-print">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
        <Link href="/" prefetch={false} className="flex min-w-0 flex-1 items-center gap-2 text-[#f9e7b7] sm:gap-3 xl:flex-none">
          <span className="cardforge-studio-brand-mark relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden border border-[#d7b469]/70 bg-[#1c130b] text-[#f2c15d] shadow-[0_0_24px_rgba(226,170,74,0.14)] sm:h-10 sm:w-10">
            <Image src={brand.markUrl} alt="" fill priority unoptimized className="object-contain p-1.5" />
          </span>
          <h1 className="cardforge-studio-title truncate font-serif text-base font-semibold sm:text-xl sm:tracking-wide md:text-2xl">{brand.brandName}</h1>
        </Link>
        <nav className="cardforge-studio-nav ml-4 hidden flex-1 items-center gap-4 text-sm text-[#dbc79e] xl:flex" aria-label="Global navigation">
          {STUDIO_NAVIGATION.map((item) => {
            const isActive = currentPath === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                aria-current={isActive ? 'page' : undefined}
                className={`border-b border-transparent py-1 transition hover:text-[#fff3ca] ${
                  isActive ? 'border-[#d8b365] text-[#fff3ca]' : ''
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        {developerCockpitHref ? (
          <Link
            href={developerCockpitHref}
            prefetch={false}
            className="hidden min-h-10 items-center gap-2 border border-[#6d5323] bg-[#1c130b] px-3 text-sm font-semibold text-[#f5d27b] transition hover:border-[#d8b365] hover:text-[#fff3ca] 2xl:inline-flex"
          >
            <Code2 className="h-4 w-4" aria-hidden="true" /> Developer cockpit
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
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center border border-[#6d5323] bg-[#171207] text-[#f3ead7] hover:bg-[#24180e] xl:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[min(88vw,22rem)] border-[#5f4526] bg-[#120e09] text-[#f7ead0]">
            <SheetHeader className="text-left">
              <SheetTitle className="font-serif text-2xl text-[#fff1c7]">{brand.brandName} navigation</SheetTitle>
              <SheetDescription className="text-[#cbb58b]">Move between the Studio, account, and public {brand.brandName} pages.</SheetDescription>
            </SheetHeader>
            <nav className="mt-6 grid gap-2" aria-label="Compact global navigation">
              {developerCockpitHref ? (
                <SheetClose asChild>
                  <Link
                    href={developerCockpitHref}
                    prefetch={false}
                    className="mb-2 inline-flex min-h-11 items-center gap-2 border border-[#6d5323] bg-[#1c130b] px-3 text-base font-semibold text-[#f5d27b] hover:border-[#d8b365] hover:text-[#fff3ca]"
                  >
                    <Code2 className="h-4 w-4" aria-hidden="true" /> Developer cockpit
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
                      className={`inline-flex min-h-11 items-center border-l-2 px-3 text-base font-semibold transition-colors hover:bg-[#24180e] hover:text-[#fff3ca] ${
                        isActive ? 'border-[#d8b365] bg-[#1c130b] text-[#fff3ca]' : 'border-transparent text-[#dbc79e]'
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
          saveStatus === 'failed' ? 'text-red-300' : saveStatus === 'saving' ? 'text-[#e2c07b]' : 'text-[#b8caa0]'
        }`} role="status" aria-live="polite">
          {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'failed' ? 'Save failed' : 'Saved in this browser'}
        </p>
      </div>
    </header>
  );
}
