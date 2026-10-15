import { expect, test } from '@playwright/test';
import { openScaleSet, seedGuestScaleWorkspace } from './helpers/projectScaleBrowser';

/**
 * Authenticated-looking screenshots must NEVER be harvested from private users.
 * These shots use the real CardForge browser UI with an isolated, seeded guest
 * demonstration workspace. Output is review evidence, NOT auto-published media.
 * Exact viewport and deterministic local fixture keep captures reproducible.
 */
test('@golden @showcase-capture creates authentic Desk, Set, Template and Output UI screenshots', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await seedGuestScaleWorkspace(page, 100, {
    staleToolTemplate: true, templateContent: true, additionalSets: 3,
  });
  await page.goto('/account', { waitUntil: 'domcontentloaded' });

  const shot = async (name: string) => {
    const png = await page.screenshot({ animations: 'disabled', fullPage: false });
    await testInfo.attach('real-cardforge-' + name, { body: png, contentType: 'image/png' });
  };

  await expect(page.locator('[data-desk-arrival-phase="ready"]')).toBeVisible();
  await expect(page.getByRole('button', { name: /^(Select|Selected) 100 Card Scale Set/ })).toBeVisible();
  await shot('desk');

  await openScaleSet(page, 100);
  await expect(page.locator('[data-desk-artifact-stage]')).toBeVisible();
  await shot('set');

  await page.getByRole('button', { name: 'Output', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Output Set', exact: true })).toBeVisible();
  await shot('output');

  await page.goto('/account', { waitUntil: 'domcontentloaded' });
  await openScaleSet(page, 100);
  await page.getByRole('button', { name: /^Templates ·/ }).click();
  await page.getByRole('button', { name: /^Design back template Scale Fixture Back/ }).click();
  const templateCanvas = page.getByRole('region', { name: 'Template canvas', exact: true });
  await expect(templateCanvas).toBeVisible();
  await shot('template');

  // These captured screens are UI proof only. Owner media publication requires
  // a separate explicit selection with truthful alt text and visual review.
});
