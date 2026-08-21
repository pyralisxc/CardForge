import { auth } from '@clerk/nextjs/server';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { DeveloperPublicAuthSlot } from '@/features/developer-access/server';
import { CardForgeAppProviders } from '@/features/app-shell/server';
import { getCachedBusinessIdentity } from '@/features/business-identity/server';
import { OwnerConsolePage } from '@/features/owner/client';
import { getCurrentOwnerAccess } from '@/features/owner/server';
import { PublicSiteHeader } from '@/features/public-site/client/shell';
import { getCachedPublicSiteConfiguration } from '@/features/public-site/server';
import { createAuthRouteHref, isClerkServerConfigPresent } from '@/infrastructure/auth/clerk';
import { createPageMetadata } from '@/shared/siteMetadata';

export const metadata: Metadata = createPageMetadata({
  title: 'CardForge Owner Console',
  description: 'Control CardForge marketing, launch readiness, contributor pipelines, legal pages, and account access mechanics.',
  path: '/owner',
  index: false,
});

export default async function OwnerPage({
  searchParams,
}: {
  searchParams: Promise<{
    workspace?: string;
    pipelineStatus?: string;
    meta?: string;
    message?: string;
  }>;
}) {
  const params = await searchParams;
  const authConfigured = isClerkServerConfigPresent();

  if (authConfigured) {
    const { isAuthenticated } = await auth();
    if (!isAuthenticated) redirect(createAuthRouteHref('/sign-in', '/owner'));
    const ownerAccess = await getCurrentOwnerAccess();
    if (!ownerAccess.isOwner) {
      return (
        <main className="grid min-h-screen place-items-center bg-[var(--cf-canvas)] px-5 py-12 text-[var(--cf-text)]">
          <section className="w-full max-w-xl border border-[var(--cf-border-strong)] bg-[var(--cf-surface)] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--cf-accent-strong)]">Owner console</p>
            <h1 className="mt-2 font-serif text-3xl text-[var(--cf-text-strong)]">Owner access required</h1>
            <p className="mt-3 text-sm leading-6 text-[var(--cf-text-muted)]">
              This signed-in account does not have CardForge owner access.
            </p>
            <Link href="/account" prefetch={false} className="mt-5 inline-flex min-h-11 items-center border border-[var(--cf-accent)] px-4 font-semibold text-[var(--cf-accent-text)] hover:bg-[var(--cf-surface-hover)]">
              Open account
            </Link>
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
          currentPath="/owner"
          siteConfiguration={siteConfiguration}
        />
      </div>
      <OwnerConsolePage
        initialWorkspace={params.workspace === 'library' || params.workspace === 'marketing' ? params.workspace : 'overview'}
        initialPipelineStatus={params.pipelineStatus === 'submitted' ? 'submitted' : 'all'}
        initialMarketingNotice={params.meta === 'connected'
          ? { kind: 'success', message: 'Meta accounts connected. Review the discovered destinations before enabling publishing.' }
          : params.meta === 'error'
            ? { kind: 'error', message: (params.message ?? 'Unable to connect Meta.').slice(0, 240) }
            : undefined}
      />
    </CardForgeAppProviders>
  );
}