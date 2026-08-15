import { DeveloperPublicAuthControls } from '@/features/developer-access/client';
import { CardForgeAppProviders } from '@/features/app-shell/server';
import { getCachedBusinessIdentity } from '@/features/business-identity/server';
import { RoadmapPage } from '@/features/roadmap/client';
import { isClerkServerConfigPresent } from '@/infrastructure/auth/clerk';
import { createPageMetadata } from '@/shared/siteMetadata';
import { ConfiguredPublicSiteShell, createBreadcrumbStructuredData, createSiteContentMap, getCachedSiteContentBlocks, StructuredData } from '@/features/public-site/server';

export async function generateMetadata() {
  const content = createSiteContentMap(await getCachedSiteContentBlocks('roadmap'));
  return createPageMetadata({
    title: content['roadmap.meta.title'],
    description: content['roadmap.meta.description'],
    path: '/roadmap',
  });
}

export default async function ForgeChroniclePage() {
  const authConfigured = isClerkServerConfigPresent();
  const businessIdentity = await getCachedBusinessIdentity();
  return (
    <CardForgeAppProviders>
      <ConfiguredPublicSiteShell businessIdentity={businessIdentity} accountSlot={authConfigured ? <DeveloperPublicAuthControls /> : undefined} currentPath="/roadmap">
        <StructuredData value={createBreadcrumbStructuredData(businessIdentity, [
          { name: 'Home', path: '/' },
          { name: 'Roadmap', path: '/roadmap' },
        ])} />
        <RoadmapPage initialAuthConfigured={authConfigured} supportEmail={businessIdentity.supportEmail} />
      </ConfiguredPublicSiteShell>
    </CardForgeAppProviders>
  );
}
