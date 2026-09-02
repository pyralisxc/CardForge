import { auth } from '@clerk/nextjs/server';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getCurrentOwnerAccess } from '@/features/owner/server';
import { createAuthRouteHref, isClerkServerConfigPresent } from '@/infrastructure/auth/clerk';
import { createPageMetadata } from '@/shared/siteMetadata';

export const metadata: Metadata = createPageMetadata({
  title: 'CardForge Owner Access',
  description: 'Protected compatibility entry for CardForge owner operations in Profile.',
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
  const targetParams = new URLSearchParams({ section: 'profile', utility: 'owner' });
  const workspace = params.workspace === 'marketing' || params.workspace === 'audience' || params.workspace === 'site' || params.workspace === 'library' || params.workspace === 'governance'
    ? params.workspace
    : 'overview';
  targetParams.set('ownerWorkspace', workspace);
  if (params.pipelineStatus === 'submitted') targetParams.set('pipelineStatus', 'submitted');
  if (params.meta === 'connected' || params.meta === 'error') targetParams.set('meta', params.meta);
  if (params.meta === 'error' && params.message) targetParams.set('message', params.message.slice(0, 240));
  const target = `/account?${targetParams.toString()}`;

  if (authConfigured) {
    const { isAuthenticated } = await auth();
    if (!isAuthenticated) redirect(createAuthRouteHref('/sign-in', target));
    const ownerAccess = await getCurrentOwnerAccess();
    if (!ownerAccess.isOwner) {
      return (
        <main className="grid min-h-screen place-items-center bg-[var(--cf-canvas)] px-5 py-12 text-[var(--cf-text)]">
          <section className="w-full max-w-xl border border-[var(--cf-border-strong)] bg-[var(--cf-surface)] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--cf-accent-strong)]">Owner access</p>
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

  redirect(target);
}
