"use client";

import Link from 'next/link';
import { SignInButton, UserProfile, useUser } from '@clerk/nextjs';
import { ArrowLeft, FolderOpen, Hammer, KeyRound, ShieldCheck, UserCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { getAccountDisplayName, toPossessiveName } from '@/features/account/lib/accountDisplay';

const clerkAppearance = {
  variables: {
    colorPrimary: '#e4aa43',
    colorBackground: '#15100a',
    colorInputBackground: '#100c08',
    colorInputText: '#fff1c7',
    colorText: '#f7ead0',
    colorTextSecondary: '#cbb58b',
    borderRadius: '4px',
    fontFamily: 'var(--font-lato), sans-serif',
  },
  elements: {
    rootBox: 'w-full',
    cardBox: 'w-full shadow-none border border-[#5f4526] bg-[#15100a]',
    navbar: 'bg-[#100c08]',
    pageScrollBox: 'bg-[#15100a]',
  },
};

function ProfileShell({
  children,
  eyebrow = 'Profile vault',
  title = 'Forge profile',
  detail = 'Sign-in methods, profile details, and account controls in one focused place.',
}: {
  children: React.ReactNode;
  eyebrow?: string;
  title?: string;
  detail?: string;
}) {
  return (
    <main className="min-h-screen bg-[#0c0b09] text-[#f7ead0]">
      <header className="border-b border-[#5f4526] bg-[#120e09]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6">
          <Link href="/" prefetch={false} className="flex items-center gap-3 text-[#f9e7b7]">
            <span className="grid h-9 w-9 place-items-center border border-[#d7b469]/70 bg-[#1c130b] text-[#f2c15d]">
              <Hammer className="h-4 w-4" />
            </span>
            <span className="font-serif text-xl font-semibold">CardForge Studio</span>
          </Link>
          <Button asChild variant="outline" className="border-[#d8b365]/70 bg-transparent text-[#f8e3b0] hover:bg-[#2a1b0d] hover:text-[#fff1c7]">
            <Link href="/account" prefetch={false}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Account
            </Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        <div className="mb-4 border border-[#5f4526] bg-[#15100a] p-4 md:p-5">
          <div className="flex items-center gap-3 text-[#e2aa4a]">
            <UserCircle2 className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-[0.18em]">{eyebrow}</span>
          </div>
          <h1 className="mt-3 font-serif text-3xl font-semibold leading-tight text-[#fff1c7] md:text-4xl">
            {title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#cbb58b]">
            {detail}
          </p>
        </div>
        {children}
      </section>
    </main>
  );
}

export function ProfileSetupFallback() {
  return (
    <ProfileShell eyebrow="Setup required" title="Profile management is waiting on auth">
      <div className="border border-[#7d5a2e] bg-[#181009] p-6">
        <div className="flex items-center gap-3 text-[#e2aa4a]">
          <ShieldCheck className="h-5 w-5" />
          <h2 className="font-serif text-2xl text-[#fff1c7]">Account system not connected</h2>
        </div>
        <p className="mt-4 text-sm leading-6 text-[#c7b288]">
          Add the Clerk publishable key and secret key, then restart the dev server to test profile management.
        </p>
      </div>
    </ProfileShell>
  );
}

export function ProfileManagementPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const displayName = getAccountDisplayName({
    displayName: user?.fullName ?? user?.firstName ?? null,
    email: user?.primaryEmailAddress?.emailAddress ?? null,
  });

  if (!isLoaded) {
    return (
      <ProfileShell>
        <div className="border border-[#5f4526] bg-[#15100a] p-6 text-[#c7b288]">
          Warming the profile vault...
        </div>
      </ProfileShell>
    );
  }

  if (!isSignedIn) {
    return (
      <ProfileShell title="Sign in for your forge profile" detail="Profile controls unlock once CardForge can connect your account.">
        <div className="border border-[#5f4526] bg-[#15100a] p-4">
          <h2 className="font-serif text-xl text-[#fff1c7]">Connect your account</h2>
          <p className="mt-3 text-sm leading-5 text-[#c7b288]">
            Sign in to manage identity, security, export access, and local custom-art permissions.
          </p>
          <SignInButton mode="modal">
            <Button className="mt-5 bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]">
              Sign in
            </Button>
          </SignInButton>
        </div>
      </ProfileShell>
    );
  }

  return (
    <ProfileShell
      eyebrow="Profile controls"
      title={displayName ? `${toPossessiveName(displayName)} CardForge profile` : 'Your CardForge profile'}
      detail="Compact account controls for identity, security, and connected sign-in methods."
    >
      <div className="grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="border border-[#5f4526] bg-[#15100a] p-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#a98a55]">Settings</p>
            <p className="break-words text-sm text-[#ffe7ad]">{user?.primaryEmailAddress?.emailAddress}</p>
          </div>
          <div className="mt-4 divide-y divide-[#4a3823] border-y border-[#4a3823]">
            <div className="flex items-start gap-3 py-3">
              <UserCircle2 className="mt-0.5 h-4 w-4 text-[#e2aa4a]" />
              <div>
                <p className="text-sm font-medium text-[#fff1c7]">Identity</p>
                <p className="text-xs leading-5 text-[#bfa97d]">Name, avatar, and email addresses.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 py-3">
              <KeyRound className="mt-0.5 h-4 w-4 text-[#e2aa4a]" />
              <div>
                <p className="text-sm font-medium text-[#fff1c7]">Security</p>
                <p className="text-xs leading-5 text-[#bfa97d]">Password, providers, and active sessions.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 py-3">
              <FolderOpen className="mt-0.5 h-4 w-4 text-[#e2aa4a]" />
              <div>
                <p className="text-sm font-medium text-[#fff1c7]">Local assets</p>
                <p className="text-xs leading-5 text-[#bfa97d]">Custom art is browser-local after sign-in.</p>
              </div>
            </div>
          </div>
          <Button asChild variant="outline" className="mt-4 w-full border-[#d8b365]/70 bg-transparent text-[#f8e3b0] hover:bg-[#2a1b0d] hover:text-[#fff1c7]">
            <Link href="/account" prefetch={false}>Open forge summary</Link>
          </Button>
        </aside>
        <div className="min-w-0">
          <UserProfile routing="hash" appearance={clerkAppearance} />
        </div>
      </div>
    </ProfileShell>
  );
}
