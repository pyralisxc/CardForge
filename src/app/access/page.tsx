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
  ['Explore Free', 'Try the editor, build templates, import data, preview generated cards, and keep local project data in your browser or downloaded files.', 'Try the Studio', '/studio'],
  ['Founder Beta', 'Founder Beta is the active early-access path while the current wave has seats. Eligible accounts can test clean export during the beta period.', 'Check beta access', '/account'],
  ['Creator Pass', 'Creator Pass is the CardForge product subscription for ongoing production access, clean exports, and the expanding reviewed library.', 'Manage access', '/account'],
  ['Developer', 'Developer participation is a separate contributor path. Approved contributors improve reviewed shared assets; it is not a customer subscription tier.', 'Developer program', '/developer'],
] as const;

export default async function AccessPage() {
  const businessIdentity = await getCachedBusinessIdentity();

  return (
    <PublicSiteShell businessIdentity={businessIdentity} accountSlot={<PublicAuthControls />} currentPath="/access">
      <StructuredData value={createBreadcrumbStructuredData(businessIdentity, [
        { name: 'Home', path: '/' },
        { name: 'Access', path: '/access' },
      ])} />
      <section className="bg-[var(--public-ivory)] px-5 py-14 md:px-8 md:py-20">
        <div className="mx-auto max-w-5xl">
          <p className="text-base font-semibold uppercase tracking-[0.14em] text-[#76551c]">Product access</p>
          <h1 className="mt-3 max-w-4xl font-[var(--public-font-display)] text-4xl font-semibold leading-tight text-[var(--public-text)] md:text-6xl">
            Start free, then choose production access when you need it.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-[#5f5548]">
            Exploration, beta access, the Creator Pass product subscription, and developer participation each have a distinct purpose.
          </p>
        </div>
      </section>

      <section className="bg-[#f0e5d2] px-5 py-12 md:px-8 md:py-16">
        <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-2">
          {accessLevels.map(([title, copy, action, href]) => (
            <article key={title} className="rounded-[var(--public-radius)] border border-[#ad9d84] bg-[var(--public-ivory)] p-6">
              <h2 className="font-[var(--public-font-display)] text-3xl font-semibold text-[var(--public-text)]">{title}</h2>
              <p className="mt-4 text-base leading-7 text-[#5f5548]">{copy}</p>
              <Link href={href} prefetch={false} className="mt-5 inline-flex min-h-11 items-center text-base font-bold text-[#654817] hover:text-[var(--public-text)]">{action}</Link>
            </article>
          ))}
        </div>
      </section>
    </PublicSiteShell>
  );
}
