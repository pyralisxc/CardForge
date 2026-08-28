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
  searchParams: Promise<{ tab?: string; submission?: string; submitSet?: string }>;
}) {
  const requestedParams = await searchParams;
  const initialTab = requestedParams.tab === 'library' ? 'library' : undefined;
  const initialSubmissionId = /^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(requestedParams.submission ?? '')
    ? requestedParams.submission
    : undefined;
  const initialSubmitSetId = /^(?:active-card-set|set-[a-z0-9_-]+)$/i.test(requestedParams.submitSet ?? '')
    ? requestedParams.submitSet
    : undefined;
  const authConfigured = isClerkServerConfigPresent();

  if (authConfigured) {
    const { isAuthenticated } = await auth();
    if (!isAuthenticated) redirect(createAuthRouteHref('/sign-in', '/developer/cockpit'));
    const developerAccess = await getCurrentDeveloperAccessSessionState();
    if (!developerAccess.projection.hasCockpitAccess) {
      return (
        <main className="grid min-h-screen place-items-center bg-[var(--cf-canvas)] px-5 py-12 text-[var(--cf-text)]">
          <section className="w-full max-w-xl border border-[var(--cf-border-strong)] bg-[var(--cf-surface)] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--cf-accent-strong)]">Developer cockpit</p>
            <h1 className="mt-2 font-serif text-3xl text-[var(--cf-text-strong)]">Contributor access required</h1>
            <p className="mt-3 text-sm leading-6 text-[var(--cf-text-muted)]">
              This signed-in account is not an active CardForge contributor or owner.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/developer" prefetch={false} className="inline-flex min-h-11 items-center border border-[var(--cf-accent)] px-4 font-semibold text-[var(--cf-accent-text)] hover:bg-[var(--cf-surface-hover)]">
                Developer program
              </Link>
              <Link href="/account" prefetch={false} className="inline-flex min-h-11 items-center border border-[var(--cf-border)] px-4 font-semibold text-[var(--cf-text-muted)] hover:bg-[var(--cf-surface-raised)]">
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
      <DeveloperCockpitPage initialTab={initialTab} initialSubmissionId={initialSubmissionId} initialSubmitSetId={initialSubmitSetId} />
    </CardForgeAppProviders>
  );
}
