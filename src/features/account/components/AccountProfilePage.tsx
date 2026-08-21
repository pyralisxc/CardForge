"use client";

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import {
  ArrowRight,
  CheckCircle2,
  Cloud,
  CreditCard,
  FolderOpen,
  LayoutDashboard,
  LibraryBig,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  UserCircle2,
  Wrench,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { AccountDeveloperStatusSection } from '@/features/account/components/AccountDeveloperStatusSection';
import { useAccountEntitlement } from '@/features/account/hooks/useAccountEntitlement';
import { getAccountDisplayName } from '@/features/account/lib/accountDisplay';
import { completeSignUpIntent, markSignUpIntent } from '@/features/analytics/client/tracking';
import type { McpAllowance, McpUsagePlanKey } from '@/features/mcp-usage/client/plans';
import { createAuthRouteHref } from '@/infrastructure/auth/clerk';
import { AccountPlanManagementPanel } from './AccountPlanManagementPanel';

interface PlatformStatusPayload {
  billing: {
    designerPassConfigured: boolean;
    productAccessConfigured: boolean;
  };
}

interface ClerkIdentity {
  isLoaded: boolean;
  isSignedIn: boolean;
  email: string | null;
  displayName: string | null;
}

interface AccountProfilePageProps {
  checkoutStatus?: 'cancelled' | 'success' | null;
  initialPlanIntent?: 'creator' | 'designer' | null;
  initialAuthConfigured?: boolean;
  plans: McpAllowance[];
  storageLibrary?: ReactNode;
  cloudStorageDetails?: ReactNode;
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

function SectionHeading({
  eyebrow,
  title,
  detail,
}: {
  eyebrow: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c79a4a]">{eyebrow}</p>
      <h2 className="mt-2 font-serif text-2xl font-semibold text-[#fff1c7] md:text-3xl">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[#cbb58b]">{detail}</p>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  title,
  detail,
  footer,
  children,
}: {
  icon: ReactNode;
  label: string;
  title: string;
  detail: string;
  footer?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col border border-[#5f4526] bg-[#15100a] p-4 md:p-5">
      <div className="flex items-center gap-2 text-[#e2aa4a]">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-[0.15em]">{label}</span>
      </div>
      <h3 className="mt-3 font-serif text-xl text-[#fff1c7]">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#cbb58b]">{detail}</p>
      {footer ? <div className="mt-4 text-xs leading-5 text-[#a9946c]">{footer}</div> : null}
      {children ? <div className="mt-auto pt-5">{children}</div> : null}
    </div>
  );
}

function DashboardNav({ showDeveloper }: { showDeveloper: boolean }) {
  const links = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: 'my-cardforge', label: 'My CardForge', icon: <LibraryBig className="h-4 w-4" /> },
    { id: 'account-and-billing', label: 'Plan & billing', icon: <CreditCard className="h-4 w-4" /> },
    ...(showDeveloper
      ? [{ id: 'developer-tools', label: 'Developer', icon: <Wrench className="h-4 w-4" /> }]
      : []),
  ];

  return (
    <nav aria-label="Account sections" className="mt-4 grid gap-1 sm:grid-cols-3 lg:grid-cols-1">
      {links.map((link) => (
        <a
          key={link.id}
          href={`#${link.id}`}
          className="flex min-h-10 items-center gap-2 border border-transparent px-3 py-2 text-sm font-semibold text-[#cbb58b] transition-colors hover:border-[#5f4526] hover:bg-[#21170d] hover:text-[#fff1c7]"
        >
          {link.icon}
          {link.label}
        </a>
      ))}
    </nav>
  );
}

export function AccountProfilePage({
  checkoutStatus = null,
  initialPlanIntent = null,
  initialAuthConfigured = false,
  plans,
  storageLibrary,
  cloudStorageDetails,
}: AccountProfilePageProps) {
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
  const showDesignerCheckout = canStartCheckout && Boolean(platformStatus?.billing.designerPassConfigured);
  const accessExpiresOn = formatAccessExpiration(entitlement.accessExpiresAt);
  const isDeveloper = entitlement.authConfigured && effectiveSignedIn && entitlement.accessMode === 'dev';
  const isOwner = entitlement.authConfigured && effectiveSignedIn && entitlement.ownerAccess.isOwner;
  const showDeveloper = isDeveloper || isOwner;
  const cloudSetLimit = entitlement.capabilities.cloudSetLimit;

  const planLabel = isOwner
    ? 'Owner access'
    : isDeveloper
      ? 'Contributor access'
      : accessExpiresOn
        ? `Creator Pass through ${accessExpiresOn}`
        : entitlement.paidPlan === 'designer'
          ? 'Designer Pass'
          : entitlement.canExportClean
            ? 'Creator Pass'
            : 'Free';
  const currentPlanKey: McpUsagePlanKey = isOwner || isDeveloper || entitlement.paidPlan === 'designer'
    ? 'designer'
    : entitlement.canExportClean
      ? 'creator'
      : 'free';
  const accountTitle = isClerkSetupIncomplete
    ? 'Account setup needed'
    : effectiveSignedIn && accountDisplayName
      ? `${accountDisplayName}'s CardForge`
      : effectiveSignedIn
        ? 'Your CardForge'
        : 'Your CardForge account';

  const heroDetail = isClerkSetupIncomplete
    ? 'Sign-in is not ready in this environment.'
    : effectiveSignedIn
      ? 'Your plan, private library, device workspace, security, and billing are organized here.'
      : 'Sign in to connect your private cloud library, cross-device saves, account security, and Creator Pass access.';

  const cloudSlotLabel = `${cloudSetLimit} private cloud set slot${cloudSetLimit === 1 ? '' : 's'}`;
  const downloadLabel = entitlement.canExportClean ? 'Watermark-free downloads' : 'Free exports include the CardForge watermark';

  return (
    <main className="min-h-screen bg-[#0c0b09] text-[#f7ead0]">
      {entitlement.authConfigured ? <ClerkIdentityBridge onChange={setClerkIdentity} /> : null}
      <section className="mx-auto max-w-7xl px-4 py-5 md:px-6 lg:py-7">
        <div className="grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start">
          <aside className="border border-[#5f4526] bg-[#100c08] p-4 lg:sticky lg:top-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a98a55]">CardForge account</p>
            <p className="mt-2 break-words font-serif text-lg text-[#fff1c7]">
              {effectiveSignedIn ? accountDisplayName ?? accountEmail : 'Creator dashboard'}
            </p>
            <p className="mt-1 break-words text-xs leading-5 text-[#9f8a66]">
              {effectiveSignedIn ? accountEmail : 'Sign in to connect cloud saves and account controls.'}
            </p>
            <div className="mt-4 inline-flex border border-[#6f532e] bg-[#1b140d] px-2.5 py-1 text-xs font-semibold text-[#f6d891]">
              {planLabel}
            </div>
            <DashboardNav showDeveloper={showDeveloper} />
            <Button asChild className="mt-5 w-full bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]">
              <Link href="/studio" prefetch={false}>Open Studio <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </aside>

          <div className="min-w-0 space-y-5">
            <section id="overview" className="scroll-mt-24 border border-[#5f4526] bg-[#100c08] p-4 md:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-[#e2aa4a]">
                    <LayoutDashboard className="h-5 w-5" />
                    <span className="text-xs font-semibold uppercase tracking-[0.18em]">Overview</span>
                  </div>
                  <h1 className="mt-3 font-serif text-3xl font-semibold leading-tight text-[#fff1c7] md:text-4xl">{accountTitle}</h1>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-[#cbb58b]">{heroDetail}</p>
                </div>
                <div className="border border-[#6f532e] bg-[#1b140d] px-3 py-2 text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#a98a55]">Current plan</p>
                  <p className="mt-1 text-sm font-semibold text-[#ffe7ad]">{planLabel}</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 xl:grid-cols-3">
                <SummaryCard
                  icon={<Cloud className="h-4 w-4" />}
                  label="Plan & access"
                  title={planLabel}
                  detail={`${cloudSlotLabel}. ${downloadLabel}.`}
                  footer={accessExpiresOn && !isOwner && !isDeveloper ? `Current paid access runs through ${accessExpiresOn}.` : 'Cloud slot limits apply only to account backups; local creation remains unlimited.'}
                >
                  {entitlement.canExportClean ? (
                    <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#bde3a8]">
                      <CheckCircle2 className="h-4 w-4" /> Creator export access active
                    </div>
                  ) : (
                    <Button asChild size="sm" variant="outline" className="border-[#d8b365]/70 bg-transparent text-[#f8e3b0] hover:bg-[#2a1b0d] hover:text-[#fff1c7]">
                      <Link href="/plans" prefetch={false}>Compare plans</Link>
                    </Button>
                  )}
                </SummaryCard>

                <SummaryCard
                  icon={<FolderOpen className="h-4 w-4" />}
                  label="Workspace"
                  title="Local-first by default"
                  detail="Your active CardForge workspace stays on this device. You choose which sets become private account cloud backups."
                  footer="Device-only work is not automatically uploaded or exposed to ChatGPT."
                >
                  <Button asChild size="sm" className="bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]">
                    <Link href="/studio" prefetch={false}>Create in Studio <ArrowRight className="ml-2 h-4 w-4" /></Link>
                  </Button>
                </SummaryCard>

                <SummaryCard
                  icon={<LockKeyhole className="h-4 w-4" />}
                  label="Identity & security"
                  title={effectiveSignedIn ? 'Account connected' : 'Sign in to connect'}
                  detail={effectiveSignedIn ? accountEmail : 'Connect an account to manage security, cloud saves, billing, and cross-device access.'}
                  footer={effectiveSignedIn ? 'Profile details, sign-in methods, passwords, and active sessions live under Profile & security.' : undefined}
                >
                  {effectiveSignedIn ? (
                    <Button asChild size="sm" variant="outline" className="border-[#d8b365]/70 bg-transparent text-[#f8e3b0] hover:bg-[#2a1b0d] hover:text-[#fff1c7]">
                      <Link href="/profile" prefetch={false}>Profile &amp; security</Link>
                    </Button>
                  ) : entitlement.authConfigured ? (
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline" className="border-[#d8b365]/70 bg-transparent text-[#f8e3b0] hover:bg-[#2a1b0d] hover:text-[#fff1c7]">
                        <Link href={createAuthRouteHref('/sign-in', '/account')} prefetch={false}>Sign in</Link>
                      </Button>
                      <Button asChild size="sm" variant="ghost" onClick={markSignUpIntent} className="text-[#f7d690] hover:bg-[#24180e] hover:text-[#fff3ca]">
                        <Link href={createAuthRouteHref('/sign-up', '/account')} prefetch={false}>Create account</Link>
                      </Button>
                    </div>
                  ) : (
                    <Button disabled size="sm" variant="outline">Account setup needed</Button>
                  )}
                </SummaryCard>
              </div>
            </section>

            <section id="my-cardforge" className="scroll-mt-24">
              <SectionHeading
                eyebrow="My CardForge"
                title="Your work across device, cloud, and AI"
                detail="Manage the things tied to your CardForge experience without mixing storage locations. Local sets, cloud backups, and AI working drafts stay visibly distinct."
              />
              <div className="space-y-4">
                {storageLibrary}
                {cloudStorageDetails}
              </div>
            </section>

            <section id="account-and-billing" className="scroll-mt-24 border border-[#5f4526] bg-[#100c08] p-4 md:p-6">
              <SectionHeading
                eyebrow="Plan & billing"
                title="Choose, start, or manage your plan"
                detail="Compare the full offer here, then use the action tied to this account. New subscriptions use Stripe Checkout; existing subscriptions open Stripe billing for plan changes, invoices, payment details, or cancellation."
              />

              <AccountPlanManagementPanel
                authConfigured={entitlement.authConfigured}
                canExportClean={entitlement.canExportClean}
                canManageBilling={canManageBilling}
                checkoutStatus={checkoutStatus}
                cloudSlotLabel={cloudSlotLabel}
                currentPlanKey={currentPlanKey}
                downloadLabel={downloadLabel}
                effectiveSignedIn={effectiveSignedIn}
                initialPlanIntent={initialPlanIntent}
                planLabel={planLabel}
                plans={plans}
                showCheckout={showCheckout}
                showDesignerCheckout={showDesignerCheckout}
              />

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <SummaryCard
                  icon={<UserCircle2 className="h-4 w-4" />}
                  label="Profile & security"
                  title={effectiveSignedIn ? accountDisplayName ?? 'Your profile' : 'Account identity'}
                  detail={effectiveSignedIn ? `Signed in as ${accountEmail}` : 'Sign in to manage your name, avatar, email addresses, password, providers, and active sessions.'}
                >
                  {effectiveSignedIn ? (
                    <Button asChild size="sm" variant="outline" className="border-[#d8b365]/70 bg-transparent text-[#f8e3b0] hover:bg-[#2a1b0d] hover:text-[#fff1c7]">
                      <Link href="/profile" prefetch={false}><ShieldCheck className="mr-2 h-4 w-4" />Manage security</Link>
                    </Button>
                  ) : entitlement.authConfigured ? (
                    <Button asChild size="sm" variant="outline" className="border-[#d8b365]/70 bg-transparent text-[#f8e3b0] hover:bg-[#2a1b0d] hover:text-[#fff1c7]">
                      <Link href={createAuthRouteHref('/sign-in', '/account')} prefetch={false}>Sign in</Link>
                    </Button>
                  ) : null}
                </SummaryCard>

                <div className="border border-[#5f4526] bg-[#15100a] p-4 md:p-5">
                  <div className="flex items-center gap-2 text-[#e2aa4a]">
                    <Sparkles className="h-4 w-4" />
                    <span className="text-xs font-semibold uppercase tracking-[0.15em]">Your data boundaries</span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="border border-[#42311f] bg-[#100c08] p-3">
                      <p className="text-sm font-semibold text-[#fff1c7]">This device</p>
                      <p className="mt-1 text-xs leading-5 text-[#a9946c]">The normal workspace, personal Templates, and local uploads stay browser-owned.</p>
                    </div>
                    <div className="border border-[#42311f] bg-[#100c08] p-3">
                      <p className="text-sm font-semibold text-[#fff1c7]">Private cloud</p>
                      <p className="mt-1 text-xs leading-5 text-[#a9946c]">Only sets you explicitly back up use your account cloud slots and become available across devices.</p>
                    </div>
                    <div className="border border-[#42311f] bg-[#100c08] p-3">
                      <p className="text-sm font-semibold text-[#fff1c7]">AI working drafts</p>
                      <p className="mt-1 text-xs leading-5 text-[#a9946c]">Temporary Studio/ChatGPT collaboration documents remain separate from permanent cloud backups.</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {showDeveloper ? (
              <section id="developer-tools" className="scroll-mt-24">
                <SectionHeading
                  eyebrow="Developer"
                  title={isOwner ? 'Owner and contributor tools' : 'Contributor tools'}
                  detail="Developer surfaces appear only for accounts that actually have contributor or owner access."
                />
                <AccountDeveloperStatusSection isOwner={isOwner} isDeveloper={isDeveloper} />
              </section>
            ) : null}
          </div>
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
