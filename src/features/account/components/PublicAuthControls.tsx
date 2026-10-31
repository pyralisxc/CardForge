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

  return <PublicAuthControlContent state={state} returnTo={returnTo} signedInAccessory={signedInAccessory} />;
}

/** Native auth presentation; identity continues to come from Clerk above. */
export function PublicAuthControlContent({ state, returnTo, signedInAccessory }: {
  state: ReturnType<typeof getPublicAuthControlState>; returnTo: string; signedInAccessory?: ReactNode;
}) {
  if (state === 'unconfigured') return null;
  if (state === 'connecting') {
    return (
      <Button
        type="button"
        size="sm"
        disabled
        aria-label="Connecting to account sign in"
        className="gap-2 max-sm:h-11 max-sm:w-11 max-sm:p-0 bg-[#6f552c] text-[var(--cf-accent-text)]"
      >
        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /><span className="max-sm:sr-only">Connecting…</span>
      </Button>
    );
  }

  if (state === 'signed-in') {
    return (
      <div className="flex items-center gap-2">
        {signedInAccessory}
        <UserButton
          userProfileMode="navigation"
          userProfileUrl="/account?section=profile"
          appearance={{ elements: { avatarBox: 'h-9 w-9' } }}
        />
      </div>
    );
  }

  return (
    <Button asChild type="button" size="sm" className="gap-2 max-sm:h-11 max-sm:w-11 max-sm:p-0 bg-[var(--cf-accent-strong)] text-[var(--cf-accent-contrast)] hover:bg-[var(--cf-accent)]">
      <Link href={createAuthRouteHref('/sign-in', returnTo)} prefetch={false}>
        <LogIn className="h-4 w-4" aria-hidden="true" /><span className="max-sm:sr-only">Sign in</span>
      </Link>
    </Button>
  );
}
