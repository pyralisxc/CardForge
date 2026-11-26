import { devices, expect, test, type Locator } from '@playwright/test';

import { openScaleSet, seedGuestScaleWorkspace } from './helpers/projectScaleBrowser';

test.use({ ...devices['Pixel 7'] });

test.describe('mobile Library location tools', () => {
  test.describe.configure({ timeout: 120_000 });

  const expectTouchTarget = async (control: Locator) => {
    await control.scrollIntoViewIfNeeded();
    await expect(control).toBeInViewport({ ratio: 0.99 });
    const bounds = await control.boundingBox();
    expect(bounds?.width).toBeGreaterThanOrEqual(44);
    expect(bounds?.height).toBeGreaterThanOrEqual(44);
  };

  for (const surface of ['Desk', 'Library'] as const) test(`@golden ${surface} Trash removes only the chosen device Set across Desk and Library`, async ({ page }) => {
    await seedGuestScaleWorkspace(page, 100, { additionalSets: 2, cardLimit: 0 });
    const providerWrites: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/project-sources/google-drive') && !['GET', 'HEAD'].includes(request.method())) providerWrites.push(request.method());
    });
    const name = 'Touch Companion Set 1';
    const target = '[data-desk-set-object-id="set:touch-companion-1"]';
    const neighbor = '[data-desk-set-object-id="set:touch-companion-2"]';
    const libraryTarget = '[id="library-object-set:touch-companion-1"]';
    const libraryNeighbor = '[id="library-object-set:touch-companion-2"]';
    await page.goto('/account', { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await expect(page.locator('[data-desk-arrival-phase="ready"]')).toBeVisible();
    await expect(page.locator(target)).toBeVisible();
    const actions = page.getByRole('button', { name: `Actions for ${name}`, exact: true });
    await expect(actions).toBeVisible();
    await actions.scrollIntoViewIfNeeded();
    expect(await actions.evaluate((button) => {
      const rect = button.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      return { matches: hit === button || button.contains(hit), hit: hit?.closest('[data-desk-set-object-id]')?.getAttribute('data-desk-set-object-id') ?? hit?.tagName ?? null, x: rect.x, y: rect.y };
    })).toMatchObject({ matches: true });
    await actions.click();
    await page.getByRole('menuitem', { name: 'Remove from Desk', exact: true }).click();
    await expect(page.locator(target)).toHaveCount(0);
    await page.goto('/account?section=library&scope=personal', { waitUntil: 'domcontentloaded' });
    await expect(page.locator(libraryTarget)).toBeVisible();
    await page.goto('/account', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Add from Library', exact: true }).first().click();
    const picker = page.getByRole('dialog', { name: 'Add from Library' });
    await picker.getByText(name, { exact: true }).locator('../..').getByRole('button', { name: 'Add to Desk' }).click();
    await expect(picker.getByText(name, { exact: true }).locator('../..').getByRole('button', { name: `Remove ${name} from Desk` })).toBeEnabled();
    await picker.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(page.locator(target)).toBeVisible();
    if (surface === 'Library') await page.goto('/account?section=library&scope=personal', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: `Actions for ${name}`, exact: true }).click();
    await page.getByRole('menuitem', { name: 'Trash', exact: true }).click();
    const confirmation = page.getByRole('alertdialog');
    await expect(confirmation).toContainText(name);
    await expect(confirmation).toContainText('permanently deleted');
    await confirmation.getByRole('button', { name: 'Permanently delete device copy', exact: true }).click();
    await expect(confirmation).toHaveCount(0);
    await page.goto('/account?section=library&scope=personal', { waitUntil: 'domcontentloaded' });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator(libraryTarget)).toHaveCount(0);
    await expect(page.locator(libraryNeighbor)).toBeVisible();
    await page.goto('/account', { waitUntil: 'domcontentloaded' });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator(target)).toHaveCount(0);
    await expect(page.locator(neighbor)).toBeVisible();
    expect(providerWrites).toEqual([]);
  });

  test('keeps multiple local Sets intact when removed from and added back to Desk', async ({ page }) => {
    await seedGuestScaleWorkspace(page, 100, { additionalSets: 2, cardLimit: 0 });
    await page.goto('/account', { waitUntil: 'domcontentloaded', timeout: 120_000 });
    for (const index of [1, 2]) {
      const tile = page.locator(`[data-desk-set-object-id="set:touch-companion-${index}"]`);
      await expect(tile).toBeVisible();
      await tile.getByRole('button', { name: `Actions for Touch Companion Set ${index}` }).click();
      await page.getByRole('menuitem', { name: 'Remove from Desk' }).click();
      await expect(tile).toHaveCount(0);
    }
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-desk-set-object-id="set:touch-companion-1"]')).toHaveCount(0);
    await page.goto('/account?focus=set%3Atouch-companion-1', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-desk="focused"]').first()).toBeVisible();
    await expect(page.locator('[data-desk-arrival-phase="ready"]')).toBeVisible();
    await page.goto('/account', { waitUntil: 'domcontentloaded' });
    const restored = page.locator('[data-desk-set-object-id="set:touch-companion-1"]');
    await expect(restored).toBeVisible();
    await restored.getByRole('button', { name: 'Actions for Touch Companion Set 1' }).click();
    await page.getByRole('menuitem', { name: 'Remove from Desk' }).click();
    await expect(restored).toHaveCount(0);
    await page.getByRole('button', { name: 'Add from Library', exact: true }).first().click();
    const picker = page.getByRole('dialog', { name: 'Add from Library' });
    for (const index of [1, 2]) {
      const row = picker.getByText(`Touch Companion Set ${index}`, { exact: true }).locator('../..');
      await row.getByRole('button', { name: 'Add to Desk' }).click();
      await expect(row.getByRole('button', { name: `Remove Touch Companion Set ${index} from Desk` })).toBeEnabled();
    }
    const secondRow = picker.getByText('Touch Companion Set 2', { exact: true }).locator('../..');
    await secondRow.getByRole('button', { name: 'Remove Touch Companion Set 2 from Desk' }).click();
    await expect(secondRow.getByRole('button', { name: 'Add to Desk' })).toBeEnabled();
    await expect(picker.getByText('Touch Companion Set 1', { exact: true }).locator('../..').getByRole('button', { name: 'Remove Touch Companion Set 1 from Desk' })).toBeEnabled();
    await secondRow.getByRole('button', { name: 'Add to Desk' }).click();
    await expect(secondRow.getByRole('button', { name: 'Remove Touch Companion Set 2 from Desk' })).toBeEnabled();
    await picker.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Touch Companion Set 2” is ready on Desk' })).toBeVisible();
    for (const index of [1, 2]) await expect(page.locator(`[data-desk-set-object-id="set:touch-companion-${index}"]`)).toBeVisible();
    await page.reload({ waitUntil: 'domcontentloaded' });
    for (const index of [1, 2]) await expect(page.locator(`[data-desk-set-object-id="set:touch-companion-${index}"]`)).toBeVisible();
    let downloads = 0;
    page.on('request', (request) => { if (request.url().includes('/api/project-sources/google-drive/')) downloads += 1; });
    const first = page.locator('[data-desk-set-object-id="set:touch-companion-1"]');
    await first.getByRole('button', { name: 'Actions for Touch Companion Set 1' }).click();
    await page.getByRole('menuitem', { name: 'Open Set', exact: true }).click();
    await expect(page.locator('[data-desk="focused"]').first()).toBeVisible();
    expect(downloads).toBe(0);
    await page.goto('/account?section=library&scope=personal', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Actions for Touch Companion Set 2', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Open on Desk', exact: true }).click();
    await expect(page.locator('[data-desk="focused"]').first()).toBeVisible();
    await expect(page.locator('[data-desk-context-rail]')).toContainText('Touch Companion Set 2');
    expect(downloads).toBe(0);
  });

  test('keeps preparation visible after the picker closes until placement finishes', async ({ page }) => {
    await seedGuestScaleWorkspace(page, 100, { additionalSets: 1, cardLimit: 0 });
    await page.goto('/account', { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await expect(page.locator('[data-desk-arrival-phase="ready"]')).toBeVisible();
    const name = 'Touch Companion Set 1';
    const tile = page.locator('[data-desk-set-object-id="set:touch-companion-1"]');
    await tile.getByRole('button', { name: `Actions for ${name}` }).click();
    await page.getByRole('menuitem', { name: 'Remove from Desk' }).click();
    await expect(tile).toHaveCount(0);
    await page.getByRole('button', { name: 'Add from Library', exact: true }).first().click();
    const picker = page.getByRole('dialog', { name: 'Add from Library' });
    const blocker = await page.context().newPage();
    await blocker.goto('/robots.txt');
    const holdPlacement = () => blocker.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('cardforge-browser-storage');
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      });
      const transaction = db.transaction('key-value', 'readwrite');
      const store = transaction.objectStore('key-value');
      let holding = true;
      (window as typeof window & { releaseDeskPlacement?: () => void }).releaseDeskPlacement = () => { holding = false; };
      await new Promise<void>((resolve, reject) => {
        let first = true;
        const keepOpen = () => {
          const request = store.get('__desk_test_hold__');
          request.onerror = () => reject(request.error);
          request.onsuccess = () => { if (first) { first = false; resolve(); } if (holding) keepOpen(); };
        };
        keepOpen();
      });
    });
    try {
      await holdPlacement();
      await picker.getByText(name, { exact: true }).locator('../..').getByRole('button', { name: 'Add to Desk' }).click();
      await expect(picker.getByRole('progressbar', { name: `Preparing ${name}` })).toBeVisible();
      await picker.getByRole('button', { name: 'Done', exact: true }).click();
      await expect(page.getByRole('region', { name: 'Open work on Desk' }).getByRole('progressbar', { name: `Preparing ${name}` })).toBeVisible();
      await blocker.evaluate(() => (window as typeof window & { releaseDeskPlacement: () => void }).releaseDeskPlacement());
      await expect(page.getByRole('status').filter({ hasText: `${name}” is ready on Desk` })).toBeVisible();
      await expect(tile).toBeVisible();
      await page.getByRole('button', { name: 'Add from Library', exact: true }).first().click();
      await holdPlacement();
      await page.evaluate(() => {
        const original = IDBObjectStore.prototype.put;
        (window as typeof window & { restoreDeskPut?: () => void }).restoreDeskPut = () => { IDBObjectStore.prototype.put = original; };
        IDBObjectStore.prototype.put = function (value, key) {
          if (typeof key === 'string' && key.startsWith('project-preferences:desk-membership:v1:')) throw new DOMException('Simulated storage failure', 'QuotaExceededError');
          return original.call(this, value, key);
        };
      });
      await picker.getByRole('button', { name: `Remove ${name} from Desk` }).click();
      await expect(picker.getByRole('progressbar', { name: `Removing ${name}` })).toBeVisible();
      await picker.getByRole('button', { name: 'Done', exact: true }).click();
      await expect(page.getByRole('region', { name: 'Open work on Desk' }).getByRole('progressbar', { name: `Removing ${name}` })).toBeVisible();
      await blocker.evaluate(() => (window as typeof window & { releaseDeskPlacement: () => void }).releaseDeskPlacement());
      await expect(page.getByRole('region', { name: 'Open work on Desk' }).getByRole('alert').filter({ hasText: `Could not remove “${name}”` })).toBeVisible();
      await expect(tile).toBeVisible();
      await page.evaluate(() => (window as typeof window & { restoreDeskPut?: () => void }).restoreDeskPut?.());
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(tile).toBeVisible();
    } finally {
      await page.evaluate(() => (window as typeof window & { restoreDeskPut?: () => void }).restoreDeskPut?.()).catch(() => undefined);
      await blocker.evaluate(() => (window as typeof window & { releaseDeskPlacement?: () => void }).releaseDeskPlacement?.()).catch(() => undefined);
      await blocker.close();
    }
  });

  test('@golden gives Locations the compact Task viewport while keeping its controls scrollable', async ({ page }) => {
    await seedGuestScaleWorkspace(page, 100);
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/account?section=library&tool=locations', { waitUntil: 'domcontentloaded', timeout: 120_000 });

    const tool = page.getByRole('region', { name: 'Locations & connections', exact: true });
    await expect(tool).toBeVisible();
    await expect(page.locator('[aria-label="CardForge Library"] > [data-presentation-mode]')).toHaveAttribute('data-presentation-mode', 'task');

    const taskPanel = tool.locator(':scope > section');
    const taskGeometry = await taskPanel.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        top: rect.top,
        bottom: rect.bottom,
        viewportHeight: innerHeight,
        overflowY: style.overflowY,
      };
    });
    expect(taskGeometry.top).toBeGreaterThanOrEqual(0);
    expect(taskGeometry.bottom).toBeLessThanOrEqual(taskGeometry.viewportHeight + 1);
    expect(['auto', 'scroll']).toContain(taskGeometry.overflowY);
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

    const search = page.getByRole('searchbox', { name: 'Search Desk work', exact: true });
    await expectTouchTarget(search);
    await expect(page.getByRole('button', { name: 'Open commands', exact: true })).toHaveCount(0);
    const appHeader = page.locator('header[data-context="false"]');
    await expect(appHeader).toBeVisible();
    await expect(appHeader.getByRole('link', { name: 'Open the CardForge public site', exact: true })).toBeVisible();
    await expect(appHeader.getByPlaceholder('Search Desk work')).toBeVisible();

    const deskViewport = page.locator('[data-desk-viewport]');
    await expect(deskViewport).toBeVisible();
    const deskBounds = await deskViewport.boundingBox();
    expect(deskBounds?.height).toBeGreaterThan(480);
    await expect(page.getByRole('navigation', { name: 'Creative context', exact: true })).toHaveCount(0);

    const deskWorld = page.locator('[data-desk-world]');
    await expect(deskViewport).toHaveAttribute('data-grid', 'true');
    expect(await deskViewport.evaluate((node) => getComputedStyle(node).backgroundImage)).not.toBe('none');
    expect(await deskWorld.evaluate((node) => getComputedStyle(node).backgroundImage)).toBe('none');

    const toolbar = page.locator('[data-desk-toolbar]');
    await expect(toolbar.getByPlaceholder('Search Desk work')).toHaveCount(0);
    const filters = toolbar.locator('[data-mobile-desk-filters] > summary[aria-label="Open Desk filters"]');
    await expectTouchTarget(filters);
    const viewMenuTrigger = toolbar.getByRole('button', { name: 'Desk view controls', exact: true });
    await expectTouchTarget(viewMenuTrigger);
    await expect(toolbar.getByRole('button', { name: 'Zoom Desk out', exact: true })).toBeHidden();

    await viewMenuTrigger.tap();
    const viewMenu = page.getByRole('menu');
    await expect(viewMenu).toBeVisible();
    const gridToggle = viewMenu.getByRole('menuitem', { name: /grid$/i });
    await gridToggle.tap();
    await expect(viewMenu).toBeVisible();
    await gridToggle.tap();
    await expect(viewMenu).toBeVisible();
    await page.getByPlaceholder('Search Desk work').tap();
    await expect(viewMenu).toBeHidden();

    await filters.tap();
    await expect(toolbar.locator('[data-mobile-desk-filters]')).toHaveAttribute('open', '');
    const viewsFilter = toolbar.getByRole('button', { name: 'Choose Desk views', exact: true });
    await viewsFilter.tap();
    const filterMenu = page.getByRole('menu');
    await filterMenu.getByRole('menuitemcheckbox', { name: 'My work', exact: true }).tap();
    await expect(filterMenu).toBeVisible();
    await page.getByPlaceholder('Search Desk work').tap();
    await expect(toolbar.locator('[data-mobile-desk-filters]')).not.toHaveAttribute('open', '');

    const status = page.locator('footer[aria-label="Environment status"]');
    const statusItems = status.locator('[data-environment-status-items]');
    await expect(status).toBeVisible();
    await expect(statusItems.getByRole('button', { name: 'Quick actions', exact: true })).toBeVisible();
    expect(await statusItems.evaluate((node) => ['auto', 'scroll'].includes(getComputedStyle(node).overflowX))).toBe(true);
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
    // Focused creator depth keeps the same horizontally scrollable status rail;
    // Quick Actions is one compact item in that rail rather than a sibling bar.
    await expect(status).toBeVisible();
    await expect(statusItems.getByRole('button', { name: 'Quick actions', exact: true })).toBeVisible();
    await expect(statusItems.getByTitle('Open Locations & connections')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Creative context', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back to Desk', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);

    const artifactStage = page.locator('[data-desk-artifact-stage]');
    const viewControls = page.locator('[data-set-view-controls]');
    await expect(artifactStage).toHaveAttribute('data-grid', 'true');
    const artifactWorld = artifactStage.locator('[data-artifact-world]');
    expect(await artifactStage.evaluate((node) => getComputedStyle(node).backgroundImage)).not.toBe('none');
    expect(await artifactWorld.evaluate((node) => getComputedStyle(node).backgroundImage)).toBe('none');
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
    await expect(page.locator('[data-mobile-environment-navigation]')).toHaveCount(0);
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
