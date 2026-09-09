import { devices, expect, test, type Locator } from '@playwright/test';

import { seedGuestScaleWorkspace } from './helpers/projectScaleBrowser';

test.use({ ...devices['Pixel 7'] });

const expectTouchTarget = async (control: Locator) => {
  await expect(control).toBeInViewport({ ratio: 1 });
  const bounds = await control.boundingBox();
  expect(bounds?.width).toBeGreaterThanOrEqual(44);
  expect(bounds?.height).toBeGreaterThanOrEqual(44);
};

test.describe('mobile Desk controls', () => {
  test.describe.configure({ timeout: 120_000 });

  test('@golden keeps Desk filtering in a compact, touchable disclosure', async ({ page }) => {
    await seedGuestScaleWorkspace(page, 100);
    await page.goto('/account', { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await expect(page.locator('[data-desk-context-rail][data-depth="desk"]')).toBeVisible();

    const toolbar = page.locator('[data-desk="overview"] [data-desk-toolbar]');
    const filters = page.locator('[data-mobile-desk-filters]');
    await expect(filters).toBeVisible();
    await expectTouchTarget(filters.locator('summary'));
    const toolbarBounds = await toolbar.boundingBox();
    expect(toolbarBounds?.height).toBeLessThanOrEqual(60);
    await filters.locator('summary').tap();
    await expect(filters).toHaveAttribute('open', '');
    await expect(page.getByRole('button', { name: 'Choose Desk views' })).toBeVisible();
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      const panel = filters.locator('[aria-label="Desk views and filters"]');
      await expect(panel).toBeInViewport({ ratio: 1 });
      const bounds = await panel.boundingBox();
      expect(bounds?.x).toBeGreaterThanOrEqual(0);
      expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(width);
      for (const name of ['Choose Desk views', 'Name this Desk view']) {
        await expect(panel.getByRole(name === 'Name this Desk view' ? 'textbox' : 'button', { name })).toBeInViewport({ ratio: 1 });
      }
    }
    await test.info().attach('compact-desk-filters', { body: await page.screenshot(), contentType: 'image/png' });
  });

  test('@golden opens, selects, and dismisses shared dropdown controls by touch', async ({ page }) => {
    await seedGuestScaleWorkspace(page, 100);
    await page.goto('/account', { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await expect(page.locator('[data-desk-context-rail][data-depth="desk"]')).toBeVisible();

    const setButton = page.getByRole('button', { name: /^(Select|Selected) 100 Card Scale Set/ });
    await setButton.tap();
    await page.getByRole('button', { name: 'Open', exact: true }).tap();
    await expect(page.getByRole('button', { name: 'Back to Desk' })).toBeVisible();

    const arrangement = page.getByRole('combobox', { name: 'Arrange cards' });
    await page.getByRole('button', { name: /^Organize/ }).tap();
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
    const name = page.getByLabel('Set name');
    await expect(name).toBeFocused();
    await name.fill('Uncommitted name');
    await name.press('Escape');
    await expect(name).toHaveCount(0);
    const rail = page.locator('[data-desk-context-rail][data-depth="set"]');
    await expect(rail).toContainText('100 Card Scale Set');
    await expect(moreActions).toBeFocused();

    await moreActions.tap();
    await page.getByRole('menuitem', { name: 'Rename' }).tap();
    const longName = 'Autumn festival illustrated card collection with a deliberately long Set name';
    await name.fill(longName);
    await name.press('Enter');
    await expect(rail).toContainText(longName);
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      for (const label of ['Back to Desk', 'Design', 'More Set actions']) {
        await expectTouchTarget(rail.getByRole('button', { name: label, exact: true }));
      }
      await expect(rail.getByRole('button', { name: 'Generate', exact: true })).toBeHidden();
      await expect(rail.getByRole('button', { name: 'Output', exact: true })).toBeHidden();
      await moreActions.tap();
      await expectTouchTarget(page.getByRole('menuitem', { name: 'Generate', exact: true }));
      await expectTouchTarget(page.getByRole('menuitem', { name: 'Output', exact: true }));
      await page.keyboard.press('Escape');
      await test.info().attach(`first-use-set-${width}`, { body: await page.screenshot(), contentType: 'image/png' });
    }
    await rail.getByRole('button', { name: 'Back to Desk', exact: true }).tap({ position: { x: 3, y: 3 } });
    await expect(page.locator('[data-desk="overview"]')).toBeVisible();
    await expect(page.getByRole('button', { name: `Selected ${longName}. Press Enter to open.` })).toBeFocused();
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
    await expect(page.locator('[data-scene-artifact="scale-card-1"]')).toHaveAttribute('data-scene-depth', 'board');
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
    await page.locator('[data-desk-context-rail]').getByRole('button', { name: 'Output', exact: true }).tap();
    await expect(page.getByRole('region', { name: 'Output Set', exact: true })).toBeVisible();
    const home = page.getByRole('button', { name: 'Return to Desk', exact: true });
    await expectTouchTarget(home);
    await home.tap();
    await expect(page.locator('[data-desk="overview"]')).toBeVisible();
    await expect(page.locator('[data-desk-tool-surface]')).toHaveCount(0);

    await page.getByRole('button', { name: 'Open', exact: true }).tap();
    const visual = page.locator('[data-scene-artifact="scale-card-1"]');
    const original = await visual.elementHandle();
    await page.locator('button[data-artifact-id="scale-card-1"]').tap();
    await expect(visual).toHaveAttribute('data-scene-depth', 'focus');
    await expectTouchTarget(page.getByRole('button', { name: 'Back to Set', exact: true }));
    await expectTouchTarget(home);
    await test.info().attach('first-use-artifact-navigation', { body: await page.screenshot(), contentType: 'image/png' });
    await home.tap();
    await expect(visual).toHaveAttribute('data-scene-depth', 'stack');
    expect(await original!.evaluate((node) => node.isConnected)).toBe(true);
    await original!.dispose();
  });

  test('@golden preserves unsaved Design recovery from the context rail', async ({ page }) => {
    await seedGuestScaleWorkspace(page, 100);
    await page.goto('/account', { waitUntil: 'domcontentloaded', timeout: 120_000 });
    const setButton = page.getByRole('button', { name: /^(Select|Selected) 100 Card Scale Set/ });
    await setButton.tap();
    await page.getByRole('button', { name: 'Open', exact: true }).tap();
    await page.getByRole('button', { name: 'Design', exact: true }).tap();

    const editorTools = page.getByRole('button', { name: 'Open editor tools', exact: true });
    await editorTools.tap();
    const toolsSheet = page.getByRole('dialog', { name: 'Editor tools', exact: true });
    const close = toolsSheet.getByRole('button', { name: 'Close', exact: true });
    await expect(close).toBeVisible();
    const closeBounds = await close.boundingBox();
    expect(closeBounds?.width).toBeGreaterThanOrEqual(44);
    expect(closeBounds?.height).toBeGreaterThanOrEqual(44);
    const iconBounds = await close.locator('svg').boundingBox();
    expect(iconBounds?.width).toBeLessThanOrEqual(24);
    expect(iconBounds?.height).toBeLessThanOrEqual(24);
    await close.tap({ position: { x: 3, y: 3 } });
    await expect(toolsSheet).toBeHidden();
    await expect(editorTools).toBeFocused();

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
    await page.setViewportSize({ width: 320, height: 844 });
    const home = rail.getByRole('button', { name: 'Return to Desk', exact: true });
    await expectTouchTarget(home);
    await expectTouchTarget(rail.getByRole('button', { name: 'Review & close', exact: true }));
    await test.info().attach('first-use-dirty-design-320', { body: await page.screenshot(), contentType: 'image/png' });
    await home.tap();
    const confirmation = page.getByRole('alertdialog', { name: 'Return to Desk with unsaved changes?' });
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole('button', { name: 'Keep editing', exact: true }).tap();
    await expect(rail).toContainText('Unsaved changes');
    await home.tap();
    await confirmation.getByRole('button', { name: 'Discard & return to Desk', exact: true }).tap();
    await expect(page.locator('[data-desk="overview"]')).toBeVisible();
    await expect(page.locator('[data-desk-tool-surface]')).toHaveCount(0);
    await expect(setButton).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('desktop Desk return', () => {
  test.use({ viewport: { width: 1200, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1, userAgent: devices['Desktop Chrome'].userAgent });
  test.setTimeout(120_000);

  test('@golden keeps the Desk camera, search, selection, and artifact node when its zone link is activated', async ({ page }) => {
    await seedGuestScaleWorkspace(page, 100);
    await page.goto('/account', { waitUntil: 'domcontentloaded', timeout: 120_000 });
    const search = page.getByRole('textbox', { name: 'Search open work', exact: true });
    await search.fill('100');
    await page.getByRole('button', { name: 'Zoom Desk in', exact: true }).click();
    const viewport = page.locator('[data-desk-viewport]');
    await viewport.evaluate((element) => { element.scrollLeft = 80; element.scrollTop = 40; });
    const camera = await viewport.evaluate((element) => ({ x: element.scrollLeft, y: element.scrollTop, zoom: element.getAttribute('data-zoom') }));
    const visual = page.locator('[data-scene-artifact="scale-card-1"]');
    const original = await visual.elementHandle();
    const set = page.getByRole('button', { name: /^(Select|Selected) 100 Card Scale Set/ });
    await set.click();
    await set.press('Enter');
    await expect(page.locator('[data-desk-context-rail][data-depth="set"]')).toBeVisible();
    await page.getByRole('navigation', { name: 'Environment zones', exact: true }).getByRole('link', { name: 'Desk', exact: true }).click();
    await expect(page.locator('[data-desk="overview"]')).toBeVisible();
    await expect(search).toHaveValue('100');
    await expect(set).toHaveAttribute('aria-pressed', 'true');
    await expect(set).toBeFocused();
    await expect.poll(() => viewport.evaluate((element) => ({ x: element.scrollLeft, y: element.scrollTop, zoom: element.getAttribute('data-zoom') }))).toEqual(camera);
    expect(await original!.evaluate((node) => node.isConnected)).toBe(true);
    await original!.dispose();
    await test.info().attach('first-use-desktop-return', { body: await page.screenshot(), contentType: 'image/png' });
  });
});
