import type { Metadata } from 'next';

import { AccountProfilePage } from '@/features/account/client/profile';
import {
  getCurrentCardforgeEntitlement,
  isClerkAuthConfigured,
  resolveAccountEntitlement,
} from '@/features/account/server';
import { CardForgeAppProviders } from '@/features/app-shell/server';
import { getCachedBusinessIdentity } from '@/features/business-identity/server';
import { DeveloperPublicAuthSlot } from '@/features/developer-access/server';
import { getMcpAllowances } from '@/features/mcp-usage/server';
import { createProjectPersistenceScope } from '@/features/project/server';
import { SiteContentProvider } from '@/features/public-site/client';
import { PublicSiteHeader } from '@/features/public-site/client/shell';
import {
  createSiteContentMap,
  getCachedPublicSiteConfiguration,
  getCachedSiteContentBlocks,
} from '@/features/public-site/server';
import {
  AccountCloudStorageBreakdown,
  AccountStorageLibrary,
  ConnectedPersonalLibraryPanel,
  GoogleDriveProjectStoragePanel,
  LocalProjectFolderPanel,
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
  searchParams: Promise<{ checkout?: string; intent?: string; storage?: string; message?: string }>;
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
  const [entitlement, businessIdentity, siteConfiguration, plans, accountContentBlocks] = await Promise.all([
    getCurrentCardforgeEntitlement().catch((error) => {
      console.error('Unable to verify account access during page render:', error);
      return resolveAccountEntitlement({ authConfigured: isClerkAuthConfigured() });
    }),
    getCachedBusinessIdentity(),
    getCachedPublicSiteConfiguration(),
    getMcpAllowances(),
    getCachedSiteContentBlocks('account'),
  ]);
  const authConfigured = entitlement.authConfigured;
  const persistenceScope = createProjectPersistenceScope({
    authConfigured,
    accountUserId: entitlement.accountUserId,
  });
  const accountContent = createSiteContentMap(accountContentBlocks);

  return (
    <CardForgeAppProviders scope="shell">
      <div className="cardforge-public-tokens">
        <PublicSiteHeader
          accountSlot={authConfigured ? <DeveloperPublicAuthSlot /> : undefined}
          businessIdentity={businessIdentity}
          currentPath="/account"
          siteConfiguration={siteConfiguration}
        />
      </div>
      {storageStatus ? (
        <div className={`mx-auto mt-4 max-w-4xl border px-4 py-3 text-sm ${storageStatus === 'google-drive-connected' ? 'border-emerald-700/50 bg-emerald-950/30 text-emerald-100' : 'border-[#8b4c35] bg-[#2a130e] text-[#efb6a4]'}`} role="status">
          {storageStatus === 'google-drive-connected'
            ? 'Google Drive is connected. Your CardForge project files can now live in your Google storage and remain reachable to CardForge services.'
            : params.message || 'Google Drive could not be connected. Review the storage panel and try again.'}
        </div>
      ) : null}
      <AccountProfilePage
        checkoutStatus={checkoutStatus}
        initialPlanIntent={initialPlanIntent}
        initialAuthConfigured={authConfigured}
        plans={plans}
        storageLibrary={(
          <SiteContentProvider key="storage-library-copy" content={accountContent}>
            <div className="space-y-4">
              <AccountStorageLibrary
                embedded
                persistenceScope={persistenceScope}
                isSignedIn={entitlement.isSignedIn}
                cloudSetLimit={entitlement.capabilities.cloudSetLimit}
              />
              <LocalProjectFolderPanel
                persistenceScope={persistenceScope}
                canUseProjectFiles={entitlement.capabilities.canUseProjectFiles}
              />
              <GoogleDriveProjectStoragePanel
                persistenceScope={persistenceScope}
                isSignedIn={entitlement.isSignedIn}
                canUseProjectFiles={entitlement.capabilities.canUseProjectFiles}
              />
              <ConnectedPersonalLibraryPanel
                isSignedIn={entitlement.isSignedIn}
                canUseConnectedStorage={entitlement.capabilities.canUseProjectFiles}
              />
            </div>
          </SiteContentProvider>
        )}
        cloudStorageDetails={(
          <AccountCloudStorageBreakdown key="cloud-storage-details" embedded isSignedIn={entitlement.isSignedIn} />
        )}
      />
    </CardForgeAppProviders>
  );
}
