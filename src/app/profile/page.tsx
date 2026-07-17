import { ProfileManagementPage, ProfileSetupFallback } from '@/features/account/client/profile';
import { isClerkServerConfigPresent } from '@/infrastructure/auth/clerk';
import { createPageMetadata } from '@/shared/siteMetadata';

export const metadata = createPageMetadata({
  title: 'CardForge Profile',
  description: 'Manage your CardForge profile.',
  path: '/profile',
  index: false,
});

export default function ProfilePage() {
  if (!isClerkServerConfigPresent()) {
    return <ProfileSetupFallback />;
  }

  return <ProfileManagementPage />;
}
