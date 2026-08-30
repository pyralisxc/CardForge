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
  test('keeps contribution work inside the responsive Library environment', async ({ page }) => {
    await page.goto('/account?section=library&scope=pipeline', { waitUntil: 'domcontentloaded', timeout: READY_TIMEOUT });

    await expect(page.getByRole('heading', { name: 'Your materials and work' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Library scopes' })).toBeVisible();
    await expect(page.getByText('Developer', { exact: true })).toHaveCount(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('navigation', { name: 'CardForge zones' })).toBeHidden();
    await expect(page.getByRole('navigation', { name: 'Library scopes' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expectNoWcagViolations(page);
  });

  test('the retired Developer workspace is no longer a public application route', async ({ page }) => {
    const response = await page.goto('/developer/cockpit', { waitUntil: 'domcontentloaded', timeout: READY_TIMEOUT });
    expect(response?.status()).toBe(404);
  });
});
