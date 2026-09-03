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

const declineAnalytics = async (page: Page) => {
  const decline = page.getByRole('button', { name: 'Decline', exact: true });
  await expect(decline).toBeVisible();
  await decline.click();
};

test.describe('hosted release smoke', () => {
  test('opens the public entry point and a guest Studio tool', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await declineAnalytics(page);
    await page.getByRole('link', { name: 'Open your Desk', exact: true }).first().click();
    await expect(page).toHaveURL(/\/account(?:\?|$)/u);
    await expect(page.getByRole('heading', { name: 'Your creative workspace' })).toBeVisible();

    await page.getByRole('button', { name: 'Create your first Set' }).click();
    await page.getByRole('button', { name: 'Fresh Set + Design', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Design Artifacts' })).toBeVisible();
    await page.getByRole('button', { name: 'Close Studio tool' }).click();
    await expect(page.getByRole('dialog', { name: 'Design Artifacts' })).toHaveCount(0);
  });
});

test.describe('hosted mobile release smoke', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('keeps the public-to-Desk path usable on a compact screen', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await declineAnalytics(page);
    await page.getByRole('button', { name: 'Open menu' }).tap();
    const navigation = page.getByRole('navigation', { name: 'Mobile navigation' });
    await expect(navigation).toBeVisible();
    await navigation.getByRole('link', { name: /^Open (?:your )?Desk$/u }).tap();
    await expect(page.getByRole('heading', { name: 'Your creative workspace' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'CardForge zones' })).toBeVisible();
  });
});
