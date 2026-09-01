import { expect, test, type Page } from '@playwright/test';
import axe from 'axe-core';

const READY_TIMEOUT = 120_000;

async function expectNoWcagViolations(page: Page) {
  await page.addScriptTag({ content: axe.source });
  const violations = await page.evaluate(async () => {
    const result = await (window as typeof window & { axe: { run: (options: unknown) => Promise<{ violations: Array<{ id: string; nodes: unknown[] }> }> } }).axe.run({ runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } });
    return result.violations.map((violation) => ({ id: violation.id, nodes: violation.nodes.length }));
  });
  expect(violations).toEqual([]);
}

test.describe('account contribution surfaces', () => {
  test.beforeEach(async ({ page }) => {
    const previewShareUrl = process.env.CARDFORGE_E2E_PREVIEW_SHARE_URL;
    if (previewShareUrl) {
      await page.goto(previewShareUrl, { waitUntil: 'domcontentloaded', timeout: READY_TIMEOUT });
    }
  });

  test('keeps Set focus and Design as one accessible Desk interaction', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/account', { waitUntil: 'domcontentloaded', timeout: READY_TIMEOUT });

    await expect(page.getByRole('heading', { name: 'Your creative workspace' })).toBeVisible();
    await page.getByRole('button', { name: 'Create your first Set' }).click();
    await page.getByRole('button', { name: 'Fresh Set', exact: true }).click();
    await expect(page.locator('[data-home-desk="focused"]')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Inside this Set' })).toBeVisible();

    await page.getByRole('button', { name: 'Design', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Design Artifacts' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Design Artifacts' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Back to Desk' }).click();
    await expect(page.getByRole('heading', { name: 'Your creative workspace' })).toBeVisible();
    await expectNoWcagViolations(page);
  });

  test('translates retired pseudo-surfaces and Studio destination links', async ({ page }) => {
    await page.goto('/account?section=storage', { waitUntil: 'domcontentloaded', timeout: READY_TIMEOUT });
    await expect(page.getByRole('heading', { name: 'Locations & connections' })).toBeVisible();

    await page.goto('/account?section=billing', { waitUntil: 'domcontentloaded', timeout: READY_TIMEOUT });
    await expect(page.getByRole('heading', { name: 'Manage access, billing, and usage' })).toBeVisible();

    await page.goto('/studio', { waitUntil: 'domcontentloaded', timeout: READY_TIMEOUT });
    await expect(page).toHaveURL(/\/account\?tool=design$/);
  });

  test('keeps contribution work inside the responsive Library environment', async ({ page }) => {
    await page.goto('/account?section=library&scope=pipeline', { waitUntil: 'domcontentloaded', timeout: READY_TIMEOUT });

    await expect(page.getByRole('heading', { name: 'Your materials and work' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Library scopes' })).toBeVisible();
    await expect(page.getByText('Contributor', { exact: true })).toHaveCount(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('navigation', { name: 'CardForge zones' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Library scopes' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expectNoWcagViolations(page);
  });

  test('retired account and program routes are cold-cut to 404', async ({ page }) => {
    for (const route of ['/developer', '/developer/cockpit', '/developer-terms', '/profile', '/environment-lab', '/creator-pool']) {
      const response = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: READY_TIMEOUT });
      expect(response?.status(), route).toBe(404);
    }
  });
});
