import { DeveloperPublicAuthSlot } from '@/features/developer-access/server';
import { CardForgeAppProviders } from '@/features/app-shell/server';
import { getCachedBusinessIdentity } from '@/features/business-identity/server';
import { DeveloperProgramPage } from '@/features/developer-program/client';
import { isClerkServerConfigPresent } from '@/infrastructure/auth/clerk';
import { createPageMetadata } from '@/shared/siteMetadata';
import { ConfiguredPublicSiteShell, createBreadcrumbStructuredData, createSiteContentMap, getCachedSiteContentBlocks, StructuredData } from '@/features/public-site/server';

export async function generateMetadata() {
  const content = createSiteContentMap(await getCachedSiteContentBlocks('developer'));
  return createPageMetadata({
    title: content['developer.meta.title'],
    description: content['developer.meta.description'],
    path: '/developer',
  });
}

export default async function DeveloperPage() {
  const authConfigured = isClerkServerConfigPresent();
  const businessIdentity = await getCachedBusinessIdentity();
  return (
    <CardForgeAppProviders>
      <ConfiguredPublicSiteShell businessIdentity={businessIdentity} accountSlot={authConfigured ? <DeveloperPublicAuthSlot /> : undefined} currentPath="/developer">
        <StructuredData value={createBreadcrumbStructuredData(businessIdentity, [
          { name: 'Home', path: '/' },
          { name: 'Developers', path: '/developer' },
        ])} />
        <DeveloperProgramPage initialAuthConfigured={authConfigured} supportEmail={businessIdentity.supportEmail} />
      </ConfiguredPublicSiteShell>
    </CardForgeAppProviders>
  );
}
