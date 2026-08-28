"use client";

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
  ENVIRONMENT_ZONES,
  getVisibleEnvironmentZones,
  type ActionDescriptor,
  type EnvironmentSettingRecord,
  type EnvironmentViewer,
  type ZoneDefinition,
} from '@/features/app-shell/client/environment';
import { projectAccountExperience } from '@/features/account/client/experience';
import { useAccountEntitlement } from '@/features/account/client/entitlement';
import { getAccountAccessLabel, getAccountDisplayName } from '@/features/account/client/identity';
import {
  AccountPlanBillingUtility,
  ProfileManagementPage,
  buildAccountProfileUtilityGroups,
  type AccountProfileUtility,
  type AccountProfileUtilityTarget,
} from '@/features/account/client/profile';
import { hasContributionScope, useDeveloperAccess, type DeveloperAccessSessionState } from '@/features/developer-access/client';
import type { McpAllowance } from '@/features/mcp-usage/client/plans';

interface AccountProfileEnvironmentProps {
  checkoutStatus?: 'cancelled' | 'success' | null;
  initialAuthConfigured: boolean;
  initialPlanIntent?: 'creator' | 'designer' | null;
  initialUtility?: 'billing' | 'identity' | null;
  initialDeveloperAccess: DeveloperAccessSessionState;
  plans?: McpAllowance[];
}

const utilityIcons: Record<AccountProfileUtilityTarget, LucideIcon> = {
  clerk: UserCircle2,
  billing: CreditCard,
  storage: HardDrive,
  developer: Wrench,
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
  initialDeveloperAccess,
  plans = [],
}: AccountProfileEnvironmentProps) {
  const router = useRouter();
  const surfaceRef = useRef<HTMLElement | null>(null);
  const [activeUtility, setActiveUtility] = useState<'billing' | 'identity' | null>(() => (
    initialUtility === 'billing' || checkoutStatus !== null || initialPlanIntent !== null
      ? 'billing'
      : initialUtility === 'identity'
        ? 'identity'
        : null
  ));
  const entitlement = useAccountEntitlement({ initialAuthConfigured });
  const developerAccess = useDeveloperAccess({
    eligible: entitlement.accessMode === 'dev' || entitlement.ownerAccess.isOwner,
    initialState: initialDeveloperAccess,
    isOwner: entitlement.ownerAccess.isOwner,
    sessionKey: entitlement.isSignedIn ? entitlement.accountUserId : null,
  });
  const experience = projectAccountExperience({
    entitlement,
    contribution: {
      active: developerAccess.hasCockpitAccess,
      canSubmit: hasContributionScope(developerAccess.scopes, 'library.submit'),
      canReview: hasContributionScope(developerAccess.scopes, 'assets.review'),
      canPublish: hasContributionScope(developerAccess.scopes, 'library.publish'),
    },
  });
  const accountEmail = entitlement.accountEmail ?? 'No signed-in account';
  const accountName = getAccountDisplayName({ email: entitlement.accountEmail }) ?? 'Creator';
  const isSignedIn = experience.signedIn;
  const isOwner = experience.owner;
  const isDeveloper = experience.contributor.active;
  const entitlementUnavailable = Boolean(entitlement.entitlementError);
  const planLabel = getAccountAccessLabel({
    isOwner,
    isDeveloper,
    accessExpiresAt: entitlement.accessExpiresAt,
    paidPlan: entitlement.paidPlan,
    canExportClean: entitlement.canExportClean,
  });
  const viewer: EnvironmentViewer = { signedIn: isSignedIn, contributor: isDeveloper, owner: isOwner };
  const availableZones = getVisibleEnvironmentZones(viewer);
  const zones = availableZones.some((zone) => zone.id === 'profile')
    ? availableZones
    : ENVIRONMENT_ZONES.filter((zone) => zone.id === 'home' || zone.id === 'studio' || zone.id === 'profile');
  const groups = useMemo(() => buildAccountProfileUtilityGroups({
    accountEmail,
    authConfigured: entitlement.authConfigured,
    entitlementLoading: entitlement.isLoadingEntitlement,
    entitlementUnavailable,
    isDeveloper,
    isOwner,
    isSignedIn,
    planLabel,
  }), [accountEmail, entitlement.authConfigured, entitlement.isLoadingEntitlement, entitlementUnavailable, isDeveloper, isOwner, isSignedIn, planLabel]);
  const actions = activeUtility ? [closeUtilityAction] : [defaultAction];

  useEffect(() => {
    if (initialUtility === 'billing' || checkoutStatus !== null || initialPlanIntent !== null) {
      setActiveUtility('billing');
      return;
    }
    setActiveUtility(initialUtility === 'identity' ? 'identity' : null);
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
      : 'environment-object-profile-identity';
    setActiveUtility(null);
    router.push('/account?section=profile');
    requestAnimationFrame(() => document.getElementById(focusId)?.focus());
  };

  const openUtility = (target: AccountProfileUtilityTarget) => {
    if (target === 'clerk') openIdentity();
    if (target === 'billing') openBilling();
    if (target === 'storage') router.push('/account?section=storage');
    if (target === 'developer') router.push('/developer/cockpit');
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
      {activeUtility === 'billing' ? (
        <section id="profile-utility-surface" tabIndex={-1} className="scroll-mt-20 outline-none" aria-label="Plan and billing">
          <span id="account-and-billing" className="sr-only" aria-hidden="true" />
          <EnvironmentSurfaceHeader
            eyebrow="Plan & billing"
            title="Manage access, billing, and usage"
            body="Your current access and next actions come first. Stripe continues to own checkout, invoices, payment details, plan changes, and cancellation."
          />
          <div className="mt-5 scroll-mt-20">
            <AccountPlanBillingUtility
              checkoutStatus={checkoutStatus}
              entitlement={entitlement}
              entitlementState={entitlement.entitlementStatus}
              initialPlanIntent={initialPlanIntent}
              isDeveloper={isDeveloper}
              isOwner={isOwner}
              onRetryEntitlement={() => { void entitlement.refreshEntitlement({ force: true }); }}
              planLabel={planLabel}
              plans={plans}
            />
          </div>
        </section>
      ) : activeUtility === 'identity' ? (
        <section id="profile-utility-surface" tabIndex={-1} className="scroll-mt-20 outline-none" aria-label="Identity and security controls">
          <span id="profile-native-controls" className="sr-only" aria-hidden="true" />
          <EnvironmentSurfaceHeader
            eyebrow="Identity & security"
            title="Manage your Clerk account"
            body="Clerk remains the native owner of profile details, verified addresses, sign-in methods, devices, sessions, and security operations."
          />
          <div className="mt-5">
            <ProfileManagementPage authConfigured={entitlement.authConfigured} />
          </div>
        </section>
      ) : (
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
        </>
      )}
    </EnvironmentShell>
  );
}
