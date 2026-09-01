import type { Metadata } from 'next';

import { AccountHomeBoundary } from '@/features/account/client/profile';
import {
  getCurrentCardforgeEntitlement,
  getAccountAccessLabel,
  isClerkAuthConfigured,
  projectAccountExperience,
  resolveAccountEntitlement,
  resolveAccountSection,
} from '@/features/account/server';
import { CardForgeAppProviders } from '@/features/app-shell/server';
import {
  EMPTY_CONTRIBUTOR_ACCESS_SESSION_STATE,
  getCurrentContributorAccessSessionState,
  hasContributionScope,
} from '@/features/contributor-access/server';
import { HomeDesk } from '@/features/home/client';
import { getMcpAllowances } from '@/features/mcp-usage/server';
import { AccountProjectWorkspaceBoundary } from '@/features/project/client';
import { createProjectPersistenceScope } from '@/features/project/server';
import { SiteContentProvider } from '@/features/public-site/client';
import {
  createSiteContentMap,
  getCachedSiteContentBlocks,
} from '@/features/public-site/server';
import {
  AccountStorageLibrary,
  ConnectedPersonalLibraryPanel,
  GoogleDriveProjectStoragePanel,
  LibraryStorageConnectionsTool,
  LocalProjectFolderPanel,
  UnifiedAccountLibrary,
} from '@/features/storage-management/client';
import { createPageMetadata } from '@/shared/siteMetadata';
import { AccountProfileEnvironment } from './_components/AccountProfileEnvironment';

export const metadata: Metadata = createPageMetadata({
  title: 'CardForge Desk',
  description: 'Organize your CardForge work, Library, profile, and connected locations.',
  path: '/account',
  index: false,
});

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; focus?: string; intent?: string; storage?: string; message?: string; returnContext?: string; section?: string; utility?: string; ownerWorkspace?: string; pipelineStatus?: string; meta?: string; tool?: string }>;
}) {
  const params = await searchParams;
  const initialFocusedWorkId = typeof params.focus === 'string' && params.focus.length <= 256
    ? params.focus
    : null;
  const initialReturnContextKey = typeof params.returnContext === 'string' && params.returnContext.length <= 128
    ? params.returnContext
    : null;
  const initialDeskTool = params.tool === 'design' || params.tool === 'generate' || params.tool === 'output' || params.tool === 'pipeline'
    ? params.tool
    : null;
  const initialPlanIntent = params.intent === 'creator' || params.intent === 'designer'
    ? params.intent
    : null;
  const checkoutStatus = params.checkout === 'success' || params.checkout === 'cancelled'
    ? params.checkout
    : null;
  const storageStatus = params.storage === 'google-drive-connected' || params.storage === 'google-drive-error'
    ? params.storage
    : null;
  const activeSection = resolveAccountSection({
    requestedSection: params.section,
    hasStorageResult: storageStatus !== null,
    hasBillingIntent: checkoutStatus !== null || initialPlanIntent !== null,
  });
  const needsPlans = activeSection === 'profile';
  const needsAccountContent = activeSection === 'library';
  const [entitlementResult, plans, accountContentBlocks] = await Promise.all([
    getCurrentCardforgeEntitlement().then((entitlement) => ({ entitlement, unavailable: false })).catch((error) => {
      console.error('Unable to verify account access during page render:', error);
      return {
        entitlement: resolveAccountEntitlement({ authConfigured: isClerkAuthConfigured() }),
        unavailable: true,
      };
    }),
    needsPlans ? getMcpAllowances() : Promise.resolve([]),
    needsAccountContent ? getCachedSiteContentBlocks('account') : Promise.resolve([]),
  ]);
  const { entitlement, unavailable: entitlementUnavailable } = entitlementResult;
  const authConfigured = entitlement.authConfigured;
  const persistenceScope = createProjectPersistenceScope({
    authConfigured,
    accountUserId: entitlement.accountUserId,
  });
  const accountContent = createSiteContentMap(accountContentBlocks);
  const isOwner = entitlement.isSignedIn && entitlement.ownerAccess.isOwner;
  const hasContributorEntitlement = entitlement.isSignedIn && entitlement.accessMode === 'contributor';
  const contributorAccess = hasContributorEntitlement || isOwner
    ? await getCurrentContributorAccessSessionState().catch((error) => {
        console.error('Unable to verify contributor access during page render:', error);
        return EMPTY_CONTRIBUTOR_ACCESS_SESSION_STATE;
      })
    : EMPTY_CONTRIBUTOR_ACCESS_SESSION_STATE;
  const contributionScopes = contributorAccess.projection.scopes;
  const experience = projectAccountExperience({
    entitlement,
    contribution: {
      active: contributorAccess.projection.active,
      canSubmit: hasContributionScope(contributionScopes, 'library.submit'),
      canReview: hasContributionScope(contributionScopes, 'assets.review'),
      canPublish: hasContributionScope(contributionScopes, 'library.publish'),
      canDraftCampaigns: hasContributionScope(contributionScopes, 'campaigns.draft'),
    },
  });
  const isContributor = experience.contributor.active;
  const accessLabel = getAccountAccessLabel({
    isOwner,
    isContributor,
    accessExpiresAt: entitlement.accessExpiresAt,
    paidPlan: entitlement.paidPlan,
    canExportClean: entitlement.canExportClean,
  });
  const homeAccessStatus = {
    label: 'Access',
    value: entitlementUnavailable ? 'Access unavailable' : accessLabel,
    detail: entitlementUnavailable
      ? 'CardForge could not verify account access. Local work remains available and is not being relabeled as Free.'
      : entitlement.capabilities.canUseProjectFiles
        ? 'Portable project files and connected storage are available.'
        : 'Local work is available; Creator Pass adds portable project files.',
    href: '/account?section=profile&utility=billing',
    action: 'Review',
  };
  const homeSecurityStatus = {
    label: 'Security',
    value: entitlement.isSignedIn ? 'Connected account' : 'Sign-in required',
    detail: entitlement.isSignedIn ? 'Clerk manages identity, sign-in methods, devices, and sessions.' : 'Connect an account to manage identity and sessions.',
    href: '/account?section=profile',
    action: entitlement.isSignedIn ? 'Review' : 'Sign in',
  };
  const storageConnections = (
    <SiteContentProvider key="storage-library-copy" content={accountContent}>
      <LibraryStorageConnectionsTool
        workspaceStorage={<AccountStorageLibrary
          embedded
          persistenceScope={persistenceScope}
          isSignedIn={entitlement.isSignedIn}
        />}
        localProjectFolder={<LocalProjectFolderPanel
          embedded
          persistenceScope={persistenceScope}
          canUseProjectFiles={entitlement.capabilities.canUseProjectFiles}
        />}
        googleDriveProjects={<GoogleDriveProjectStoragePanel
          embedded
          persistenceScope={persistenceScope}
          isSignedIn={entitlement.isSignedIn}
          canUseProjectFiles={entitlement.capabilities.canUseProjectFiles}
        />}
        connectedAssets={<ConnectedPersonalLibraryPanel
          embedded
          isSignedIn={entitlement.isSignedIn}
          canUseConnectedStorage={entitlement.capabilities.canUseProjectFiles}
        />}
      />
    </SiteContentProvider>
  );

  if (activeSection === 'library') {
    return (
      <CardForgeAppProviders scope="shell">
        <AccountProjectWorkspaceBoundary persistenceScope={persistenceScope}>
          <UnifiedAccountLibrary
            persistenceScope={persistenceScope}
            experience={experience}
            initialReturnContextKey={initialReturnContextKey}
            initialTool={params.tool === 'locations' || storageStatus !== null || params.section === 'storage' ? 'locations' : null}
            storageConnections={storageConnections}
          />
        </AccountProjectWorkspaceBoundary>
      </CardForgeAppProviders>
    );
  }

  return (
    <CardForgeAppProviders scope="shell">
      {activeSection === 'profile' ? (
        <AccountProfileEnvironment
          checkoutStatus={checkoutStatus}
          initialAuthConfigured={authConfigured}
          initialContributorAccess={contributorAccess}
          initialPlanIntent={initialPlanIntent}
          initialUtility={params.utility === 'billing' || checkoutStatus !== null || initialPlanIntent !== null || params.section === 'billing' ? 'billing' : params.utility === 'identity' ? 'identity' : params.utility === 'contributor' ? 'contributor' : params.utility === 'owner' && isOwner ? 'owner' : null}
          initialOwnerWorkspace={params.ownerWorkspace === 'marketing' || params.ownerWorkspace === 'audience' || params.ownerWorkspace === 'site' || params.ownerWorkspace === 'library' || params.ownerWorkspace === 'governance' ? params.ownerWorkspace : 'overview'}
          initialOwnerPipelineStatus={params.pipelineStatus === 'submitted' ? 'submitted' : 'all'}
          initialOwnerMarketingNotice={params.meta === 'connected'
            ? { kind: 'success', message: 'Meta accounts connected. Review the discovered destinations before enabling publishing.' }
            : params.meta === 'error'
              ? { kind: 'error', message: (params.message ?? 'Unable to connect Meta.').slice(0, 240) }
              : undefined}
          plans={plans}
        />
      ) : <AccountProjectWorkspaceBoundary persistenceScope={persistenceScope}>
          <AccountHomeBoundary initialAuthConfigured={authConfigured}>
            <HomeDesk
              key={initialFocusedWorkId || initialReturnContextKey ? `home-desk:${initialFocusedWorkId ?? 'overview'}:${initialReturnContextKey ?? 'fresh'}` : 'home-desk'}
              persistenceScope={persistenceScope}
              experience={experience}
              initialContributorAccess={contributorAccess}
              initialFocusedWorkId={initialFocusedWorkId}
              initialTool={initialDeskTool}
              initialReturnContextKey={initialReturnContextKey}
              homeAccessStatus={homeAccessStatus}
              homeSecurityStatus={homeSecurityStatus}
            />
          </AccountHomeBoundary>
      </AccountProjectWorkspaceBoundary>}
    </CardForgeAppProviders>
  );
}
