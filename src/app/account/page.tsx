import type { Metadata } from 'next';

import { AccountProfilePage } from '@/features/account/client/profile';
import {
  getCurrentCardforgeEntitlement,
  getAccountAccessLabel,
  isClerkAuthConfigured,
  resolveAccountEntitlement,
  resolveAccountSection,
} from '@/features/account/server';
import { CardForgeAppProviders } from '@/features/app-shell/server';
import { getMcpAllowances } from '@/features/mcp-usage/server';
import { createProjectPersistenceScope } from '@/features/project/server';
import { SiteContentProvider } from '@/features/public-site/client';
import {
  createSiteContentMap,
  getCachedSiteContentBlocks,
} from '@/features/public-site/server';
import {
  AccountCloudStorageBreakdown,
  AccountStorageLibrary,
  AccountStorageWorkspace,
  ConnectedPersonalLibraryPanel,
  GoogleDriveProjectStoragePanel,
  LocalProjectFolderPanel,
  UnifiedAccountLibrary,
} from '@/features/storage-management/client';
import { createPageMetadata } from '@/shared/siteMetadata';

export const metadata: Metadata = createPageMetadata({
  title: 'CardForge Account',
  description: 'Manage your CardForge account, storage, and access.',
  path: '/account',
  index: false,
});

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; intent?: string; storage?: string; message?: string; section?: string }>;
}) {
  const params = await searchParams;
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
  const [entitlement, plans, accountContentBlocks] = await Promise.all([
    getCurrentCardforgeEntitlement().catch((error) => {
      console.error('Unable to verify account access during page render:', error);
      return resolveAccountEntitlement({ authConfigured: isClerkAuthConfigured() });
    }),
    getMcpAllowances(),
    getCachedSiteContentBlocks('account'),
  ]);
  const authConfigured = entitlement.authConfigured;
  const persistenceScope = createProjectPersistenceScope({
    authConfigured,
    accountUserId: entitlement.accountUserId,
  });
  const accountContent = createSiteContentMap(accountContentBlocks);
  const isOwner = entitlement.isSignedIn && entitlement.ownerAccess.isOwner;
  const isDeveloper = entitlement.isSignedIn && entitlement.accessMode === 'dev';
  const accessLabel = getAccountAccessLabel({
    isOwner,
    isDeveloper,
    accessExpiresAt: entitlement.accessExpiresAt,
    paidPlan: entitlement.paidPlan,
    canExportClean: entitlement.canExportClean,
  });

  return (
    <CardForgeAppProviders scope="shell">
      {storageStatus ? (
        <div className={`mx-auto mt-4 max-w-4xl border px-4 py-3 text-sm ${storageStatus === 'google-drive-connected' ? 'border-emerald-700/50 bg-emerald-950/30 text-emerald-100' : 'border-[#8b4c35] bg-[#2a130e] text-[#efb6a4]'}`} role="status">
          {storageStatus === 'google-drive-connected'
            ? 'Google Drive is connected. Your CardForge project files can now live in your Google storage and remain reachable to CardForge services.'
            : params.message || 'Google Drive could not be connected. Review the storage panel and try again.'}
        </div>
      ) : null}
      <AccountProfilePage
        activeSection={activeSection}
        checkoutStatus={checkoutStatus}
        initialPlanIntent={initialPlanIntent}
        initialAuthConfigured={authConfigured}
        plans={plans}
        library={(
          <UnifiedAccountLibrary
            key="unified-account-library"
            persistenceScope={persistenceScope}
            isSignedIn={entitlement.isSignedIn}
            cloudSetLimit={entitlement.capabilities.cloudSetLimit}
            homeAccessStatus={{
              label: 'Access',
              value: accessLabel,
              detail: `${entitlement.capabilities.cloudSetLimit} private cloud set slot${entitlement.capabilities.cloudSetLimit === 1 ? '' : 's'}`,
              href: '/account?section=billing',
              action: 'Review',
            }}
            homeSecurityStatus={{
              label: 'Security',
              value: entitlement.isSignedIn ? 'Connected account' : 'Sign-in required',
              detail: entitlement.isSignedIn ? 'Clerk manages identity, sign-in methods, devices, and sessions.' : 'Connect an account to manage identity and sessions.',
              href: '/account?section=profile',
              action: entitlement.isSignedIn ? 'Review' : 'Sign in',
            }}
            view={activeSection === 'home' || activeSection === 'developer' ? 'home' : 'library'}
          />
        )}
        storageManagement={(
          <SiteContentProvider key="storage-library-copy" content={accountContent}>
            <AccountStorageWorkspace
              browserAndCloud={<AccountStorageLibrary
                embedded
                persistenceScope={persistenceScope}
                isSignedIn={entitlement.isSignedIn}
                cloudSetLimit={entitlement.capabilities.cloudSetLimit}
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
              cloudDetails={<AccountCloudStorageBreakdown embedded isSignedIn={entitlement.isSignedIn} />}
            />
          </SiteContentProvider>
        )}
      />
    </CardForgeAppProviders>
  );
}
