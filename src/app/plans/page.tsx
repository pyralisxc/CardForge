import { ContributorPublicAuthSlot } from '@/features/contributor-access/server';
import { CardForgeAppProviders } from '@/features/app-shell/server';
import { getCachedBusinessIdentity } from '@/features/business-identity/server';
import {
  applyProductAccessPricePresentation,
  getMcpAllowances,
} from '@/features/mcp-usage/server';
import { getCurrentProductAccessPricePresentation } from '@/features/billing/server';
import { PlansPageContent } from '@/features/public-site/client';
import {
  ConfiguredPublicSiteShell,
  createBreadcrumbStructuredData,
  createSiteContentMap,
  getCachedSiteContentBlocks,
  StructuredData,
} from '@/features/public-site/server';
import { isClerkServerConfigPresent } from '@/infrastructure/auth/clerk';
import { OwnerPublicSiteControlsSlot } from '@/app/_components/OwnerPublicSiteControlsSlot';
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
  const [businessIdentity, basePlans, productAccessPrices] = await Promise.all([
    getCachedBusinessIdentity(),
    getMcpAllowances(),
    getCurrentProductAccessPricePresentation(),
  ]);
  const plans = applyProductAccessPricePresentation(basePlans, productAccessPrices);
  return (
    <CardForgeAppProviders>
      <ConfiguredPublicSiteShell businessIdentity={businessIdentity} accountSlot={authConfigured ? <ContributorPublicAuthSlot /> : undefined} currentPath="/plans" ownerControls={<OwnerPublicSiteControlsSlot currentPath="/plans" />}>
        <StructuredData value={createBreadcrumbStructuredData(businessIdentity, [
          { name: 'Home', path: '/' },
          { name: 'Plans', path: '/plans' },
        ])} />
        <PlansPageContent plans={plans} />
      </ConfiguredPublicSiteShell>
    </CardForgeAppProviders>
  );
}