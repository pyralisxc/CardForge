import { devices, expect, test, type Page } from '@playwright/test';
import { openScaleSet, seedGuestScaleWorkspace } from './helpers/projectScaleBrowser';

const recovery = (page: Page) => page.getByRole('group', { name: 'Card removal recovery', exact: true });
const card = (page: Page, ordinal: number) => page.locator(`button[data-artifact-id="scale-card-${ordinal}"]`);

const removeShown = async (page: Page, ordinal: number, mobile: boolean) => {
  const search = page.getByRole('searchbox', { name: 'Search cards in this Set', exact: true });
  await search.fill(`Scale Card ${String(ordinal).padStart(4, '0')}`);
  await page.getByRole('button', { name: /^Organize ·/ }).click();
  await page.getByRole('button', { name: 'Select shown', exact: true }).click();
  await page.keyboard.press('Escape');
  const actions = page.getByRole('toolbar', { name: 'Selection actions', exact: true });
  if (mobile) {
    await actions.getByRole('button', { name: 'More selection actions', exact: true }).click();
    await page.getByRole('dialog', { name: 'More selection actions', exact: true }).getByRole('button', { name: 'Remove', exact: true }).click();
  } else await actions.getByRole('button', { name: 'Remove', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Remove card', exact: true }).click();
  await expect(card(page, ordinal)).toHaveCount(0);
  await search.fill('');
};

for (const mobile of [false, true]) {
  test.describe(`Set removal Undo on ${mobile ? 'mobile' : 'desktop'}`, () => {
    test.use(mobile
      ? { viewport: devices['Pixel 7'].viewport, isMobile: true, hasTouch: true }
      : { viewport: { width: 1180, height: 757 } });
    test.beforeEach(({ page }) => { page.setDefaultTimeout(15_000); });

    test('@golden recovers consecutive removals by name with stable keyboard focus', async ({ page }) => {
      test.setTimeout(120_000);
      await seedGuestScaleWorkspace(page, 100, { cardLimit: 3, titleField: 'Card Title' });
      await page.goto('/account', { waitUntil: 'domcontentloaded' });
      await openScaleSet(page, 100);
      await expect(card(page, 1)).toHaveAccessibleName(/Scale Card 0001/);
      await removeShown(page, 1, mobile);
      await expect(recovery(page)).toContainText('Scale Card 0001');
      const firstId = await recovery(page).getAttribute('data-card-removal-recovery');
      await removeShown(page, 2, mobile);
      await expect(recovery(page)).toContainText('Scale Card 0002');
      await expect(recovery(page)).toContainText('latest of 2 removals');
      expect(await recovery(page).getAttribute('data-card-removal-recovery')).not.toBe(firstId);
      await expect(page.getByRole('status').filter({ hasText: /Scale Card 0002.*Undo latest removal is available/ })).toHaveAttribute('aria-live', 'polite');

      const undo = recovery(page).getByRole('button', { name: /^Undo latest removal/ });
      await undo.focus();
      await page.keyboard.press('Enter');
      await expect(card(page, 2)).toBeVisible();
      await expect(card(page, 1)).toHaveCount(0);
      await expect(recovery(page)).toHaveAttribute('data-card-removal-recovery', firstId!);
      await expect(undo).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(card(page, 1)).toBeVisible();
      await expect(card(page, 3)).toBeVisible();
      await expect(recovery(page)).toHaveCount(0);
      await expect(page.locator('[data-desk-set-board]')).toBeFocused();

      await removeShown(page, 1, mobile);
      const dismiss = recovery(page).getByRole('button', { name: /^Dismiss latest removal/ });
      await dismiss.focus();
      await page.keyboard.press('Enter');
      await expect(recovery(page)).toHaveCount(0);
      await expect(card(page, 1)).toHaveCount(0);
      await expect(card(page, 2)).toBeVisible();
      await expect(page.locator('[data-desk-set-board]')).toBeFocused();
    });

    test('@golden undoes the last card in an empty Set but never resurrects recovery after reload', async ({ page }) => {
      test.setTimeout(120_000);
      await seedGuestScaleWorkspace(page, 100, { cardLimit: 1 });
      await page.goto('/account', { waitUntil: 'domcontentloaded' });
      await openScaleSet(page, 100);
      await removeShown(page, 1, mobile);
      await expect(page.getByText('This Set is ready for its first card', { exact: true })).toBeVisible();
      await expect(recovery(page)).toBeInViewport({ ratio: 1 });
      await recovery(page).getByRole('button', { name: /^Undo latest removal/ }).click();
      await expect(card(page, 1)).toBeVisible();
      await removeShown(page, 1, mobile);
      await expect(recovery(page)).toBeVisible();
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.locator('[data-desk-arrival-phase="ready"]')).toBeVisible();
      await expect(page.getByText('This Set is ready for its first card', { exact: true })).toBeVisible();
      await expect(recovery(page)).toHaveCount(0);
      await expect(card(page, 1)).toHaveCount(0);
    });
  });
}
