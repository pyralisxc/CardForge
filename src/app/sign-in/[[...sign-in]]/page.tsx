import { SignIn } from '@clerk/nextjs';
import Link from 'next/link';

import {
  createAuthRouteHref,
  getSafeLocalReturnPath,
  isClerkServerConfigPresent,
} from '@/infrastructure/auth/clerk';
import { createPageMetadata } from '@/shared/siteMetadata';

export const metadata = createPageMetadata({
  title: 'Sign in to CardForge',
  description: 'Sign in to your CardForge account.',
  path: '/sign-in',
  index: false,
});

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  if (!isClerkServerConfigPresent()) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--cf-canvas)] px-5 py-12 text-[var(--cf-text)]">
        <div className="w-full max-w-md border border-[var(--cf-border)] bg-[var(--cf-surface-raised)] p-8 text-center shadow-2xl">
          <h1 className="font-[var(--font-cardforge-spectral)] text-3xl font-semibold text-[var(--cf-text-strong)]">Account sign-in is unavailable</h1>
          <p className="mt-3 text-base leading-7 text-[var(--cf-text-muted)]">
            CardForge account sign-in has not been configured for this environment.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex min-h-11 items-center justify-center border border-[var(--cf-border-strong)] px-5 font-bold text-[var(--cf-accent-text)] hover:border-[var(--cf-accent)]"
          >
            Return home
          </Link>
        </div>
      </main>
    );
  }

  const params = await searchParams;
  const fallbackRedirectUrl = getSafeLocalReturnPath(params.redirect_url);

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--cf-canvas)] px-5 py-12 text-[var(--cf-text)]">
      <div className="grid max-w-md justify-items-center gap-6 text-center">
        <Link href="/" className="font-[var(--font-cardforge-spectral)] text-2xl font-semibold text-[var(--cf-text)]">
          CardForge Studio
        </Link>
        <div>
          <h1 className="font-[var(--font-cardforge-spectral)] text-3xl font-semibold text-[var(--cf-text-strong)]">Return to your account</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--cf-text-muted)]">Sign in to view your plan, billing, assistant access, and online usage. Studio remains available without signing in.</p>
        </div>
        <SignIn
          fallbackRedirectUrl={fallbackRedirectUrl}
          signUpFallbackRedirectUrl={fallbackRedirectUrl}
          signUpUrl={createAuthRouteHref('/sign-up', fallbackRedirectUrl)}
        />
        <Link href="/account" prefetch={false} className="inline-flex min-h-11 items-center border border-[var(--cf-border-strong)] px-5 font-bold text-[var(--cf-accent-text)] hover:border-[var(--cf-accent)]">Open Desk without signing in</Link>
      </div>
    </main>
  );
}
