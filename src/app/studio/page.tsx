import { auth } from '@clerk/nextjs/server';

import { StudioRuntimeLoader } from '@/features/app-shell/client/studio';
import { CardForgeAppProviders } from '@/features/app-shell/server';
import { getCachedBusinessIdentity } from '@/features/business-identity/server';
import {
  EMPTY_CONTRIBUTOR_ACCESS_SESSION_STATE,
  getCurrentContributorAccessSessionState,
} from '@/features/contributor-access/server';
import { createProjectPersistenceScope } from '@/features/project/server';
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
  const authConfigured = isClerkServerConfigPresent();
  let accountUserId: string | null = null;

  if (authConfigured) {
    const { isAuthenticated, redirectToSignIn, userId } = await auth();
    if (documentId && !isAuthenticated) {
      return redirectToSignIn({
        returnBackUrl: `/studio?document=${encodeURIComponent(documentId)}`,
      });
    }
    accountUserId = userId;
  }

  const persistenceScope = createProjectPersistenceScope({
    authConfigured,
    accountUserId,
  });
  const [businessIdentity, initialContributorAccess] = await Promise.all([
    getCachedBusinessIdentity(),
    getCurrentContributorAccessSessionState().catch((error) => {
      console.error('Unable to load optional Studio contributor access:', error);
      return EMPTY_CONTRIBUTOR_ACCESS_SESSION_STATE;
    }),
  ]);

  return (
    <CardForgeAppProviders scope="studio">
      <StudioRuntimeLoader businessIdentity={{
        brandName: businessIdentity.brandName,
        copyrightHolder: businessIdentity.copyrightHolder,
      }} initialContributorAccess={initialContributorAccess} persistenceScope={persistenceScope} />
    </CardForgeAppProviders>
  );
}
