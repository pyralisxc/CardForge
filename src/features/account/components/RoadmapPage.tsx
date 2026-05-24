"use client";

import { useEffect, useState } from 'react';
import { UserButton, useUser } from '@clerk/nextjs';
import { History } from 'lucide-react';

import { PublicSiteHeader } from '@/components/card-forge/PublicSiteHeader';
import { RoadmapPanel } from '@/features/account/components/RoadmapPanel';
import { useAccountEntitlement } from '@/features/account/hooks/useAccountEntitlement';

export function RoadmapPage({
  initialAuthConfigured = false,
}: {
  initialAuthConfigured?: boolean;
}) {
  const entitlement = useAccountEntitlement({ initialAuthConfigured });
  const [clerkIdentity, setClerkIdentity] = useState({
    isLoaded: false,
    isSignedIn: entitlement.isSignedIn,
    email: entitlement.accountEmail,
  });
  const effectiveSignedIn = entitlement.authConfigured && clerkIdentity.isLoaded
    ? clerkIdentity.isSignedIn
    : entitlement.isSignedIn;
  const accountEmail = clerkIdentity.email ?? entitlement.accountEmail ?? null;
  const isDeveloper = entitlement.authConfigured
    && effectiveSignedIn
    && (entitlement.accessMode === 'dev' || entitlement.ownerAccess.isOwner);

  return (
    <main className="min-h-screen bg-[#0c0b09] text-[#f7ead0]">
      {entitlement.authConfigured ? (
        <ClerkIdentityBridge onChange={setClerkIdentity} />
      ) : null}
      <PublicSiteHeader
        currentPath="/roadmap"
        showOwnerLink={entitlement.ownerAccess.isOwner}
        rightSlot={entitlement.authConfigured && effectiveSignedIn ? (
          <UserButton userProfileMode="navigation" userProfileUrl="/profile" />
        ) : null}
      />

      <section className="mx-auto max-w-7xl px-4 py-5 md:px-6">
        <div className="border border-[#6d4f2b] bg-[#15100a] p-4 md:p-5">
          <div className="flex items-center gap-3 text-[#e2aa4a]">
            <History className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-[0.18em]">Forge Chronicle</span>
          </div>
          <h1 className="mt-3 font-serif text-3xl font-semibold leading-tight text-[#fff1c7] md:text-4xl">
            Vote for the CardForge tools you want next.
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#c7b288]">
            Add compact ideas, vote on what matters, and follow the next milestones without digging through your account page. Suggestions and votes are shared public beta signals, not private project notes.
          </p>
        </div>
      </section>

      <RoadmapPanel
        isDeveloper={isDeveloper}
        isSignedIn={effectiveSignedIn}
        accountEmail={accountEmail}
      />
    </main>
  );
}

function ClerkIdentityBridge({
  onChange,
}: {
  onChange: (identity: {
    isLoaded: boolean;
    isSignedIn: boolean;
    email: string | null;
  }) => void;
}) {
  const { isLoaded, isSignedIn, user } = useUser();

  useEffect(() => {
    onChange({
      isLoaded,
      isSignedIn: Boolean(isSignedIn),
      email: user?.primaryEmailAddress?.emailAddress ?? null,
    });
  }, [isLoaded, isSignedIn, onChange, user?.primaryEmailAddress?.emailAddress]);

  return null;
}
