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
  description: 'See small card sets made inside CardForge and how one shared design keeps every card together.',
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
      <section className="border-b border-[var(--public-border)] bg-[var(--public-obsidian)] px-5 py-10 md:px-8 md:py-14">
        <div className="mx-auto max-w-6xl">
          <p className="text-base font-semibold text-[var(--public-brass)]">Made with CardForge</p>
          <h1 className="mt-2 max-w-4xl font-serif text-4xl font-semibold leading-tight text-[var(--public-ivory)] md:text-5xl">
            See what one design can become.
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-[var(--public-muted-text)]">
            See a few small sets made inside CardForge. The words and pictures change, while the shared design keeps every card feeling like part of the same family.
          </p>
        </div>
      </section>
      <section aria-label="Rendered CardForge example sets" className="bg-[var(--public-charcoal)] px-5 py-10 md:px-8 md:py-12">
        <div className="mx-auto max-w-6xl">
          <LiveExampleGallery />
        </div>
      </section>
    </PublicSiteShell>
  );
}
