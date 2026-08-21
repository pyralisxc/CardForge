"use client";

import Link from 'next/link';
import { UserProfile, useUser } from '@clerk/nextjs';
import { FolderOpen, KeyRound, ShieldCheck, UserCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { getAccountDisplayName, toPossessiveName } from '@/features/account/lib/accountDisplay';
import { createAuthRouteHref } from '@/infrastructure/auth/clerk';

const clerkAppearance = {
  variables: {
    colorPrimary: 'var(--cf-accent-strong)',
    colorBackground: 'var(--cf-surface)',
    colorInputBackground: 'var(--cf-surface-inset)',
    colorInputText: 'var(--cf-text-strong)',
    colorText: 'var(--cf-text)',
    colorTextSecondary: 'var(--cf-text-muted)',
    borderRadius: 'var(--cf-panel-radius)',
    fontFamily: 'var(--font-cardforge-lato), sans-serif',
  },
  elements: {
    rootBox: 'w-full',
    cardBox: 'w-full shadow-none border border-[var(--cf-border)] bg-[var(--cf-surface)]',
    navbar: 'bg-[var(--cf-surface-inset)]',
    pageScrollBox: 'bg-[var(--cf-surface)]',
  },
};

function ProfileShell({
  children,
  eyebrow = 'Account profile',
  title = 'Profile and security',
  detail = 'Sign-in methods, profile details, and account controls in one focused place.',
}: {
  children: React.ReactNode;
  eyebrow?: string;
  title?: string;
  detail?: string;
}) {
  return (
    <main className="min-h-screen bg-[var(--cf-canvas)] text-[var(--cf-text)]">
      <section className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        <div className="mb-4 border border-[var(--cf-border)] bg-[var(--cf-surface)] p-4 md:p-5">
          <div className="flex items-center gap-3 text-[var(--cf-accent-strong)]">
            <UserCircle2 className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-[0.18em]">{eyebrow}</span>
          </div>
          <h1 className="mt-3 font-serif text-3xl font-semibold leading-tight text-[var(--cf-text-strong)] md:text-4xl">
            {title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--cf-text-muted)]">
            {detail}
          </p>
        </div>
        {children}
      </section>
    </main>
  );
}

export function ProfileSetupFallback() {
  return (
    <ProfileShell eyebrow="Setup required" title="Profile management is waiting on auth">
      <div className="border border-[var(--cf-warning-border)] bg-[var(--cf-surface-inset)] p-6">
        <div className="flex items-center gap-3 text-[var(--cf-warning)]">
          <ShieldCheck className="h-5 w-5" />
          <h2 className="font-serif text-2xl text-[var(--cf-text-strong)]">Account management unavailable</h2>
        </div>
        <p className="mt-4 text-sm leading-6 text-[var(--cf-text-muted)]">
          Add the Clerk publishable key and secret key, then restart the dev server to test profile management.
        </p>
      </div>
    </ProfileShell>
  );
}

export function ProfileManagementPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const displayName = getAccountDisplayName({
    displayName: user?.fullName ?? user?.firstName ?? null,
    email: user?.primaryEmailAddress?.emailAddress ?? null,
  });

  if (!isLoaded) {
    return (
      <ProfileShell>
        <div className="border border-[var(--cf-border)] bg-[var(--cf-surface)] p-6 text-[var(--cf-text-muted)]">
          Loading your profile...
        </div>
      </ProfileShell>
    );
  }

  if (!isSignedIn) {
    return (
      <ProfileShell title="Sign in to manage your profile" detail="Profile controls are available after CardForge connects your account.">
        <div className="border border-[var(--cf-border)] bg-[var(--cf-surface)] p-4">
          <h2 className="font-serif text-xl text-[var(--cf-text-strong)]">Connect your account</h2>
          <p className="mt-3 text-sm leading-5 text-[var(--cf-text-muted)]">
            Sign in to manage identity, security, export access, and local custom-art permissions.
          </p>
          <Button asChild className="mt-5 bg-[var(--cf-accent-strong)] text-[var(--cf-accent-contrast)] hover:brightness-110">
            <Link href={createAuthRouteHref('/sign-in', '/profile')} prefetch={false}>
              Sign in
            </Link>
          </Button>
        </div>
      </ProfileShell>
    );
  }

  return (
    <ProfileShell
      eyebrow="Profile controls"
      title={displayName ? `${toPossessiveName(displayName)} CardForge profile` : 'Your CardForge profile'}
      detail="Compact account controls for identity, security, and connected sign-in methods."
    >
      <div className="grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="border border-[var(--cf-border)] bg-[var(--cf-surface)] p-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--cf-text-subtle)]">Settings</p>
            <p className="break-words text-sm text-[var(--cf-accent-text)]">{user?.primaryEmailAddress?.emailAddress}</p>
          </div>
          <div className="mt-4 divide-y divide-[var(--cf-border-subtle)] border-y border-[var(--cf-border-subtle)]">
            <div className="flex items-start gap-3 py-3">
              <UserCircle2 className="mt-0.5 h-4 w-4 text-[var(--cf-accent-strong)]" />
              <div>
                <p className="text-sm font-medium text-[var(--cf-text-strong)]">Identity</p>
                <p className="text-xs leading-5 text-[var(--cf-text-muted)]">Name, avatar, and email addresses.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 py-3">
              <KeyRound className="mt-0.5 h-4 w-4 text-[var(--cf-accent-strong)]" />
              <div>
                <p className="text-sm font-medium text-[var(--cf-text-strong)]">Security</p>
                <p className="text-xs leading-5 text-[var(--cf-text-muted)]">Password, providers, and active sessions.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 py-3">
              <FolderOpen className="mt-0.5 h-4 w-4 text-[var(--cf-accent-strong)]" />
              <div>
                <p className="text-sm font-medium text-[var(--cf-text-strong)]">Local assets</p>
                <p className="text-xs leading-5 text-[var(--cf-text-muted)]">Custom art is browser-local after sign-in.</p>
              </div>
            </div>
          </div>
          <Button asChild variant="outline" className="mt-4 w-full border-[var(--cf-accent)] bg-transparent text-[var(--cf-accent-text)] hover:bg-[var(--cf-surface-hover)] hover:text-[var(--cf-text-strong)]">
            <Link href="/account" prefetch={false}>Open account summary</Link>
          </Button>
        </aside>
        <div className="cardforge-clerk-profile min-w-0">
          <UserProfile routing="hash" appearance={clerkAppearance} />
        </div>
      </div>
    </ProfileShell>
  );
}