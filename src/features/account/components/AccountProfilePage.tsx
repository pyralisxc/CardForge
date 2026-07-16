"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { SignInButton, SignUpButton, useUser } from '@clerk/nextjs';
import { ArrowRight, ShieldCheck, Sparkles, UserCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { AccountAccessSection } from '@/features/account/components/AccountAccessSection';
import { AccountDeveloperStatusSection } from '@/features/account/components/AccountDeveloperStatusSection';
import { AccountFounderBetaSection } from '@/features/account/components/AccountFounderBetaSection';
import {
  AccountIdentitySection,
  type LocalAssetSummary,
} from '@/features/account/components/AccountIdentitySection';
import { useAccountEntitlement } from '@/features/account/hooks/useAccountEntitlement';
import { getAccountAccessActions } from '@/features/account/lib/accountAccessActions';
import { buildForgeTitle, getAccountDisplayName } from '@/features/account/lib/accountDisplay';
import type { AccountEntitlement } from '@/features/account/lib/accountEntitlement';
import type { FounderBetaCampaign } from '@/features/account/model/founderBeta';
import { AccountBillingActions } from '@/features/billing/client/account';
import {
  CUSTOM_DIVIDER_ASSETS_STORAGE_KEY,
  CUSTOM_ICON_ASSETS_STORAGE_KEY,
  CUSTOM_IMAGE_ASSETS_STORAGE_KEY,
  CUSTOM_TEXTURE_ASSETS_STORAGE_KEY,
  getProjectAssetStorage,
  readProjectAssetListFromStorage,
} from '@/features/project/client';

interface PlatformStatusPayload {
  billing: { checkoutConfigured: boolean };
  founderBetaCampaign?: FounderBetaCampaign;
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

const getFounderBetaStatusCopy = ({
  campaign,
  isSignedIn,
  slotsRemaining,
}: {
  campaign: FounderBetaCampaign;
  isSignedIn: boolean;
  slotsRemaining: number;
}) => {
  if (!campaign.enabled) return 'Founder Beta is currently paused.';
  if (!campaign.autoGrant) return 'Founder Beta is being granted manually by the CardForge team.';
  if (slotsRemaining <= 0) {
    return campaign.waitlistEnabled
      ? 'The current Founder Beta wave is full. Join the waitlist or check back when the next wave opens.'
      : 'The current Founder Beta wave is full.';
  }
  if (!isSignedIn) return 'Sign in to claim a Founder Beta export pass for this account.';
  return `Claiming Founder Beta grants ${campaign.accessDays} days of clean export access for this account.`;
};

export function AccountProfilePage({ initialAuthConfigured = false }: { initialAuthConfigured?: boolean }) {
  const { toast } = useToast();
  const entitlement = useAccountEntitlement({ initialAuthConfigured });
  const [clerkIdentity, setClerkIdentity] = useState<ClerkIdentity>({
    isLoaded: false,
    isSignedIn: entitlement.isSignedIn,
    email: entitlement.accountEmail,
    displayName: null,
  });
  const [platformStatus, setPlatformStatus] = useState<PlatformStatusPayload | null>(null);
  const [isClaimingFounderBeta, setIsClaimingFounderBeta] = useState(false);
  const [localAssetSummary, setLocalAssetSummary] = useState<LocalAssetSummary>({
    textures: 0,
    dividers: 0,
    icons: 0,
    images: 0,
  });
  const effectiveSignedIn = entitlement.authConfigured && clerkIdentity.isLoaded
    ? clerkIdentity.isSignedIn || entitlement.isSignedIn
    : entitlement.isSignedIn;

  useEffect(() => {
    if (!entitlement.authConfigured || !clerkIdentity.isLoaded) return;
    const clerkEmail = clerkIdentity.email ?? null;
    const entitlementEmail = entitlement.accountEmail ?? null;
    if (clerkIdentity.isSignedIn !== entitlement.isSignedIn || clerkEmail !== entitlementEmail) {
      void entitlement.refreshEntitlement({ force: true });
    }
  }, [
    clerkIdentity.email,
    clerkIdentity.isLoaded,
    clerkIdentity.isSignedIn,
    entitlement.accountEmail,
    entitlement.authConfigured,
    entitlement.isSignedIn,
    entitlement.refreshEntitlement,
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

  useEffect(() => {
    const readLocalAssets = async () => {
      const storage = getProjectAssetStorage();
      const [textures, dividers, icons, images] = await Promise.all([
        readProjectAssetListFromStorage(storage, CUSTOM_TEXTURE_ASSETS_STORAGE_KEY),
        readProjectAssetListFromStorage(storage, CUSTOM_DIVIDER_ASSETS_STORAGE_KEY),
        readProjectAssetListFromStorage(storage, CUSTOM_ICON_ASSETS_STORAGE_KEY),
        readProjectAssetListFromStorage(storage, CUSTOM_IMAGE_ASSETS_STORAGE_KEY),
      ]);
      setLocalAssetSummary({
        textures: textures.length,
        dividers: dividers.length,
        icons: icons.length,
        images: images.length,
      });
    };
    void readLocalAssets();
    window.addEventListener('storage', readLocalAssets);
    window.addEventListener('focus', readLocalAssets);
    return () => {
      window.removeEventListener('storage', readLocalAssets);
      window.removeEventListener('focus', readLocalAssets);
    };
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
  const founderBetaCampaign = platformStatus?.founderBetaCampaign;
  const founderBetaSlotsRemaining = founderBetaCampaign
    ? Math.max(0, founderBetaCampaign.releaseSlotCap - founderBetaCampaign.claimedSlots)
    : 0;
  const canClaimFounderBeta = Boolean(
    canStartCheckout
    && founderBetaCampaign?.enabled
    && founderBetaCampaign.autoGrant
    && founderBetaSlotsRemaining > 0,
  );
  const accountAccessActions = getAccountAccessActions({
    canClaimFounderBeta,
    canStartCheckout,
    checkoutConfigured: Boolean(platformStatus?.billing.checkoutConfigured),
    effectiveSignedIn,
    isClerkSetupIncomplete,
  });
  const accessExpiresOn = formatAccessExpiration(entitlement.accessExpiresAt);
  const isDeveloper = entitlement.authConfigured && effectiveSignedIn && entitlement.accessMode === 'dev';
  const isOwner = entitlement.authConfigured && effectiveSignedIn && entitlement.ownerAccess.isOwner;
  const libraryAccessLabel = isOwner
    ? 'Library Command'
    : isDeveloper
      ? 'Forge Review'
      : entitlement.canExportClean
        ? 'Creator Pass Library'
        : 'Starter Library';
  const accountTitle = buildForgeTitle({
    displayName: clerkIdentity.displayName,
    email: clerkIdentity.email ?? entitlement.accountEmail,
    tierLabel: isOwner ? 'Library Command' : isDeveloper ? 'Forge Review' : entitlement.canExportClean ? 'Creator Pass' : 'Starter Library',
    isAnonymous: !effectiveSignedIn,
    isSetupIncomplete: isClerkSetupIncomplete,
  });
  const accountMessage = isClerkSetupIncomplete
    ? 'Add matching Clerk keys locally, restart the dev server, then test free, paid, developer, and owner states.'
    : isOwner
      ? 'Owner access unlocks export, contributor command, voting rules, caps, and launch controls.'
      : isDeveloper
        ? 'Your developer account can submit building blocks, vote on the library, and export clean files without a subscription.'
        : accessExpiresOn
          ? `Founder Beta keeps clean export active through ${accessExpiresOn}.`
          : entitlement.canExportClean
            ? 'Clean export and Creator Pass assets are active while your project files stay local.'
            : 'Build card systems in the browser. Sign in when you want custom art uploads, clean export, or a deeper reviewed library.';
  const accountPanelMessage = !isClerkSetupIncomplete && !isOwner && !isDeveloper && !accessExpiresOn && !entitlement.canExportClean
    ? 'Starter Library is active. Sign in to add custom art; Creator Pass unlocks clean export and the deeper reviewed library.'
    : accountMessage;

  const handleClaimFounderBeta = async () => {
    setIsClaimingFounderBeta(true);
    try {
      const response = await fetch('/api/founder-beta/claim', { method: 'POST' });
      const body = await response.json() as {
        accessExpiresAt?: string;
        entitlement?: AccountEntitlement;
        error?: { message?: string };
        campaign?: FounderBetaCampaign;
      };
      if (!response.ok) throw new Error(body.error?.message ?? 'Unable to claim Founder Beta access.');
      if (body.campaign) {
        setPlatformStatus((current) => current ? { ...current, founderBetaCampaign: body.campaign } : current);
      }
      if (body.entitlement) entitlement.applyEntitlement(body.entitlement);
      else await entitlement.refreshEntitlement();
      toast({
        title: 'Founder Beta claimed',
        description: `Clean export is active${body.accessExpiresAt ? ` through ${formatAccessExpiration(body.accessExpiresAt)}` : ''}.`,
      });
    } catch (error) {
      toast({
        title: 'Founder Beta not claimed',
        description: error instanceof Error ? error.message : 'Unable to claim Founder Beta access.',
        variant: 'destructive',
      });
    } finally {
      setIsClaimingFounderBeta(false);
    }
  };

  const accountActions = (
    <>
      <Button asChild size="lg" className="bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]">
        <Link href="/studio" prefetch={false}>Open Studio <ArrowRight className="ml-2 h-5 w-5" /></Link>
      </Button>
      {entitlement.authConfigured && effectiveSignedIn ? (
        <Button asChild size="lg" variant="outline" className="min-w-[11rem] border-[#d8b365]/70 bg-[#120e09] font-semibold text-[#f8e3b0] hover:bg-[#2a1b0d] hover:text-[#fff1c7]">
          <Link href="/profile" prefetch={false}><UserCircle2 className="mr-2 h-5 w-5" />Manage Account</Link>
        </Button>
      ) : null}
      <AccountBillingActions
        authConfigured={entitlement.authConfigured}
        canManageBilling={canManageBilling}
        effectiveSignedIn={effectiveSignedIn}
        checkoutLabel={accountAccessActions.checkoutLabel}
        showCheckout={accountAccessActions.showCheckout}
      />
      {isClerkSetupIncomplete ? (
        <Button disabled size="lg" variant="outline" className="border-[#755632] bg-transparent text-[#bea97f]">Clerk setup incomplete</Button>
      ) : !effectiveSignedIn ? (
        <>
          <SignInButton mode="modal"><Button size="lg" variant="outline" className="border-[#d8b365]/70 bg-transparent text-[#f8e3b0] hover:bg-[#2a1b0d] hover:text-[#fff1c7]">Sign in for export</Button></SignInButton>
          <SignUpButton mode="modal"><Button size="lg" variant="ghost" className="text-[#f7d690] hover:bg-[#24180e] hover:text-[#fff3ca]">Create account</Button></SignUpButton>
        </>
      ) : accountAccessActions.showFounderBeta ? (
        <Button size="lg" variant="outline" className="border-[#d8b365]/70 bg-transparent text-[#f8e3b0] hover:bg-[#2a1b0d] hover:text-[#fff1c7]" onClick={handleClaimFounderBeta} disabled={isClaimingFounderBeta}>
          <Sparkles className="mr-2 h-5 w-5" />{isClaimingFounderBeta ? 'Claiming pass...' : 'Claim Founder Beta'}
        </Button>
      ) : !canStartCheckout ? (
        <Button disabled size="lg" variant="outline" className="border-[#5f7f54] bg-transparent text-[#bde3a8]"><ShieldCheck className="mr-2 h-5 w-5" /> Export active</Button>
      ) : null}
    </>
  );

  return (
    <main className="min-h-screen bg-[#0c0b09] text-[#f7ead0]">
      {entitlement.authConfigured ? <ClerkIdentityBridge onChange={setClerkIdentity} /> : null}
      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-5 md:px-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <AccountIdentitySection
          accountDisplayName={accountDisplayName}
          accountEmail={accountEmail}
          accountPanelMessage={accountPanelMessage}
          accountTitle={accountTitle}
          accessExpiresOn={accessExpiresOn}
          actions={accountActions}
          cleanExportLabel={isClerkSetupIncomplete ? (entitlement.canExportClean ? 'Local dev fallback' : 'Locked') : (entitlement.canExportClean ? 'Unlocked' : 'Locked')}
          effectiveSignedIn={effectiveSignedIn}
          libraryAccessLabel={libraryAccessLabel}
          localAssetSummary={localAssetSummary}
        />
        <aside className="space-y-4">
          <AccountAccessSection effectiveSignedIn={effectiveSignedIn} isDeveloper={isDeveloper} isOwner={isOwner} />
          <AccountDeveloperStatusSection authSetupIncomplete={isClerkSetupIncomplete} isDeveloper={isDeveloper} isOwner={isOwner} ownerSource={entitlement.ownerAccess.source} />
          {founderBetaCampaign ? (
            <AccountFounderBetaSection
              campaign={founderBetaCampaign}
              slotsRemaining={founderBetaSlotsRemaining}
              statusCopy={getFounderBetaStatusCopy({ campaign: founderBetaCampaign, isSignedIn: effectiveSignedIn, slotsRemaining: founderBetaSlotsRemaining })}
            />
          ) : null}
        </aside>
      </section>
      <section className="mx-auto max-w-7xl px-4 pb-10 md:px-6">
        <AccountDeveloperStatusSection
          authSetupIncomplete={false}
          isDeveloper={isDeveloper}
          isOwner={isOwner}
          ownerSource={entitlement.ownerAccess.source}
          showAccountLinks
          showStatusPanels={false}
        />
      </section>
    </main>
  );
}

function ClerkIdentityBridge({ onChange }: { onChange: (identity: ClerkIdentity) => void }) {
  const { isLoaded, isSignedIn, user } = useUser();
  useEffect(() => {
    onChange({
      isLoaded,
      isSignedIn: Boolean(isSignedIn),
      email: user?.primaryEmailAddress?.emailAddress ?? null,
      displayName: user?.fullName ?? user?.firstName ?? null,
    });
  }, [isLoaded, isSignedIn, onChange, user?.firstName, user?.fullName, user?.primaryEmailAddress?.emailAddress]);
  return null;
}
