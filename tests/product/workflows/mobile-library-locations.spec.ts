import { devices, expect, test, type Locator } from '@playwright/test';

import { openScaleSet, seedGuestScaleWorkspace } from './helpers/projectScaleBrowser';

test.use({ ...devices['Pixel 7'] });

test.describe('mobile Library location tools', () => {
  test.describe.configure({ timeout: 120_000 });

  const expectTouchTarget = async (control: Locator) => {
    await control.scrollIntoViewIfNeeded();
    await expect(control).toBeInViewport({ ratio: 1 });
    const bounds = await control.boundingBox();
    expect(bounds?.width).toBeGreaterThanOrEqual(44);
    expect(bounds?.height).toBeGreaterThanOrEqual(44);
  };

  test('@golden gives Locations the compact Task viewport while keeping its controls scrollable', async ({ page }) => {
    await seedGuestScaleWorkspace(page, 100);
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/account?section=library&tool=locations', { waitUntil: 'domcontentloaded', timeout: 120_000 });

    const tool = page.getByRole('region', { name: 'Locations & connections', exact: true });
    await expect(tool).toBeVisible();
    await expect(page.locator('[aria-label="CardForge Library"] > [data-presentation-mode]')).toHaveAttribute('data-presentation-mode', 'task');
    const mobileNav = page.locator('[class*="mobileNav"]');
    await expect(mobileNav).toBeHidden();
    await expect.poll(async () => {
      const [toolPanel, primary] = await Promise.all([
        tool.locator(':scope > section').boundingBox(),
        page.locator('main').boundingBox(),
      ]);
      return Boolean(
        toolPanel
        && primary
        && Math.abs(toolPanel.y - primary.y) <= 1
        && Math.abs(toolPanel.height - primary.height) <= 1
      );
    }).toBe(true);

    const storage = tool.getByRole('region', { name: 'Storage and connections', exact: true });
    const deviceLocation = storage.getByRole('button', { name: /This device/ });
    await expectTouchTarget(deviceLocation);
    await deviceLocation.tap();
    await expect(tool.getByRole('heading', { name: 'This device', exact: true })).toBeVisible();

    const scrollState = await storage.evaluate((element) => {
      let owner: HTMLElement | null = element.parentElement;
      while (owner) {
        const style = getComputedStyle(owner);
        if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && owner.scrollHeight > owner.clientHeight + 1) {
          const before = owner.scrollTop;
          owner.scrollTop = owner.scrollHeight;
          return { before, after: owner.scrollTop, scrollHeight: owner.scrollHeight, clientHeight: owner.clientHeight };
        }
        owner = owner.parentElement;
      }
      return null;
    });
    expect(scrollState).not.toBeNull();
    expect(scrollState!.scrollHeight).toBeGreaterThan(scrollState!.clientHeight);
    expect(scrollState!.after).toBeGreaterThan(scrollState!.before);

    await tool.getByRole('button', { name: 'Close This device', exact: true }).tap();
    const driveLocation = storage.getByRole('button', { name: /Google Drive projects/ });
    await expectTouchTarget(driveLocation);
    await driveLocation.tap();

    await expect(tool.getByRole('heading', { name: 'Google Drive projects', exact: true })).toBeVisible();
    const signIn = tool.getByRole('link', { name: 'Sign in to connect', exact: true });
    await expectTouchTarget(signIn);
    await signIn.click({ trial: true });

    await test.info().attach('mobile-library-locations', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });

  test('@golden keeps Desk navigation, commands, status truth, and compact actions while focusing work', async ({ page }) => {
    await seedGuestScaleWorkspace(page, 100);
    await page.setViewportSize({ width: 320, height: 844 });
    await page.goto('/account', { waitUntil: 'domcontentloaded', timeout: 120_000 });

    const command = page.getByRole('button', { name: 'Open commands', exact: true });
    await expectTouchTarget(command);
    await expect(page.getByRole('navigation', { name: 'Creative context', exact: true })).toHaveCount(0);

    const toolbar = page.locator('[data-desk-toolbar]');
    const filters = toolbar.locator('[data-mobile-desk-filters] > summary[aria-label="Open Desk filters"]');
    await expectTouchTarget(filters);
    await expectTouchTarget(toolbar.getByRole('button', { name: 'Desk view controls', exact: true }));
    await expect(toolbar.getByRole('button', { name: 'Zoom Desk out', exact: true })).toBeHidden();

    const status = page.locator('footer[aria-label="Environment status"]');
    await expect(status).toBeVisible();
    await expect(status.getByText('Local working copy saved', { exact: true })).toBeVisible();
    await expect(status.getByText('Private creator desk', { exact: true })).toBeHidden();
    expect(await status.locator(':scope > div:first-child > *').evaluateAll((items) => items.every((item) => item.scrollWidth <= item.clientWidth + 1))).toBe(true);

    const storageStatus = page.getByTitle('Open Locations & connections');
    await expectTouchTarget(storageStatus);
    await storageStatus.tap();
    const locations = page.getByRole('region', { name: 'Locations & connections', exact: true });
    await expect(locations).toBeVisible();
    await page.getByRole('button', { name: 'Done', exact: true }).tap();
    await expect(locations).toBeHidden();

    await openScaleSet(page, 100);
    const mobileNav = page.getByRole('navigation', { name: 'CardForge zones', exact: true });
    await expect(mobileNav).toBeHidden();
    await expect(status).toBeHidden();
    await expect(page.getByRole('navigation', { name: 'Creative context', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back to Desk', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);

    const artifactStage = page.locator('[data-desk-artifact-stage]');
    const viewControls = page.locator('[data-set-view-controls]');
    expect(await page.evaluate(() => {
      const stage = document.querySelector('[data-desk-artifact-stage]')?.getBoundingClientRect();
      const controls = document.querySelector('[data-set-view-controls]')?.getBoundingClientRect();
      return Boolean(stage && controls && controls.top >= stage.bottom - 1);
    })).toBe(true);
    await expect(viewControls).toBeVisible();

    await artifactStage.locator('button[data-artifact-id="scale-card-1"]').click();
    const selectionActions = page.getByRole('toolbar', { name: 'Selection actions', exact: true });
    await expect(selectionActions.getByRole('button', { name: 'Edit selected', exact: true })).toBeVisible();
    await expect(selectionActions.getByRole('button', { name: 'More selection actions', exact: true })).toBeVisible();
    expect(await selectionActions.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    await selectionActions.getByRole('button', { name: 'More selection actions', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Duplicate', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');

    await page.setViewportSize({ width: 320, height: 667 });
    await expect.poll(async () => page.evaluate(() => {
      const stage = document.querySelector('[data-desk-artifact-stage]')?.getBoundingClientRect();
      const controls = document.querySelector('[data-set-view-controls]')?.getBoundingClientRect();
      return Boolean(
        stage
        && controls
        && controls.top >= stage.bottom - 1
        && controls.bottom <= innerHeight + 1
        && document.documentElement.scrollWidth <= innerWidth + 2
      );
    })).toBe(true);

    const selectedCard = page.locator('button[data-artifact-id="scale-card-1"]');
    await selectedCard.focus();
    await selectedCard.press('Enter');
    await expect(page.locator('[data-focused-artifact-workspace]')).toBeVisible();
    await expect.poll(async () => page.evaluate(() => {
      const workspace = document.querySelector('[data-focused-artifact-workspace]');
      const stage = workspace?.querySelector('[data-desk-artifact-stage]')?.getBoundingClientRect();
      const controls = workspace?.querySelector('[aria-label="Focused Artifact tools"]')?.getBoundingClientRect();
      return Boolean(
        stage
        && controls
        && controls.top >= stage.bottom - 1
        && controls.bottom <= innerHeight + 1
        && document.documentElement.scrollWidth <= innerWidth + 2
      );
    })).toBe(true);

    await test.info().attach('mobile-desk-capability-parity', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });

  test('@golden edits a focused Artifact in place without overlapping the mobile stage, inspector, or rails', async ({ page }) => {
    await seedGuestScaleWorkspace(page, 100, { cardLimit: 5, exportSample: true });
    await page.setViewportSize({ width: 320, height: 667 });
    await page.goto('/account', { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await openScaleSet(page, 100);

    const boardCard = page.locator('button[data-artifact-id="scale-card-1"]');
    await boardCard.focus();
    await boardCard.press('Enter');

    const workspace = page.locator('[data-focused-artifact-workspace]');
    await page.locator('[data-desk-context-rail]').getByRole('button', { name: 'Edit', exact: true }).click();
    await expect(workspace).toHaveAttribute('data-editing', 'true');

    const titleTarget = page.locator('[data-field-element-id="scale-template-title"]');
    await expect(titleTarget).toBeVisible();
    await expect.poll(async () => {
      const bounds = await titleTarget.boundingBox();
      return bounds ? Math.min(bounds.width, bounds.height) : 0;
    }).toBeGreaterThanOrEqual(44);
    await titleTarget.tap();

    const titleInput = page.getByRole('textbox', { name: 'Card Name', exact: true });
    await expect(titleInput).toHaveValue('Scale Card 0001');
    await titleInput.fill('Draft Mobile Artifact');
    await expect(page.locator('[data-scene-depth="edit"]')).toContainText('Draft Mobile Artifact');

    expect(await workspace.evaluate((element) => {
      const stage = element.querySelector('[data-desk-artifact-stage]')?.getBoundingClientRect();
      const inspector = element.querySelector('[aria-label="Artifact field inspector"]')?.getBoundingClientRect();
      const controls = element.querySelector('[aria-label="Focused Artifact tools"]')?.getBoundingClientRect();
      return Boolean(
        stage
        && inspector
        && controls
        && inspector.top >= stage.bottom - 1
        && controls.top >= inspector.bottom - 1
        && controls.right <= innerWidth + 1
        && document.documentElement.scrollWidth <= innerWidth + 2
      );
    })).toBe(true);

    await workspace.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('alertdialog', { name: 'Discard unsaved Artifact changes?' })).toBeVisible();
    await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
    await expect(workspace).toHaveAttribute('data-editing', 'false');
    await expect(page.locator('[data-scene-depth="focus"]')).toContainText('Scale Card 0001');

    await page.locator('[data-desk-context-rail]').getByRole('button', { name: 'Edit', exact: true }).click();
    await page.locator('[data-field-element-id="scale-template-title"]').tap();
    await page.getByRole('textbox', { name: 'Card Name', exact: true }).fill('Saved Mobile Artifact');
    await workspace.getByRole('button', { name: 'Save & Done', exact: true }).click();
    await expect(workspace).toHaveAttribute('data-editing', 'false');
    await expect(page.locator('[data-scene-depth="focus"]')).toContainText('Saved Mobile Artifact');

    await test.info().attach('mobile-artifact-direct-edit', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });
});
