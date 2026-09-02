"use client";

import { UserButton, useUser } from '@clerk/nextjs';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { LoaderCircle, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSafeCurrentReturnPath } from '@/infrastructure/auth/useSafeCurrentReturnPath';
import {
  createAuthRouteHref,
  getPublicAuthControlState,
  isClerkPublicConfigPresent,
} from '@/infrastructure/auth/clerk';

export function PublicAuthControls({
  signedInAccessory,
}: {
  signedInAccessory?: ReactNode;
}) {
  if (!isClerkPublicConfigPresent()) return null;

  return <ClerkPublicAuthControls signedInAccessory={signedInAccessory} />;
}

function ClerkPublicAuthControls({ signedInAccessory }: { signedInAccessory?: ReactNode }) {
  const returnTo = useSafeCurrentReturnPath();
  const { isLoaded, isSignedIn } = useUser();

  const state = getPublicAuthControlState({
    authConfigured: true,
    isLoaded,
    isSignedIn: Boolean(isSignedIn),
  });

  if (state === 'connecting') {
    return (
      <Button
        type="button"
        size="sm"
        disabled
        aria-label="Connecting to account sign in"
        className="gap-2 bg-[#6f552c] text-[var(--cf-accent-text)]"
      >
        <LoaderCircle className="h-4 w-4 animate-spin" /> Connecting…
      </Button>
    );
  }

  if (state === 'signed-in') {
    return (
      <div className="flex items-center gap-2">
        {signedInAccessory}
        <Link href="/account?section=profile" prefetch={false} className="inline-flex min-h-10 items-center px-2 text-sm font-semibold text-[var(--cf-text-muted)] hover:text-[var(--cf-text-strong)]">Profile</Link>
        <UserButton userProfileMode="navigation" userProfileUrl="/account" />
      </div>
    );
  }

  return (
    <Button asChild type="button" size="sm" className="gap-2 bg-[var(--cf-accent-strong)] text-[var(--cf-accent-contrast)] hover:bg-[var(--cf-accent)]">
      <Link href={createAuthRouteHref('/sign-in', returnTo)} prefetch={false}>
        <LogIn className="h-4 w-4" /> Sign in
      </Link>
    </Button>
  );
}
