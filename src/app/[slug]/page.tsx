import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { CardForgeAppProviders } from '@/features/app-shell/server';
import { ContributorPublicAuthSlot } from '@/features/contributor-access/server';
import { getCachedBusinessIdentity } from '@/features/business-identity/server';
import { PublicSiteShell } from '@/features/public-site/client/shell';
import { ComposedPageContent } from '@/features/public-site/client/landing';
import { getCachedPublicSiteConfiguration, getCachedSiteMedia, isPublicSitePageSlug } from '@/features/public-site/server';
import { isClerkServerConfigPresent } from '@/infrastructure/auth/clerk';
import { createPageMetadata } from '@/shared/siteMetadata';
import { OwnerPublicSiteControlsSlot } from '@/app/_components/OwnerPublicSiteControlsSlot';

type Props = { params: Promise<{ slug: string }> };

const readPage = async (slug: string) => {
  if (!isPublicSitePageSlug(slug)) notFound();
  const settings = await getCachedPublicSiteConfiguration();
  const page = settings.pages?.find((item) => item.slug === slug && item.published);
  if (!page) notFound();
  return { page, settings };
};

export async function generateMetadata({ params }: Props) {
  const { page } = await readPage((await params).slug);
  return createPageMetadata({ title: page.title, description: page.description,
    keywords: page.keywords, path: `/${page.slug}` });
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
