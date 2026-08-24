"use client";

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Cloud,
  CreditCard,
  FolderOpen,
  HardDrive,
  Home,
  LibraryBig,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  UserCircle2,
  Wrench,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CardForgeSectionIntro, CardForgeSurface } from '@/components/ui/cardforge-presentation';
import { useAccountEntitlement } from '@/features/account/hooks/useAccountEntitlement';
import { getAccountDisplayName } from '@/features/account/lib/accountDisplay';
import type { AccountSection } from '@/features/account/lib/accountSections';
import { completeSignUpIntent, markSignUpIntent } from '@/features/analytics/client/tracking';
import type { McpAllowance, McpUsagePlanKey } from '@/features/mcp-usage/client/plans';
import { createAuthRouteHref } from '@/infrastructure/auth/clerk';
import { cn } from '@/shared/classNames';

const AccountDeveloperStatusSection = dynamic(() => import('./AccountDeveloperStatusSection').then((module) => module.AccountDeveloperStatusSection));
const AccountPlanManagementPanel = dynamic(() => import('./AccountPlanManagementPanel').then((module) => module.AccountPlanManagementPanel));

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
  activeSection: AccountSection;
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

function AccountShortcut({
  href,
  icon,
  title,
  detail,
  accent = false,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={cn(
        'group flex min-h-28 items-start gap-3 border p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cf-accent)]',
        accent
          ? 'border-[var(--cf-accent)] bg-[var(--cf-accent-strong)] text-[var(--cf-accent-contrast)] hover:brightness-110'
          : 'border-[var(--cf-border)] bg-[var(--cf-surface)] hover:border-[var(--cf-border-strong)] hover:bg-[var(--cf-surface-hover)]',
      )}
    >
      <span className={cn('mt-0.5 shrink-0', accent ? 'text-current' : 'text-[var(--cf-accent-strong)]')}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-sm font-semibold', accent ? 'text-current' : 'text-[var(--cf-text-strong)]')}>{title}</span>
        <span className={cn('mt-1 block text-xs leading-5', accent ? 'text-current/80' : 'text-[var(--cf-text-subtle)]')}>{detail}</span>
      </span>
      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function SummaryCard({
  icon,
  label,
  title,
  detail,
  children,
}: {
  icon: ReactNode;
  label: string;
  title: string;
  detail: string;
  children?: ReactNode;
}) {
  return (
    <CardForgeSurface className="flex h-full flex-col p-4">
      <div className="flex items-center gap-2 text-[var(--cf-accent-strong)]">
        {icon}
        <span className="text-[11px] font-semibold uppercase tracking-[0.15em]">{label}</span>
      </div>
      <h3 className="mt-2 font-serif text-lg text-[var(--cf-text-strong)]">{title}</h3>
      <p className="mt-1 text-sm leading-5 text-[var(--cf-text-muted)]">{detail}</p>
      {children ? <div className="mt-auto pt-4">{children}</div> : null}
    </CardForgeSurface>
  );
}

function DashboardNav({
  activeSection,
  showDeveloper,
}: {
  activeSection: AccountSection;
  showDeveloper: boolean;
}) {
  const links = [
    { id: 'home', href: '/account', label: 'Home', icon: <Home className="h-4 w-4" /> },
    { id: 'library', href: '/account?section=library', label: 'Library', icon: <LibraryBig className="h-4 w-4" /> },
    { id: 'storage', href: '/account?section=storage', label: 'Storage & connections', icon: <HardDrive className="h-4 w-4" /> },
    { id: 'billing', href: '/account?section=billing', label: 'Plan & billing', icon: <CreditCard className="h-4 w-4" /> },
    { id: 'profile', href: '/profile', label: 'Profile & security', icon: <LockKeyhole className="h-4 w-4" /> },
    ...(showDeveloper ? (
      [{ id: 'developer', href: '/account?section=developer', label: 'Developer', icon: <Wrench className="h-4 w-4" /> }]
    ) : []),
  ];

  return (
    <nav aria-label="Account sections" className="mt-3 grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1">
      {links.map((link) => (
        <Link
          key={link.id}
          href={link.href}
          prefetch={false}
          aria-current={activeSection === link.id ? 'page' : undefined}
          className={cn(
            'flex min-h-10 items-center gap-2 border px-3 py-2 text-sm font-semibold transition-colors',
            activeSection === link.id
              ? 'border-[var(--cf-border-strong)] bg-[var(--cf-surface-raised)] text-[var(--cf-accent-text)]'
              : 'border-transparent text-[var(--cf-text-muted)] hover:border-[var(--cf-border)] hover:bg-[var(--cf-surface-hover)] hover:text-[var(--cf-text-strong)]',
          )}
        >
          {link.icon}
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

export function AccountProfilePage({
  activeSection,
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
      ? 'Your home for creating, finding your work, and managing the account behind it.'
      : 'Sign in to connect your library, cloud saves, account security, and Creator Pass access.';
  const cloudSlotLabel = `${cloudSetLimit} private cloud set slot${cloudSetLimit === 1 ? '' : 's'}`;
  const downloadLabel = entitlement.canExportClean ? 'Watermark-free downloads' : 'Free exports include the CardForge watermark';
  const showHome = activeSection === 'home' || (activeSection === 'developer' && !showDeveloper);

  return (
    <main className="min-h-screen bg-[var(--cf-canvas)] text-[var(--cf-text)]">
      {entitlement.authConfigured ? <ClerkIdentityBridge onChange={setClerkIdentity} /> : null}
      <section className="mx-auto max-w-6xl px-4 py-4 md:px-6 md:py-5">
        {entitlement.entitlementError ? (
          <div role="status" className="mb-4 border border-[#8b4c35] bg-[#2a130e] p-3 text-sm text-[#efb6a4]">
            Account access could not be verified, so CardForge is not presenting this as signed-out or Free. Local work remains available. Retry account or cloud actions after the service recovers.
          </div>
        ) : null}
        <div className="grid gap-4 lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:items-start">
          <CardForgeSurface as="aside" tone="inset" className="p-3 lg:sticky lg:top-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--cf-text-subtle)]">Account</p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 lg:block">
              <div className="min-w-0">
                <p className="truncate font-serif text-base text-[var(--cf-text-strong)]">
                  {effectiveSignedIn ? accountDisplayName ?? accountEmail : 'Creator home'}
                </p>
                <p className="truncate text-xs text-[var(--cf-text-subtle)]">
                  {effectiveSignedIn ? accountEmail : 'Sign in to connect your account.'}
                </p>
              </div>
              <span className="border border-[var(--cf-border-strong)] bg-[var(--cf-surface-raised)] px-2 py-1 text-[11px] font-semibold text-[var(--cf-accent-text)] lg:mt-3 lg:inline-flex">
                {planLabel}
              </span>
            </div>
            <DashboardNav activeSection={showHome ? 'home' : activeSection} showDeveloper={showDeveloper} />
            <Button asChild size="sm" className="mt-3 w-full bg-[var(--cf-accent-strong)] text-[var(--cf-accent-contrast)] hover:brightness-110">
              <Link href="/studio" prefetch={false}>Open Studio <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </CardForgeSurface>

          <div className="min-w-0">
            {showHome ? (
              <div className="space-y-4">
                <CardForgeSurface as="section" tone="inset" className="p-4 md:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-[var(--cf-accent-strong)]">
                        <Home className="h-4 w-4" />
                        <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">Account home</span>
                      </div>
                      <h1 className="mt-2 font-serif text-2xl font-semibold leading-tight text-[var(--cf-text-strong)] md:text-3xl">{accountTitle}</h1>
                      <p className="mt-1 max-w-2xl text-sm leading-5 text-[var(--cf-text-muted)]">{heroDetail}</p>
                      {!effectiveSignedIn && entitlement.authConfigured ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button asChild size="sm" variant="outline"><Link href={createAuthRouteHref('/sign-in', '/account')} prefetch={false}>Sign in</Link></Button>
                          <Button asChild size="sm" variant="ghost" onClick={markSignUpIntent}><Link href={createAuthRouteHref('/sign-up', '/account')} prefetch={false}>Create account</Link></Button>
                        </div>
                      ) : null}
                    </div>
                    <div className="border border-[var(--cf-border-strong)] bg-[var(--cf-surface-raised)] px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--cf-text-subtle)]">Current plan</p>
                      <p className="mt-0.5 text-sm font-semibold text-[var(--cf-accent-text)]">{planLabel}</p>
                    </div>
                  </div>
                </CardForgeSurface>

                <section aria-labelledby="account-shortcuts-heading">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <h2 id="account-shortcuts-heading" className="text-sm font-semibold text-[var(--cf-text-strong)]">Where do you want to go?</h2>
                    <span className="text-xs text-[var(--cf-text-subtle)]">Account shortcuts</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    <AccountShortcut accent href="/studio" icon={<FolderOpen className="h-5 w-5" />} title="Continue creating" detail="Open your active Studio workspace." />
                    <AccountShortcut href="/account?section=library" icon={<LibraryBig className="h-5 w-5" />} title="Browse your Library" detail="Find sets, projects, assets, and drafts." />
                    <AccountShortcut href="/account?section=storage" icon={<HardDrive className="h-5 w-5" />} title="Manage storage" detail="Control devices, cloud, Drive, and folders." />
                    <AccountShortcut href="/account?section=billing" icon={<CreditCard className="h-5 w-5" />} title="Plan & billing" detail={`${cloudSlotLabel}. ${downloadLabel}.`} />
                    <AccountShortcut href="/profile" icon={<ShieldCheck className="h-5 w-5" />} title="Profile & security" detail={effectiveSignedIn ? accountEmail : 'Sign in methods, identity, and sessions.'} />
                    {showDeveloper ? (
                      <AccountShortcut href="/account?section=developer" icon={<Wrench className="h-5 w-5" />} title="Developer tools" detail="Owner and contributor workspaces." />
                    ) : null}
                  </div>
                </section>

                <CardForgeSurface as="section" className="p-4">
                  <div className="grid gap-5 md:grid-cols-2">
                    <div>
                      <div className="flex items-center gap-2 text-[var(--cf-accent-strong)]">
                        <CheckCircle2 className="h-4 w-4" />
                        <h2 className="text-xs font-semibold uppercase tracking-[0.15em]">Account status</h2>
                      </div>
                      <dl className="mt-3 divide-y divide-[var(--cf-border-subtle)] text-sm">
                        <div className="flex items-center justify-between gap-4 py-2 first:pt-0"><dt className="text-[var(--cf-text-muted)]">Access</dt><dd className="font-semibold text-[var(--cf-text-strong)]">{planLabel}</dd></div>
                        <div className="flex items-center justify-between gap-4 py-2"><dt className="text-[var(--cf-text-muted)]">Cloud backups</dt><dd className="font-semibold text-[var(--cf-text-strong)]">{cloudSlotLabel}</dd></div>
                        <div className="flex items-center justify-between gap-4 py-2 pb-0"><dt className="text-[var(--cf-text-muted)]">Identity</dt><dd className="truncate font-semibold text-[var(--cf-text-strong)]">{effectiveSignedIn ? 'Connected' : 'Not connected'}</dd></div>
                      </dl>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-[var(--cf-accent-strong)]">
                        <Sparkles className="h-4 w-4" />
                        <h2 className="text-xs font-semibold uppercase tracking-[0.15em]">Your work stays clear</h2>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-[var(--cf-text-muted)]">Device-only work is not automatically uploaded or exposed to ChatGPT.</p>
                      <p className="mt-2 text-xs leading-5 text-[var(--cf-text-muted)]">Only sets you explicitly back up use your account cloud slots; connected providers remain authoritative for their own files.</p>
                    </div>
                  </div>
                </CardForgeSurface>
              </div>
            ) : null}

            {activeSection === 'library' ? <section aria-label="Library">{library}</section> : null}

            {activeSection === 'storage' ? (
              <section>
                <CardForgeSurface tone="inset" className="mb-4 p-4">
                  <CardForgeSectionIntro
                    eyebrow="Storage & connections"
                    title="Control where your work is stored"
                    body="Manage device storage, CardForge Cloud, Google Drive, local-folder permissions, and location-specific removal."
                  />
                </CardForgeSurface>
                <div className="space-y-4">{storageManagement}</div>
              </section>
            ) : null}

            {activeSection === 'billing' ? (
              <CardForgeSurface as="section" tone="inset" className="p-4 md:p-5">
                <CardForgeSectionIntro
                  eyebrow="Plan & billing"
                  title="Choose, start, or manage your plan"
                  body="New subscriptions use Stripe Checkout; existing subscriptions open Stripe billing for plan changes, invoices, payment details, or cancellation."
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
                    detail={effectiveSignedIn ? `Signed in as ${accountEmail}` : 'Sign in to manage your identity, providers, and active sessions.'}
                  >
                    {effectiveSignedIn ? (
                      <Button asChild size="sm" variant="outline"><Link href="/profile" prefetch={false}><ShieldCheck className="mr-2 h-4 w-4" />Profile &amp; security</Link></Button>
                    ) : entitlement.authConfigured ? (
                      <Button asChild size="sm" variant="outline"><Link href={createAuthRouteHref('/sign-in', '/account')} prefetch={false}>Sign in</Link></Button>
                    ) : null}
                  </SummaryCard>
                  <SummaryCard
                    icon={<Cloud className="h-4 w-4" />}
                    label="Data boundaries"
                    title="Local creation stays local"
                    detail="Private cloud contains only explicit backups. AI working drafts remain separate from permanent cloud sets."
                  />
                </div>
              </CardForgeSurface>
            ) : null}

            {activeSection === 'developer' && showDeveloper ? (
              <section>
                <CardForgeSurface tone="inset" className="mb-4 p-4">
                  <CardForgeSectionIntro
                    eyebrow="Developer"
                    title={isOwner ? 'Owner and contributor tools' : 'Contributor tools'}
                    body="Developer surfaces appear only for accounts that actually have contributor or owner access."
                  />
                </CardForgeSurface>
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
