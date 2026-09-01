import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

import { createContextualStudioHref, normalizeStudioReturnTo } from '@/features/app-shell/client/navigation';
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
  searchParams: Promise<{ document?: string; returnTo?: string; revision?: string }>;
}) {
  const params = await searchParams;
  const documentId = params.document;
  if (!documentId) redirect('/account?tool=design');
  const requestedReturnTo = normalizeStudioReturnTo(params.returnTo);
  const contextualHref = createContextualStudioHref({
    documentId,
    revision: params.revision,
    returnTo: requestedReturnTo,
  });
  const authConfigured = isClerkServerConfigPresent();

  if (authConfigured) {
    const { isAuthenticated, redirectToSignIn } = await auth();
    if (!isAuthenticated) {
      return redirectToSignIn({
        returnBackUrl: contextualHref,
      });
    }
  }

  redirect(contextualHref);
}
