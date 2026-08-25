"use client";

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { CreditCard, HardDrive, ShieldCheck, Wrench } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { useAccountEntitlement } from '@/features/account/hooks/useAccountEntitlement';
import { getAccountAccessLabel, getAccountDisplayName } from '@/features/account/lib/accountDisplay';
import type { AccountSection } from '@/features/account/lib/accountSections';
import { completeSignUpIntent, markSignUpIntent } from '@/features/analytics/client/tracking';
import type { McpAllowance, McpUsagePlanKey } from '@/features/mcp-usage/client/plans';
import { createAuthRouteHref } from '@/infrastructure/auth/clerk';
import { cn } from '@/shared/classNames';
import { AccountUtilityPanel } from './AccountUtilityPanel';
import { AccountMobileNavigation } from './AccountMobileNavigation';
import { AccountWorkspaceHeader } from './AccountWorkspaceHeader';

const AccountDeveloperStatusSection = dynamic(() => import('./AccountDeveloperStatusSection').then((module) => module.AccountDeveloperStatusSection));
const AccountPlanManagementPanel = dynamic(() => import('./AccountPlanManagementPanel').then((module) => module.AccountPlanManagementPanel));
const ProfileManagementPage = dynamic(() => import('./ProfileManagementPage').then((module) => module.ProfileManagementPage));

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
  imageUrl: string | null;
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

function AccountSectionHeading({
  icon,
  eyebrow,
  title,
  body,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <div className="mb-5 border-b border-[var(--cf-border)] pb-4 md:mb-6 md:pb-5">
      <div className="flex items-center gap-2 text-[var(--cf-accent-strong)]">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-[0.16em]">{eyebrow}</span>
      </div>
      <h1 className="mt-2 max-w-4xl font-serif text-[1.75rem] font-semibold leading-tight text-[var(--cf-text-strong)] md:text-3xl">{title}</h1>
      <p className="mt-2 max-w-4xl text-sm leading-5 text-[var(--cf-text-muted)] md:leading-6">{body}</p>
    </div>
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
    imageUrl: null,
  });
  const [platformStatus, setPlatformStatus] = useState<PlatformStatusPayload | null>(null);
  const [desktopAccountOpen, setDesktopAccountOpen] = useState(true);
  const [mobileAccountOpen, setMobileAccountOpen] = useState(false);
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
  const isDeveloper = entitlement.authConfigured && effectiveSignedIn && entitlement.accessMode === 'dev';
  const isOwner = entitlement.authConfigured && effectiveSignedIn && entitlement.ownerAccess.isOwner;
  const showDeveloper = isDeveloper || isOwner;
  const cloudSetLimit = entitlement.capabilities.cloudSetLimit;

  const planLabel = getAccountAccessLabel({
    isOwner,
    isDeveloper,
    accessExpiresAt: entitlement.accessExpiresAt,
    paidPlan: entitlement.paidPlan,
    canExportClean: entitlement.canExportClean,
  });
  const currentPlanKey: McpUsagePlanKey | undefined = isOwner || isDeveloper
    ? undefined
    : entitlement.paidPlan === 'designer'
      ? 'designer'
    : entitlement.canExportClean
      ? 'creator'
      : 'free';
  const heroDetail = isClerkSetupIncomplete
    ? 'Sign-in is not ready in this environment.'
    : effectiveSignedIn
      ? 'Here is what you were working on.'
      : 'Sign in to connect your library, cloud saves, account security, and Creator Pass access.';
  const cloudSlotLabel = `${cloudSetLimit} private cloud set slot${cloudSetLimit === 1 ? '' : 's'}`;
  const downloadLabel = entitlement.canExportClean ? 'Watermark-free downloads' : 'Free exports include the CardForge watermark';
  const showHome = activeSection === 'home' || (activeSection === 'developer' && !showDeveloper);
  const displayedSection = showHome ? 'home' : activeSection;
  const accountName = effectiveSignedIn ? accountDisplayName ?? accountEmail : 'Creator account';

  return (
    <main className="min-h-screen bg-[var(--cf-canvas)] text-[var(--cf-text)]">
      {entitlement.authConfigured ? <ClerkIdentityBridge onChange={setClerkIdentity} /> : null}
      <AccountWorkspaceHeader
        activeSection={displayedSection}
        accountLabel={accountName}
        avatarUrl={clerkIdentity.imageUrl}
        onOpenDesktopAccount={() => setDesktopAccountOpen((open) => !open)}
        onOpenMobileAccount={() => setMobileAccountOpen(true)}
      />

      <div className={cn(
        'mx-auto grid min-h-[calc(100vh-4rem)] max-w-[96rem]',
        desktopAccountOpen ? 'xl:grid-cols-[minmax(0,1fr)_20rem]' : 'grid-cols-1',
      )}>
        <section className="min-w-0 px-4 pb-24 pt-5 sm:pb-8 md:px-8 md:py-8 xl:px-10">
          {entitlement.entitlementError ? (
            <div role="status" className="mb-5 border border-[#8b4c35] bg-[#2a130e] p-3 text-sm text-[#efb6a4]">
              Account access could not be verified, so CardForge is not presenting this as signed-out or Free. Local work remains available. Retry account or cloud actions after the service recovers.
            </div>
          ) : null}

          {showHome ? (
            <div>
              <div className="mb-5 border-b border-[var(--cf-border)] pb-5 md:mb-6 md:pb-6">
                <h1 className="font-serif text-[1.75rem] font-semibold leading-tight text-[var(--cf-text-strong)] md:text-4xl">
                  {effectiveSignedIn ? `Good to see you, ${accountDisplayName ?? 'creator'}.` : 'Your CardForge workspace'}
                </h1>
                <p className="mt-2 text-sm text-[var(--cf-text-muted)]">{heroDetail}</p>
                {!effectiveSignedIn && entitlement.authConfigured ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button asChild size="sm"><Link href={createAuthRouteHref('/sign-in', '/account')} prefetch={false}>Sign in</Link></Button>
                    <Button asChild size="sm" variant="outline" onClick={markSignUpIntent}><Link href={createAuthRouteHref('/sign-up', '/account')} prefetch={false}>Create account</Link></Button>
                  </div>
                ) : null}
              </div>
              {library}
            </div>
          ) : null}

          {activeSection === 'library' ? <section aria-label="Library">{library}</section> : null}

          {activeSection === 'storage' ? (
            <section>
              <AccountSectionHeading
                icon={<HardDrive className="h-5 w-5" />}
                eyebrow="Storage & connections"
                title="See and manage every storage location"
                body="Open a location for its exact capacity, permissions, destination, and removal controls. Your Library remains the combined view of the work itself."
              />
              <div className="space-y-4">{storageManagement}</div>
            </section>
          ) : null}

          {activeSection === 'billing' ? (
            <section>
              <AccountSectionHeading
                icon={<CreditCard className="h-5 w-5" />}
                eyebrow="Plan & billing"
                title="Manage access, billing, and usage"
                body="Your current access and next actions come first. Stripe continues to own checkout, invoices, payment details, plan changes, and cancellation."
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
            </section>
          ) : null}

          {activeSection === 'profile' ? (
            <section>
              <AccountSectionHeading
                icon={<ShieldCheck className="h-5 w-5" />}
                eyebrow="Profile & security"
                title="Manage your identity and sign-in security"
                body="CardForge keeps this workspace consistent while Clerk securely owns profile details, sign-in methods, devices, and active sessions."
              />
              <ProfileManagementPage authConfigured={entitlement.authConfigured} />
            </section>
          ) : null}

          {activeSection === 'developer' && showDeveloper ? (
            <section>
              <AccountSectionHeading
                icon={<Wrench className="h-5 w-5" />}
                eyebrow="Developer"
                title={isOwner ? 'Owner and contributor tools' : 'Contributor tools'}
                body="Developer surfaces appear only for accounts that actually have contributor or owner access."
              />
              <AccountDeveloperStatusSection isOwner={isOwner} isDeveloper={isDeveloper} />
            </section>
          ) : null}
        </section>

        {desktopAccountOpen ? (
          <aside className="hidden min-h-0 border-l border-[var(--cf-border)] xl:block" aria-label="Account utilities">
            <AccountUtilityPanel
              accountEmail={effectiveSignedIn ? accountEmail : 'Sign in to connect your account'}
              accountName={accountName}
              activeSection={displayedSection}
              avatarUrl={clerkIdentity.imageUrl}
              cloudSlotLabel={cloudSlotLabel}
              isOwner={isOwner}
              onClose={() => setDesktopAccountOpen(false)}
              planLabel={planLabel}
              showDeveloper={showDeveloper}
            />
          </aside>
        ) : null}
      </div>

      <AccountMobileNavigation activeSection={displayedSection} onOpenMore={() => setMobileAccountOpen(true)} />

      <Sheet open={mobileAccountOpen} onOpenChange={setMobileAccountOpen}>
        <SheetContent side="right" className="w-[min(92vw,24rem)] border-[var(--cf-border)] bg-[var(--cf-surface-inset)] p-0 sm:max-w-sm">
          <SheetTitle className="sr-only">Account utilities</SheetTitle>
          <SheetDescription className="sr-only">Manage profile, billing, storage, connections, and developer access.</SheetDescription>
          <AccountUtilityPanel
            accountEmail={effectiveSignedIn ? accountEmail : 'Sign in to connect your account'}
            accountName={accountName}
            activeSection={displayedSection}
            avatarUrl={clerkIdentity.imageUrl}
            cloudSlotLabel={cloudSlotLabel}
            isOwner={isOwner}
            onNavigate={() => setMobileAccountOpen(false)}
            planLabel={planLabel}
            showDeveloper={showDeveloper}
          />
        </SheetContent>
      </Sheet>
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
      imageUrl: user?.imageUrl ?? null,
    });
  }, [isLoaded, isSignedIn, onChange, user?.createdAt, user?.firstName, user?.fullName, user?.imageUrl, user?.primaryEmailAddress?.emailAddress]);
  return null;
}
