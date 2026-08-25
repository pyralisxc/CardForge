"use client";

import Link from 'next/link';
import { UserProfile, useUser } from '@clerk/nextjs';
import { Loader2, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { createAuthRouteHref } from '@/infrastructure/auth/clerk';

const clerkAppearance = {
  variables: {
    colorPrimary: 'var(--cf-accent-strong)',
    colorPrimaryForeground: 'var(--cf-accent-contrast)',
    colorBackground: 'var(--cf-surface)',
    colorBorder: 'var(--cf-border)',
    colorForeground: 'var(--cf-text)',
    colorInput: 'var(--cf-surface-inset)',
    colorInputForeground: 'var(--cf-text-strong)',
    colorMuted: 'var(--cf-surface-inset)',
    colorMutedForeground: 'var(--cf-text-muted)',
    colorNeutral: 'var(--cf-text)',
    colorSuccess: 'var(--cf-success)',
    borderRadius: '0px',
    fontFamily: 'var(--font-cardforge-lato), sans-serif',
  },
};

export function ProfileSetupFallback() {
  return (
    <div role="status" className="border-y border-[var(--cf-warning-border)] py-5">
      <div className="flex items-center gap-3 text-[var(--cf-warning)]">
        <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-[var(--cf-text-strong)]">Profile management is waiting on authentication setup</h2>
      </div>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--cf-text-muted)]">
        Add the Clerk publishable and secret keys, then restart this environment to manage identity and security.
      </p>
    </div>
  );
}

export function ProfileManagementPage({ authConfigured = true }: { authConfigured?: boolean }) {
  const { isLoaded, isSignedIn, user } = useUser();

  if (!authConfigured) return <ProfileSetupFallback />;

  if (!isLoaded) {
    return (
      <div role="status" className="flex items-center gap-2 border-y border-[var(--cf-border)] py-5 text-sm text-[var(--cf-text-muted)]">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading profile and security controls…
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-4 border-y border-[var(--cf-border)] py-5">
        <div>
          <h2 className="text-sm font-semibold text-[var(--cf-text-strong)]">Sign in to manage your profile</h2>
          <p className="mt-1 text-sm text-[var(--cf-text-muted)]">Identity, sign-in methods, devices, and sessions are available after CardForge connects your account.</p>
        </div>
        <Button asChild size="sm" className="bg-[var(--cf-accent-strong)] text-[var(--cf-accent-contrast)] hover:brightness-110">
          <Link href={createAuthRouteHref('/sign-in', '/account?section=profile')} prefetch={false}>Sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-[var(--cf-border)] py-3">
        <div>
          <p className="text-sm font-semibold text-[var(--cf-text-strong)]">Clerk-secured account</p>
          <p className="mt-0.5 text-xs text-[var(--cf-text-muted)]">{user.primaryEmailAddress?.emailAddress ?? 'Signed-in CardForge account'}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 border border-[var(--cf-success-border)] px-2.5 py-1 text-xs font-semibold text-[var(--cf-success)]">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Security controls active
        </span>
      </div>
      <div className="cardforge-clerk-profile mt-4 min-w-0 overflow-hidden border border-[var(--cf-border)] bg-[var(--cf-surface)]">
        <UserProfile routing="hash" appearance={clerkAppearance} />
      </div>
    </div>
  );
}
