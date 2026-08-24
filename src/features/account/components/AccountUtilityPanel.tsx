"use client";

import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  ChevronRight,
  Cloud,
  CreditCard,
  Database,
  HardDrive,
  ShieldCheck,
  UserCog,
  UserCircle2,
  Wrench,
  X,
} from 'lucide-react';

interface AccountUtilityPanelProps {
  accountEmail: string;
  accountName: string;
  avatarUrl: string | null;
  cloudSlotLabel: string;
  isOwner: boolean;
  onClose?: () => void;
  onNavigate?: () => void;
  planLabel: string;
  showDeveloper: boolean;
}

function UtilityLink({
  href,
  icon,
  title,
  detail,
  onNavigate,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  detail: string;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      onClick={onNavigate}
      className="group grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-[var(--cf-border-subtle)] py-3 text-left"
    >
      <span className="text-[var(--cf-accent-strong)]">{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-[var(--cf-text-strong)]">{title}</span>
        <span className="mt-0.5 block truncate text-xs text-[var(--cf-text-subtle)]">{detail}</span>
      </span>
      <ChevronRight className="h-4 w-4 text-[var(--cf-text-subtle)] transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </Link>
  );
}

export function AccountUtilityPanel({
  accountEmail,
  accountName,
  avatarUrl,
  cloudSlotLabel,
  isOwner,
  onClose,
  onNavigate,
  planLabel,
  showDeveloper,
}: AccountUtilityPanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--cf-surface-inset)] text-[var(--cf-text)]">
      <div className="flex items-center justify-between border-b border-[var(--cf-border)] px-5 py-4">
        <h2 className="font-serif text-2xl font-semibold text-[var(--cf-text-strong)]">Account</h2>
        {onClose ? (
          <button type="button" onClick={onClose} aria-label="Close account panel" className="inline-flex min-h-10 min-w-10 items-center justify-center text-[var(--cf-text-muted)] hover:text-[var(--cf-text-strong)]">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div className="cardforge-mobile-scroll-surface min-h-0 flex-1 overflow-y-auto px-5 pb-6">
        <div className="flex items-center gap-3 border-b border-[var(--cf-border)] py-5">
          {avatarUrl ? (
            <Image src={avatarUrl} alt="" width={48} height={48} className="h-12 w-12 rounded-full object-cover" unoptimized />
          ) : (
            <UserCircle2 className="h-12 w-12 text-[var(--cf-accent-strong)]" aria-hidden="true" />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--cf-text-strong)]">{accountName}</p>
            <p className="truncate text-xs text-[var(--cf-text-subtle)]">{accountEmail}</p>
            <span className="mt-1.5 inline-flex border border-[var(--cf-border-strong)] px-2 py-0.5 text-[11px] font-semibold text-[var(--cf-accent-text)]">{planLabel}</span>
          </div>
        </div>

        <nav aria-label="Account management">
          <UtilityLink href="/profile" icon={<ShieldCheck className="h-5 w-5" />} title="Profile & security" detail="Identity, sign-in methods, and sessions" onNavigate={onNavigate} />
          {isOwner ? <UtilityLink href="/owner" icon={<UserCog className="h-5 w-5" />} title="Owner access" detail="Manage CardForge operations" onNavigate={onNavigate} /> : null}
          <UtilityLink href="/account?section=billing" icon={<CreditCard className="h-5 w-5" />} title="Plan & billing" detail="Plans, payments, invoices, and cancellation" onNavigate={onNavigate} />
          <UtilityLink href="/account?section=storage" icon={<HardDrive className="h-5 w-5" />} title="Storage & connections" detail="Providers, permissions, capacity, and removal" onNavigate={onNavigate} />
          <UtilityLink href="/account?section=storage" icon={<Database className="h-5 w-5" />} title="Google Drive" detail="Connection and project-file settings" onNavigate={onNavigate} />
          <UtilityLink href="/account?section=storage" icon={<Cloud className="h-5 w-5" />} title="CardForge Cloud" detail={cloudSlotLabel} onNavigate={onNavigate} />
          {showDeveloper ? <UtilityLink href="/account?section=developer" icon={<Wrench className="h-5 w-5" />} title="Developer tools" detail="Owner and contributor workspaces" onNavigate={onNavigate} /> : null}
        </nav>
      </div>
    </div>
  );
}
