import { ProfileManagementPage, ProfileSetupFallback } from '@/features/account/components/ProfileManagementPage';
import { isClerkServerConfigPresent } from '@/lib/clerkConfig';

export default function ProfilePage() {
  if (!isClerkServerConfigPresent()) {
    return <ProfileSetupFallback />;
  }

  return <ProfileManagementPage />;
}
