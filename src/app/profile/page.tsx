import { ProfileManagementPage, ProfileSetupFallback } from '@/features/account/client/profile';
import { isClerkServerConfigPresent } from '@/infrastructure/auth/clerk';

export default function ProfilePage() {
  if (!isClerkServerConfigPresent()) {
    return <ProfileSetupFallback />;
  }

  return <ProfileManagementPage />;
}
