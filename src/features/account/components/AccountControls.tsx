"use client";

import {
  UserButton,
  useUser,
} from '@clerk/nextjs';
import Link from 'next/link';
import { LoaderCircle, LogIn, UserPlus } from 'lucide-react';
import { useEffect } from 'react';

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

  if (state === 'checking') {
    return (
      <Button type="button" size="sm" disabled aria-label="Checking account access" className="gap-2 bg-[#6f552c] text-[#f8e3b0]">
        <LoaderCircle className="h-4 w-4 animate-spin" /> Checking…
      </Button>
    );
  }

  if (state === 'unavailable') {
    return (
      <div className="ml-auto text-right text-xs text-[#c8b07f]">
        <p className="font-semibold text-[#fff1c7]">Account sign-in isn&apos;t available here.</p>
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

  useEffect(() => {
    if (!isLoaded) return;
    onRefreshEntitlement();
    if (isSignedIn) completeSignUpIntent(user?.createdAt);
  }, [isLoaded, isSignedIn, onRefreshEntitlement, user?.createdAt]);

  return (
    <div className="ml-auto flex items-center gap-2">
      <div className="hidden text-right text-xs text-[#c8b07f] sm:block">
        <p className="font-semibold text-[#fff1c7]">{modeLabel}</p>
        <p>{effectiveSignedIn ? 'Account connected' : 'Sign in to unlock paid export'}</p>
      </div>
      {!effectiveSignedIn ? (
        <>
          <Button asChild type="button" size="sm" className="gap-2 bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]">
            <Link href={createAuthRouteHref('/sign-in', '/studio')} prefetch={false}>
              <LogIn className="h-4 w-4" /> Sign in
            </Link>
          </Button>
          <Button asChild type="button" variant="outline" size="sm" onClick={markSignUpIntent} className="hidden gap-2 border-[#d8b365]/70 bg-transparent text-[#f8e3b0] hover:bg-[#2a1b0d] hover:text-[#fff1c7] sm:inline-flex">
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
