import { DeveloperPublicAuthControls } from '@/features/developer-access/components/DeveloperPublicAuthControls';
import { getCurrentDeveloperAccessSessionState } from '@/features/developer-access/server/access';

export async function DeveloperPublicAuthSlot() {
  const initialDeveloperAccess = await getCurrentDeveloperAccessSessionState();
  return <DeveloperPublicAuthControls initialDeveloperAccess={initialDeveloperAccess} />;
}
