import { CardForgeStudioShell } from '@/features/app-shell/client/studio';
import { getBusinessIdentity } from '@/features/business-identity/server';
import { createPageMetadata } from '@/shared/siteMetadata';

export const metadata = createPageMetadata({
  title: 'CardForge Studio Workspace',
  description: 'Design reusable card templates and generate complete sets in the CardForge workspace.',
  path: '/studio',
  index: false,
});

export default async function StudioPage() {
  const businessIdentity = await getBusinessIdentity();

  return (
    <CardForgeStudioShell businessIdentity={{
      brandName: businessIdentity.brandName,
      copyrightHolder: businessIdentity.copyrightHolder,
    }} />
  );
}
