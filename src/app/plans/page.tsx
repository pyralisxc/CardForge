import { DeveloperPublicAuthSlot } from '@/features/developer-access/server';
import { CardForgeAppProviders } from '@/features/app-shell/server';
import { getCachedBusinessIdentity } from '@/features/business-identity/server';
import { getMcpAllowances } from '@/features/mcp-usage/server';
import { PlansPageContent } from '@/features/public-site/client';
import {
  ConfiguredPublicSiteShell,
  createBreadcrumbStructuredData,
  createSiteContentMap,
  getCachedSiteContentBlocks,
  StructuredData,
} from '@/features/public-site/server';
import { isClerkServerConfigPresent } from '@/infrastructure/auth/clerk';
import { createPageMetadata } from '@/shared/siteMetadata';

export async function generateMetadata() {
  const content = createSiteContentMap(await getCachedSiteContentBlocks('plans'));
  return createPageMetadata({
    title: content['plans.meta.title'],
    description: content['plans.meta.description'],
    path: '/plans',
  });
}

export default async function PlansPage() {
  const authConfigured = isClerkServerConfigPresent();
  const [businessIdentity, plans] = await Promise.all([
    getCachedBusinessIdentity(),
    getMcpAllowances(),
  ]);
  return (
    <CardForgeAppProviders>
      <ConfiguredPublicSiteShell businessIdentity={businessIdentity} accountSlot={authConfigured ? <DeveloperPublicAuthSlot /> : undefined} currentPath="/plans">
        <StructuredData value={createBreadcrumbStructuredData(businessIdentity, [
          { name: 'Home', path: '/' },
          { name: 'Plans', path: '/plans' },
        ])} />
        <PlansPageContent plans={plans} />
      </ConfiguredPublicSiteShell>
    </CardForgeAppProviders>
  );
}
