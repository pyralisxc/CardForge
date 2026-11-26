import { expect, test } from '@playwright/test';

import {
  installBrowserPerformanceObservers,
  seedGuestScaleWorkspace,
} from './helpers/projectScaleBrowser';

const READY_TIMEOUT = 120_000;

test.describe('Desk desktop spatial interaction', () => {
  test.describe.configure({ timeout: READY_TIMEOUT });

  test('a tile Details action keeps the invoking Set when another Set is selected', async ({ page }) => {
    await seedGuestScaleWorkspace(page, 100, { additionalSets: 2, cardLimit: 0 });
    await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('cardforge-browser-storage', 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const value = JSON.stringify({ version: 4, positions: {
        'set:scale-set-100': { x: 170, y: 0, z: 1 },
        'set:touch-companion-1': { x: 0, y: 0, z: 2 },
        'set:touch-companion-2': { x: 42, y: 0, z: 3 },
      } });
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction('key-value', 'readwrite');
        for (const scope of ['guest', 'local']) transaction.objectStore('key-value').put(value, `project-preferences:home-desk-order:positions:${scope}`);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      db.close();
    });
    await page.goto('/account', { waitUntil: 'domcontentloaded', timeout: READY_TIMEOUT });
    await expect(page.locator('[data-desk-arrival-phase="ready"]')).toBeVisible();
    const first = page.getByRole('button', { name: /^(Select|Selected) Touch Companion Set 1/ });
    await first.focus();
    await first.press('Space');
    await expect(first).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Actions for Touch Companion Set 2' }).click();
    await expect(page.getByRole('menu', { name: 'Actions for Touch Companion Set 2' }).getByText('Touch Companion Set 2', { exact: true })).toBeVisible();
    await expect(page.locator('[data-desk-set-object-id="set:touch-companion-1"] button[aria-pressed]')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('[data-desk-set-object-id="set:touch-companion-2"] button[aria-pressed]')).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('menuitem', { name: 'Details', exact: true }).click();
    await expect(page.getByRole('complementary', { name: 'Details for Touch Companion Set 2' })).toBeVisible();
    await page.getByRole('button', { name: 'Close details for Touch Companion Set 2' }).click();
    await first.focus();
    await first.press('Control+Space');
    const firstPressed = page.locator('[data-desk-set-object-id="set:touch-companion-1"] button[aria-pressed]');
    const secondPressed = page.locator('[data-desk-set-object-id="set:touch-companion-2"] button[aria-pressed]');
    await expect(firstPressed).toHaveAttribute('aria-pressed', 'true');
    await expect(secondPressed).toHaveAttribute('aria-pressed', 'true');
    const secondActions = page.getByRole('button', { name: 'Actions for Touch Companion Set 2' });
    await secondActions.focus();
    await secondActions.press('Enter');
    await expect(page.getByRole('menu', { name: 'Actions for Touch Companion Set 2' })).toBeVisible();
    await expect(firstPressed).toHaveAttribute('aria-pressed', 'true');
    await expect(secondPressed).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
    await first.click({ button: 'right', position: { x: 5, y: 20 } });
    await expect(page.getByRole('menu', { name: 'Actions for Touch Companion Set 1' })).toBeVisible();
    await expect(firstPressed).toHaveAttribute('aria-pressed', 'true');
    await expect(secondPressed).toHaveAttribute('aria-pressed', 'true');
  });

  test('@golden @preview desktop Desk uses direct grab-and-drag movement without entering Move mode', async ({ page }) => {
    await installBrowserPerformanceObservers(page);
    await seedGuestScaleWorkspace(page, 100);
    await page.goto('/account', { waitUntil: 'domcontentloaded', timeout: READY_TIMEOUT });

    const setButton = page.getByRole('button', { name: /^(Select|Selected) 100 Card Scale Set/ });
    const setObject = page.locator('[data-desk-set-object-id="set:scale-set-100"]');
    const viewport = page.locator('[data-desk-viewport]');

    await expect(setButton).toBeVisible();
    const workSurface = page.getByRole('region', { name: 'Open work on Desk' });
    await expect(workSurface).toHaveCSS('display', 'flex');
    await workSurface.evaluate((node) => node.setAttribute('aria-label', 'Renamed Desk work'));
    await expect(page.getByRole('region', { name: 'Renamed Desk work' })).toHaveCSS('display', 'flex');
    await expect(page.locator('[data-desk-arrival-phase="ready"]')).toBeVisible();
    // Featured work must keep the same physical proxy footprint. The retired
    // featured-card minimum must not override a positioned Set's visual size.
    await expect.poll(() => setButton.evaluate((button) => {
      const visual = button.firstElementChild!;
      return Math.abs(Number.parseFloat(getComputedStyle(visual).minHeight)
        - Number.parseFloat(getComputedStyle(button).getPropertyValue('--desk-visual-height')));
    })).toBeLessThan(0.1);
    const previewCards = setObject.locator('[data-preview-artifact-id]');
    await expect(previewCards).toHaveCount(5);
    const previewCenters = await previewCards.evaluateAll((nodes) => nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return rect.left + rect.width / 2;
    }));
    expect(Math.max(...previewCenters) - Math.min(...previewCenters)).toBeGreaterThan(24);
    await expect(viewport).not.toHaveAttribute('data-arrange-mode', 'true');
    await expect(page.getByRole('button', { name: /^Move$/ })).toHaveCount(0);
    await expect(setButton).toHaveAttribute('title', /Drag to move/);
    await expect.poll(() => setButton.evaluate((node) => getComputedStyle(node).cursor)).toBe('grab');

    const box = await setButton.boundingBox();
    expect(box).not.toBeNull();
    const start = { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 72, start.y + 48, { steps: 5 });
    await page.mouse.up();

    await expect.poll(async () => setObject.evaluate((node) => {
      const style = (node as HTMLElement).style;
      return {
        x: Number.parseFloat(style.getPropertyValue('--desk-x')),
        y: Number.parseFloat(style.getPropertyValue('--desk-y')),
      };
    })).toMatchObject({ x: expect.any(Number), y: expect.any(Number) });

    const after = await setObject.evaluate((node) => {
      const style = (node as HTMLElement).style;
      return {
        x: Number.parseFloat(style.getPropertyValue('--desk-x')),
        y: Number.parseFloat(style.getPropertyValue('--desk-y')),
      };
    });
    // Selection can change the viewport frame; authored millimeters times zoom
    // alone do not represent screen travel. The grabbed point must follow the
    // pointer in the real rendered scene, then its authored position persists.
    const afterBox = await setButton.boundingBox();
    expect(afterBox).not.toBeNull();
    expect(Math.abs(afterBox!.x + afterBox!.width / 2 - start.x - 72)).toBeLessThan(2);
    expect(Math.abs(afterBox!.y + afterBox!.height / 2 - start.y - 48)).toBeLessThan(2);

    await page.reload({ waitUntil: 'domcontentloaded', timeout: READY_TIMEOUT });
    await expect.poll(() => page.locator('[data-desk-set-object-id="set:scale-set-100"]').evaluate((node) => {
      const style = (node as HTMLElement).style;
      return {
        x: Number.parseFloat(style.getPropertyValue('--desk-x')),
        y: Number.parseFloat(style.getPropertyValue('--desk-y')),
      };
    })).toEqual(after);
  });

  test('@golden Desk shell keeps the whole fitted Desk stable while selection stays object-local', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 720 });
    await seedGuestScaleWorkspace(page, 100);
    await page.goto('/account', { waitUntil: 'domcontentloaded', timeout: READY_TIMEOUT });

    await expect(page.getByPlaceholder('Search Desk work')).toBeVisible();
    await expect(page.getByPlaceholder('Find work')).toHaveCount(0);
    await expect(page.getByText('Access', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Connections', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Security', { exact: true })).toHaveCount(0);
    await expect(page.getByText('1 visible work', { exact: true })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Creative context', exact: true })).toHaveCount(0);

    const toolbar = page.locator('[data-desk-toolbar]');
    await expect(toolbar.getByRole('button', { name: 'Zoom Desk out', exact: true })).toBeVisible();
    await expect.poll(() => toolbar.evaluate((node) => {
      const rail = node.getBoundingClientRect();
      const add = Array.from(node.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Add from Library')?.getBoundingClientRect();
      return Boolean(add && add.left >= rail.left - 1 && add.right <= rail.right + 1);
    })).toBe(true);
    await expect(page.locator('header').getByRole('button', { name: 'Zoom Desk out', exact: true })).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

    const viewport = page.locator('[data-desk-viewport]');
    const setButton = page.getByRole('button', { name: /^(Select|Selected) 100 Card Scale Set/ });
    await expect(viewport).toBeVisible();
    await expect(viewport).toHaveAttribute('data-camera-mode', 'fit-work');
    await expect(setButton).toBeInViewport({ ratio: 0.99 });

    await setButton.click();
    await expect(setButton).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-desk-context-rail][data-depth="desk"]')).toBeHidden();
    await expect(page.getByRole('navigation', { name: 'Creative context', exact: true })).toHaveCount(0);
    await expect(setButton).toBeInViewport({ ratio: 0.99 });

    const expectToolbarControlsClear = async (widths = [901, 929, 960, 1024, 1180, 1440], height = 720) => {
      for (const width of widths) {
      await page.setViewportSize({ width, height });
      await expect.poll(() => toolbar.evaluate((node) => {
        const controls = Array.from(node.querySelectorAll<HTMLElement>('button, input, summary'))
          .map((element) => ({
            name: element.getAttribute('aria-label') || element.textContent || element.tagName,
            rect: element.getBoundingClientRect(),
          }))
          .filter(({ rect }) => rect.width > 0 && rect.height > 0);
        return controls.flatMap((left, index) => controls.slice(index + 1).flatMap((right) => {
          const overlapWidth = Math.min(left.rect.right, right.rect.right) - Math.max(left.rect.left, right.rect.left);
          const overlapHeight = Math.min(left.rect.bottom, right.rect.bottom) - Math.max(left.rect.top, right.rect.top);
          return overlapWidth > 1 && overlapHeight > 1 ? [`${left.name} overlaps ${right.name}`] : [];
        }));
      })).toEqual([]);
      await toolbar.getByRole('button', { name: 'Add from Library', exact: true }).click({ trial: true });
      await setButton.click({ trial: true });
      }
    };
    await expectToolbarControlsClear();
    const enlargedLabels = await page.addStyleTag({ content: '[data-desk-toolbar] button { font-size: 18px !important; }' });
    await expectToolbarControlsClear();
    await enlargedLabels.evaluate((node) => node.parentNode?.removeChild(node));
    await toolbar.getByRole('button', { name: /^Organize / }).click();
    await expectToolbarControlsClear([901, 1024], 600);
    await toolbar.getByRole('button', { name: 'Close organize', exact: true }).click();
    await page.setViewportSize({ width: 1024, height: 720 });

    const storage = page.getByRole('button', { name: /Storage/ }).first();
    await expect(storage).toBeVisible();
    await storage.click();
    await expect(page.getByRole('region', { name: 'Storage and connections' })).toBeVisible();
    await expect(page).toHaveURL(/\/account(?:\?|$)/);
    await page.getByRole('button', { name: 'Done', exact: true }).click();
  });

  test('@golden zero-result filtering keeps the Desk camera recoverable', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 720 });
    await seedGuestScaleWorkspace(page, 100);
    await page.goto('/account', { waitUntil: 'domcontentloaded', timeout: READY_TIMEOUT });

    const viewport = page.locator('[data-desk-viewport]');
    const search = page.getByPlaceholder('Search Desk work');
    await expect(viewport).toBeVisible();
    await search.fill('no matching work exists');
    await expect(page.getByText('No work matches this view', { exact: true })).toBeVisible();
    await expect(viewport).toHaveAttribute('data-camera-mode', 'whole');
    await expect(viewport).toHaveAttribute('data-relative-zoom', '1.00');
    await expect.poll(async () => Number(await viewport.getAttribute('data-zoom'))).toBeGreaterThan(0.1);

    await page.getByRole('button', { name: 'Show My work', exact: true }).click();
    await expect(page.getByRole('button', { name: /^(Select|Selected) 100 Card Scale Set/ })).toBeVisible();
    await page.getByRole('button', { name: 'Fit Work', exact: true }).click();
    await expect(viewport).toHaveAttribute('data-camera-mode', 'fit-work');
    await expect(page.getByRole('button', { name: /^(Select|Selected) 100 Card Scale Set/ })).toBeInViewport({ ratio: 0.99 });
  });

  test('@golden Desk action menu exposes truthful actions, hands off focus cleanly, and persists deletion', async ({ page }) => {
    await seedGuestScaleWorkspace(page, 100);
    await page.goto('/account', { waitUntil: 'domcontentloaded', timeout: READY_TIMEOUT });

    const setObject = page.locator('[data-desk-set-object-id="set:scale-set-100"]');
    const actionsTrigger = page.getByRole('button', { name: 'Actions for 100 Card Scale Set' });
    await expect(setObject).toBeVisible();

    await actionsTrigger.click();
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitem')).toHaveCount(9);
    await expect(menu.getByRole('menuitem', { name: 'Open Set' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Generate cards' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: /^Save & move/ })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Send to Pipeline' })).toHaveCount(0);
    await expect(menu.getByRole('menuitem', { name: 'Duplicate' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Output' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Details' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Review updates' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Remove from Desk' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Trash' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(actionsTrigger).toBeFocused();

    await actionsTrigger.click();
    await page.getByRole('menuitem', { name: 'Details' }).click();
    await expect(page.getByRole('menu')).toBeHidden();
    await expect(page.getByRole('complementary', { name: 'Details for 100 Card Scale Set' })).toBeVisible();
    await page.getByRole('button', { name: 'Close details for 100 Card Scale Set' }).click();

    await actionsTrigger.click();
    await page.getByRole('menuitem', { name: 'Trash' }).click();
    await expect(page.getByRole('menu')).toBeHidden();
    await expect(page.getByRole('alertdialog')).toContainText('Trash “100 Card Scale Set”?');
    await page.getByRole('button', { name: 'Permanently delete device copy' }).click();
    await expect(setObject).toHaveCount(0);

    await page.reload({ waitUntil: 'domcontentloaded', timeout: READY_TIMEOUT });
    await expect(page.locator('[data-desk-set-object-id="set:scale-set-100"]')).toHaveCount(0);
    await expect(page.locator('[data-desk-arrival-phase="ready"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create your first Set', exact: true })).toBeVisible();
  });

  test('@golden focused Set fills narrow desktop viewport without document overflow', async ({ page }) => {
    await page.setViewportSize({ width: 929, height: 650 });
    await seedGuestScaleWorkspace(page, 100);
    await page.goto('/account', { waitUntil: 'domcontentloaded', timeout: READY_TIMEOUT });

    await page.getByRole('button', { name: /^(Select|Selected) 100 Card Scale Set/ }).dblclick();
    const board = page.locator('[data-desk-set-board]');
    await expect(board).toBeVisible();
    await expect(page.getByRole('searchbox', { name: 'Search cards in this Set', exact: true })).toBeVisible();
    await expect(page.getByRole('searchbox')).toHaveCount(1);
    await expect(page.getByPlaceholder('Search cards', { exact: true })).toBeHidden();
    // The retired command palette must not interrupt focused Set work.
    await page.keyboard.press('Control+k');
    await expect(page.getByRole('dialog', { name: 'Actions for this context' })).toHaveCount(0);
    await expect(board).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

    const stage = page.locator('[data-desk-artifact-stage]');
    await expect(stage).toHaveAttribute('data-camera-mode', 'fit-work');
    const boardBox = await board.boundingBox();
    const mainBox = await page.locator('main[data-scene-viewport]').boundingBox();
    expect(boardBox).not.toBeNull();
    expect(mainBox).not.toBeNull();
    expect(boardBox!.width).toBeGreaterThan(mainBox!.width * 0.92);

    const artifact = page.locator('button[data-artifact-id="scale-card-1"]');
    const stageBeforeSelection = await stage.boundingBox();
    await artifact.click();
    await expect(artifact).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => stage.boundingBox()).toEqual(stageBeforeSelection);
    const selectionActions = page.getByRole('toolbar', { name: 'Selection actions' });
    for (const width of [768, 800, 929, 1040]) {
      await page.setViewportSize({ width, height: 650 });
      await expect.poll(() => selectionActions.locator('..').evaluate((toolbar) => {
        const outer = toolbar.getBoundingClientRect();
        const controls = Array.from(toolbar.children, (element) => element.getBoundingClientRect()).filter((rect) => rect.width > 0 && rect.height > 0);
        return controls.some((rect) => rect.left < outer.left - 1 || rect.right > outer.right + 1)
          || controls.some((left, index) => controls.slice(index + 1).some((right) => Math.min(left.right, right.right) - Math.max(left.left, right.left) > 1 && Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > 1));
      })).toBe(false);
    }
    await page.setViewportSize({ width: 929, height: 650 });
    const tagInput = selectionActions.getByRole('textbox', { name: 'New tag name' });
    await selectionActions.getByRole('button', { name: 'Remove', exact: true }).focus();
    for (let index = 0; index < 4 && !await tagInput.evaluate((input) => input === document.activeElement); index += 1) await page.keyboard.press('Tab');
    await expect(tagInput).toBeFocused();
    await expect.poll(async () => {
      const [bar, input] = await Promise.all([selectionActions.boundingBox(), tagInput.boundingBox()]);
      return Boolean(bar && input && input.x >= bar.x - 1 && input.x + input.width <= bar.x + bar.width + 1);
    }).toBe(true);
    await page.getByRole('button', { name: 'Clear Artifact selection', exact: true }).click();
    await expect(artifact).toHaveAttribute('aria-pressed', 'false');
    await artifact.dblclick();
    const focused = page.locator('[data-focused-artifact-workspace]');
    await expect(focused).toBeVisible();
    await expect(focused).toHaveAttribute('data-editing', 'false');
    await expect(page.locator('[data-artifact-edit-workspace]')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(focused).toHaveCount(0);
    await artifact.dblclick();
    await expect(focused).toBeVisible();

    // Editing remains an explicit second step after focus settles.
    await page.locator('[data-desk-context-rail]').getByRole('button', { name: 'Edit', exact: true }).click();
    await expect(page.locator('[data-artifact-edit-workspace]')).toBeVisible();
  });
});
