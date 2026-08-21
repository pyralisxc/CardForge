"use client";

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { History } from 'lucide-react';

import { RoadmapPanel } from '@/features/roadmap/components/RoadmapPanel';
import { useAccountEntitlement } from '@/features/account/client/entitlement';
import { useSiteContent } from '@/features/public-site/client/context';

export function RoadmapPage({
  initialAuthConfigured = false,
  supportEmail,
}: {
  initialAuthConfigured?: boolean;
  supportEmail?: string | null;
}) {
  const siteContent = useSiteContent();
  const entitlement = useAccountEntitlement({ initialAuthConfigured });
  const [clerkIdentity, setClerkIdentity] = useState({
    isLoaded: false,
    isSignedIn: entitlement.isSignedIn,
    email: entitlement.accountEmail,
  });
  const effectiveSignedIn = entitlement.authConfigured && clerkIdentity.isLoaded
    ? clerkIdentity.isSignedIn || entitlement.isSignedIn
    : entitlement.isSignedIn;
  const accountEmail = clerkIdentity.email ?? entitlement.accountEmail ?? null;
  const isDeveloper = entitlement.authConfigured
    && effectiveSignedIn
    && entitlement.ownerAccess.isOwner;

  return (
    <div className="min-h-screen bg-[var(--cf-canvas)] text-[var(--cf-text)]">
      {entitlement.authConfigured ? (
        <ClerkIdentityBridge onChange={setClerkIdentity} />
      ) : null}
      <section className="mx-auto max-w-7xl px-4 py-5 md:px-6">
        <div className="border border-[var(--cf-border-strong)] bg-[var(--cf-surface)] p-4 md:p-5">
          <div className="flex items-center gap-3 text-[var(--cf-accent-strong)]">
            <History className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-[0.18em]">{siteContent['roadmap.hero.eyebrow']}</span>
          </div>
          <h1 className="mt-3 font-serif text-3xl font-semibold leading-tight text-[var(--cf-text-strong)] md:text-4xl">
            {siteContent['roadmap.hero.headline']}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--cf-text-muted)]">
            {siteContent['roadmap.hero.body']}
          </p>
        </div>
      </section>

      <RoadmapPanel
        isDeveloper={isDeveloper}
        isOwner={entitlement.ownerAccess.isOwner}
        isSignedIn={effectiveSignedIn}
        accountEmail={accountEmail}
        supportEmail={supportEmail}
      />
    </div>
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