import { devices, expect, test } from '@playwright/test';

test.use({ ...devices['Pixel 7'] });

test.describe('mobile Desk controls', () => {
  test.describe.configure({ timeout: 120_000 });

  test('opens, selects, and dismisses shared dropdown controls by touch', async ({ page }) => {
    await page.goto('/account', { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await expect(page.getByRole('heading', { name: 'Your creative workspace' })).toBeVisible();

    const arrangement = page.getByRole('combobox', { name: 'Arrange open work' });
    await arrangement.tap();
    await expect(page.getByRole('option', { name: 'Name', exact: true })).toBeVisible();
    await page.getByRole('option', { name: 'Name', exact: true }).tap();
    await expect(arrangement).toContainText('Name');

    await arrangement.tap();
    await expect(page.getByRole('option', { name: 'Largest first' })).toBeVisible();
    await page.getByRole('heading', { name: 'Your creative workspace' }).tap();
    await expect(page.getByRole('option', { name: 'Largest first' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Create your first Set' }).tap();
    await page.getByRole('button', { name: 'Fresh Set', exact: true }).tap();
    const moreActions = page.getByRole('button', { name: /More actions for/ });
    await expect(moreActions).toBeVisible();
    await moreActions.tap();
    await expect(page.getByRole('menuitem', { name: 'Rename' })).toBeVisible();
    await page.getByRole('menuitem', { name: 'Rename' }).tap();
    await expect(page.getByLabel('Work name')).toBeVisible();
  });
});
