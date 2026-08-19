import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('workspace-scoped data loading', () => {
  it('keeps Owner Console startup to overview-owned stores', () => {
    const store = readSource('src/features/owner/lib/ownerConsoleStore.ts');
    const route = readSource('src/app/api/owner/console/route.ts');
    const page = readSource('src/features/owner/components/OwnerConsolePage.tsx');
    const inbox = readSource('src/features/owner/components/OwnerInboxPanel.tsx');

    const overviewBody = store.slice(store.indexOf('getOwnerConsoleOverviewPayload'), store.indexOf('getOwnerSiteControlPayload'));
    expect(overviewBody).toContain('getBusinessIdentity()');
    expect(overviewBody).toContain('getRoadmapAdminItems()');
    expect(overviewBody).toContain('getOwnerDatabaseMetrics()');
    expect(overviewBody).not.toContain('getSiteContentBlocks()');
    expect(overviewBody).not.toContain('getSiteMedia()');
    expect(overviewBody).not.toContain('getLegalDocuments()');
    expect(overviewBody).not.toContain('getContactRequests()');
    expect(route).toContain("scope === 'site'");
    expect(route).toContain('getOwnerConsoleOverviewPayload');
    expect(page).toContain('loadSite');
    expect(page).toContain("workspace === 'site' || workspace === 'governance'");
    expect(page).toContain('<OwnerInboxPanel />');
    expect(inbox).toContain("fetch('/api/owner/contact-requests'");
  });

  it('does not rebuild Owner inbox and database metrics after site mutations', () => {
    const route = readSource('src/app/api/owner/console/route.ts');
    const media = readSource('src/app/api/owner/site-media/[slot]/route.ts');
    const restore = readSource('src/app/api/owner/site-media/[slot]/restore/route.ts');

    expect(route).toContain('getOwnerSiteConsolePayload()');
    expect(route).not.toContain('console: await getOwnerConsolePayload()');
    expect(media).toContain('getOwnerSiteConsolePayload');
    expect(restore).toContain('getOwnerSiteConsolePayload');
  });

  it('loads Developer Campaign and Site workspaces only when their tabs are opened', () => {
    const store = readSource('src/features/developer-cockpit/server/cockpitStore.ts');
    const route = readSource('src/app/api/developer-cockpit/route.ts');
    const page = readSource('src/features/developer-cockpit/components/DeveloperCockpitPage.tsx');

    const bootstrapBody = store.slice(store.indexOf('getDeveloperCockpitBootstrap'), store.indexOf('getDeveloperCampaignWorkspace'));
    expect(bootstrapBody).toContain('getMarketingContributorContext()');
    expect(bootstrapBody).not.toContain('fetchCampaigns(access)');
    expect(bootstrapBody).not.toContain('fetchSiteProposals(access)');
    expect(bootstrapBody).not.toContain('getAuthorizedCampaignMediaPage');
    expect(bootstrapBody).not.toContain('getSiteContentBlocks()');
    expect(route).toContain("scope === 'campaigns'");
    expect(route).toContain("scope === 'site'");
    expect(page).toContain("activeTab === 'campaigns' || activeTab === 'campaign-media'");
    expect(page).toContain("activeTab === 'site'");
    expect(page).toContain('loadDeveloperCampaignWorkspace');
    expect(page).toContain('loadDeveloperSiteWorkspace');
  });

  it('returns only the owning workspace after Developer mutations', () => {
    const proposalRoute = readSource('src/app/api/developer-cockpit/site-proposals/route.ts');
    const mediaRoute = readSource('src/app/api/developer-cockpit/media/[mediaId]/route.ts');
    const client = readSource('src/features/developer-cockpit/client/api.ts');

    expect(proposalRoute).toContain('getDeveloperSiteWorkspace(access)');
    expect(proposalRoute).not.toContain('getDeveloperCockpitView(access)');
    expect(client).toContain('Promise<DeveloperSiteWorkspaceView>');
    expect(mediaRoute).not.toContain('getDeveloperCockpitView');
    expect(mediaRoute).toContain('createNoStoreJsonResponse({ cockpit: true })');
  });

  it('keeps Marketing consumers on the Campaign workspace instead of the Cockpit bootstrap', () => {
    const marketingClient = readSource('src/features/marketing-content/client/api.ts');
    expect(marketingClient).toContain("fetch('/api/developer-cockpit?scope=campaigns'");
    expect(marketingClient).toContain('body.campaigns');
  });
});
