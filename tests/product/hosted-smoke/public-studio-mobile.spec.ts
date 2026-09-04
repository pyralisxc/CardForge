import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  const protectionBypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
  if (!protectionBypass) return;
  const response = await page.request.get('/', {
    headers: {
      'x-vercel-protection-bypass': protectionBypass,
      'x-vercel-set-bypass-cookie': 'true',
    },
  });
  expect(response.ok()).toBe(true);
});

const dismissAnalyticsIfOffered = async (page: Page) => {
  const decline = page.getByRole('button', { name: 'Decline', exact: true });
  await decline.click({ timeout: 3_000 }).catch(() => undefined);
};

test.describe('hosted release smoke', () => {
  test('keeps Profile loading and unavailable access distinct from a verified guest', async ({ page }) => {
    let releaseRequest!: () => void;
    const requestGate = new Promise<void>((resolve) => { releaseRequest = resolve; });
    let unavailable = false;
    await page.route('**/api/account/entitlement', async (route) => {
      await requestGate;
      if (unavailable) await route.abort('failed');
      else await route.continue();
    });
    try {
      await page.goto('/account?section=profile', { waitUntil: 'domcontentloaded' });
      const snapshot = page.getByTestId('profile-snapshot');
      await expect(snapshot).toContainText('Checking account');
      await expect(snapshot).toContainText('Checking access');
      await expect(snapshot).not.toContainText('Guest');
      await expect(snapshot).not.toContainText('Free');

      releaseRequest();
      await expect(snapshot).toContainText('Guest creator');
      await expect(snapshot.getByText('Free', { exact: true })).toBeVisible();

      unavailable = true;
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(snapshot).toContainText('Account unavailable');
      await expect(snapshot).toContainText('Access unavailable');
      await expect(snapshot).not.toContainText('Guest');
      await expect(snapshot).not.toContainText('Free');

      unavailable = false;
      await page.getByRole('button', { name: 'Retry', exact: true }).click();
      await expect(snapshot).toContainText('Guest creator');
      await expect(snapshot.getByText('Free', { exact: true })).toBeVisible();
    } finally {
      releaseRequest();
    }
  });

  test('opens the public entry point and a guest Studio tool', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await dismissAnalyticsIfOffered(page);
    await page.getByRole('link', { name: 'Open your Desk', exact: true }).first().click();
    await expect(page).toHaveURL(/\/account(?:\?|$)/u);
    await expect(page.getByRole('region', { name: 'Open Sets on Desk' })).toBeVisible();

    await page.getByRole('button', { name: 'Create your first Set' }).click();
    await page.getByRole('button', { name: 'Fresh Set + Design', exact: true }).click();
    const designTool = page.getByRole('region', { name: 'Design Artifacts' });
    await expect(designTool).toBeVisible();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(designTool).toHaveCount(0);
  });
});

test.describe('hosted mobile release smoke', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('keeps the public-to-Desk path usable on a compact screen', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await dismissAnalyticsIfOffered(page);
    await page.getByRole('button', { name: 'Open menu' }).tap();
    const navigation = page.getByRole('navigation', { name: 'Mobile navigation' });
    await expect(navigation).toBeVisible();
    await navigation.getByRole('link', { name: /^Open (?:your )?Desk$/u }).tap();
    await expect(page.getByRole('region', { name: 'Open Sets on Desk' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'CardForge zones' })).toBeVisible();
  });
});
