"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { SignInButton, SignUpButton, UserButton, useUser } from '@clerk/nextjs';
import { ArrowRight, CheckCircle2, FileCheck2, Hammer, ShieldCheck, Sparkles, UploadCloud, Vote } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DeveloperAssetHubPanel } from '@/features/developer-assets/components/DeveloperAssetHubPanel';
import { useAccountEntitlement } from '@/features/account/hooks/useAccountEntitlement';

const programStandards = [
  'Share polished assets that other card makers can actually use.',
  'Include a clear preview, intended use, and licensing/source notes.',
  'Vote on peer work for craft, readability, flexibility, and fit.',
  'Keep personal uploads separate from assets submitted to CardForge.',
];

const developerSteps = [
  {
    title: 'Show what you can make',
    copy: 'Apply with a signed-in account and include examples, asset types, or a small portfolio.',
  },
  {
    title: 'Submit useful assets',
    copy: 'Templates, parts, icons, dividers, textures, and presets enter review before they reach makers.',
  },
  {
    title: 'Help the library improve',
    copy: 'Peer voting keeps the library curated and gives strong work a path into CardForge.',
  },
];

const createDeveloperRequestMailto = (accountEmail: string | null) => {
  const subject = 'CardForge developer program request';
  const body = [
    'CardForge developer program request',
    '',
    `Account email: ${accountEmail ?? ''}`,
    'Portfolio or asset examples:',
    '',
    'Asset types I want to contribute:',
    '',
    'Notes:',
  ].join('\n');

  return `mailto:Cameron.r.locke96@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};

export function DeveloperProgramPage({
  initialAuthConfigured = false,
}: {
  initialAuthConfigured?: boolean;
}) {
  const entitlement = useAccountEntitlement({ initialAuthConfigured });
  const [clerkIdentity, setClerkIdentity] = useState({
    isLoaded: false,
    isSignedIn: entitlement.isSignedIn,
    email: entitlement.accountEmail,
  });
  const effectiveSignedIn = entitlement.authConfigured && clerkIdentity.isLoaded
    ? clerkIdentity.isSignedIn
    : entitlement.isSignedIn;
  const accountEmail = clerkIdentity.email ?? entitlement.accountEmail ?? null;
  const isDeveloper = entitlement.authConfigured
    && effectiveSignedIn
    && (entitlement.accessMode === 'dev' || entitlement.ownerAccess.isOwner);
  const developerRequestMailto = useMemo(() => createDeveloperRequestMailto(accountEmail), [accountEmail]);

  return (
    <main className="min-h-screen bg-[#0c0b09] text-[#f7ead0]">
      {entitlement.authConfigured ? (
        <ClerkIdentityBridge onChange={setClerkIdentity} />
      ) : null}
      <header className="border-b border-[#5f4526] bg-[#120e09]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6">
          <Link href="/" prefetch={false} className="flex items-center gap-3 text-[#f9e7b7]">
            <span className="grid h-9 w-9 place-items-center border border-[#d7b469]/70 bg-[#1c130b] text-[#f2c15d]">
              <Hammer className="h-4 w-4" />
            </span>
            <span className="font-serif text-xl font-semibold">CardForge Studio</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-[#dbc79e] md:flex">
            <Link href="/studio" prefetch={false} className="hover:text-[#fff3ca]">Studio</Link>
            <Link href="/roadmap" prefetch={false} className="hover:text-[#fff3ca]">Roadmap</Link>
            <Link href="/account" prefetch={false} className="hover:text-[#fff3ca]">Account</Link>
            {entitlement.ownerAccess.isOwner ? <Link href="/owner" prefetch={false} className="hover:text-[#fff3ca]">Owner</Link> : null}
          </nav>
          {entitlement.authConfigured && effectiveSignedIn ? (
            <UserButton userProfileMode="navigation" userProfileUrl="/profile" />
          ) : null}
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-5 md:px-6">
        <div className="border border-[#6d4f2b] bg-[#15100a] p-4 md:p-5">
          <div className="flex items-center gap-3 text-[#e2aa4a]">
            <UploadCloud className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-[0.18em]">
              {isDeveloper ? 'Forge Review developer' : 'Become a developer'}
            </span>
          </div>
          <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-end">
            <div>
              <h1 className="font-serif text-3xl font-semibold leading-tight text-[#fff1c7] md:text-4xl">
                Share assets makers want to use.
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#c7b288]">
                Forge Review is the contribution path for people who want to add templates, parts, icons, textures, dividers, and presets to CardForge. Developers do not pay for access; they help make the library better.
              </p>
            </div>
            <div className="border border-[#5f4526] bg-[#100c08] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-[#a98a55]">Current account</p>
              <p className="mt-2 break-words text-sm text-[#ffe7ad]">{accountEmail ?? 'No signed-in account'}</p>
              <p className="mt-2 text-xs text-[#c7b288]">
                {isDeveloper ? 'Developer tools are active.' : 'Apply after signing in so the account can be approved.'}
              </p>
            </div>
          </div>
        </div>

        <Tabs defaultValue={isDeveloper ? 'hub' : 'overview'} className="mt-4">
          <TabsList className="flex h-auto flex-wrap justify-start gap-2 rounded-none border border-[#5f4526] bg-[#100c08] p-2">
            <TabsTrigger value="overview" className="rounded-none border border-transparent px-4 py-2 text-[#c7b288] data-[state=active]:border-[#d8b365] data-[state=active]:bg-[#2a1b0d] data-[state=active]:text-[#ffe7ad]">Overview</TabsTrigger>
            <TabsTrigger value="hub" className="rounded-none border border-transparent px-4 py-2 text-[#c7b288] data-[state=active]:border-[#d8b365] data-[state=active]:bg-[#2a1b0d] data-[state=active]:text-[#ffe7ad]">Asset Hub</TabsTrigger>
            <TabsTrigger value="standards" className="rounded-none border border-transparent px-4 py-2 text-[#c7b288] data-[state=active]:border-[#d8b365] data-[state=active]:bg-[#2a1b0d] data-[state=active]:text-[#ffe7ad]">Standards</TabsTrigger>
            <TabsTrigger value="apply" className="rounded-none border border-transparent px-4 py-2 text-[#c7b288] data-[state=active]:border-[#d8b365] data-[state=active]:bg-[#2a1b0d] data-[state=active]:text-[#ffe7ad]">Apply</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-3">
            <div className="grid gap-3 md:grid-cols-3">
              {developerSteps.map((step, index) => (
                <article key={step.title} className="border border-[#5f4526] bg-[#15100a] p-4">
                  <span className="text-xs uppercase tracking-[0.16em] text-[#a98a55]">{String(index + 1).padStart(2, '0')}</span>
                  <h2 className="mt-2 font-serif text-lg text-[#fff1c7]">{step.title}</h2>
                  <p className="mt-2 text-sm leading-5 text-[#c7b288]">{step.copy}</p>
                </article>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="hub" className="mt-3">
            {isDeveloper ? (
              <DeveloperAssetHubPanel compact />
            ) : (
              <LockedDeveloperPanel />
            )}
          </TabsContent>

          <TabsContent value="standards" className="mt-3">
            <section className="border border-[#5f4526] bg-[#15100a] p-4">
              <div className="flex items-center gap-3 text-[#e2aa4a]">
                <FileCheck2 className="h-5 w-5" />
                <h2 className="font-serif text-xl text-[#fff1c7]">Contribution standards</h2>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {programStandards.map((standard) => (
                  <div key={standard} className="flex gap-3 border border-[#4a3823] bg-[#100c08] p-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#8be0a4]" />
                    <p className="text-sm leading-5 text-[#d8c49a]">{standard}</p>
                  </div>
                ))}
              </div>
            </section>
          </TabsContent>

          <TabsContent value="apply" className="mt-3">
            <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <div className="border border-[#5f4526] bg-[#15100a] p-4">
                <div className="flex items-center gap-3 text-[#e2aa4a]">
                  <Sparkles className="h-5 w-5" />
                  <h2 className="font-serif text-xl text-[#fff1c7]">Apply to contribute</h2>
                </div>
                <p className="mt-2 text-sm leading-6 text-[#c7b288]">
                  Bring a clear style, usable assets, and a practical sense for what card makers need. Accepted developers get review tools, clean export, and a direct way to improve the shared library.
                </p>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  {!entitlement.authConfigured ? (
                    <Button disabled className="border-[#755632] bg-transparent text-[#bea97f]" variant="outline">
                      Clerk setup incomplete
                    </Button>
                  ) : !effectiveSignedIn ? (
                    <>
                      <SignInButton mode="modal">
                        <Button className="bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]">Sign in first</Button>
                      </SignInButton>
                      <SignUpButton mode="modal">
                        <Button variant="outline" className="border-[#d8b365]/70 bg-transparent text-[#f8e3b0] hover:bg-[#2a1b0d] hover:text-[#fff1c7]">Create account</Button>
                      </SignUpButton>
                    </>
                  ) : (
                    <Button asChild className="bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]">
                      <a href={developerRequestMailto}>
                        Request developer access <ArrowRight className="ml-2 h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
              <div className="border border-[#5f4526] bg-[#15100a] p-4">
                <div className="flex items-center gap-3 text-[#e2aa4a]">
                  <Vote className="h-5 w-5" />
                  <h2 className="font-serif text-xl text-[#fff1c7]">Review keeps it useful</h2>
                </div>
                <p className="mt-2 text-sm leading-6 text-[#c7b288]">
                  Developer votes help strong assets rise and keep clutter out of the maker experience.
                </p>
              </div>
            </section>
          </TabsContent>
        </Tabs>
      </section>
    </main>
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

function LockedDeveloperPanel() {
  return (
    <section className="border border-[#7d5a2e] bg-[#181009] p-5">
      <div className="flex items-center gap-3 text-[#e2aa4a]">
        <ShieldCheck className="h-5 w-5" />
        <h2 className="font-serif text-2xl text-[#fff1c7]">Forge Review is approval-gated</h2>
      </div>
      <p className="mt-3 text-sm leading-6 text-[#c7b288]">
        This keeps the site library curated. Free and Creator Pass accounts can upload local custom art for their own browser workspace, while developer accounts can submit candidates into the shared CardForge pipeline.
      </p>
    </section>
  );
}
