"use client";

import {
  UserButton,
  useUser,
} from '@clerk/nextjs';
import Link from 'next/link';
import { LoaderCircle, LogIn, UserPlus } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { resolveAccountControlsState } from '@/features/account/lib/accountControlsState';
import { completeSignUpIntent, markSignUpIntent } from '@/features/analytics/client/tracking';
import { createAuthRouteHref } from '@/infrastructure/auth/clerk';

interface AccountControlsProps {
  authConfigured: boolean;
  isLoadingAccount: boolean;
  isSignedIn: boolean;
  modeLabel: string;
  onRefreshEntitlement: () => void;
}

export function AccountControls({
  authConfigured,
  isLoadingAccount,
  isSignedIn,
  modeLabel,
  onRefreshEntitlement,
}: AccountControlsProps) {
  const state = resolveAccountControlsState({ authConfigured, isLoadingAccount });

  if (state === 'checking' && !isSignedIn) {
    return (
      <Button type="button" size="sm" disabled aria-label="Checking account access" className="gap-2 bg-[var(--cf-surface-hover)] text-[var(--cf-accent-text)]">
        <LoaderCircle className="h-4 w-4 animate-spin" /> Checking…
      </Button>
    );
  }

  if (state === 'unavailable') {
    return (
      <div className="ml-auto text-right text-xs text-[var(--cf-text-muted)]">
        <p className="font-semibold text-[var(--cf-text-strong)]">Account sign-in isn&apos;t available here.</p>
      </div>
    );
  }

  return (
    <ClerkAccountControls
      fallbackSignedIn={isSignedIn}
      modeLabel={modeLabel}
      onRefreshEntitlement={onRefreshEntitlement}
    />
  );
}

function ClerkAccountControls({
  fallbackSignedIn,
  modeLabel,
  onRefreshEntitlement,
}: {
  fallbackSignedIn: boolean;
  modeLabel: string;
  onRefreshEntitlement: () => void;
}) {
  const { isLoaded, isSignedIn, user } = useUser();
  const effectiveSignedIn = isLoaded ? Boolean(isSignedIn) : fallbackSignedIn;
  const previousSignedInRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    const nextSignedIn = Boolean(isSignedIn);
    const previousSignedIn = previousSignedInRef.current;
    previousSignedInRef.current = nextSignedIn;
    if (previousSignedIn !== null && previousSignedIn !== nextSignedIn) {
      onRefreshEntitlement();
    }
    if (isSignedIn) completeSignUpIntent(user?.createdAt);
  }, [isLoaded, isSignedIn, onRefreshEntitlement, user?.createdAt]);

  return (
    <div className="ml-auto flex items-center gap-2">
      <div className="hidden text-right text-xs text-[var(--cf-text-muted)] sm:block">
        <p className="font-semibold text-[var(--cf-text-strong)]">{modeLabel}</p>
        <p>{effectiveSignedIn ? 'Account connected' : 'Sign in to unlock paid export'}</p>
      </div>
      {!effectiveSignedIn ? (
        <>
          <Button asChild type="button" size="sm" className="gap-2 bg-[var(--cf-accent-strong)] text-[var(--cf-accent-contrast)] hover:brightness-110">
            <Link href={createAuthRouteHref('/sign-in', '/studio')} prefetch={false}>
              <LogIn className="h-4 w-4" /> Sign in
            </Link>
          </Button>
          <Button asChild type="button" variant="outline" size="sm" onClick={markSignUpIntent} className="hidden gap-2 border-[var(--cf-accent)] bg-transparent text-[var(--cf-accent-text)] hover:bg-[var(--cf-surface-hover)] hover:text-[var(--cf-text-strong)] sm:inline-flex">
            <Link href={createAuthRouteHref('/sign-up', '/studio')} prefetch={false}>
              <UserPlus className="h-4 w-4" /> Create account
            </Link>
          </Button>
        </>
      ) : (
        <UserButton userProfileMode="navigation" userProfileUrl="/account" />
      )}
    </div>
  );
}