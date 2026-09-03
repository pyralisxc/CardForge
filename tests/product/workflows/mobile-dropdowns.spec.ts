import { devices, expect, test } from '@playwright/test';

import { seedGuestScaleWorkspace } from './helpers/projectScaleBrowser';

test.use({ ...devices['Pixel 7'] });

test.describe('mobile Desk controls', () => {
  test.describe.configure({ timeout: 120_000 });

  test('@golden opens, selects, and dismisses shared dropdown controls by touch', async ({ page }) => {
    await seedGuestScaleWorkspace(page, 100);
    await page.goto('/account', { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await expect(page.getByRole('heading', { name: 'Your creative workspace' })).toBeVisible();

    const setButton = page.getByRole('button', { name: /^(Select|Selected) 100 Card Scale Set/ });
    await setButton.tap();
    await page.getByRole('button', { name: 'Open', exact: true }).tap();
    await expect(page.getByRole('button', { name: 'Back to Desk' })).toBeVisible();

    const arrangement = page.getByRole('combobox', { name: 'Arrange cards' });
    await arrangement.tap();
    await expect(page.getByRole('option', { name: 'Arrange as grid', exact: true })).toBeVisible();
    await page.getByRole('option', { name: 'Arrange as grid', exact: true }).tap();
    await expect(arrangement).toContainText('Arrange: Grid');

    await arrangement.tap();
    await expect(page.getByRole('option', { name: 'Arrange as stacks', exact: true })).toBeVisible();
    await page.touchscreen.tap(8, 8);
    await expect(page.getByRole('option', { name: 'Arrange as stacks', exact: true })).toHaveCount(0);

    const moreActions = page.getByRole('button', { name: /More actions for/ });
    await expect(moreActions).toBeVisible();
    await moreActions.tap();
    await expect(page.getByRole('menuitem', { name: 'Rename' })).toBeVisible();
    await page.getByRole('menuitem', { name: 'Rename' }).tap();
    await expect(page.getByLabel('Work name')).toBeVisible();
  });
});
