import { devices, expect, test } from '@playwright/test';

import { seedGuestScaleWorkspace } from './helpers/projectScaleBrowser';

test.use({ ...devices['Pixel 7'] });

test.describe('mobile Desk controls', () => {
  test.describe.configure({ timeout: 120_000 });

  test('@golden opens, selects, and dismisses shared dropdown controls by touch', async ({ page }) => {
    await seedGuestScaleWorkspace(page, 100);
    await page.goto('/account', { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await expect(page.locator('[data-desk-context-rail][data-depth="desk"]')).toBeVisible();

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
    await page.keyboard.press('Escape');
    await expect(page.getByRole('option', { name: 'Arrange as stacks', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Back to Desk' })).toBeVisible();
    await expect(page.locator('[data-desk-context-rail][data-depth="set"]')).toBeVisible();

    const moreActions = page.getByRole('button', { name: 'More Set actions' });
    await expect(moreActions).toBeVisible();
    await moreActions.tap();
    await expect(page.getByRole('menuitem', { name: 'Rename' })).toBeVisible();
    await page.getByRole('menuitem', { name: 'Rename' }).tap();
    await expect(page.getByLabel('Set name')).toBeVisible();
  });

  test('@golden keeps Generate docked beside the persistent creative scene', async ({ page }) => {
    await seedGuestScaleWorkspace(page, 100);
    await page.goto('/account', { waitUntil: 'domcontentloaded', timeout: 120_000 });
    const setButton = page.getByRole('button', { name: /^(Select|Selected) 100 Card Scale Set/ });
    await setButton.tap();
    await page.getByRole('button', { name: 'Open', exact: true }).tap();
    await page.getByRole('button', { name: 'Generate', exact: true }).tap();

    const tool = page.getByRole('region', { name: 'Generate into 100 Card Scale Set' });
    await expect(tool).toBeVisible();
    await expect(tool).toHaveAttribute('data-presentation', 'sheet');
    await expect(page.locator('[data-desk-context-rail][data-depth="tool"]')).toContainText('Generate');
    await expect(page.locator('[data-set-object][data-presentation="focused"] [data-desk-set-stack]')).toBeVisible();
    await expect(page.locator('[class*="mobileNav"]')).toBeHidden();
    await expect.poll(async () => {
      const [toolPanel, primary] = await Promise.all([
        tool.locator('section').first().boundingBox(),
        page.locator('main[data-scroll="contained"]').boundingBox(),
      ]);
      if (!toolPanel || !primary) return false;
      return toolPanel.y > primary.y + primary.height * 0.25
        && toolPanel.height <= primary.height * 0.65;
    }).toBe(true);

    await page.locator('[data-desk-context-rail][data-depth="tool"]').getByRole('button', { name: 'Done' }).tap();
    await expect(tool).toHaveCount(0);
    await expect(page.locator('[data-desk-context-rail][data-depth="set"]')).toBeVisible();
  });

  test('@golden preserves unsaved Design recovery from the context rail', async ({ page }) => {
    await seedGuestScaleWorkspace(page, 100);
    await page.goto('/account', { waitUntil: 'domcontentloaded', timeout: 120_000 });
    const setButton = page.getByRole('button', { name: /^(Select|Selected) 100 Card Scale Set/ });
    await setButton.tap();
    await page.getByRole('button', { name: 'Open', exact: true }).tap();
    await page.getByRole('button', { name: 'Design', exact: true }).tap();

    const canvas = page.getByRole('region', { name: 'Template canvas' });
    const editableElement = page.locator('[data-cardforge-editor-overlay]').first();
    await expect(editableElement).toBeVisible();
    await editableElement.tap();
    await canvas.focus();
    await canvas.press('ArrowRight');

    const rail = page.locator('[data-desk-context-rail][data-depth="tool"]');
    await expect(rail).toContainText('Unsaved changes');
    await rail.getByRole('button', { name: 'Review & close' }).tap();
    await expect(page.getByRole('alertdialog', { name: 'Close Design with unsaved changes?' })).toBeVisible();
    await page.getByRole('button', { name: 'Keep editing' }).tap();
    await expect(page.getByRole('region', { name: 'Design Artifacts' })).toBeVisible();
  });
});
