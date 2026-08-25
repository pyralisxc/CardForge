"use client";

import Link from 'next/link';
import { HardDrive, Home, LibraryBig, MoreHorizontal, ShieldCheck } from 'lucide-react';

import type { AccountSection } from '../lib/accountSections';
import { cn } from '@/shared/classNames';

const destinationClass = (active: boolean) => cn(
  'flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 px-1 pb-[env(safe-area-inset-bottom)] text-[10px] font-semibold transition-colors',
  active
    ? 'text-[var(--cf-accent-strong)]'
    : 'text-[var(--cf-text-subtle)] hover:text-[var(--cf-text-strong)]',
);

export function AccountMobileNavigation({
  activeSection,
  onOpenMore,
}: {
  activeSection: AccountSection;
  onOpenMore: () => void;
}) {
  const moreActive = activeSection === 'billing' || activeSection === 'developer';

  return (
    <nav
      aria-label="Account destinations"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[var(--cf-border)] bg-[color:var(--cf-surface-inset)]/95 backdrop-blur sm:hidden"
    >
      <Link href="/account" prefetch={false} aria-current={activeSection === 'home' ? 'page' : undefined} className={destinationClass(activeSection === 'home')}>
        <Home className="h-5 w-5" aria-hidden="true" />
        <span>Home</span>
      </Link>
      <Link href="/account?section=library" prefetch={false} aria-current={activeSection === 'library' ? 'page' : undefined} className={destinationClass(activeSection === 'library')}>
        <LibraryBig className="h-5 w-5" aria-hidden="true" />
        <span>Library</span>
      </Link>
      <Link href="/account?section=storage" prefetch={false} aria-current={activeSection === 'storage' ? 'page' : undefined} className={destinationClass(activeSection === 'storage')}>
        <HardDrive className="h-5 w-5" aria-hidden="true" />
        <span>Storage</span>
      </Link>
      <Link href="/account?section=profile" prefetch={false} aria-current={activeSection === 'profile' ? 'page' : undefined} className={destinationClass(activeSection === 'profile')}>
        <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        <span>Profile</span>
      </Link>
      <button type="button" onClick={onOpenMore} aria-label="More account destinations" className={destinationClass(moreActive)}>
        <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
        <span>More</span>
      </button>
    </nav>
  );
}
