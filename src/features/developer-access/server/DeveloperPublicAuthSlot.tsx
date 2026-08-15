import { DeveloperPublicAuthControls } from '@/features/developer-access/components/DeveloperPublicAuthControls';
import { getCurrentDeveloperAccessSessionState } from '@/features/developer-access/server/access';

export async function DeveloperPublicAuthSlot() {
  const initialDeveloperAccess = await getCurrentDeveloperAccessSessionState();
  const developerAccess = initialDeveloperAccess.sessionKey
    ? initialDeveloperAccess
    : await getCurrentDeveloperAccessSessionState();

  return <DeveloperPublicAuthControls initialDeveloperAccess={developerAccess} />;
}
