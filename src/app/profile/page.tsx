import { ProfileManagementPage, ProfileSetupFallback } from '@/features/account/client/profile';
import { getDeveloperPublicAuthSlot } from '@/features/developer-access/server';
import { CardForgeAppProviders } from '@/features/app-shell/server';
import { getCachedBusinessIdentity } from '@/features/business-identity/server';
import { PublicSiteHeader } from '@/features/public-site/client/shell';
import { getCachedPublicSiteConfiguration } from '@/features/public-site/server';
import { isClerkServerConfigPresent } from '@/infrastructure/auth/clerk';
import { createPageMetadata } from '@/shared/siteMetadata';

export const metadata = createPageMetadata({
  title: 'CardForge Profile',
  description: 'Manage your CardForge profile.',
  path: '/profile',
  index: false,
});

export default async function ProfilePage() {
  const authConfigured = isClerkServerConfigPresent();
  const [businessIdentity, siteConfiguration] = await Promise.all([
    getCachedBusinessIdentity(),
    getCachedPublicSiteConfiguration(),
  ]);

  return (
    <CardForgeAppProviders>
      <div className="cardforge-public-tokens">
        <PublicSiteHeader
          accountSlot={authConfigured ? await getDeveloperPublicAuthSlot() : undefined}
          businessIdentity={businessIdentity}
          currentPath="/account"
          siteConfiguration={siteConfiguration}
        />
      </div>
      {authConfigured ? <ProfileManagementPage /> : <ProfileSetupFallback />}
    </CardForgeAppProviders>
  );
}
