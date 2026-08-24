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
import { CardForgeSectionIntro, CardForgeSurface } from '@/components/ui/cardforge-presentation';
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
  library?: ReactNode;
  storageManagement?: ReactNode;
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
    <CardForgeSurface className="flex h-full flex-col p-4 md:p-5">
      <div className="flex items-center gap-2 text-[var(--cf-accent-strong)]">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-[0.15em]">{label}</span>
      </div>
      <h3 className="mt-3 font-serif text-xl text-[var(--cf-text-strong)]">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--cf-text-muted)]">{detail}</p>
      {footer ? <div className="mt-4 text-xs leading-5 text-[var(--cf-text-subtle)]">{footer}</div> : null}
      {children ? <div className="mt-auto pt-5">{children}</div> : null}
    </CardForgeSurface>
  );
}

function DashboardNav({ showDeveloper }: { showDeveloper: boolean }) {
  const links = [
    { href: '#overview', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
    { href: '#library', label: 'Library', icon: <LibraryBig className="h-4 w-4" /> },
    { href: '#storage-and-connections', label: 'Storage & connections', icon: <Cloud className="h-4 w-4" /> },
    { href: '#account-and-billing', label: 'Plan & billing', icon: <CreditCard className="h-4 w-4" /> },
    { href: '/profile', label: 'Profile & security', icon: <LockKeyhole className="h-4 w-4" /> },
    ...(showDeveloper
      ? [{ href: '#developer-tools', label: 'Developer', icon: <Wrench className="h-4 w-4" /> }]
      : []),
  ];

  return (
    <nav aria-label="Account sections" className="mt-4 grid gap-1 sm:grid-cols-3 lg:grid-cols-1">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          prefetch={false}
          className="flex min-h-10 items-center gap-2 border border-transparent px-3 py-2 text-sm font-semibold text-[var(--cf-text-muted)] transition-colors hover:border-[var(--cf-border)] hover:bg-[var(--cf-surface-hover)] hover:text-[var(--cf-text-strong)]"
        >
          {link.icon}
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

export function AccountProfilePage({
  checkoutStatus = null,
  initialPlanIntent = null,
  initialAuthConfigured = false,
  plans,
  library,
  storageManagement,
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
    <main className="min-h-screen bg-[var(--cf-canvas)] text-[var(--cf-text)]">
      {entitlement.authConfigured ? <ClerkIdentityBridge onChange={setClerkIdentity} /> : null}
      <section className="mx-auto max-w-7xl px-4 py-5 md:px-6 lg:py-7">
        {entitlement.entitlementError ? (
          <div role="status" className="mb-4 border border-[#8b4c35] bg-[#2a130e] p-3 text-sm text-[#efb6a4]">
            Account access could not be verified, so CardForge is not presenting this as signed-out or Free. Local work remains available. Retry account or cloud actions after the service recovers.
          </div>
        ) : null}
        <div className="grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start">
          <CardForgeSurface as="aside" tone="inset" className="p-4 lg:sticky lg:top-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--cf-text-subtle)]">CardForge account</p>
            <p className="mt-2 break-words font-serif text-lg text-[var(--cf-text-strong)]">
              {effectiveSignedIn ? accountDisplayName ?? accountEmail : 'Creator dashboard'}
            </p>
            <p className="mt-1 break-words text-xs leading-5 text-[var(--cf-text-subtle)]">
              {effectiveSignedIn ? accountEmail : 'Sign in to connect cloud saves and account controls.'}
            </p>
            <div className="mt-4 inline-flex border border-[var(--cf-border-strong)] bg-[var(--cf-surface-raised)] px-2.5 py-1 text-xs font-semibold text-[var(--cf-accent-text)]">
              {planLabel}
            </div>
            <DashboardNav showDeveloper={showDeveloper} />
            <Button asChild className="mt-5 w-full bg-[var(--cf-accent-strong)] text-[var(--cf-accent-contrast)] hover:brightness-110">
              <Link href="/studio" prefetch={false}>Open Studio <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </CardForgeSurface>

          <div className="min-w-0 space-y-5">
            <CardForgeSurface as="section" id="overview" tone="inset" className="scroll-mt-24 p-4 md:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-[var(--cf-accent-strong)]">
                    <LayoutDashboard className="h-5 w-5" />
                    <span className="text-xs font-semibold uppercase tracking-[0.18em]">Overview</span>
                  </div>
                  <h1 className="mt-3 font-serif text-3xl font-semibold leading-tight text-[var(--cf-text-strong)] md:text-4xl">{accountTitle}</h1>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--cf-text-muted)]">{heroDetail}</p>
                </div>
                <div className="border border-[var(--cf-border-strong)] bg-[var(--cf-surface-raised)] px-3 py-2 text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--cf-text-subtle)]">Current plan</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--cf-accent-text)]">{planLabel}</p>
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
                    <div className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--cf-success)]">
                      <CheckCircle2 className="h-4 w-4" /> Creator export access active
                    </div>
                  ) : (
                    <Button asChild size="sm" variant="outline" className="border-[var(--cf-accent)] bg-transparent text-[var(--cf-accent-text)] hover:bg-[var(--cf-surface-hover)] hover:text-[var(--cf-text-strong)]">
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
                  <Button asChild size="sm" className="bg-[var(--cf-accent-strong)] text-[var(--cf-accent-contrast)] hover:brightness-110">
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
                    <Button asChild size="sm" variant="outline" className="border-[var(--cf-accent)] bg-transparent text-[var(--cf-accent-text)] hover:bg-[var(--cf-surface-hover)] hover:text-[var(--cf-text-strong)]">
                      <Link href="/profile" prefetch={false}>Profile &amp; security</Link>
                    </Button>
                  ) : entitlement.authConfigured ? (
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline" className="border-[var(--cf-accent)] bg-transparent text-[var(--cf-accent-text)] hover:bg-[var(--cf-surface-hover)] hover:text-[var(--cf-text-strong)]">
                        <Link href={createAuthRouteHref('/sign-in', '/account')} prefetch={false}>Sign in</Link>
                      </Button>
                      <Button asChild size="sm" variant="ghost" onClick={markSignUpIntent} className="text-[var(--cf-accent-text)] hover:bg-[var(--cf-surface-hover)] hover:text-[var(--cf-text-strong)]">
                        <Link href={createAuthRouteHref('/sign-up', '/account')} prefetch={false}>Create account</Link>
                      </Button>
                    </div>
                  ) : (
                    <Button disabled size="sm" variant="outline">Account setup needed</Button>
                  )}
                </SummaryCard>
              </div>
            </CardForgeSurface>

            <section id="library" className="scroll-mt-24">
              <CardForgeSectionIntro
                eyebrow="Library"
                title="Your CardForge work, wherever it lives"
                body="Browse one inventory of sets, projects, reusable assets, and working drafts. Every item keeps its real storage source and availability visible."
              />
              <div className="mt-4">{library}</div>
            </section>

            <section id="storage-and-connections" className="scroll-mt-24">
              <CardForgeSectionIntro
                eyebrow="Storage & connections"
                title="Control where your work is stored"
                body="Manage device storage, CardForge Cloud, Google Drive, local-folder permissions, and location-specific removal without turning those providers into separate libraries."
              />
              <div className="mt-4 space-y-4">{storageManagement}</div>
            </section>

            <CardForgeSurface as="section" id="account-and-billing" tone="inset" className="scroll-mt-24 p-4 md:p-6">
              <CardForgeSectionIntro
                eyebrow="Plan & billing"
                title="Choose, start, or manage your plan"
                body="Compare the full offer here, then use the action tied to this account. New subscriptions use Stripe Checkout; existing subscriptions open Stripe billing for plan changes, invoices, payment details, or cancellation."
              />

              <div className="mt-4">
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
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <SummaryCard
                  icon={<UserCircle2 className="h-4 w-4" />}
                  label="Profile & security"
                  title={effectiveSignedIn ? accountDisplayName ?? 'Your profile' : 'Account identity'}
                  detail={effectiveSignedIn ? `Signed in as ${accountEmail}` : 'Sign in to manage your name, avatar, email addresses, password, providers, and active sessions.'}
                >
                  {effectiveSignedIn ? (
                    <Button asChild size="sm" variant="outline" className="border-[var(--cf-accent)] bg-transparent text-[var(--cf-accent-text)] hover:bg-[var(--cf-surface-hover)] hover:text-[var(--cf-text-strong)]">
                      <Link href="/profile" prefetch={false}><ShieldCheck className="mr-2 h-4 w-4" />Manage security</Link>
                    </Button>
                  ) : entitlement.authConfigured ? (
                    <Button asChild size="sm" variant="outline" className="border-[var(--cf-accent)] bg-transparent text-[var(--cf-accent-text)] hover:bg-[var(--cf-surface-hover)] hover:text-[var(--cf-text-strong)]">
                      <Link href={createAuthRouteHref('/sign-in', '/account')} prefetch={false}>Sign in</Link>
                    </Button>
                  ) : null}
                </SummaryCard>

                <CardForgeSurface className="p-4 md:p-5">
                  <div className="flex items-center gap-2 text-[var(--cf-accent-strong)]">
                    <Sparkles className="h-4 w-4" />
                    <span className="text-xs font-semibold uppercase tracking-[0.15em]">Your data boundaries</span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {[
                      ['This device', 'The normal workspace, personal Templates, and local uploads stay browser-owned.'],
                      ['Private cloud', 'Only sets you explicitly back up use your account cloud slots and become available across devices.'],
                      ['AI working drafts', 'Temporary Studio/ChatGPT collaboration documents remain separate from permanent cloud backups.'],
                    ].map(([title, detail]) => (
                      <CardForgeSurface key={title} tone="inset" className="border-[var(--cf-border-subtle)] p-3">
                        <p className="text-sm font-semibold text-[var(--cf-text-strong)]">{title}</p>
                        <p className="mt-1 text-xs leading-5 text-[var(--cf-text-subtle)]">{detail}</p>
                      </CardForgeSurface>
                    ))}
                  </div>
                </CardForgeSurface>
              </div>
            </CardForgeSurface>

            {showDeveloper ? (
              <section id="developer-tools" className="scroll-mt-24">
                <CardForgeSectionIntro
                  eyebrow="Developer"
                  title={isOwner ? 'Owner and contributor tools' : 'Contributor tools'}
                  body="Developer surfaces appear only for accounts that actually have contributor or owner access."
                />
                <div className="mt-4">
                  <AccountDeveloperStatusSection isOwner={isOwner} isDeveloper={isDeveloper} />
                </div>
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
