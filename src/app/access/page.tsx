import Link from 'next/link';

import { PublicAuthControls } from '@/features/account/client/auth';
import { getCachedBusinessIdentity } from '@/features/business-identity/server';
import { PublicSiteShell } from '@/features/public-site/client';
import { createBreadcrumbStructuredData, StructuredData } from '@/features/public-site/server';
import { createPageMetadata } from '@/shared/siteMetadata';

export const metadata = createPageMetadata({
  title: 'CardForge Access',
  description: 'Compare free exploration, Founder Beta, Creator Pass product access, and the separate developer contributor path.',
  path: '/access',
});

const accessLevels = [
  ['Try it free', 'Open the Studio, make cards, and see your set come together. Your projects stay in your browser or downloaded files.', 'Try the Studio', '/studio'],
  ['Founder Beta', 'Early access for people helping shape CardForge while the current beta wave still has room.', 'Check beta access', '/account'],
  ['Creator Pass', 'The CardForge product subscription. It unlocks clean downloads and directly supports the business as the Studio grows.', 'Manage access', '/account'],
  ['Build with us', 'A separate path for developers who want to help improve shared CardForge tools and artwork.', 'Developer program', '/developer'],
] as const;

export default async function AccessPage() {
  const businessIdentity = await getCachedBusinessIdentity();

  return (
    <PublicSiteShell businessIdentity={businessIdentity} accountSlot={<PublicAuthControls />} currentPath="/access">
      <StructuredData value={createBreadcrumbStructuredData(businessIdentity, [
        { name: 'Home', path: '/' },
        { name: 'Access', path: '/access' },
      ])} />
      <section className="border-b border-[var(--public-border)] bg-[var(--public-obsidian)] px-5 py-10 md:px-8 md:py-14">
        <div className="mx-auto max-w-5xl">
          <p className="text-base font-semibold text-[var(--public-brass)]">Pick the path that fits</p>
          <h1 className="mt-2 max-w-4xl font-[var(--public-font-display)] text-4xl font-semibold leading-tight text-[var(--public-ivory)] md:text-5xl">
            Try CardForge first. Subscribe when it earns its place.
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-[var(--public-muted-text)]">
            You can explore before paying. Creator Pass is for people using the product, while personal support and developer participation stay separate.
          </p>
        </div>
      </section>

      <section className="bg-[var(--public-charcoal)] px-5 py-10 md:px-8 md:py-12">
        <div className="mx-auto grid max-w-6xl gap-px overflow-hidden border border-[var(--public-border)] bg-[var(--public-border)] md:grid-cols-2">
          {accessLevels.map(([title, copy, action, href]) => (
            <article key={title} className="bg-[var(--public-surface)] p-6">
              <h2 className="font-[var(--public-font-display)] text-3xl font-semibold text-[var(--public-ivory)]">{title}</h2>
              <p className="mt-3 text-base leading-7 text-[var(--public-muted-text)]">{copy}</p>
              <Link href={href} prefetch={false} className="mt-4 inline-flex min-h-11 items-center text-base font-bold text-[var(--public-brass)] hover:text-[var(--public-ivory)]">{action}</Link>
            </article>
          ))}
        </div>
      </section>
    </PublicSiteShell>
  );
}
