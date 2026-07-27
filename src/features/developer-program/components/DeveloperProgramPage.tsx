"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { SignInButton, SignUpButton, useUser } from '@clerk/nextjs';
import {
  ArrowRight,
  CheckCircle2,
  Megaphone,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  Vote,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAccountEntitlement } from '@/features/account/client/entitlement';
import { createDeveloperRequestMailto } from '@/features/contact/client/links';
import { ContactRequestForm } from '@/features/contact/client/form';

const contributionLanes = [
  {
    icon: UploadCloud,
    title: 'Library craft',
    copy: 'Submit templates, overlays, icons, textures, fonts, and reusable recipes into Forge Review.',
  },
  {
    icon: Megaphone,
    title: 'Campaign packages',
    copy: 'Turn screenshots, Jam walkthroughs, release notes, and product proof into channel-ready marketing drafts.',
  },
  {
    icon: Vote,
    title: 'Site improvements',
    copy: 'Propose clearer public-site copy against the current live text, with rationale and owner review.',
  },
];

const standards = [
  'Every contribution has a named owner, source notes, and a visible review state.',
  'Personal workspace uploads stay separate from CardForge-owned contribution packages.',
  'Campaign captures stay private until an owner approves their public publishing media.',
  'Developers propose; the owner approves site changes, channel bindings, schedules, and publication.',
];

export function DeveloperProgramPage({
  initialAuthConfigured = false,
  supportEmail,
}: {
  initialAuthConfigured?: boolean;
  supportEmail?: string | null;
}) {
  const entitlement = useAccountEntitlement({ initialAuthConfigured });
  const [identity, setIdentity] = useState({
    isLoaded: false,
    isSignedIn: entitlement.isSignedIn,
    email: entitlement.accountEmail,
  });
  const signedIn = entitlement.authConfigured && identity.isLoaded
    ? identity.isSignedIn || entitlement.isSignedIn
    : entitlement.isSignedIn;
  const accountEmail = identity.email ?? entitlement.accountEmail;
  const isContributor = signedIn
    && (entitlement.accessMode === 'dev' || entitlement.ownerAccess.isOwner);
  const requestMailto = useMemo(
    () => createDeveloperRequestMailto({ accountEmail, supportEmail }),
    [accountEmail, supportEmail],
  );

  return (
    <div className="min-h-screen bg-[#0c0b09] text-[#f7ead0]">
      {entitlement.authConfigured ? <ClerkIdentityBridge onChange={setIdentity} /> : null}
      <section className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <div className="border border-[#6d4f2b] bg-[#15100a] p-5 md:p-7">
            <div className="flex items-center gap-3 text-[#e2aa4a]">
              <Sparkles className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em]">Forge community</span>
            </div>
            <h1 className="mt-4 font-serif text-4xl font-semibold leading-tight text-[#fff1c7] md:text-5xl">
              Help operate the forge, not just admire it.
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-[#c7b288]">
              CardForge contributors improve the shared library, prepare honest product marketing, and propose clearer site details from one protected cockpit. The work stays reviewable and durable; live public changes always remain owner-approved.
            </p>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {contributionLanes.map(({ icon: Icon, title, copy }) => (
                <article key={title} className="border border-[#4a3823] bg-[#100c08] p-3">
                  <Icon className="h-4 w-4 text-[#e2aa4a]" />
                  <h2 className="mt-3 font-serif text-lg text-[#ffe7ad]">{title}</h2>
                  <p className="mt-2 text-sm leading-5 text-[#c7b288]">{copy}</p>
                </article>
              ))}
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              {isContributor ? (
                <Button asChild className="bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]">
                  <Link href="/developer/cockpit">
                    Open developer cockpit <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              ) : !entitlement.authConfigured ? (
                <Button disabled variant="outline" className="border-[#755632] bg-transparent text-[#bea97f]">
                  Account setup incomplete
                </Button>
              ) : !signedIn ? (
                <>
                  <SignInButton mode="modal">
                    <Button className="bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]">Sign in first</Button>
                  </SignInButton>
                  <SignUpButton mode="modal">
                    <Button variant="outline" className="border-[#d8b365]/70 bg-transparent text-[#f8e3b0] hover:bg-[#2a1b0d] hover:text-[#fff1c7]">
                      Create account
                    </Button>
                  </SignUpButton>
                </>
              ) : (
                <Button asChild variant="outline" className="border-[#d8b365]/70 bg-transparent text-[#f8e3b0] hover:bg-[#2a1b0d] hover:text-[#fff1c7]">
                  <a href={requestMailto}>
                    Email fallback <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
            {entitlement.authConfigured && signedIn && !isContributor ? (
              <ContactRequestForm
                kind="developer"
                defaultEmail={accountEmail}
                defaultName=""
                defaultSubject="CardForge developer program request"
              />
            ) : null}
          </div>

          <aside className="border border-[#5f4526] bg-[#100c08] p-4">
            <div className="flex items-center gap-2 text-[#e2aa4a]">
              <ShieldCheck className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.16em]">Approval-gated workspace</p>
            </div>
            <p className="mt-3 break-words text-sm text-[#ffe7ad]">
              {accountEmail ?? 'No signed-in account'}
            </p>
            <p className="mt-3 text-xs leading-5 text-[#c7b288]">
              Contributor access is intentionally scoped. The owner can enable campaign drafting and site proposals independently for each active developer.
            </p>
          </aside>
        </div>

        <section className="mt-5 border border-[#5f4526] bg-[#15100a] p-5">
          <h2 className="font-serif text-2xl text-[#fff1c7]">The cockpit contract</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {standards.map((standard) => (
              <div key={standard} className="flex gap-3 border border-[#4a3823] bg-[#100c08] p-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#8be0a4]" />
                <p className="text-sm leading-5 text-[#d8c49a]">{standard}</p>
              </div>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}

function ClerkIdentityBridge({
  onChange,
}: {
  onChange: (identity: {
    isLoaded: boolean;
    isSignedIn: boolean;
    email: string | null;
  }) => void;
}) {
  const { isLoaded, isSignedIn, user } = useUser();

  useEffect(() => {
    onChange({
      isLoaded,
      isSignedIn: Boolean(isSignedIn),
      email: user?.primaryEmailAddress?.emailAddress ?? null,
    });
  }, [isLoaded, isSignedIn, onChange, user?.primaryEmailAddress?.emailAddress]);

  return null;
}
