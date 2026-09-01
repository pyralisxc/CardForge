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

  it('loads Campaign work in its owning surface and leaves the retired Site proposal boundary closed', () => {
    const campaignRoute = readSource('src/app/api/marketing-content/route.ts');
    const siteRoute = readSource('src/app/api/site-proposals/route.ts');
    const campaignWorkspace = readSource('src/features/marketing-content/server/workspace.ts');
    const campaignLibrary = readSource('src/features/marketing-content/components/CampaignLibraryWorkspace.tsx');
    const contributorProfile = readSource('src/app/account/_components/ContributorProfilePanel.tsx');

    expect(campaignRoute).toContain('getMarketingContentWorkspace(access, {');
    expect(campaignWorkspace).toContain('getAuthorizedCampaignMediaPage');
    expect(campaignWorkspace).not.toContain('fetchSiteProposals(access)');
    expect(campaignWorkspace).not.toContain('getSiteContentBlocks()');
    expect(siteRoute).toContain("'site_proposal_retired'");
    expect(siteRoute).not.toContain('getSiteProposalWorkspace');
    expect(campaignLibrary).toContain('loadMarketingContentWorkspace');
    expect(contributorProfile).not.toContain('loadSiteProposalWorkspace');
  });

  it('returns only the owning workspace after active contribution mutations', () => {
    const proposalRoute = readSource('src/app/api/site-proposals/route.ts');
    const mediaRoute = readSource('src/app/api/marketing-content/media/[mediaId]/route.ts');

    expect(proposalRoute).toContain("'site_proposal_retired'");
    expect(mediaRoute).toContain('createNoStoreJsonResponse({ updated: true })');
    expect(mediaRoute).toContain('createNoStoreJsonResponse({ deleted: true })');
  });

  it('keeps the retired Site proposal grant out of current public, Contributor, and Owner owners', () => {
    const contributorPage = readSource('src/features/contributor-program/components/ContributorProgramPage.tsx');
    const publicContent = readSource('src/features/public-site/model/siteContent.ts');
    const ownerGovernance = readSource('src/features/owner/components/OwnerGovernancePanels.tsx');
    const ownerPeopleRoute = readSource('src/app/api/owner/people/route.ts');
    const contributorModel = readSource('src/features/contributor-access/model.ts');
    const contributorProfiles = readSource('src/features/contributor-access/server/profileStore.ts');

    expect(contributorPage).not.toContain('contributor.lane.site');
    expect(contributorPage).not.toContain('site proposals independently');
    expect(publicContent).not.toContain('contributor.lane.site');
    expect(publicContent).not.toContain('site-copy proposals');
    expect(publicContent).not.toContain('propose public-site improvements');
    expect(ownerGovernance).toContain('Public-site editing remains owner-only.');
    expect(ownerGovernance).not.toContain('campaign drafting and site proposals');
    expect(ownerPeopleRoute).not.toContain('canProposeSiteContent');
    expect(contributorModel).not.toContain('canProposeSiteContent');
    expect(contributorProfiles).not.toContain('can_propose_site_content');
    expect(contributorProfiles).not.toContain('canProposeSiteContent');
  });

  it('keeps Marketing consumers on the Campaign workspace instead of the combined bootstrap', () => {
    const marketingClient = readSource('src/features/marketing-content/client/api.ts');
    expect(marketingClient).toContain("fetch('/api/marketing-content'");
    expect(marketingClient).not.toContain('/api/contributor-cockpit');
    expect(marketingClient).toContain('body.campaigns');
  });
});
