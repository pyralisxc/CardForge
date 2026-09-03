"use client";

import { useUser } from '@clerk/nextjs';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { CreditCard, Crown, HardDrive, UserCircle2, Wrench, type LucideIcon } from 'lucide-react';

import {
  CompactSettingRow,
  EnvironmentBoundaryNotice,
  EnvironmentSectionHeading,
  EnvironmentShell,
  EnvironmentStatus,
  EnvironmentSurfaceHeader,
  EnvironmentToolLayer,
  ENVIRONMENT_ZONES,
  createActionDefinition,
  createActionRuntime,
  getVisibleEnvironmentZones,
  type ActionDescriptor,
  type EnvironmentSettingRecord,
  type EnvironmentViewer,
} from '@/features/app-shell/client/environment';
import { projectAccountExperience } from '@/features/account/client/experience';
import { PublicAuthControls } from '@/features/account/client/auth';
import { useAccountEntitlement } from '@/features/account/client/entitlement';
import { getAccountAccessLabel, getAccountDisplayName } from '@/features/account/client/identity';
import {
  AccountPlanBillingUtility,
  AccountProfileSnapshot,
  ProfileManagementPage,
  buildAccountProfileUtilityGroups,
  createAccountProfileOperations,
  type AccountProfileUtility,
  type AccountProfileUtilityTarget,
} from '@/features/account/client/profile';
import { hasContributionScope, useContributorAccess, type ContributorAccessSessionState } from '@/features/contributor-access/client';
import { AccountMcpUsageSection } from '@/features/mcp-usage/client/account';
import type { McpAllowance } from '@/features/mcp-usage/client/plans';

import { ContributorProfilePanel } from './ContributorProfilePanel';

const OwnerProfileOperations = dynamic(() => import('@/features/owner/client').then((module) => module.OwnerProfileOperations), {
  loading: () => <div className="grid min-h-40 place-items-center text-sm text-[var(--cf-text-muted)]">Loading protected operations…</div>,
});

interface AccountProfileEnvironmentProps {
  checkoutStatus?: 'cancelled' | 'success' | null;
  initialAuthConfigured: boolean;
  initialPlanIntent?: 'creator' | 'designer' | null;
  initialUtility?: 'billing' | 'identity' | 'contributor' | 'owner' | null;
  initialOwnerWorkspace?: 'overview' | 'audience' | 'governance';
  initialContributorAccess: ContributorAccessSessionState;
  plans?: McpAllowance[];
}

const utilityIcons: Record<AccountProfileUtilityTarget, LucideIcon> = {
  clerk: UserCircle2,
  billing: CreditCard,
  storage: HardDrive,
  contributor: Wrench,
  owner: Crown,
};

const toRecord = (item: AccountProfileUtility): EnvironmentSettingRecord => ({
  id: item.id,
  kind: item.kind,
  eyebrow: item.eyebrow,
  title: item.title,
  summary: item.summary,
  value: item.value,
  status: item.status,
  tone: item.tone,
  icon: utilityIcons[item.target],
  actionSources: [{
    id: `${item.id}-source`,
    label: item.target === 'clerk' ? 'Clerk' : item.target === 'billing' ? 'Stripe and CardForge' : 'CardForge',
    source: 'provider-native',
    currentRevisionAvailable: true,
  }],
  meta: item.meta,
});

export function AccountProfileEnvironment({
  checkoutStatus = null,
  initialAuthConfigured,
  initialPlanIntent = null,
  initialUtility = null,
  initialOwnerWorkspace = 'overview',
  initialContributorAccess,
  plans = [],
}: AccountProfileEnvironmentProps) {
  const router = useRouter();
  const { user: clerkUser } = useUser();
  const surfaceRef = useRef<HTMLElement | null>(null);
  const [activeUtility, setActiveUtility] = useState<'billing' | 'identity' | 'contributor' | 'owner' | null>(() => (
    initialUtility === 'billing' || checkoutStatus !== null || initialPlanIntent !== null
      ? 'billing'
        : initialUtility === 'identity' ? 'identity' : initialUtility === 'contributor' ? 'contributor' : initialUtility === 'owner' ? 'owner' : null
  ));
  const entitlement = useAccountEntitlement({ initialAuthConfigured });
  const contributorAccess = useContributorAccess({
    eligible: entitlement.accessMode === 'contributor' || entitlement.ownerAccess.isOwner,
    initialState: initialContributorAccess,
    isOwner: entitlement.ownerAccess.isOwner,
    sessionKey: entitlement.isSignedIn ? entitlement.accountUserId : null,
  });
  const experience = projectAccountExperience({
    entitlement,
    contribution: {
      active: contributorAccess.active,
      canSubmit: hasContributionScope(contributorAccess.scopes, 'library.submit'),
      canReview: hasContributionScope(contributorAccess.scopes, 'assets.review'),
      canPublish: hasContributionScope(contributorAccess.scopes, 'library.publish'),
      canDraftCampaigns: hasContributionScope(contributorAccess.scopes, 'campaigns.draft'),
    },
  });
  const accountEmail = entitlement.accountEmail ?? 'No signed-in account';
  const accountName = clerkUser?.fullName
    ?? clerkUser?.username
    ?? getAccountDisplayName({ email: entitlement.accountEmail })
    ?? 'Creator';
  const isSignedIn = experience.signedIn;
  const isOwner = experience.owner;
  const isContributor = experience.contributor.active;
  const entitlementUnavailable = Boolean(entitlement.entitlementError);
  const planLabel = getAccountAccessLabel({
    isOwner,
    isContributor,
    accessExpiresAt: entitlement.accessExpiresAt,
    paidPlan: entitlement.paidPlan,
    canExportClean: entitlement.canExportClean,
  });
  const viewer: EnvironmentViewer = { signedIn: isSignedIn, contributor: isContributor, owner: isOwner };
  const availableZones = getVisibleEnvironmentZones(viewer);
  const zones = availableZones.some((zone) => zone.id === 'profile')
    ? availableZones
    : ENVIRONMENT_ZONES.filter((zone) => zone.id === 'desk' || zone.id === 'library' || zone.id === 'profile');
  const groups = useMemo(() => buildAccountProfileUtilityGroups({
    accountEmail,
    authConfigured: entitlement.authConfigured,
    entitlementLoading: entitlement.isLoadingEntitlement,
    entitlementUnavailable,
    isContributor,
    isOwner,
    isSignedIn,
    planLabel,
  }), [accountEmail, entitlement.authConfigured, entitlement.isLoadingEntitlement, entitlementUnavailable, isContributor, isOwner, isSignedIn, planLabel]);

  useEffect(() => {
    if (initialUtility === 'billing' || checkoutStatus !== null || initialPlanIntent !== null) {
      setActiveUtility('billing');
      return;
    }
    setActiveUtility(initialUtility === 'identity' ? 'identity' : initialUtility === 'contributor' ? 'contributor' : initialUtility === 'owner' ? 'owner' : null);
  }, [checkoutStatus, initialPlanIntent, initialUtility]);

  const openIdentity = () => {
    setActiveUtility('identity');
    requestAnimationFrame(() => document.getElementById('profile-utility-surface')?.focus());
    router.push('/account?section=profile&utility=identity');
  };

  const openBilling = () => {
    setActiveUtility('billing');
    requestAnimationFrame(() => {
      surfaceRef.current?.scrollTo({ top: 0 });
      document.getElementById('profile-utility-surface')?.focus();
    });
    router.push('/account?section=profile&utility=billing');
  };

  const closeUtility = () => {
    const focusId = activeUtility === 'billing'
      ? 'environment-object-profile-plan-billing'
      : activeUtility === 'contributor'
        ? 'environment-object-profile-contributor-access'
        : activeUtility === 'owner'
          ? 'environment-object-profile-owner-access'
          : 'environment-object-profile-identity';
    setActiveUtility(null);
    router.push('/account?section=profile');
    requestAnimationFrame(() => document.getElementById(focusId)?.focus());
  };

  const openUtility = (target: AccountProfileUtilityTarget) => {
    if (target === 'clerk') openIdentity();
    if (target === 'billing') openBilling();
    if (target === 'storage') router.push('/account?section=library&tool=locations');
    if (target === 'contributor') {
      setActiveUtility('contributor');
      router.push('/account?section=profile&utility=contributor');
    }
    if (target === 'owner') {
      setActiveUtility('owner');
      router.push('/account?section=profile&utility=owner');
    }
  };

  const actionDefinitions = createAccountProfileOperations({ utilityOpen: Boolean(activeUtility), closeUtility, openIdentity })
    .map(({ descriptor, execute }) => createActionDefinition(descriptor, execute));
  const actions = actionDefinitions.map((definition) => definition.descriptor);
  const actionRuntime = createActionRuntime(actionDefinitions);
  const runAction = (action: ActionDescriptor) => { void actionRuntime.execute(action.id, { targetIds: [] }); };

  return (
    <EnvironmentShell
      ariaLabel="CardForge profile"
      brand={{ src: '/brand/cardforge-studio/brand-mark.svg', alt: 'CardForge' }}
      viewer={viewer}
      zones={zones}
      activeZone="profile"
      viewportPolicy="flow"
      detail={null}
      actions={actions}
      accountControl={<PublicAuthControls />}
      surfaceRef={surfaceRef}
      statusContent={(
        <>
          <EnvironmentStatus
            label={!entitlement.authConfigured ? 'Authentication setup required' : entitlement.isLoadingEntitlement ? 'Checking Clerk account' : isSignedIn ? 'Clerk identity connected' : 'Sign in required'}
            tone={isSignedIn ? 'success' : entitlement.isLoadingEntitlement ? 'neutral' : 'warning'}
          />
          <EnvironmentStatus
            label={!entitlement.authConfigured ? 'Authentication setup required' : entitlementUnavailable ? 'Account access unavailable' : entitlement.isLoadingEntitlement ? 'Checking account access' : planLabel}
            tone={!entitlement.authConfigured ? 'warning' : entitlementUnavailable ? 'danger' : entitlement.isLoadingEntitlement ? 'warning' : 'neutral'}
          />
        </>
      )}
      footerContent={<span>{isSignedIn ? accountEmail : 'Profile controls remain provider-owned'}</span>}
      onCommand={() => router.push('/account?section=library#library-search')}
      onAction={runAction}
      onCloseDetail={() => {}}
    >
      <>
        <EnvironmentSurfaceHeader
          eyebrow="Profile"
          title={isSignedIn ? accountName : 'Your CardForge profile'}
          body="Identity, security, access, and account utilities stay compact around you. Provider-sensitive controls remain with the provider that owns them."
        />
        <AccountProfileSnapshot
          accountLabel={isSignedIn ? accountEmail : 'Guest creator'}
          identityLabel={isSignedIn ? 'Clerk identity connected' : 'Guest workspace'}
          planLabel={planLabel}
          workspaceLabel="Local-first browser workspace"
          authorityLabel={isOwner ? 'Owner' : isContributor ? 'Contributor' : isSignedIn ? 'Creator' : 'Guest'}
        />
        {entitlementUnavailable ? (
          <EnvironmentBoundaryNotice
            title="Account access is unavailable"
            message="CardForge is not presenting this account as signed-out or Free. Clerk profile controls and local work remain available."
            actionLabel="Retry"
            onAction={() => { void entitlement.refreshEntitlement({ force: true }); }}
          />
        ) : null}
        {!activeUtility && isSignedIn ? (
          <div className="mt-4">
            <AccountMcpUsageSection presentation="summary" onOpenDetails={openBilling} />
          </div>
        ) : null}
        {!activeUtility && isContributor ? (
          <div className="mt-4">
            <ContributorProfilePanel access={contributorAccess} presentation="summary" onOpenDetails={() => openUtility('contributor')} />
          </div>
        ) : null}
        {groups.map((group) => (
          <section key={group.id} className="mt-5" aria-labelledby={`profile-${group.id}-heading`}>
            <EnvironmentSectionHeading id={`profile-${group.id}-heading`} title={group.title} meta={`${group.items.length} ${group.items.length === 1 ? 'utility' : 'utilities'}`} />
            {group.items.map((item) => {
              const record = toRecord(item);
              return <CompactSettingRow key={item.id} item={record} selected={false} onOpen={() => openUtility(item.target)} />;
            })}
          </section>
        ))}
        {activeUtility ? (
          <EnvironmentToolLayer
            id="profile-utility-title"
            eyebrow={activeUtility === 'billing' ? 'Plan & billing' : activeUtility === 'identity' ? 'Identity & security' : activeUtility === 'owner' ? 'Owner access' : 'Contributor'}
            title={activeUtility === 'billing' ? 'Manage access, billing, and usage' : activeUtility === 'identity' ? 'Manage your Clerk account' : activeUtility === 'owner' ? 'Protected CardForge operations' : 'Your contribution access and work'}
            summary={activeUtility === 'billing'
              ? 'Your current access comes first. Stripe continues to own checkout, invoices, payment details, plan changes, and cancellation.'
              : activeUtility === 'identity'
                ? 'Clerk owns profile details, verified addresses, sign-in methods, devices, sessions, and security operations.'
                : activeUtility === 'owner'
                  ? 'Privileged operational controls are composed here by their owning features. Provider credentials and provider-native configuration remain with each provider.'
                  : 'Personal access and progress live with your profile. Shared assets and campaigns remain in Library.'}
            closeLabel="Close profile tool"
            onClose={closeUtility}
          >
            <section id="profile-utility-surface" tabIndex={-1} className="outline-none">
              {activeUtility === 'billing' ? (
                <>
                  <span id="account-and-billing" className="sr-only" aria-hidden="true" />
                  <AccountPlanBillingUtility
                    checkoutStatus={checkoutStatus}
                    entitlement={entitlement}
                    entitlementState={entitlement.entitlementStatus}
                    initialPlanIntent={initialPlanIntent}
                    isContributor={isContributor}
                    isOwner={isOwner}
                    onRetryEntitlement={() => { void entitlement.refreshEntitlement({ force: true }); }}
                    planLabel={planLabel}
                    plans={plans}
                  />
                </>
              ) : activeUtility === 'identity' ? (
                <>
                  <span id="profile-native-controls" className="sr-only" aria-hidden="true" />
                  <ProfileManagementPage authConfigured={entitlement.authConfigured} />
                </>
              ) : activeUtility === 'owner' ? (
                <OwnerProfileOperations
                  initialWorkspace={initialOwnerWorkspace}
                />
              ) : (
                <ContributorProfilePanel access={contributorAccess} />
              )}
            </section>
          </EnvironmentToolLayer>
        ) : null}
      </>
    </EnvironmentShell>
  );
}
