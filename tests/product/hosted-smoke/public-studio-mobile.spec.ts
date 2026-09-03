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
