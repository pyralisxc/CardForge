import { SignIn } from '@clerk/nextjs';
import Link from 'next/link';

import { getSafeLocalReturnPath, isClerkServerConfigPresent } from '@/infrastructure/auth/clerk';
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
  searchParams: Promise<{
    redirect_url?: string;
    returnTo?: string;
    next?: string;
  }>;
}) {
  if (!isClerkServerConfigPresent()) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#0c0b09] px-5 py-12 text-[#f7f1e4]">
        <div className="w-full max-w-md border border-[#4d3c25] bg-[#1b1510] p-8 text-center shadow-2xl">
          <h1 className="font-[var(--font-cardforge-spectral)] text-3xl font-semibold">Account sign-in is unavailable</h1>
          <p className="mt-3 text-base leading-7 text-[#c8bda8]">
            CardForge account sign-in has not been configured for this environment.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex min-h-11 items-center justify-center border border-[#846634] px-5 font-bold text-[#f8e3b0] hover:border-[#d9a441]"
          >
            Return home
          </Link>
        </div>
      </main>
    );
  }

  const params = await searchParams;
  const fallbackRedirectUrl = getSafeLocalReturnPath(
    params.redirect_url ?? params.returnTo ?? params.next,
  );

  return (
    <main className="grid min-h-screen place-items-center bg-[#0c0b09] px-5 py-12">
      <div className="grid justify-items-center gap-6">
        <Link href="/" className="font-[var(--font-cardforge-spectral)] text-2xl font-semibold text-[#f7f1e4]">
          CardForge Studio
        </Link>
        <SignIn fallbackRedirectUrl={fallbackRedirectUrl} />
      </div>
    </main>
  );
}
