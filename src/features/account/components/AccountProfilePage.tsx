"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { SignInButton, SignUpButton, useUser } from '@clerk/nextjs';
import { ArrowRight, ShieldCheck, UserCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { AccountDeveloperStatusSection } from '@/features/account/components/AccountDeveloperStatusSection';
import { AccountIdentitySection } from '@/features/account/components/AccountIdentitySection';
import { useAccountEntitlement } from '@/features/account/hooks/useAccountEntitlement';
import { getAccountDisplayName } from '@/features/account/lib/accountDisplay';
import { AccountBillingActions } from '@/features/billing/client/account';
import { completeSignUpIntent, markSignUpIntent } from '@/features/analytics/client/tracking';

interface PlatformStatusPayload {
  billing: { productAccessConfigured: boolean };
}

interface ClerkIdentity {
  isLoaded: boolean;
  isSignedIn: boolean;
  email: string | null;
  displayName: string | null;
}

const formatAccessExpiration = (value: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

export function AccountProfilePage({ initialAuthConfigured = false }: { initialAuthConfigured?: boolean }) {
  const entitlement = useAccountEntitlement({ initialAuthConfigured });
  const [clerkIdentity, setClerkIdentity] = useState<ClerkIdentity>({
    isLoaded: false,
    isSignedIn: entitlement.isSignedIn,
    email: entitlement.accountEmail,
    displayName: null,
  });
  const [platformStatus, setPlatformStatus] = useState<PlatformStatusPayload | null>(null);
  const refreshEntitlement = entitlement.refreshEntitlement;
  const effectiveSignedIn = entitlement.authConfigured && clerkIdentity.isLoaded
    ? clerkIdentity.isSignedIn || entitlement.isSignedIn
    : entitlement.isSignedIn;

  useEffect(() => {
    if (!entitlement.authConfigured || !clerkIdentity.isLoaded) return;
    const clerkEmail = clerkIdentity.email ?? null;
    const entitlementEmail = entitlement.accountEmail ?? null;
    if (clerkIdentity.isSignedIn !== entitlement.isSignedIn || clerkEmail !== entitlementEmail) {
      void refreshEntitlement({ force: true });
    }
  }, [
    clerkIdentity.email,
    clerkIdentity.isLoaded,
    clerkIdentity.isSignedIn,
    entitlement.accountEmail,
    entitlement.authConfigured,
    entitlement.isSignedIn,
    refreshEntitlement,
  ]);

  useEffect(() => {
    let isMounted = true;
    void fetch('/api/billing/status', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load platform status.');
        return response.json() as Promise<PlatformStatusPayload>;
      })
      .then((payload) => { if (isMounted) setPlatformStatus(payload); })
      .catch(() => { if (isMounted) setPlatformStatus(null); });
    return () => { isMounted = false; };
  }, []);


  const accountEmail = useMemo(() => (
    clerkIdentity.email ?? entitlement.accountEmail ?? 'No signed-in account'
  ), [clerkIdentity.email, entitlement.accountEmail]);
  const accountDisplayName = getAccountDisplayName({
    displayName: clerkIdentity.displayName,
    email: clerkIdentity.email ?? entitlement.accountEmail,
  });
  const isClerkSetupIncomplete = !entitlement.authConfigured;
  const canStartCheckout = entitlement.authConfigured && effectiveSignedIn && !entitlement.canExportClean;
  const canManageBilling = entitlement.authConfigured && effectiveSignedIn && entitlement.hasStripeCustomer;
  const showCheckout = canStartCheckout && Boolean(platformStatus?.billing.productAccessConfigured);
  const accessExpiresOn = formatAccessExpiration(entitlement.accessExpiresAt);
  const isDeveloper = entitlement.authConfigured && effectiveSignedIn && entitlement.accessMode === 'dev';
  const isOwner = entitlement.authConfigured && effectiveSignedIn && entitlement.ownerAccess.isOwner;
  const accountTitle = isClerkSetupIncomplete
    ? 'Account setup needed'
    : effectiveSignedIn
      ? 'Your account'
      : 'Your CardForge account';
  const accountPanelMessage = isClerkSetupIncomplete
    ? 'Sign-in is not ready in this environment.'
    : isOwner
      ? 'You have access to CardForge owner tools.'
      : isDeveloper
        ? 'You can help review and contribute to shared CardForge assets.'
        : accessExpiresOn
          ? `Creator Pass is active through ${accessExpiresOn}.`
          : entitlement.canExportClean
            ? 'Watermark-free downloads are active for your account.'
            : 'Make cards in Studio, then come back here whenever you need your account or plan.';

  const planLabel = isOwner
    ? 'Owner access'
    : isDeveloper
      ? 'Contributor access'
      : accessExpiresOn
        ? `Creator Pass through ${accessExpiresOn}`
        : entitlement.canExportClean
          ? 'Creator Pass'
          : 'Free';

  const accountActions = (
    <>
      <Button asChild size="lg" className="bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]">
        <Link href="/studio" prefetch={false}>Open Studio <ArrowRight className="ml-2 h-5 w-5" /></Link>
      </Button>
      {entitlement.authConfigured && effectiveSignedIn ? (
        <Button asChild size="lg" variant="outline" className="min-w-[11rem] border-[#d8b365]/70 bg-[#120e09] font-semibold text-[#f8e3b0] hover:bg-[#2a1b0d] hover:text-[#fff1c7]">
          <Link href="/profile" prefetch={false}><UserCircle2 className="mr-2 h-5 w-5" />Profile &amp; security</Link>
        </Button>
      ) : null}
      <AccountBillingActions
        authConfigured={entitlement.authConfigured}
        canManageBilling={canManageBilling}
        effectiveSignedIn={effectiveSignedIn}
        checkoutLabel="Get Creator Pass"
        showCheckout={showCheckout}
      />
      {isClerkSetupIncomplete ? (
        <Button disabled size="lg" variant="outline" className="border-[#755632] bg-transparent text-[#bea97f]">Account setup needed</Button>
      ) : !effectiveSignedIn ? (
        <>
          <SignInButton mode="modal"><Button size="lg" variant="outline" className="border-[#d8b365]/70 bg-transparent text-[#f8e3b0] hover:bg-[#2a1b0d] hover:text-[#fff1c7]">Sign in</Button></SignInButton>
          <SignUpButton mode="modal"><Button size="lg" variant="ghost" onClick={markSignUpIntent} className="text-[#f7d690] hover:bg-[#24180e] hover:text-[#fff3ca]">Create account</Button></SignUpButton>
        </>
      ) : !canStartCheckout ? (
        <Button disabled size="lg" variant="outline" className="border-[#5f7f54] bg-transparent text-[#bde3a8]"><ShieldCheck className="mr-2 h-5 w-5" /> Downloads active</Button>
      ) : null}
    </>
  );

  return (
    <main className="min-h-screen bg-[#0c0b09] text-[#f7ead0]">
      {entitlement.authConfigured ? <ClerkIdentityBridge onChange={setClerkIdentity} /> : null}
      <section className="mx-auto max-w-4xl px-4 py-5 md:px-6">
        <AccountIdentitySection
          accountDisplayName={accountDisplayName}
          accountEmail={accountEmail}
          accountPanelMessage={accountPanelMessage}
          accountTitle={accountTitle}
          actions={accountActions}
          effectiveSignedIn={effectiveSignedIn}
          planLabel={planLabel}
        />
        <div className="mt-4 space-y-4">
          <AccountDeveloperStatusSection isOwner={isOwner} />
        </div>
      </section>
    </main>
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
      displayName: user?.fullName ?? user?.firstName ?? null,
    });
  }, [isLoaded, isSignedIn, onChange, user?.createdAt, user?.firstName, user?.fullName, user?.primaryEmailAddress?.emailAddress]);
  return null;
}
