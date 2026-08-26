"use client";

import { useEffect, useState, type ReactNode } from 'react';
import { useUser } from '@clerk/nextjs';

import { useAccountEntitlement } from '@/features/account/hooks/useAccountEntitlement';
import { completeSignUpIntent } from '@/features/analytics/client/tracking';

interface AccountHomeBoundaryProps {
  initialAuthConfigured?: boolean;
  children: ReactNode;
}

interface ClerkIdentity {
  isLoaded: boolean;
  isSignedIn: boolean;
  email: string | null;
}

export function AccountHomeBoundary({ initialAuthConfigured = false, children }: AccountHomeBoundaryProps) {
  const entitlement = useAccountEntitlement({ initialAuthConfigured });
  const [identity, setIdentity] = useState<ClerkIdentity>({
    isLoaded: false,
    isSignedIn: entitlement.isSignedIn,
    email: entitlement.accountEmail,
  });
  const refreshEntitlement = entitlement.refreshEntitlement;

  useEffect(() => {
    if (!entitlement.authConfigured || !identity.isLoaded) return;
    if (
      identity.isSignedIn !== entitlement.isSignedIn
      || identity.email !== (entitlement.accountEmail ?? null)
    ) {
      void refreshEntitlement({ force: true });
    }
  }, [
    entitlement.accountEmail,
    entitlement.authConfigured,
    entitlement.isSignedIn,
    identity.email,
    identity.isLoaded,
    identity.isSignedIn,
    refreshEntitlement,
  ]);

  return (
    <div className="min-h-screen bg-[var(--cf-canvas)] text-[var(--cf-text)]">
      {entitlement.authConfigured ? <ClerkIdentityBridge onChange={setIdentity} /> : null}
      {entitlement.entitlementError ? (
        <div role="status" className="border-b border-[#8b4c35] bg-[#2a130e] px-4 py-3 text-sm text-[#efb6a4]">
          Account access is unavailable. Local work remains available and has not been relabeled as signed-out or Free.
        </div>
      ) : null}
      {children}
    </div>
  );
}

function ClerkIdentityBridge({ onChange }: { onChange: (identity: ClerkIdentity) => void }) {
  const { isLoaded, isSignedIn, user } = useUser();
  useEffect(() => {
    if (isLoaded && isSignedIn) completeSignUpIntent(user?.createdAt);
    onChange({
      isLoaded,
      isSignedIn: Boolean(isSignedIn),
      email: user?.primaryEmailAddress?.emailAddress ?? null,
    });
  }, [isLoaded, isSignedIn, onChange, user?.createdAt, user?.primaryEmailAddress?.emailAddress]);
  return null;
}
