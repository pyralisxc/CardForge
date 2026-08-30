"use client";

import { useUser } from '@clerk/nextjs';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  getVisibleEnvironmentZones,
  type ActionDescriptor,
  type EnvironmentSettingRecord,
  type EnvironmentViewer,
  type ZoneDefinition,
} from '@/features/app-shell/client/environment';
import { projectAccountExperience } from '@/features/account/client/experience';
import { PublicAuthControls } from '@/features/account/client/auth';
import { useAccountEntitlement } from '@/features/account/client/entitlement';
import { getAccountAccessLabel, getAccountDisplayName } from '@/features/account/client/identity';
import {
  AccountPlanBillingUtility,
  ProfileManagementPage,
  buildAccountProfileUtilityGroups,
  type AccountProfileUtility,
  type AccountProfileUtilityTarget,
} from '@/features/account/client/profile';
import { hasContributionScope, useContributorAccess, type ContributorAccessSessionState } from '@/features/contributor-access/client';
import type { McpAllowance } from '@/features/mcp-usage/client/plans';

import { ContributorProfilePanel } from './ContributorProfilePanel';

interface AccountProfileEnvironmentProps {
  checkoutStatus?: 'cancelled' | 'success' | null;
  initialAuthConfigured: boolean;
  initialPlanIntent?: 'creator' | 'designer' | null;
  initialUtility?: 'billing' | 'identity' | 'contributor' | null;
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

const defaultAction: ActionDescriptor = {
  id: 'profile.manage-account',
  label: 'Manage identity',
  ownerFeature: 'account',
  supportedObjectKinds: [],
  supportedSources: [],
  revisionPolicy: 'none',
  requiredPermission: 'guest',
  scope: 'zone',
  hierarchy: 'primary',
  availability: { kind: 'available' },
  commitment: 'none',
  automation: { kind: 'human-only', owner: 'provider' },
  result: 'provider-handoff',
};

const closeUtilityAction: ActionDescriptor = {
  id: 'profile.close-utility',
  label: 'Profile overview',
  ownerFeature: 'account',
  supportedObjectKinds: [],
  supportedSources: [],
  revisionPolicy: 'none',
  requiredPermission: 'guest',
  scope: 'zone',
  hierarchy: 'primary',
  availability: { kind: 'available' },
  commitment: 'none',
  automation: { kind: 'human-only', owner: 'cardforge' },
  result: 'navigation',
};

export function AccountProfileEnvironment({
  checkoutStatus = null,
  initialAuthConfigured,
  initialPlanIntent = null,
  initialUtility = null,
  initialContributorAccess,
  plans = [],
}: AccountProfileEnvironmentProps) {
  const router = useRouter();
  const { user: clerkUser } = useUser();
  const surfaceRef = useRef<HTMLElement | null>(null);
  const [activeUtility, setActiveUtility] = useState<'billing' | 'identity' | 'contributor' | null>(() => (
    initialUtility === 'billing' || checkoutStatus !== null || initialPlanIntent !== null
      ? 'billing'
        : initialUtility === 'identity' ? 'identity' : initialUtility === 'contributor' ? 'contributor' : null
  ));
  const entitlement = useAccountEntitlement({ initialAuthConfigured });
  const contributorAccess = useContributorAccess({
    eligible: entitlement.accessMode === 'dev' || entitlement.ownerAccess.isOwner,
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
      canProposeSite: hasContributionScope(contributorAccess.scopes, 'site.propose'),
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
    : ENVIRONMENT_ZONES.filter((zone) => zone.id === 'home' || zone.id === 'library' || zone.id === 'profile');
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
  const actions = activeUtility ? [closeUtilityAction] : [defaultAction];

  useEffect(() => {
    if (initialUtility === 'billing' || checkoutStatus !== null || initialPlanIntent !== null) {
      setActiveUtility('billing');
      return;
    }
    setActiveUtility(initialUtility === 'identity' ? 'identity' : initialUtility === 'contributor' ? 'contributor' : null);
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
    router.push('/account?section=billing');
  };

  const closeUtility = () => {
    const focusId = activeUtility === 'billing'
      ? 'environment-object-profile-plan-billing'
      : activeUtility === 'contributor'
        ? 'environment-object-profile-contributor-access'
        : 'environment-object-profile-identity';
    setActiveUtility(null);
    router.push('/account?section=profile');
    requestAnimationFrame(() => document.getElementById(focusId)?.focus());
  };

  const openUtility = (target: AccountProfileUtilityTarget) => {
    if (target === 'clerk') openIdentity();
    if (target === 'billing') openBilling();
    if (target === 'storage') router.push('/account?section=storage');
    if (target === 'contributor') {
      setActiveUtility('contributor');
      router.push('/account?section=profile&utility=contributor');
    }
    if (target === 'owner') router.push('/owner');
  };

  const runAction = (action: ActionDescriptor) => {
    if (action.id === 'profile.close-utility') {
      closeUtility();
      return;
    }
    if (action.id === 'profile.manage-account') {
      openIdentity();
      return;
    }
  };

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
      onChooseZone={(zone: ZoneDefinition) => router.push(zone.href)}
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
        {entitlementUnavailable ? (
          <EnvironmentBoundaryNotice
            title="Account access is unavailable"
            message="CardForge is not presenting this account as signed-out or Free. Clerk profile controls and local work remain available."
            actionLabel="Retry"
            onAction={() => { void entitlement.refreshEntitlement({ force: true }); }}
          />
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
            eyebrow={activeUtility === 'billing' ? 'Plan & billing' : activeUtility === 'identity' ? 'Identity & security' : 'Contributor'}
            title={activeUtility === 'billing' ? 'Manage access, billing, and usage' : activeUtility === 'identity' ? 'Manage your Clerk account' : 'Your contribution access and work'}
            summary={activeUtility === 'billing'
              ? 'Your current access comes first. Stripe continues to own checkout, invoices, payment details, plan changes, and cancellation.'
              : activeUtility === 'identity'
                ? 'Clerk owns profile details, verified addresses, sign-in methods, devices, sessions, and security operations.'
                : 'Personal access, progress, and site-proposal drafts live with your profile. Shared assets and campaigns remain in Library.'}
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
