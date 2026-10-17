import type { PublicSitePage } from '../model/sitePages';
import type { SiteMediaAsset } from '../model/siteMedia';
import { HomepageComposedSection } from './HomepageComposedSection';

/** Shared by public routes and the unpublished responsive canvas. */
export function ComposedPageContent({ page, media }: { page: PublicSitePage; media: SiteMediaAsset[] }) {
  return <>
    <header data-owner-page-id={page.id} className="mx-auto max-w-7xl px-5 py-12 md:px-8 md:py-16">
      <h1 className="font-[var(--public-font-display)] text-4xl font-semibold text-[var(--public-ivory)] md:text-5xl">{page.title}</h1>
      <p className="mt-4 max-w-3xl text-lg leading-8 text-[var(--public-muted-text)]">{page.description}</p>
    </header>
    {page.sections.filter((section) => section.visible).map((section) => (
      <HomepageComposedSection key={section.id} section={section} media={media} />
    ))}
  </>;
}
