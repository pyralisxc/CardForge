"use client";

import Image from 'next/image';
import Link from 'next/link';
import { Home, LibraryBig, Search, UserCircle2, WandSparkles } from 'lucide-react';

import type { AccountSection } from '../lib/accountSections';
import { cn } from '@/shared/classNames';

interface AccountWorkspaceHeaderProps {
  activeSection: AccountSection;
  accountLabel: string;
  avatarUrl: string | null;
  onOpenDesktopAccount: () => void;
  onOpenMobileAccount: () => void;
}

const workspaceLinkClass = (active: boolean) => cn(
  'inline-flex min-h-10 items-center gap-2 border px-3 text-sm font-semibold transition-colors',
  active
    ? 'border-[var(--cf-border-strong)] bg-[var(--cf-surface-raised)] text-[var(--cf-accent-text)]'
    : 'border-transparent text-[var(--cf-text-muted)] hover:border-[var(--cf-border)] hover:text-[var(--cf-text-strong)]',
);

export function AccountWorkspaceHeader({
  activeSection,
  accountLabel,
  avatarUrl,
  onOpenDesktopAccount,
  onOpenMobileAccount,
}: AccountWorkspaceHeaderProps) {
  return (
    <header className="border-b border-[var(--cf-border)] bg-[var(--cf-surface-inset)]">
      <div className="mx-auto flex min-h-16 max-w-[96rem] items-center gap-3 px-4 md:px-6">
        <Link href="/" prefetch={false} aria-label="CardForge home" className="inline-flex min-h-11 items-center gap-3 text-[var(--cf-text-strong)]">
          <span className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden border border-[var(--cf-border-strong)] bg-[var(--cf-surface-raised)]">
            <Image src="/brand/cardforge-studio/brand-mark.svg" alt="" fill priority className="object-contain p-1.5" />
          </span>
          <span className="hidden font-serif text-xl font-semibold sm:inline">CardForge</span>
        </Link>

        <nav aria-label="Workspace destinations" className="ml-1 hidden min-w-0 items-center gap-1 sm:flex md:ml-auto">
          <Link href="/account" prefetch={false} aria-current={activeSection === 'home' ? 'page' : undefined} className={workspaceLinkClass(activeSection === 'home')}>
            <Home className="h-4 w-4" aria-hidden="true" /> <span className="hidden sm:inline">Home</span>
          </Link>
          <Link href="/studio" prefetch={false} className={workspaceLinkClass(false)}>
            <WandSparkles className="h-4 w-4" aria-hidden="true" /> <span className="hidden sm:inline">Studio</span>
          </Link>
          <Link href="/account?section=library" prefetch={false} aria-current={activeSection === 'library' ? 'page' : undefined} className={workspaceLinkClass(activeSection === 'library')}>
            <LibraryBig className="h-4 w-4" aria-hidden="true" /> <span className="hidden sm:inline">Library</span>
          </Link>
        </nav>

        <Link
          href="/studio"
          prefetch={false}
          className="ml-auto inline-flex min-h-10 items-center gap-2 border border-[var(--cf-border)] px-3 text-xs font-semibold text-[var(--cf-accent-text)] sm:hidden"
        >
          <WandSparkles className="h-4 w-4" aria-hidden="true" /> Studio
        </Link>

        <Link
          href="/account?section=library#library-search"
          prefetch={false}
          className="ml-auto hidden min-h-10 items-center gap-2 border border-[var(--cf-border)] px-3 text-sm text-[var(--cf-text-muted)] transition-colors hover:border-[var(--cf-border-strong)] hover:text-[var(--cf-text-strong)] lg:inline-flex"
        >
          <Search className="h-4 w-4" aria-hidden="true" /> Search your work
        </Link>

        <button
          type="button"
          onClick={onOpenDesktopAccount}
          aria-label="Open account panel"
          className="hidden min-h-11 items-center gap-2 px-1 text-sm font-semibold text-[var(--cf-text-strong)] xl:inline-flex"
        >
          {avatarUrl ? (
            <Image src={avatarUrl} alt="" width={36} height={36} className="h-9 w-9 rounded-full object-cover" unoptimized />
          ) : (
            <UserCircle2 className="h-9 w-9 text-[var(--cf-accent-strong)]" aria-hidden="true" />
          )}
          <span className="max-w-28 truncate">{accountLabel}</span>
        </button>
        <button
          type="button"
          onClick={onOpenMobileAccount}
          aria-label="Open account panel"
          className="hidden min-h-11 min-w-11 items-center justify-center text-[var(--cf-text-strong)] sm:inline-flex xl:hidden"
        >
          {avatarUrl ? (
            <Image src={avatarUrl} alt="" width={36} height={36} className="h-9 w-9 rounded-full object-cover" unoptimized />
          ) : (
            <UserCircle2 className="h-8 w-8 text-[var(--cf-accent-strong)]" aria-hidden="true" />
          )}
        </button>
      </div>
    </header>
  );
}
