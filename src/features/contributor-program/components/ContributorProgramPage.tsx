"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import {
  ArrowRight,
  CheckCircle2,
  Megaphone,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAccountEntitlement } from '@/features/account/client/entitlement';
import { createContributorRequestMailto } from '@/features/contact/client/links';
import { ContactRequestForm } from '@/features/contact/client/form';
import { useSiteContent } from '@/features/public-site/client/context';
import { createAuthRouteHref } from '@/infrastructure/auth/clerk';

const standards = [
  'Every contribution has a named owner, source notes, and a visible review state.',
  'Personal workspace uploads stay separate from CardForge-owned contribution packages.',
  'Campaign captures stay private until an owner approves their public publishing media.',
  'Contributors prepare reviewable work; the owner retains channel bindings, schedules, and publication authority.',
];

export function ContributorProgramPage({
  initialAuthConfigured = false,
  supportEmail,
}: {
  initialAuthConfigured?: boolean;
  supportEmail?: string | null;
}) {
  const siteContent = useSiteContent();
  const contributionLanes = [
    { icon: UploadCloud, title: siteContent['contributor.lane.assets.title'], copy: siteContent['contributor.lane.assets.body'] },
    { icon: Megaphone, title: siteContent['contributor.lane.campaigns.title'], copy: siteContent['contributor.lane.campaigns.body'] },
  ];
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
    && (entitlement.accessMode === 'contributor' || entitlement.ownerAccess.isOwner);
  const requestMailto = useMemo(
    () => createContributorRequestMailto({ accountEmail, supportEmail }),
    [accountEmail, supportEmail],
  );

  return (
    <div className="min-h-screen bg-[var(--cf-canvas)] text-[var(--cf-text)]">
      {entitlement.authConfigured ? <ClerkIdentityBridge onChange={setIdentity} /> : null}
      <section className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <div className="border border-[var(--cf-border-strong)] bg-[var(--cf-surface)] p-5 md:p-7">
            <div className="flex items-center gap-3 text-[var(--cf-accent-strong)]">
              <Sparkles className="h-5 w-5" />
              <span data-site-content-slug="contributor.hero.eyebrow" className="text-xs font-semibold uppercase tracking-[0.18em]">{siteContent['contributor.hero.eyebrow']}</span>
            </div>
            <h1 data-site-content-slug="contributor.hero.headline" className="mt-4 font-serif text-4xl font-semibold leading-tight text-[var(--cf-text-strong)] md:text-5xl">
              {siteContent['contributor.hero.headline']}
            </h1>
            <p data-site-content-slug="contributor.hero.body" className="mt-4 max-w-3xl text-sm leading-6 text-[var(--cf-text-muted)]">
              {siteContent['contributor.hero.body']}
            </p>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {contributionLanes.map(({ icon: Icon, title, copy }) => (
                <article key={title} className="border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-3">
                  <Icon className="h-4 w-4 text-[var(--cf-accent-strong)]" />
                  <h2 className="mt-3 font-serif text-lg text-[var(--cf-accent-text)]">{title}</h2>
                  <p className="mt-2 text-sm leading-5 text-[var(--cf-text-muted)]">{copy}</p>
                </article>
              ))}
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              {isContributor ? (
                <Button asChild className="bg-[var(--cf-accent-strong)] text-[var(--cf-accent-contrast)] hover:bg-[var(--cf-accent)]">
                  <Link href="/account?section=library&scope=pipeline">
                    Open contributor Library <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              ) : !entitlement.authConfigured ? (
                <Button disabled variant="outline" className="border-[#755632] bg-transparent text-[#bea97f]">
                  Account setup incomplete
                </Button>
              ) : !signedIn ? (
                <>
                  <Button asChild className="bg-[var(--cf-accent-strong)] text-[var(--cf-accent-contrast)] hover:bg-[var(--cf-accent)]">
                    <Link href={createAuthRouteHref('/sign-in', '/contributors')} prefetch={false}>Sign in first</Link>
                  </Button>
                  <Button asChild variant="outline" className="border-[var(--cf-accent)]/70 bg-transparent text-[var(--cf-accent-text)] hover:bg-[var(--cf-surface-hover)] hover:text-[var(--cf-text-strong)]">
                    <Link href={createAuthRouteHref('/sign-up', '/contributors')} prefetch={false}>Create account</Link>
                  </Button>
                </>
              ) : (
                <Button asChild variant="outline" className="border-[var(--cf-accent)]/70 bg-transparent text-[var(--cf-accent-text)] hover:bg-[var(--cf-surface-hover)] hover:text-[var(--cf-text-strong)]">
                  <a href={requestMailto}>
                    Email fallback <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
            {entitlement.authConfigured && signedIn && !isContributor ? (
              <ContactRequestForm
                kind="contributor"
                defaultEmail={accountEmail}
                defaultName=""
                defaultSubject="CardForge Contributor program request"
              />
            ) : null}
          </div>

          <aside className="border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] p-4">
            <div className="flex items-center gap-2 text-[var(--cf-accent-strong)]">
              <ShieldCheck className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.16em]">Scoped contributor access</p>
            </div>
            <p className="mt-3 break-words text-sm text-[var(--cf-accent-text)]">
              {accountEmail ?? 'No signed-in account'}
            </p>
            <p className="mt-3 text-xs leading-5 text-[var(--cf-text-muted)]">
              Contributor access is intentionally scoped. The owner can enable campaign drafting for an active contributor; public-site editing remains owner-only.
            </p>
          </aside>
        </div>

        <section className="mt-5 border border-[var(--cf-border)] bg-[var(--cf-surface)] p-5">
          <h2 data-site-content-slug="contributor.rules.heading" className="font-serif text-2xl text-[var(--cf-text-strong)]">{siteContent['contributor.rules.heading']}</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {standards.map((standard) => (
              <div key={standard} className="flex gap-3 border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#8be0a4]" />
                <p className="text-sm leading-5 text-[var(--cf-text-muted)]">{standard}</p>
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
