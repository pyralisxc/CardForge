"use client";

import {
  SignInButton,
  SignUpButton,
  UserButton,
  useUser,
} from '@clerk/nextjs';
import { LogIn, UserPlus } from 'lucide-react';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';

interface AccountControlsProps {
  authConfigured: boolean;
  isSignedIn: boolean;
  modeLabel: string;
  onRefreshEntitlement: () => void;
}

export function AccountControls({
  authConfigured,
  isSignedIn,
  modeLabel,
  onRefreshEntitlement,
}: AccountControlsProps) {
  if (!authConfigured) {
    return (
      <div className="ml-auto hidden text-right text-xs text-[#c8b07f] sm:block">
        <p className="font-semibold text-[#fff1c7]">Clerk setup incomplete</p>
        <p>Add secret key to test accounts</p>
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
  const { isLoaded, isSignedIn } = useUser();
  const effectiveSignedIn = isLoaded ? Boolean(isSignedIn) : fallbackSignedIn;

  useEffect(() => {
    if (!isLoaded) return;
    onRefreshEntitlement();
  }, [isLoaded, isSignedIn, onRefreshEntitlement]);

  return (
    <div className="ml-auto flex items-center gap-2">
      <div className="hidden text-right text-xs text-[#c8b07f] sm:block">
        <p className="font-semibold text-[#fff1c7]">{modeLabel}</p>
        <p>{effectiveSignedIn ? 'Account connected' : 'Sign in to unlock paid export'}</p>
      </div>
      {!effectiveSignedIn ? (
        <>
        <SignInButton mode="modal">
          <Button type="button" size="sm" className="gap-2 bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]">
            <LogIn className="h-4 w-4" /> Sign in
          </Button>
        </SignInButton>
        <SignUpButton mode="modal">
          <Button type="button" variant="outline" size="sm" className="hidden gap-2 border-[#d8b365]/70 bg-transparent text-[#f8e3b0] hover:bg-[#2a1b0d] hover:text-[#fff1c7] sm:inline-flex">
            <UserPlus className="h-4 w-4" /> Create account
          </Button>
        </SignUpButton>
        </>
      ) : (
        <UserButton userProfileMode="navigation" userProfileUrl="/profile" />
      )}
    </div>
  );
}
