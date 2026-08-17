import { resolve } from 'node:path';

import { expect, test, type Page } from '@playwright/test';
import axe from 'axe-core';

import type {
  DeveloperCockpitView,
  SocialCampaign,
} from '@/features/developer-cockpit/model';
import { DEFAULT_MARKETING_STRATEGY } from '@/features/marketing/model';

const READY_TIMEOUT = 120_000;
const mediaFixture = resolve(
  process.cwd(),
  'public/site-fallbacks/showcase/cardforge-workshop-cover.webp',
);

const baseCampaign = {
  id: 'campaign-1',
  contributorId: 'developer-1',
  contributorEmail: 'developer@example.com',
  contributorName: 'CardForge Contributor',
  title: 'Developer cockpit release proof',
  objective: 'Show how CardForge turns shipped work into a reviewable campaign package.',
  destinationUrl: 'https://cardforges.com/developer',
  productionNote: 'PR #88 proof and release context.',
  variants: [{
    service: 'facebook',
    text: 'Build the feature, preserve the proof, and prepare the story.',
    attachments: [{
      id: 'attachment-1', mediaId: '11111111-1111-4111-8111-111111111111', derivativeId: null, displayOrder: 0, captionOverride: '', cropIntent: {},
      altText: 'CardForge Developer Cockpit showing a campaign package ready for owner review.',
      media: { id: '11111111-1111-4111-8111-111111111111', previewUrl: '/api/developer-cockpit/media/11111111-1111-4111-8111-111111111111', reviewState: 'needs_review', creatorCredit: 'CardForge', rightsBasis: 'CardForge-owned capture.' },
    }],
  }],
  status: 'submitted',
  requestedPublishAt: '2026-08-01T18:00:00.000Z',
  reviewNote: '',
  reviewedBy: null,
  submittedAt: '2026-07-28T18:00:00.000Z',
  approvedAt: null,
  version: 1,
  createdAt: '2026-07-28T17:00:00.000Z',
  updatedAt: '2026-07-28T18:00:00.000Z', associations: [],
} as unknown as SocialCampaign;

const makeCockpit = ({
  isOwner,
  campaigns,
}: {
  isOwner: boolean;
  campaigns: SocialCampaign[];
}): DeveloperCockpitView => ({
  configured: true,
  extendedContributionsEnabled: false,
  currentUserId: isOwner ? 'owner-1' : 'developer-1',
  isDeveloper: !isOwner,
  isOwner,
  scopes: isOwner
    ? [
      'assets.submit',
      'assets.review',
      'campaigns.draft',
      'campaigns.approve',
      'campaigns.publish',
      'site.propose',
      'site.publish',
      'scopes.manage',
    ]
    : ['assets.submit', 'assets.review', 'campaigns.draft'],
  campaigns,
  campaignMedia: [],
  campaignMediaSummary: { mediaCount: 0, protectedBytes: 0, derivativeBytes: 0, unusedMediaCount: 0 },
  campaignMediaPage: { total: 0, page: 1, pageSize: 24 },
  publishJobs: [],
  siteProposals: [],
  siteContentBlocks: [],
  profiles: [],
  marketingStrategy: DEFAULT_MARKETING_STRATEGY,
  marketingCampaigns: [],
});

async function mockCockpit(page: Page, cockpit: DeveloperCockpitView) {
  let activeCockpit = cockpit;
  await page.route('**/api/developer-cockpit', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ cockpit: activeCockpit }),
    });
  });
  await page.route('**/api/developer-cockpit/media/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      path: mediaFixture,
    });
  });
  return (nextCockpit: DeveloperCockpitView) => { activeCockpit = nextCockpit; };
}

async function expectNoWcagViolations(page: Page) {
  await page.addScriptTag({ content: axe.source });
  const violations = await page.evaluate(async () => {
    const axeWindow = window as typeof window & {
      axe: {
        run: (options: {
          runOnly: { type: 'tag'; values: string[] };
        }) => Promise<{
          violations: Array<{ id: string; nodes: unknown[] }>;
        }>;
      };
    };
    const result = await axeWindow.axe.run({
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa'],
      },
    });
    return result.violations.map((violation) => ({
      id: violation.id,
      nodes: violation.nodes.length,
    }));
  });
  expect(violations).toEqual([]);
}

test.describe('developer cockpit UX audit', () => {
  test('guides a contributor from an empty workspace to a production-ready draft', async ({ page }) => {
    await mockCockpit(page, makeCockpit({ isOwner: false, campaigns: [] }));
    await page.goto('/developer/cockpit', {
      waitUntil: 'domcontentloaded',
      timeout: READY_TIMEOUT,
    });

    await page.getByRole('tab', { name: 'Campaigns', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Build a campaign package', exact: true })).toBeVisible();
    await expect(page.getByText('0 of 5 package sections ready', { exact: true })).toBeVisible();

    const saveDraft = page.getByRole('button', {
      name: 'Create campaign draft',
      exact: true,
    });
    await expect(saveDraft).toBeDisabled();

    await page.getByPlaceholder('Founder workflow proof', { exact: true }).fill('Continuous production proof');
    await page
      .getByPlaceholder('What should someone understand or do after seeing this?', { exact: true })
      .fill('Show that meaningful work leaves behind a reusable campaign package.');
    await page
      .getByLabel('Facebook post copy', { exact: true })
      .fill('Working code can naturally become an owner-reviewed CardForge story.');

    await expect(saveDraft).toBeEnabled();
    await expect(page.getByText('2 of 5 package sections ready', { exact: true })).toBeVisible();

    await page
      .getByPlaceholder('Release, feature, proof, or review context.', { exact: true })
      .fill('PR #89 proof for the release review.');
    await expect(page.getByText('3 of 5 package sections ready', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Add channel variant', exact: true }).click();
    const copyStarter = page.getByRole('button', {
      name: 'Start from primary copy',
      exact: true,
    });
    await expect(copyStarter).toBeVisible();
    await copyStarter.click();
    await expect(page.getByLabel('Instagram post copy', { exact: true })).toHaveValue(
      'Working code can naturally become an owner-reviewed CardForge story.',
    );

    await expect(page.getByText('Approve package and make media public', { exact: true })).toHaveCount(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByLabel('Cockpit section', { exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Campaigns', exact: true })).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expectNoWcagViolations(page);
  });

  test('lets an owner review media proof and continue after approval without changing queues', async ({ page }) => {
    const submittedCockpit = makeCockpit({
      isOwner: true,
      campaigns: [baseCampaign],
    });
    const approvedCampaign: SocialCampaign = {
      ...baseCampaign,
      status: 'approved',
      approvedAt: '2026-07-28T19:00:00.000Z',
      reviewedBy: 'owner-1',
      version: 2,
      variants: baseCampaign.variants.map((variant) => ({
        ...variant,
        attachments: variant.attachments.map((attachment) => ({
          ...attachment,
          media: { ...attachment.media, reviewState: 'public' },
        })),
      })),
    };
    const approvedCockpit = makeCockpit({
      isOwner: true,
      campaigns: [approvedCampaign],
    });

    const setCockpit = await mockCockpit(page, submittedCockpit);
    await page.route('**/api/developer-cockpit/campaigns', async (route) => {
      setCockpit(approvedCockpit);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ campaign: approvedCampaign, allowedNextActions: ['provider_draft', 'scheduled'] }),
      });
    });
    await page.goto('/developer/cockpit', {
      waitUntil: 'domcontentloaded',
      timeout: READY_TIMEOUT,
    });

    await page.getByRole('tab', { name: 'Campaigns', exact: true }).click();
    await expect(page.getByLabel('Filter campaign packages', { exact: true })).toHaveValue('needs_action');
    await expect(page.getByRole('heading', {
      name: 'Developer cockpit release proof',
      exact: true,
    })).toBeVisible();
    await expect(page.getByRole('img', {
      name: 'CardForge Developer Cockpit showing a campaign package ready for owner review.',
      exact: true,
    })).toBeVisible();
    await expect(page.getByText('Release and review context', { exact: true })).toBeVisible();
    await expect(page.getByText('Development associations', { exact: true })).toBeVisible();

    await page.getByRole('button', {
      name: 'Approve package and make media public',
      exact: true,
    }).click();
    const approvalDialog = page.getByRole('alertdialog');
    await expect(approvalDialog).toBeVisible();
    await approvalDialog.getByRole('button', {
      name: 'Approve package',
      exact: true,
    }).click();

    await expect(page.getByRole('heading', {
      name: 'Developer cockpit release proof',
      exact: true,
    })).toBeVisible();
    await expect(page.getByText(
      'The package and media are approved. Provider setup is the next owner action.',
      { exact: true },
    )).toBeVisible();
    await expect(page.getByText('Owner publishing controls', { exact: true })).toBeVisible();
    await expect(page.getByText('public · CardForge', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Filter campaign packages', { exact: true })).toHaveValue('needs_action');
    await expectNoWcagViolations(page);
  });
});
