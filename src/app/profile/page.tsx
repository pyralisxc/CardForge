import { ProfileManagementPage, ProfileSetupFallback } from '@/features/account/client/profile';
import { PublicAuthControls } from '@/features/account/client/auth';
import { CardForgeAppProviders } from '@/features/app-shell/server';
import { getCachedBusinessIdentity } from '@/features/business-identity/server';
import { PublicSiteHeader } from '@/features/public-site/client/shell';
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
  const businessIdentity = await getCachedBusinessIdentity();

  return (
    <CardForgeAppProviders>
      <div className="cardforge-public-tokens">
        <PublicSiteHeader
          accountSlot={authConfigured ? <PublicAuthControls /> : undefined}
          businessIdentity={businessIdentity}
          currentPath="/account"
        />
      </div>
      {authConfigured ? <ProfileManagementPage /> : <ProfileSetupFallback />}
    </CardForgeAppProviders>
  );
}
