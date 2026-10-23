import { Suspense } from 'react';
import { notFound, permanentRedirect } from 'next/navigation';
import { CardForgeAppProviders } from '@/features/app-shell/server';
import { ContributorPublicAuthSlot } from '@/features/contributor-access/server';
import { getCachedBusinessIdentity } from '@/features/business-identity/server';
import { PublicSiteShell } from '@/features/public-site/client/shell';
import { ComposedPageContent } from '@/features/public-site/client/landing';
import { getCachedSiteMedia, isPublicSitePageSlug } from '@/features/public-site/server';
import { resolveLiveWebsitePresentation } from '@/features/public-site/server/websitePresentationResolver';
import { readActivatedWebsiteRedirect } from '@/features/public-site/server/websiteEditionStore';
import { isClerkServerConfigPresent } from '@/infrastructure/auth/clerk';
import { createPageMetadata } from '@/shared/siteMetadata';
import { OwnerPublicSiteControlsSlot } from '@/app/_components/OwnerPublicSiteControlsSlot';

type Props = { params: Promise<{ slug: string }> };

const readPage = async (slug: string) => {
  if (!isPublicSitePageSlug(slug)) notFound();
  const resolved = await resolveLiveWebsitePresentation();
  const settings = resolved.configuration;
  const page = settings.pages?.find((item) => item.slug === slug && item.published);
  if (!page) {
    const redirect = !resolved.privatePreview && resolved.generation !== null
      ? await readActivatedWebsiteRedirect(resolved.generation, slug) : null;
    if (redirect) permanentRedirect(redirect);
    notFound();
  }
  return { page, settings, privatePreview: resolved.privatePreview };
};

export async function generateMetadata({ params }: Props) {
  const { page, privatePreview } = await readPage((await params).slug);
  return createPageMetadata({ title: page.title, description: page.description,
    keywords: page.keywords, path: `/${page.slug}`, ...(privatePreview ? { robots: { index: false, follow: false } } : {}) });
}

export default async function OwnerAuthoredPublicPage({ params }: Props) {
  const { page, settings } = await readPage((await params).slug);
  const [businessIdentity, media] = await Promise.all([getCachedBusinessIdentity(), getCachedSiteMedia()]);
  return <CardForgeAppProviders>
    <PublicSiteShell businessIdentity={businessIdentity} siteConfiguration={settings} currentPath={`/${page.slug}`}
      accountSlot={isClerkServerConfigPresent() ? <ContributorPublicAuthSlot /> : undefined}>
      <ComposedPageContent page={page} media={media} />
      <Suspense fallback={null}><OwnerPublicSiteControlsSlot currentPath={`/${page.slug}`} /></Suspense>
    </PublicSiteShell>
  </CardForgeAppProviders>;
}
