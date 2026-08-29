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

  it('loads Campaign and Site contribution work only inside their owning surfaces', () => {
    const campaignRoute = readSource('src/app/api/marketing-content/route.ts');
    const siteRoute = readSource('src/app/api/site-proposals/route.ts');
    const campaignWorkspace = readSource('src/features/marketing-content/server/workspace.ts');
    const siteWorkspace = readSource('src/features/developer-cockpit/server/cockpitStore.ts');
    const campaignLibrary = readSource('src/features/marketing-content/components/CampaignLibraryWorkspace.tsx');
    const contributorProfile = readSource('src/app/account/_components/ContributorProfilePanel.tsx');

    expect(campaignRoute).toContain('getMarketingContentWorkspace(access, {');
    expect(campaignWorkspace).toContain('getAuthorizedCampaignMediaPage');
    expect(campaignWorkspace).not.toContain('fetchSiteProposals(access)');
    expect(campaignWorkspace).not.toContain('getSiteContentBlocks()');
    expect(siteRoute).toContain('getDeveloperSiteWorkspace(access)');
    expect(siteWorkspace).toContain('fetchSiteProposals(access)');
    expect(siteWorkspace).not.toContain('getAuthorizedCampaignMediaPage');
    expect(campaignLibrary).toContain('loadMarketingContentWorkspace');
    expect(contributorProfile).toContain('canProposeSite ? loadDeveloperSiteWorkspace()');
  });

  it('returns only the owning workspace after contribution mutations', () => {
    const proposalRoute = readSource('src/app/api/site-proposals/route.ts');
    const mediaRoute = readSource('src/app/api/marketing-content/media/[mediaId]/route.ts');
    const client = readSource('src/features/developer-cockpit/client/api.ts');

    expect(proposalRoute).toContain('getDeveloperSiteWorkspace(access)');
    expect(client).toContain('Promise<DeveloperSiteWorkspaceView>');
    expect(mediaRoute).toContain('createNoStoreJsonResponse({ updated: true })');
    expect(mediaRoute).toContain('createNoStoreJsonResponse({ deleted: true })');
  });

  it('keeps Marketing consumers on the Campaign workspace instead of the combined bootstrap', () => {
    const marketingClient = readSource('src/features/marketing-content/client/api.ts');
    expect(marketingClient).toContain("fetch('/api/marketing-content'");
    expect(marketingClient).not.toContain('/api/developer-cockpit');
    expect(marketingClient).toContain('body.campaigns');
  });
});
