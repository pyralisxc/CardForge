import { auth } from '@clerk/nextjs/server';

import { StudioRuntimeLoader } from '@/features/app-shell/client/studio';
import { CardForgeAppProviders } from '@/features/app-shell/server';
import { getBusinessIdentity } from '@/features/business-identity/server';
import { getCurrentDeveloperAccessSessionState } from '@/features/developer-access/server';
import { isClerkServerConfigPresent } from '@/infrastructure/auth/clerk';
import { createPageMetadata } from '@/shared/siteMetadata';

export const metadata = createPageMetadata({
  title: 'CardForge Studio Workspace',
  description: 'Design reusable card templates and generate complete sets in the CardForge workspace.',
  path: '/studio',
  index: false,
});

export default async function StudioPage({
  searchParams,
}: {
  searchParams: Promise<{ document?: string }>;
}) {
  const documentId = (await searchParams).document;
  if (documentId && isClerkServerConfigPresent()) {
    const { isAuthenticated, redirectToSignIn } = await auth();
    if (!isAuthenticated) {
      return redirectToSignIn({
        returnBackUrl: `/studio?document=${encodeURIComponent(documentId)}`,
      });
    }
  }

  const [businessIdentity, initialDeveloperAccess] = await Promise.all([
    getBusinessIdentity(),
    getCurrentDeveloperAccessSessionState(),
  ]);

  return (
    <CardForgeAppProviders>
      <StudioRuntimeLoader businessIdentity={{
        brandName: businessIdentity.brandName,
        copyrightHolder: businessIdentity.copyrightHolder,
      }} initialDeveloperAccess={initialDeveloperAccess} />
    </CardForgeAppProviders>
  );
}
