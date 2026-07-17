import type { Metadata } from 'next';

import { getCachedBusinessIdentity } from '@/features/business-identity/server';
import { LiveExampleGallery, PublicSiteShell } from '@/features/public-site/client';
import {
  createBreadcrumbStructuredData,
  StructuredData,
} from '@/features/public-site/server';
import { createPageMetadata } from '@/shared/siteMetadata';

export const metadata: Metadata = createPageMetadata({
  title: 'Complete Card Set Examples',
  description: 'Review complete first-party CardForge demonstration sets rendered from shipped templates and structured rows.',
  path: '/examples',
});

export default async function ExamplesPage() {
  const businessIdentity = await getCachedBusinessIdentity();

  return (
    <PublicSiteShell businessIdentity={businessIdentity} currentPath="/examples">
      <StructuredData value={createBreadcrumbStructuredData(businessIdentity, [
        { name: 'Home', path: '/' },
        { name: 'Complete Card Set Examples', path: '/examples' },
      ])} />
      <section className="bg-[var(--public-ivory)] px-5 py-14 md:px-8 md:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="text-base font-semibold uppercase tracking-[0.16em] text-[#76551c]">Complete sets</p>
          <h1 className="mt-3 max-w-4xl font-serif text-4xl font-semibold leading-tight text-[var(--public-text)] md:text-6xl">
            Complete Card Set Examples
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-[#5f5548]">
            These are small, first-party CardForge demonstrations. Every shown card comes from a reviewed data row and a template loaded from the same shipped runtime catalog used by the Studio.
          </p>
        </div>
      </section>
      <section aria-label="Rendered CardForge example sets" className="bg-[#f0e5d2] px-5 py-12 md:px-8 md:py-16">
        <div className="mx-auto max-w-6xl">
          <LiveExampleGallery />
        </div>
      </section>
    </PublicSiteShell>
  );
}
