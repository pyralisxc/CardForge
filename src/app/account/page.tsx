import type { Metadata } from 'next';

import { AccountProfilePage } from '@/features/account/client/profile';
import { getCurrentCardforgeEntitlement } from '@/features/account/server';
import { CardForgeAppProviders } from '@/features/app-shell/server';
import { getCachedBusinessIdentity } from '@/features/business-identity/server';
import { DeveloperPublicAuthSlot } from '@/features/developer-access/server';
import { getMcpAllowances } from '@/features/mcp-usage/server';
import { createProjectPersistenceScope } from '@/features/project/server';
import { PublicSiteHeader } from '@/features/public-site/client/shell';
import { getCachedPublicSiteConfiguration } from '@/features/public-site/server';
import { AccountCloudStorageBreakdown, AccountStorageLibrary } from '@/features/storage-management/client';
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
  searchParams: Promise<{ checkout?: string; intent?: string }>;
}) {
  const params = await searchParams;
  const initialPlanIntent = params.intent === 'creator' || params.intent === 'designer'
    ? params.intent
    : null;
  const checkoutStatus = params.checkout === 'success' || params.checkout === 'cancelled'
    ? params.checkout
    : null;
  const [entitlement, businessIdentity, siteConfiguration, plans] = await Promise.all([
    getCurrentCardforgeEntitlement(),
    getCachedBusinessIdentity(),
    getCachedPublicSiteConfiguration(),
    getMcpAllowances(),
  ]);
  const authConfigured = entitlement.authConfigured;
  const persistenceScope = createProjectPersistenceScope({
    authConfigured,
    accountUserId: entitlement.accountUserId,
  });

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
      <AccountProfilePage
        checkoutStatus={checkoutStatus}
        initialPlanIntent={initialPlanIntent}
        initialAuthConfigured={authConfigured}
        plans={plans}
        storageLibrary={(
          <AccountStorageLibrary
            key="storage-library"
            embedded
            persistenceScope={persistenceScope}
            isSignedIn={entitlement.isSignedIn}
            cloudSetLimit={entitlement.capabilities.cloudSetLimit}
          />
        )}
        cloudStorageDetails={(
          <AccountCloudStorageBreakdown key="cloud-storage-details" embedded isSignedIn={entitlement.isSignedIn} />
        )}
      />
    </CardForgeAppProviders>
  );
}
