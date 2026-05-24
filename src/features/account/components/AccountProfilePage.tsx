"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  SignInButton,
  SignUpButton,
  UserButton,
  useUser,
} from '@clerk/nextjs';
import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Crown,
  FolderOpen,
  Hammer,
  Lock,
  ShieldCheck,
  Sparkles,
  UserCircle2,
  type LucideIcon,
} from 'lucide-react';

import { PublicSiteHeader } from '@/components/card-forge/PublicSiteHeader';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAccountEntitlement } from '@/features/account/hooks/useAccountEntitlement';
import { useCheckoutActions } from '@/features/billing/hooks/useCheckoutActions';
import type { FounderBetaCampaign } from '@/lib/ownerConsole';
import type { AccountEntitlement } from '@/lib/accountEntitlement';
import {
  CUSTOM_DIVIDER_ASSETS_STORAGE_KEY,
  CUSTOM_TEXTURE_ASSETS_STORAGE_KEY,
} from '@/lib/projectDocument';
import { readProjectAssetListFromStorage } from '@/features/project/lib/projectLocalAssets';
import { buildForgeTitle, getAccountDisplayName } from '@/features/account/lib/accountDisplay';

interface PlatformStatusPayload {
  billing: {
    checkoutConfigured: boolean;
    webhookConfigured: boolean;
    missing: string[];
  };
  authConfigured: boolean;
  accessMode: string;
  shippedLibraryWritesEnabled: boolean;
  supabase?: {
    configured: boolean;
    missing: string[];
  };
  founderBetaCampaign?: FounderBetaCampaign;
}

interface LocalAssetSummary {
  textures: number;
  dividers: number;
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

const accessExplainerRows = [
  {
    label: 'Free preview',
    value: 'Design templates, import data, generate previews, and export/import project files locally.',
  },
  {
    label: 'Founder Beta',
    value: 'A time-boxed clean export grant while billing and the shared library are still being proven.',
  },
  {
    label: 'Creator Pass',
    value: 'The paid or beta export tier for clean PDF, PNG, ZIP, and stronger library assets.',
  },
  {
    label: 'Developer',
    value: 'Approved contributors can submit and vote on shared library assets without paying for access.',
  },
] as const;

function LibraryLaneRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-[1.4rem_7rem_1fr] items-start gap-3 border-b border-[#4a3823] py-3 last:border-b-0">
      <Icon className="mt-0.5 h-4 w-4 text-[#e2aa4a]" />
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#a98a55]">{label}</p>
      <p className="text-sm leading-5 text-[#d8c49a]">{value}</p>
    </div>
  );
}

export function AccountProfilePage({
  initialAuthConfigured = false,
}: {
  initialAuthConfigured?: boolean;
}) {
  const { toast } = useToast();
  const entitlement = useAccountEntitlement({ initialAuthConfigured });
  const [clerkIdentity, setClerkIdentity] = useState<{
    isLoaded: boolean;
    isSignedIn: boolean;
    email: string | null;
    displayName: string | null;
  }>({
    isLoaded: false,
    isSignedIn: entitlement.isSignedIn,
    email: entitlement.accountEmail,
    displayName: null,
  });
  const effectiveSignedIn = entitlement.authConfigured && clerkIdentity.isLoaded
    ? clerkIdentity.isSignedIn
    : entitlement.isSignedIn;
  const [platformStatus, setPlatformStatus] = useState<PlatformStatusPayload | null>(null);
  const [isClaimingFounderBeta, setIsClaimingFounderBeta] = useState(false);
  const [localAssetSummary, setLocalAssetSummary] = useState<LocalAssetSummary>({
    textures: 0,
    dividers: 0,
  });

  const { handleStartCheckout, isCheckoutStarting } = useCheckoutActions({
    authConfigured: entitlement.authConfigured,
    isSignedIn: effectiveSignedIn,
    toast,
  });

  useEffect(() => {
    let isMounted = true;

    const loadStatus = async () => {
      try {
        const response = await fetch('/api/billing/status', { cache: 'no-store' });
        if (!response.ok) throw new Error('Unable to load platform status.');
        const payload = await response.json() as PlatformStatusPayload;
        if (isMounted) setPlatformStatus(payload);
      } catch {
        if (isMounted) setPlatformStatus(null);
      }
    };

    void loadStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const readLocalAssets = () => {
      setLocalAssetSummary({
        textures: readProjectAssetListFromStorage(window.localStorage, CUSTOM_TEXTURE_ASSETS_STORAGE_KEY).length,
        dividers: readProjectAssetListFromStorage(window.localStorage, CUSTOM_DIVIDER_ASSETS_STORAGE_KEY).length,
      });
    };

    readLocalAssets();
    window.addEventListener('storage', readLocalAssets);
    window.addEventListener('focus', readLocalAssets);

    return () => {
      window.removeEventListener('storage', readLocalAssets);
      window.removeEventListener('focus', readLocalAssets);
    };
  }, []);

  const accountEmail = useMemo(() => (
    clerkIdentity.email
    ?? entitlement.accountEmail
    ?? 'No signed-in account'
  ), [clerkIdentity.email, entitlement.accountEmail]);
  const accountDisplayName = getAccountDisplayName({
    displayName: clerkIdentity.displayName,
    email: clerkIdentity.email ?? entitlement.accountEmail,
  });

  const isClerkSetupIncomplete = !entitlement.authConfigured;
  const canStartCheckout = entitlement.authConfigured && effectiveSignedIn && !entitlement.canExportClean;
  const checkoutConfigured = Boolean(platformStatus?.billing.checkoutConfigured);
  const founderBetaCampaign = platformStatus?.founderBetaCampaign;
  const founderBetaSlotsRemaining = founderBetaCampaign
    ? Math.max(0, founderBetaCampaign.releaseSlotCap - founderBetaCampaign.claimedSlots)
    : 0;
  const founderBetaStatusCopy = founderBetaCampaign
    ? getFounderBetaStatusCopy({
      campaign: founderBetaCampaign,
      isSignedIn: effectiveSignedIn,
      slotsRemaining: founderBetaSlotsRemaining,
    })
    : null;
  const canClaimFounderBeta = Boolean(
    entitlement.authConfigured
    && effectiveSignedIn
    && !entitlement.canExportClean
    && founderBetaCampaign?.enabled
    && founderBetaCampaign.autoGrant
    && founderBetaSlotsRemaining > 0
  );
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
    tierLabel: isOwner
      ? 'Library Command'
      : isDeveloper
        ? 'Forge Review'
        : entitlement.canExportClean
          ? 'Creator Pass'
          : 'Starter Library',
    isAnonymous: !effectiveSignedIn,
    isSetupIncomplete: isClerkSetupIncomplete,
  });
  const accountMessage = isClerkSetupIncomplete
    ? 'Add matching Clerk keys locally, restart the dev server, then test free, paid, developer, and owner states.'
    : isOwner
      ? 'Owner access unlocks export, developer asset command, voting rules, caps, and launch controls.'
    : isDeveloper
      ? 'Your developer account can submit assets, vote on the library, and export clean files without a subscription.'
    : accessExpiresOn
      ? `Founder Beta keeps clean export active through ${accessExpiresOn}.`
    : entitlement.canExportClean
        ? 'Clean export and Creator Pass assets are active while your project files stay local.'
        : 'Build cards in the browser. Sign in when you want custom art uploads, clean export, or a stronger library.';
  const cleanExportLabel = isClerkSetupIncomplete
    ? (entitlement.canExportClean ? 'Local dev fallback' : 'Locked')
    : (entitlement.canExportClean ? 'Unlocked' : 'Locked');
  const accountPanelMessage = !isClerkSetupIncomplete && !isOwner && !isDeveloper && !accessExpiresOn && !entitlement.canExportClean
    ? 'Starter Library is active. Sign in to add custom art; Creator Pass unlocks clean export and a stronger library.'
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
      if (body.entitlement) {
        entitlement.applyEntitlement(body.entitlement);
      } else {
        await entitlement.refreshEntitlement();
      }
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

  return (
    <main className="min-h-screen bg-[#0c0b09] text-[#f7ead0]">
      {entitlement.authConfigured ? (
        <ClerkIdentityBridge onChange={setClerkIdentity} />
      ) : null}
      <PublicSiteHeader
        currentPath="/account"
        showOwnerLink={isOwner}
        rightSlot={entitlement.authConfigured && effectiveSignedIn ? (
          <UserButton userProfileMode="navigation" userProfileUrl="/profile" />
        ) : null}
      />

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-5 md:px-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="border border-[#5f4526] bg-[#15100a] p-4 md:p-5">
          <div className="flex items-center gap-3 text-[#e2aa4a]">
            <UserCircle2 className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-[0.18em]">
              {accountDisplayName ? `${accountDisplayName} workspace` : 'Your workspace'}
            </span>
          </div>
          <h1 className="mt-3 font-serif text-3xl font-semibold leading-tight text-[#fff1c7] md:text-4xl">
            {accountTitle}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#cbb58b]">
            {accountPanelMessage}
          </p>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="border border-[#5f4526] bg-[#100c08] p-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-[#a98a55]">Account</p>
              <p className="mt-2 break-words text-[#ffe7ad]">{accountEmail}</p>
            </div>
            <div className="border border-[#5f4526] bg-[#100c08] p-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-[#a98a55]">Clean export</p>
              <p className="mt-2 text-[#ffe7ad]">{cleanExportLabel}</p>
              {accessExpiresOn ? (
                <p className="mt-1 text-xs text-[#c7b288]">Beta through {accessExpiresOn}</p>
              ) : null}
            </div>
            <div className="border border-[#5f4526] bg-[#100c08] p-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-[#a98a55]">Forge status</p>
              <p className="mt-2 text-[#ffe7ad]">Maker and generator available</p>
            </div>
            <div className="border border-[#5f4526] bg-[#100c08] p-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-[#a98a55]">Asset access</p>
              <p className="mt-2 text-[#ffe7ad]">{libraryAccessLabel}</p>
            </div>
          </div>

          <div className="mt-3 border border-[#5f4526] bg-[#100c08] p-3">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <FolderOpen className="mt-1 h-5 w-5 text-[#e2aa4a]" />
                <div>
                  <p className="font-serif text-lg text-[#fff1c7]">Local Asset Library</p>
                  <p className="mt-1 text-sm leading-5 text-[#c7b288]">
                    Your custom art stays browser-local. Sign in to add uploads to this workspace.
                  </p>
                </div>
              </div>
              <div className="grid min-w-44 grid-cols-2 gap-2 text-center">
                <div className="border border-[#4a3823] bg-[#0c0b09] px-3 py-2">
                  <p className="text-lg font-semibold text-[#ffe7ad]">{localAssetSummary.textures}</p>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[#a98a55]">Textures</p>
                </div>
                <div className="border border-[#4a3823] bg-[#0c0b09] px-3 py-2">
                  <p className="text-lg font-semibold text-[#ffe7ad]">{localAssetSummary.dividers}</p>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[#a98a55]">Dividers</p>
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs uppercase tracking-[0.14em] text-[#a98a55]">
              {effectiveSignedIn ? 'Custom art uploads are available in this workspace' : 'Sign in to add custom art'}
            </p>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button asChild size="lg" className="bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]">
              <Link href="/studio" prefetch={false}>
                Open Studio <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            {entitlement.authConfigured && effectiveSignedIn ? (
              <Button asChild size="lg" variant="outline" className="border-[#d8b365]/70 bg-transparent text-[#f8e3b0] hover:bg-[#2a1b0d] hover:text-[#fff1c7]">
                <Link href="/profile" prefetch={false}>
                  Manage Profile
                </Link>
              </Button>
            ) : null}
            {!entitlement.authConfigured ? (
              <Button disabled size="lg" variant="outline" className="border-[#755632] bg-transparent text-[#bea97f]">
                Clerk setup incomplete
              </Button>
            ) : !effectiveSignedIn ? (
              <>
                <SignInButton mode="modal">
                  <Button size="lg" variant="outline" className="border-[#d8b365]/70 bg-transparent text-[#f8e3b0] hover:bg-[#2a1b0d] hover:text-[#fff1c7]">
                    Sign in for export
                  </Button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <Button size="lg" variant="ghost" className="text-[#f7d690] hover:bg-[#24180e] hover:text-[#fff3ca]">
                    Create account
                  </Button>
                </SignUpButton>
              </>
            ) : canStartCheckout ? (
              canClaimFounderBeta ? (
                <Button
                  size="lg"
                  variant="outline"
                  className="border-[#d8b365]/70 bg-transparent text-[#f8e3b0] hover:bg-[#2a1b0d] hover:text-[#fff1c7]"
                  onClick={handleClaimFounderBeta}
                  disabled={isClaimingFounderBeta}
                >
                  <Sparkles className="mr-2 h-5 w-5" />
                  {isClaimingFounderBeta ? 'Claiming pass...' : 'Claim Founder Beta'}
                </Button>
              ) : (
                <Button
                  size="lg"
                  variant="outline"
                  className="border-[#d8b365]/70 bg-transparent text-[#f8e3b0] hover:bg-[#2a1b0d] hover:text-[#fff1c7]"
                  onClick={handleStartCheckout}
                  disabled={isCheckoutStarting}
                >
                  <CreditCard className="mr-2 h-5 w-5" />
                  {isCheckoutStarting
                    ? 'Checking access...'
                    : checkoutConfigured
                      ? 'Unlock export'
                      : 'Beta access by invite'}
                </Button>
              )
            ) : (
              <Button disabled size="lg" variant="outline" className="border-[#5f7f54] bg-transparent text-[#bde3a8]">
                <ShieldCheck className="mr-2 h-5 w-5" /> Export active
              </Button>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="border border-[#5f4526] bg-[#15100a] p-4">
            <div className="flex items-center gap-3 text-[#e2aa4a]">
              <ShieldCheck className="h-5 w-5" />
              <h2 className="font-serif text-xl text-[#fff1c7]">Access at a glance</h2>
            </div>
            <div className="mt-3">
              {accessExplainerRows.map((row) => (
                <div key={row.label} className="border-b border-[#4a3823] py-3 last:border-b-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#a98a55]">{row.label}</p>
                  <p className="mt-1 text-sm leading-5 text-[#d8c49a]">{row.value}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs uppercase tracking-[0.14em] text-[#a98a55]">
              Project files and personal uploads stay local unless you choose to export files or submit assets.
            </p>
          </div>

          {isOwner ? (
            <div className="border border-[#8a642f] bg-[#1b1209] p-4 shadow-[inset_0_0_0_1px_rgba(255,224,157,0.08)]">
              <div className="flex items-center gap-3 text-[#f0c568]">
                <Crown className="h-5 w-5" />
                <h2 className="font-serif text-xl text-[#fff1c7]">Owner Forge</h2>
              </div>
              <p className="mt-3 text-sm leading-5 text-[#d5be8c]">
                Business profile, legal pages, provider readiness, developer rules, and asset tier command are unlocked.
              </p>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row lg:flex-col">
                <Button asChild className="bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]">
                  <Link href="/owner" prefetch={false}>
                    Open Owner Console <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <span className="text-xs uppercase tracking-[0.16em] text-[#a98a55]">
                  Source: {entitlement.ownerAccess.source === 'clerk_private_metadata' ? 'trusted private role' : 'server owner allowlist'}
                </span>
              </div>
            </div>
          ) : null}

          {founderBetaCampaign ? (
            <div className="border border-[#5f4526] bg-[#15100a] p-4">
              <div className="flex items-center gap-3 text-[#e2aa4a]">
                <Sparkles className="h-5 w-5" />
                <h2 className="font-serif text-xl text-[#fff1c7]">{founderBetaCampaign.campaignTitle}</h2>
              </div>
              <p className="mt-3 text-sm leading-5 text-[#c7b288]">
                {founderBetaCampaign.landingMessage}
              </p>
              {founderBetaStatusCopy ? (
                <p className="mt-2 text-sm leading-5 text-[#d8c49a]">
                  {founderBetaStatusCopy}
                </p>
              ) : null}
              <div className="mt-3 border border-[#5f4526] bg-[#100c08] p-3 text-sm text-[#ffe7ad]">
                {founderBetaSlotsRemaining} of {founderBetaCampaign.releaseSlotCap} current wave slots remain. Public cap: {founderBetaCampaign.publicSlotCap}. Access lasts {founderBetaCampaign.accessDays} days.
              </div>
            </div>
          ) : null}

          {isClerkSetupIncomplete ? (
            <div className="border border-[#7d5a2e] bg-[#181009] p-4">
              <div className="flex items-center gap-3 text-[#e2aa4a]">
                <ShieldCheck className="h-5 w-5" />
                <h2 className="font-serif text-xl text-[#fff1c7]">Clerk test path</h2>
              </div>
              <ol className="mt-4 space-y-2 text-sm leading-5 text-[#c7b288]">
                <li>Add <code className="text-[#f6d98e]">CLERK_SECRET_KEY</code> to <code className="text-[#f6d98e]">.env.local</code>.</li>
                <li>Restart <code className="text-[#f6d98e]">npm run dev</code> so middleware and account APIs pick it up.</li>
                <li>Sign in here, then set <code className="text-[#f6d98e]">cardforgeAccess</code> in Clerk private metadata for dev or paid tests.</li>
              </ol>
            </div>
          ) : null}
          <div className="border border-[#5f4526] bg-[#15100a] p-4">
            <div className="flex items-center gap-3 text-[#e2aa4a]">
              <Lock className="h-5 w-5" />
              <h2 className="font-serif text-xl text-[#fff1c7]">What your account unlocks</h2>
            </div>
            <div className="mt-3">
              <LibraryLaneRow icon={CheckCircle2} label="Starter" value="Use official templates and free library assets." />
              <LibraryLaneRow icon={FolderOpen} label="Local art" value="Sign in to organize custom uploads in this browser." />
              <LibraryLaneRow icon={CreditCard} label="Creator Pass" value="Unlock clean exports and stronger library assets." />
              {isDeveloper ? (
                <LibraryLaneRow icon={Hammer} label="Forge Review" value="Submit and vote on CardForge library assets." />
              ) : null}
              {isOwner ? (
                <LibraryLaneRow icon={Crown} label="Command" value="Control launch, library, and voting mechanics." />
              ) : null}
            </div>
            <p className="mt-3 text-xs uppercase tracking-[0.14em] text-[#a98a55]">
              Your projects remain local unless you choose to export or upload assets.
            </p>
          </div>
        </aside>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-10 md:px-6">
        <div className="grid gap-3 md:grid-cols-3">
          <Link href="/roadmap" prefetch={false} className="border border-[#5f4526] bg-[#15100a] p-4 transition hover:border-[#d8b365] hover:bg-[#1b1209]">
            <p className="text-xs uppercase tracking-[0.16em] text-[#a98a55]">Public priorities</p>
            <h2 className="mt-2 font-serif text-xl text-[#fff1c7]">Roadmap and feature voting</h2>
            <p className="mt-2 text-sm leading-5 text-[#c7b288]">Vote on compact feature ideas and follow the living launch path.</p>
          </Link>
          <Link href="/developer" prefetch={false} className="border border-[#5f4526] bg-[#15100a] p-4 transition hover:border-[#d8b365] hover:bg-[#1b1209]">
            <p className="text-xs uppercase tracking-[0.16em] text-[#a98a55]">Forge Review</p>
            <h2 className="mt-2 font-serif text-xl text-[#fff1c7]">{isDeveloper ? 'Open developer hub' : 'Become a developer'}</h2>
            <p className="mt-2 text-sm leading-5 text-[#c7b288]">Review assets, submit work, or learn the standards for joining the program.</p>
          </Link>
          <Link href={isOwner ? '/owner' : '/contact'} prefetch={false} className="border border-[#5f4526] bg-[#15100a] p-4 transition hover:border-[#d8b365] hover:bg-[#1b1209]">
            <p className="text-xs uppercase tracking-[0.16em] text-[#a98a55]">{isOwner ? 'Library Command' : 'Support'}</p>
            <h2 className="mt-2 font-serif text-xl text-[#fff1c7]">{isOwner ? 'Open owner console' : 'Questions or access help'}</h2>
            <p className="mt-2 text-sm leading-5 text-[#c7b288]">{isOwner ? 'Configure launch rules, access caps, legal pages, and library mechanics.' : 'Reach out about accounts, beta access, exports, or developer review.'}</p>
          </Link>
        </div>
      </section>
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
    displayName: string | null;
  }) => void;
}) {
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
