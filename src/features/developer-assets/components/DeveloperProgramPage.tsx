"use client";

import { useEffect, useMemo, useState } from 'react';
import { SignInButton, SignUpButton, UserButton, useUser } from '@clerk/nextjs';
import { ArrowRight, CheckCircle2, FileCheck2, ShieldCheck, Sparkles, UploadCloud, Vote } from 'lucide-react';

import { PublicSiteHeader } from '@/features/app-shell/components/PublicSiteHeader';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DeveloperAssetHubPanel } from '@/features/developer-assets/components/DeveloperAssetHubPanel';
import { useAccountEntitlement } from '@/features/account/hooks/useAccountEntitlement';
import { getAccountDisplayName } from '@/features/account/lib/accountDisplay';

const programStandards = [
  'Share polished assets that make real card systems easier to build.',
  'Include a clear preview, intended use, and licensing/source notes.',
  'Vote on peer work for craft, readability, flexibility, and fit.',
  'Keep personal uploads separate from assets submitted to CardForge.',
];

const developerSteps = [
  {
    title: 'Show your craft',
    copy: 'Apply with a signed-in account and include examples, asset types, or a small portfolio.',
  },
  {
    title: 'Submit useful building blocks',
    copy: 'Templates, overlays, icons, dividers, textures, and element recipes enter review before they shape the studio.',
  },
  {
    title: 'Help the forge improve',
    copy: 'Peer voting keeps the shared library curated and gives strong work a path into the live CardForge catalog.',
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
    displayName: null as string | null,
  });
  const effectiveSignedIn = entitlement.authConfigured && clerkIdentity.isLoaded
    ? clerkIdentity.isSignedIn
    : entitlement.isSignedIn;
  const accountEmail = clerkIdentity.email ?? entitlement.accountEmail ?? null;
  const accountDisplayName = getAccountDisplayName({
    displayName: clerkIdentity.displayName,
    email: accountEmail,
  });
  const isDeveloper = entitlement.authConfigured
    && effectiveSignedIn
    && (entitlement.accessMode === 'dev' || entitlement.ownerAccess.isOwner);
  const developerRequestMailto = useMemo(() => createDeveloperRequestMailto(accountEmail), [accountEmail]);

  if (!isDeveloper) {
    return (
      <main className="min-h-screen bg-[#0c0b09] text-[#f7ead0]">
        {entitlement.authConfigured ? (
          <ClerkIdentityBridge onChange={setClerkIdentity} />
        ) : null}
        <PublicSiteHeader
          currentPath="/developer"
          showOwnerLink={entitlement.ownerAccess.isOwner}
          rightSlot={entitlement.authConfigured && effectiveSignedIn ? (
            <UserButton userProfileMode="navigation" userProfileUrl="/profile" />
          ) : null}
        />

        <PublicDeveloperRecruitment
          accountEmail={accountEmail}
          authConfigured={entitlement.authConfigured}
          developerRequestMailto={developerRequestMailto}
          isSignedIn={effectiveSignedIn}
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0c0b09] text-[#f7ead0]">
      {entitlement.authConfigured ? (
        <ClerkIdentityBridge onChange={setClerkIdentity} />
      ) : null}
      <PublicSiteHeader
        currentPath="/developer"
        showOwnerLink={entitlement.ownerAccess.isOwner}
        rightSlot={entitlement.authConfigured && effectiveSignedIn ? (
          <UserButton userProfileMode="navigation" userProfileUrl="/profile" />
        ) : null}
      />

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
                Shape the library behind the forge.
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#c7b288]">
                Forge Review is the contribution path for people who want to improve the templates, overlays, icons, textures, dividers, and element recipes creators build from. Developers do not pay for access; they help make the shared library stronger for everyone.
              </p>
            </div>
            <div className="border border-[#5f4526] bg-[#100c08] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-[#a98a55]">Current account</p>
              <p className="mt-2 truncate text-sm font-semibold text-[#ffe7ad]" title={accountEmail ?? undefined}>
                {accountDisplayName ?? accountEmail ?? 'No signed-in account'}
              </p>
              {accountDisplayName && accountEmail ? (
                <p className="mt-1 truncate text-xs text-[#c7b288]" title={accountEmail}>{accountEmail}</p>
              ) : null}
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
                  Bring a clear style, usable assets, and a practical sense for what creators need when a card project gets real. Accepted developers get review tools, clean export, and a direct way to improve the shared library.
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
                  Developer votes help strong assets rise and keep clutter out of the creator experience.
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
    displayName: string | null;
  }) => void;
}) {
  const { isLoaded, isSignedIn, user } = useUser();

  useEffect(() => {
    onChange({
      isLoaded,
      isSignedIn: Boolean(isSignedIn),
      email: user?.primaryEmailAddress?.emailAddress ?? null,
      displayName: user?.fullName ?? user?.firstName ?? null,
    });
  }, [isLoaded, isSignedIn, onChange, user?.firstName, user?.fullName, user?.primaryEmailAddress?.emailAddress]);

  return null;
}

function PublicDeveloperRecruitment({
  accountEmail,
  authConfigured,
  developerRequestMailto,
  isSignedIn,
}: {
  accountEmail: string | null;
  authConfigured: boolean;
  developerRequestMailto: string;
  isSignedIn: boolean;
}) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="border border-[#6d4f2b] bg-[#15100a] p-5 md:p-7">
          <div className="flex items-center gap-3 text-[#e2aa4a]">
            <Sparkles className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-[0.18em]">Forge community</span>
          </div>
          <h1 className="mt-4 font-serif text-4xl font-semibold leading-tight text-[#fff1c7] md:text-5xl">
            Join the community shaping the forge.
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-[#c7b288]">
            Help shape the shared CardForge library by contributing templates, overlays, icons, dividers, textures, and element recipes. Approved developers get a private asset hub for submissions, continuous voting, and pipeline status, while creators get a better studio for building complete sets.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {!authConfigured ? (
              <Button disabled className="border-[#755632] bg-transparent text-[#bea97f]" variant="outline">
                Clerk setup incomplete
              </Button>
            ) : !isSignedIn ? (
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

        <aside className="border border-[#5f4526] bg-[#100c08] p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-[#a98a55]">Current account</p>
          <p className="mt-2 break-words text-sm text-[#ffe7ad]">{accountEmail ?? 'No signed-in account'}</p>
          <p className="mt-2 text-xs leading-5 text-[#c7b288]">
            Participation is approval-gated so the shared library stays curated. Normal users can still upload local art inside their own browser workspace.
          </p>
        </aside>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {developerSteps.map((step, index) => (
          <article key={step.title} className="border border-[#5f4526] bg-[#15100a] p-4">
            <span className="text-xs uppercase tracking-[0.16em] text-[#a98a55]">{String(index + 1).padStart(2, '0')}</span>
            <h2 className="mt-2 font-serif text-lg text-[#fff1c7]">{step.title}</h2>
            <p className="mt-2 text-sm leading-5 text-[#c7b288]">{step.copy}</p>
          </article>
        ))}
      </div>

      <section className="mt-5 border border-[#5f4526] bg-[#15100a] p-5">
        <div className="flex items-center gap-3 text-[#e2aa4a]">
          <Vote className="h-5 w-5" />
          <h2 className="font-serif text-2xl text-[#fff1c7]">What approved developers do</h2>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {[
            'Submit useful source assets into the shared CardForge review pipeline.',
            'Vote continuously on uploaded, published, and CardForge default assets until they land in archive.',
            'Keep local personal uploads separate from site-library candidates.',
            'Help decide which assets belong in Starter Library, Creator Pass, or the shared CardForge catalog.',
          ].map((standard) => (
            <div key={standard} className="flex gap-3 border border-[#4a3823] bg-[#100c08] p-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#8be0a4]" />
              <p className="text-sm leading-5 text-[#d8c49a]">{standard}</p>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
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
