"use client";

import Link from 'next/link';
import { Hammer } from 'lucide-react';
import { AccountControls } from '@/features/account/components/AccountControls';

interface HeaderProps {
  authConfigured: boolean;
  isSignedIn: boolean;
  modeLabel: string;
  onRefreshEntitlement: () => void;
}

export function Header({ authConfigured, isSignedIn, modeLabel, onRefreshEntitlement }: HeaderProps) {
  return (
    <header className="border-b border-[#5f4526] bg-[#120e09] px-4 py-4 text-[#f7ead0] shadow-[0_10px_30px_rgba(0,0,0,0.28)] no-print">
      <div className="mx-auto flex max-w-7xl items-center gap-3">
        <Link href="/" prefetch={false} className="flex min-w-0 items-center gap-3 text-[#f9e7b7]">
          <span className="grid h-10 w-10 shrink-0 place-items-center border border-[#d7b469]/70 bg-[#1c130b] text-[#f2c15d] shadow-[0_0_24px_rgba(226,170,74,0.14)]">
            <Hammer className="h-5 w-5" />
          </span>
          <h1 className="truncate font-serif text-xl font-semibold tracking-wide md:text-2xl">CardForge Studio</h1>
        </Link>
        <nav className="ml-4 hidden items-center gap-5 text-sm text-[#dbc79e] md:flex">
          <Link href="/" prefetch={false} className="hover:text-[#fff3ca]">Landing</Link>
          <Link href="/studio" prefetch={false} className="hover:text-[#fff3ca]">Studio</Link>
          <Link href="/account" prefetch={false} className="hover:text-[#fff3ca]">Account</Link>
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
