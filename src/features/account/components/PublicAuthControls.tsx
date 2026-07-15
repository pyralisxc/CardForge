"use client";

import { SignInButton, UserButton, useUser } from '@clerk/nextjs';
import { LoaderCircle, LogIn } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  getPublicAuthControlState,
  isClerkPublicConfigPresent,
} from '@/lib/clerkConfig';

export function PublicAuthControls() {
  if (!isClerkPublicConfigPresent()) {
    return (
      <Button asChild size="sm" variant="outline" className="border-[#d8b365]/70 bg-transparent text-[#f8e3b0] hover:bg-[#2a1b0d] hover:text-[#fff1c7]">
        <Link href="/account" prefetch={false}>Account</Link>
      </Button>
    );
  }

  return <ClerkPublicAuthControls />;
}

function ClerkPublicAuthControls() {
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
        className="gap-2 bg-[#6f552c] text-[#f8e3b0]"
      >
        <LoaderCircle className="h-4 w-4 animate-spin" /> Connecting…
      </Button>
    );
  }

  if (state === 'signed-in') {
    return <UserButton userProfileMode="navigation" userProfileUrl="/profile" />;
  }

  return (
    <SignInButton mode="modal">
      <Button type="button" size="sm" className="gap-2 bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]">
        <LogIn className="h-4 w-4" /> Sign in
      </Button>
    </SignInButton>
  );
}
