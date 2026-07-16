import { CardForgeStudioShell } from '@/features/app-shell/client/studio';
import { getBusinessIdentity } from '@/features/business-identity/server';

export default async function StudioPage() {
  const businessIdentity = await getBusinessIdentity();

  return (
    <CardForgeStudioShell businessIdentity={{
      brandName: businessIdentity.brandName,
      copyrightHolder: businessIdentity.copyrightHolder,
    }} />
  );
}
