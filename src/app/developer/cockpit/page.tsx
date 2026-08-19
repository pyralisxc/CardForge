import { auth } from '@clerk/nextjs/server';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import {
  DeveloperPublicAuthSlot,
  getCurrentDeveloperAccessSessionState,
} from '@/features/developer-access/server';
import { CardForgeAppProviders } from '@/features/app-shell/server';
import { getCachedBusinessIdentity } from '@/features/business-identity/server';
import { DeveloperCockpitPage } from '@/features/developer-cockpit/client';
import { PublicSiteHeader } from '@/features/public-site/client/shell';
import { getCachedPublicSiteConfiguration } from '@/features/public-site/server';
import { createAuthRouteHref, isClerkServerConfigPresent } from '@/infrastructure/auth/clerk';
import { createPageMetadata } from '@/shared/siteMetadata';

export const metadata: Metadata = createPageMetadata({
  title: 'CardForge Developer Cockpit',
  description: 'Protected CardForge workspace for asset review, campaign packages, site proposals, and owner-approved publishing.',
  path: '/developer/cockpit',
  index: false,
});

export default async function DeveloperCockpitRoute({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; submission?: string }>;
}) {
  const requestedParams = await searchParams;
  const initialTab = requestedParams.tab === 'library' ? 'library' : undefined;
  const initialSubmissionId = /^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(requestedParams.submission ?? '')
    ? requestedParams.submission
    : undefined;
  const authConfigured = isClerkServerConfigPresent();

  if (authConfigured) {
    const { isAuthenticated } = await auth();
    if (!isAuthenticated) redirect(createAuthRouteHref('/sign-in', '/developer/cockpit'));
    const developerAccess = await getCurrentDeveloperAccessSessionState();
    if (!developerAccess.projection.hasCockpitAccess) {
      return (
        <main className="grid min-h-screen place-items-center bg-[#0c0b09] px-5 py-12 text-[#f7ead0]">
          <section className="w-full max-w-xl border border-[#6d4f2b] bg-[#15100a] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#e2aa4a]">Developer cockpit</p>
            <h1 className="mt-2 font-serif text-3xl text-[#fff1c7]">Contributor access required</h1>
            <p className="mt-3 text-sm leading-6 text-[#c7b288]">
              This signed-in account is not an active CardForge contributor or owner.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/developer" prefetch={false} className="inline-flex min-h-11 items-center border border-[#d8b365]/70 px-4 font-semibold text-[#f8e3b0] hover:bg-[#2a1b0d]">
                Developer program
              </Link>
              <Link href="/account" prefetch={false} className="inline-flex min-h-11 items-center border border-[#5f4526] px-4 font-semibold text-[#c7b288] hover:bg-[#1b1209]">
                Open account
              </Link>
            </div>
          </section>
        </main>
      );
    }
  }

  const [businessIdentity, siteConfiguration] = await Promise.all([
    getCachedBusinessIdentity(),
    getCachedPublicSiteConfiguration(),
  ]);
  return (
    <CardForgeAppProviders scope="shell">
      <div className="cardforge-public-tokens">
        <PublicSiteHeader
          accountSlot={authConfigured ? <DeveloperPublicAuthSlot /> : undefined}
          businessIdentity={businessIdentity}
          currentPath="/developer/cockpit"
          siteConfiguration={siteConfiguration}
        />
      </div>
      <DeveloperCockpitPage initialTab={initialTab} initialSubmissionId={initialSubmissionId} />
    </CardForgeAppProviders>
  );
}
