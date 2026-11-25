import type { Metadata } from 'next';
import { unstable_rethrow } from 'next/navigation';

import { AccountDeskBoundary } from '@/features/account/client/profile';
import {
  getCurrentCardforgeUserAccess,
  getAccountAccessLabel,
  getAccountDeskKey,
  projectAccountExperience,
  resolveAccountEntitlement,
  resolveCardforgeEntitlementForAccess,
  resolveAccountSection,
} from '@/features/account/server';
import { CardForgeAppProviders } from '@/features/app-shell/server';
import { getCurrentProductAccessPricePresentation } from '@/features/billing/server/productAccessPricePresentation';
import { DEFAULT_BUSINESS_IDENTITY, getCachedBusinessIdentity } from '@/features/business-identity/server';
import {
  EMPTY_CONTRIBUTOR_ACCESS_SESSION_STATE,
  getCurrentContributorAccessSessionState,
  hasContributionScope,
} from '@/features/contributor-access/server';
import { Desk } from '@/features/desk/client';
import { WorkspaceUpdatesBoundary } from '@/features/creator-workbench/client';
import { getCachedExperienceSettings } from '@/features/experience-settings/server';
import {
  applyProductAccessPricePresentation,
  getMcpAllowances,
} from '@/features/mcp-usage/server';
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
  GoogleDrivePreviewWarmupBoundary,
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
  searchParams: Promise<{ artifact?: string; checkout?: string; document?: string; outputRef?: string; focus?: string; intent?: string; storage?: string; message?: string; returnContext?: string; returnTo?: string; revision?: string; section?: string; utility?: string; ownerWorkspace?: string; meta?: string; tool?: string }>;
}) {
  const params = await searchParams;
  const initialFocusedWorkId = typeof params.focus === 'string' && params.focus.length <= 256
    ? params.focus
    : null;
  const initialFocusedArtifactId = initialFocusedWorkId?.startsWith('set:') && typeof params.artifact === 'string' && params.artifact.length <= 256
    ? params.artifact
    : null;
  const initialReturnContextKey = typeof params.returnContext === 'string' && params.returnContext.length <= 128
    ? params.returnContext
    : null;
  const initialDeskTool = params.outputRef !== undefined ? 'output' : params.tool === 'design' || params.tool === 'generate' || params.tool === 'output' || params.tool === 'pipeline'
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
  const needsBusinessIdentity = activeSection === 'desk' || activeSection === 'library';
  const [identity, basePlans, productAccessPrices, accountContentBlocks, businessIdentity, experienceSettings] = await Promise.all([
    getCurrentCardforgeUserAccess().catch((error) => {
      unstable_rethrow(error);
      console.error('Unable to verify account identity during page render:', error);
      return null;
    }),
    needsPlans ? getMcpAllowances() : Promise.resolve([]),
    needsPlans ? getCurrentProductAccessPricePresentation() : Promise.resolve(null),
    needsAccountContent ? getCachedSiteContentBlocks('account') : Promise.resolve([]),
    needsBusinessIdentity ? getCachedBusinessIdentity() : Promise.resolve(DEFAULT_BUSINESS_IDENTITY),
    getCachedExperienceSettings(),
  ]);
  if (!identity) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--cf-canvas)] px-5 py-12 text-[var(--cf-text)]">
        <div className="grid max-w-md gap-4 text-center">
          <h1 className="text-xl font-semibold">Account identity unavailable</h1>
          <p>CardForge could not verify which workspace to open. Your saved work has not been changed. Try again when your account is available.</p>
          <a className="underline" href="">Try again</a>
        </div>
      </main>
    );
  }
  const entitlementResult = await resolveCardforgeEntitlementForAccess(identity)
    .then((entitlement) => ({ entitlement, unavailable: false }))
    .catch((error) => {
      unstable_rethrow(error);
      console.error('Unable to verify account access during page render:', error);
      return {
        entitlement: resolveAccountEntitlement({
          authConfigured: identity.authConfigured,
          accountUserId: identity.user?.id ?? null,
          isSignedIn: Boolean(identity.user),
        }),
        unavailable: true,
      };
    });
  const plans = productAccessPrices
    ? applyProductAccessPricePresentation(basePlans, productAccessPrices)
    : basePlans;
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
  const deskAccessStatus = {
    label: 'Access',
    value: entitlementUnavailable ? 'Access unavailable' : accessLabel,
    detail: entitlementUnavailable
      ? 'CardForge could not verify account access. Local work remains available and is not being relabeled as Free.'
      : entitlement.capabilities.canUseProjectFiles
        ? 'Portable project files and connected storage are available.'
        : 'Portable project access is temporarily unavailable. Refresh and try again.',
    href: '/account?section=profile&utility=billing',
    action: 'Review',
  };
  const deskSecurityStatus = {
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
        <AccountProjectWorkspaceBoundary persistenceScope={persistenceScope} canUseProjectFiles={entitlement.capabilities.canUseProjectFiles}>
          <WorkspaceUpdatesBoundary scope={persistenceScope}>
          <GoogleDrivePreviewWarmupBoundary enabled={entitlement.isSignedIn}>
            <UnifiedAccountLibrary
              persistenceScope={persistenceScope}
              experience={experience}
              businessIdentity={{
                brandName: businessIdentity.brandName,
                copyrightHolder: businessIdentity.copyrightHolder,
              }}
              initialReturnContextKey={initialReturnContextKey}
              initialCampaignNotice={params.meta === 'connected'
                ? { kind: 'success', message: 'Meta accounts connected. Review the discovered destinations before enabling publishing.' }
                : params.meta === 'error'
                  ? { kind: 'error', message: (params.message ?? 'Unable to connect Meta.').slice(0, 240) }
                  : undefined}
              initialTool={params.tool === 'locations' || storageStatus !== null || params.section === 'storage' ? 'locations' : null}
              storageConnections={storageConnections}
            />
          </GoogleDrivePreviewWarmupBoundary>
          </WorkspaceUpdatesBoundary>
        </AccountProjectWorkspaceBoundary>
      </CardForgeAppProviders>
    );
  }

  return (
    <CardForgeAppProviders scope="shell">
      {activeSection === 'profile' ? (
        <AccountProfileEnvironment
          persistenceScope={persistenceScope}
          defaultAutosaveDelaySeconds={experienceSettings.studioAutosaveDelaySeconds}
          checkoutStatus={checkoutStatus}
          initialAuthConfigured={authConfigured}
          initialContributorAccess={contributorAccess}
          initialPlanIntent={initialPlanIntent}
          initialUtility={params.utility === 'billing' || checkoutStatus !== null || initialPlanIntent !== null || params.section === 'billing' ? 'billing' : params.utility === 'identity' ? 'identity' : params.utility === 'contributor' ? 'contributor' : params.utility === 'owner' && isOwner ? 'owner' : null}
          initialOwnerWorkspace={params.ownerWorkspace === 'audience' || params.ownerWorkspace === 'governance' ? params.ownerWorkspace : 'overview'}
          plans={plans}
        />
      ) : <AccountProjectWorkspaceBoundary persistenceScope={persistenceScope} canUseProjectFiles={entitlement.capabilities.canUseProjectFiles}>
          <WorkspaceUpdatesBoundary scope={persistenceScope}>
          <GoogleDrivePreviewWarmupBoundary enabled={entitlement.isSignedIn}>
            <AccountDeskBoundary initialAuthConfigured={authConfigured}>
              <Desk
                defaultAutosaveDelaySeconds={experienceSettings.studioAutosaveDelaySeconds}
                key={getAccountDeskKey({ focusedWorkId: initialFocusedWorkId, focusedArtifactId: initialFocusedArtifactId, returnContextKey: initialReturnContextKey, documentId: params.document, revision: params.revision, outputRef: params.outputRef })}
                persistenceScope={persistenceScope}
                experience={experience}
                businessIdentity={{
                  brandName: businessIdentity.brandName,
                  copyrightHolder: businessIdentity.copyrightHolder,
                }}
                initialContributorAccess={contributorAccess}
                initialFocusedWorkId={initialFocusedWorkId}
                initialFocusedArtifactId={initialFocusedArtifactId}
                initialTool={initialDeskTool}
                initialReturnContextKey={initialReturnContextKey}
                accessStatus={deskAccessStatus}
                securityStatus={deskSecurityStatus}
                storageConnections={storageConnections}
              />
            </AccountDeskBoundary>
          </GoogleDrivePreviewWarmupBoundary>
          </WorkspaceUpdatesBoundary>
      </AccountProjectWorkspaceBoundary>}
    </CardForgeAppProviders>
  );
}
