"use client";

import Link from 'next/link';
import { Hammer } from 'lucide-react';
import { AccountControls } from '@/features/account/components/AccountControls';

interface HeaderProps {
  authConfigured: boolean;
  currentPath?: string;
  isSignedIn: boolean;
  modeLabel: string;
  onRefreshEntitlement: () => void;
}

const studioNavItems = [
  { href: '/', label: 'Landing' },
  { href: '/studio', label: 'Studio' },
  { href: '/roadmap', label: 'Roadmap' },
  { href: '/developer', label: 'Developers' },
  { href: '/account', label: 'Account' },
] as const;

export function Header({
  authConfigured,
  currentPath = '/studio',
  isSignedIn,
  modeLabel,
  onRefreshEntitlement,
}: HeaderProps) {
  return (
    <header className="border-b border-[#5f4526] bg-[#120e09] px-4 py-4 text-[#f7ead0] shadow-[0_10px_30px_rgba(0,0,0,0.28)] no-print">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
        <Link href="/" prefetch={false} className="flex min-w-0 items-center gap-3 text-[#f9e7b7]">
          <span className="grid h-10 w-10 shrink-0 place-items-center border border-[#d7b469]/70 bg-[#1c130b] text-[#f2c15d] shadow-[0_0_24px_rgba(226,170,74,0.14)]">
            <Hammer className="h-5 w-5" />
          </span>
          <h1 className="truncate font-serif text-xl font-semibold tracking-wide md:text-2xl">CardForge Studio</h1>
        </Link>
        <nav className="order-3 flex w-full flex-wrap gap-3 text-xs text-[#dbc79e] md:order-none md:ml-4 md:w-auto md:flex-1 md:items-center md:gap-5 md:text-sm">
          {studioNavItems.map((item) => {
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
        <AccountControls
          authConfigured={authConfigured}
          isSignedIn={isSignedIn}
          modeLabel={modeLabel}
          onRefreshEntitlement={onRefreshEntitlement}
        />
      </div>
    </header>
  );
}
