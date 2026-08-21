import { SignUp } from '@clerk/nextjs';
import Link from 'next/link';

import { PlanChoiceGrid } from '@/features/mcp-usage/client/plans';
import { getMcpAllowances } from '@/features/mcp-usage/server';
import {
  createAuthRouteHref,
  getSafeLocalReturnPath,
  isClerkServerConfigPresent,
} from '@/infrastructure/auth/clerk';
import { createPageMetadata } from '@/shared/siteMetadata';

export const metadata = createPageMetadata({
  title: 'Create a CardForge account',
  description: 'Create your CardForge account.',
  path: '/sign-up',
  index: false,
});

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  if (!isClerkServerConfigPresent()) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#0c0b09] px-5 py-12 text-[#f7f1e4]">
        <div className="w-full max-w-md border border-[#4d3c25] bg-[#1b1510] p-8 text-center shadow-2xl">
          <h1 className="font-[var(--font-cardforge-spectral)] text-3xl font-semibold">Account creation is unavailable</h1>
          <p className="mt-3 text-base leading-7 text-[#c8bda8]">
            CardForge account sign-up has not been configured for this environment.
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
  const fallbackRedirectUrl = getSafeLocalReturnPath(params.redirect_url);
  const plans = await getMcpAllowances();
  const selectedPlanKey = (() => {
    const intent = new URL(fallbackRedirectUrl, 'https://cardforge.local').searchParams.get('intent');
    return intent === 'creator' || intent === 'designer' ? intent : null;
  })();
  const selectedPlan = plans.find((plan) => plan.planKey === selectedPlanKey);

  return (
    <main className="min-h-screen bg-[#0c0b09] px-5 py-10 text-[#f7f1e4]">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="font-[var(--font-cardforge-spectral)] text-2xl font-semibold text-[#f7f1e4]">CardForge Studio</Link>
          <Link href="/studio" prefetch={false} className="inline-flex min-h-11 items-center border border-[#846634] px-5 font-bold text-[#f8e3b0] hover:border-[#d9a441]">Open Studio without an account</Link>
        </div>
        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,28rem)]">
          <div className="max-w-2xl pt-2">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#d8b365]">Account setup</p>
            <h1 className="mt-2 font-[var(--font-cardforge-spectral)] text-4xl font-semibold text-[#fff1c7] md:text-5xl">Create in seconds. Add the plan that fits how you make.</h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-[#c7b288]">Your account keeps your plan, billing, ChatGPT plugin access, and private plugin workspace together. The Studio still opens instantly, and your everyday projects remain on this device unless you choose to export or share them.</p>
          </div>
          <div id="create-account" className="grid justify-items-center">
            {selectedPlan ? (
              <div className="mb-4 w-full max-w-md border border-[#6f532e] bg-[#1b140d] p-4 text-left">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#d8b365]">Selected plan</p>
                <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-[var(--font-cardforge-spectral)] text-2xl font-semibold text-[#fff1c7]">{selectedPlan.displayName}</p>
                  <p className="font-semibold text-[#f3d48f]">{selectedPlan.priceLabel} <span className="text-xs font-normal text-[#a9946c]">{selectedPlan.priceNote}</span></p>
                </div>
                <p className="mt-2 text-sm leading-6 text-[#c7b288]">Create the account first. You will return directly to Plan &amp; billing to confirm the choice before Stripe Checkout opens.</p>
              </div>
            ) : null}
            <SignUp
              fallbackRedirectUrl={fallbackRedirectUrl}
              signInFallbackRedirectUrl={fallbackRedirectUrl}
              signInUrl={createAuthRouteHref('/sign-in', fallbackRedirectUrl)}
            />
          </div>
        </div>
        <section aria-labelledby="signup-plans-heading" className="mt-12 border-t border-[#4d3c25] pt-10">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#d8b365]">Plans</p>
          <h2 id="signup-plans-heading" className="mt-2 font-[var(--font-cardforge-spectral)] text-3xl font-semibold text-[#fff1c7] md:text-4xl">See exactly what each plan gives you</h2>
          <p className="mt-3 mb-6 max-w-3xl text-base leading-7 text-[#c7b288]">Compare finished Studio exports and portable CardForge project files with monthly ChatGPT plugin actions and private plugin workspace.</p>
          <PlanChoiceGrid
            plans={plans}
            creatorHref="/sign-up?redirect_url=%2Faccount%3Fintent%3Dcreator%23account-and-billing#create-account"
            designerHref="/sign-up?redirect_url=%2Faccount%3Fintent%3Ddesigner%23account-and-billing#create-account"
            featuredPlanKey={selectedPlanKey ?? undefined}
          />
        </section>
      </div>
    </main>
  );
}
