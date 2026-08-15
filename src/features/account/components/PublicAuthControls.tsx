"use client";

import { SignInButton, UserButton, useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { Code2, LoaderCircle, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDeveloperAccess } from '@/features/developer-access/client';
import {
  getPublicAuthControlState,
  isClerkPublicConfigPresent,
} from '@/infrastructure/auth/clerk';

export function PublicAuthControls() {
  if (!isClerkPublicConfigPresent()) return null;

  return <ClerkPublicAuthControls />;
}

function ClerkPublicAuthControls() {
  const { isLoaded, isSignedIn, user } = useUser();
  const developerAccess = useDeveloperAccess(
    isLoaded && isSignedIn ? user?.id ?? null : null,
  );

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
        className="gap-2 bg-[#6f552c] text-[#f8e3b0]"
      >
        <LoaderCircle className="h-4 w-4 animate-spin" /> Connecting…
      </Button>
    );
  }

  if (state === 'signed-in') {
    return (
      <div className="flex items-center gap-2">
        {developerAccess.hasCockpitAccess ? (
          <Button
            asChild
            size="sm"
            variant="outline"
            className="gap-2 border-[#8a642f] bg-transparent text-[#f0c568] hover:bg-[#241a0f] hover:text-[#ffe7ad]"
          >
            <Link href={developerAccess.cockpitHref} prefetch={false}>
              <Code2 className="h-4 w-4" aria-hidden="true" /> Developer
            </Link>
          </Button>
        ) : null}
        <UserButton userProfileMode="navigation" userProfileUrl="/account" />
      </div>
    );
  }

  return (
    <SignInButton mode="modal">
      <Button type="button" size="sm" className="gap-2 bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]">
        <LogIn className="h-4 w-4" /> Sign in
      </Button>
    </SignInButton>
  );
}
