import { expect, test } from '@playwright/test';

import {
  installBrowserPerformanceObservers,
  seedGuestScaleWorkspace,
} from './helpers/projectScaleBrowser';

const READY_TIMEOUT = 120_000;

test.describe('Desk desktop spatial interaction', () => {
  test.describe.configure({ timeout: READY_TIMEOUT });

  test('@golden desktop Desk uses direct grab-and-drag movement without entering Move mode', async ({ page }) => {
    await installBrowserPerformanceObservers(page);
    await seedGuestScaleWorkspace(page, 100);
    await page.goto('/account', { waitUntil: 'domcontentloaded', timeout: READY_TIMEOUT });

    const setButton = page.getByRole('button', { name: /^(Select|Selected) 100 Card Scale Set/ });
    const setObject = page.locator('[data-desk-set-object-id="set:scale-set-100"]');
    const viewport = page.locator('[data-desk-viewport]');

    await expect(setButton).toBeVisible();
    await expect(viewport).not.toHaveAttribute('data-arrange-mode', 'true');
    await expect(page.getByRole('button', { name: /^Move$/ })).toHaveCount(0);
    await expect(setButton).toHaveAttribute('title', /Drag to move/);
    await expect.poll(() => setButton.evaluate((node) => getComputedStyle(node).cursor)).toBe('grab');

    const before = await setObject.evaluate((node) => {
      const style = (node as HTMLElement).style;
      return {
        x: Number.parseFloat(style.getPropertyValue('--desk-x')),
        y: Number.parseFloat(style.getPropertyValue('--desk-y')),
      };
    });
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
    expect(after.x - before.x).toBeGreaterThan(30);
    expect(after.y - before.y).toBeGreaterThan(20);

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
    await expect(page.getByText(/1 open project/)).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Creative context', exact: true })).toHaveCount(0);

    const toolbar = page.locator('[data-desk-toolbar]');
    await expect(toolbar.getByRole('button', { name: 'Zoom Desk out', exact: true })).toBeVisible();
    await expect(page.locator('header').getByRole('button', { name: 'Zoom Desk out', exact: true })).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

    const viewport = page.locator('[data-desk-viewport]');
    await expect(viewport).toBeVisible();
    await expect.poll(() => viewport.evaluate((node) => ({
      horizontal: node.scrollWidth - node.clientWidth,
      vertical: node.scrollHeight - node.clientHeight,
    }))).toEqual({ horizontal: 0, vertical: 0 });

    const setButton = page.getByRole('button', { name: /^(Select|Selected) 100 Card Scale Set/ });
    await setButton.click();
    await expect(setButton).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-desk-context-rail][data-depth="desk"]')).toBeHidden();
    await expect(page.getByRole('navigation', { name: 'Creative context', exact: true })).toHaveCount(0);
    await expect.poll(() => viewport.evaluate((node) => ({
      horizontal: node.scrollWidth - node.clientWidth,
      vertical: node.scrollHeight - node.clientHeight,
    }))).toEqual({ horizontal: 0, vertical: 0 });

    const storage = page.getByRole('button', { name: /Storage/ }).first();
    await expect(storage).toBeVisible();
    await storage.click();
    await expect(page.getByRole('region', { name: 'Storage and connections' })).toBeVisible();
    await expect(page).toHaveURL(/\/account(?:\?|$)/);
    await page.getByRole('button', { name: 'Done', exact: true }).click();
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
    await expect(menu.getByRole('menuitem')).toHaveCount(7);
    await expect(menu.getByRole('menuitem', { name: 'Open Set' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Generate cards' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: /^Save & move/ })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Send to Pipeline' })).toHaveCount(0);
    await expect(menu.getByRole('menuitem', { name: 'Duplicate' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Output' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Details' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Delete device copy' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(actionsTrigger).toBeFocused();

    await actionsTrigger.click();
    await page.getByRole('menuitem', { name: 'Details' }).click();
    await expect(page.getByRole('menu')).toBeHidden();
    await expect(page.getByRole('complementary', { name: 'Details for 100 Card Scale Set' })).toBeVisible();
    await page.getByRole('button', { name: 'Close details for 100 Card Scale Set' }).click();

    await actionsTrigger.click();
    await page.getByRole('menuitem', { name: 'Delete device copy' }).click();
    await expect(page.getByRole('menu')).toBeHidden();
    await expect(page.getByRole('alertdialog')).toContainText('Delete this Set from this device?');
    await page.getByRole('button', { name: 'Delete local Set' }).click();
    await expect(setObject).toHaveCount(0);

    await page.reload({ waitUntil: 'domcontentloaded', timeout: READY_TIMEOUT });
    await expect(page.locator('[data-desk-set-object-id="set:scale-set-100"]')).toHaveCount(0);
  });

  test('@golden focused Set fills narrow desktop viewport without document overflow', async ({ page }) => {
    await page.setViewportSize({ width: 929, height: 650 });
    await seedGuestScaleWorkspace(page, 100);
    await page.goto('/account', { waitUntil: 'domcontentloaded', timeout: READY_TIMEOUT });

    await page.getByRole('button', { name: /^(Select|Selected) 100 Card Scale Set/ }).dblclick();
    const board = page.locator('[data-desk-set-board]');
    await expect(board).toBeVisible();
    await expect(page.getByPlaceholder('Search cards in this Set')).toBeVisible();
    await expect(page.getByPlaceholder('Search cards', { exact: true })).toBeHidden();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

    const stage = page.locator('[data-desk-artifact-stage]');
    await expect(stage).toHaveAttribute('data-relative-zoom', '1.00');
    const boardBox = await board.boundingBox();
    const mainBox = await page.locator('main[data-scene-viewport]').boundingBox();
    expect(boardBox).not.toBeNull();
    expect(mainBox).not.toBeNull();
    expect(boardBox!.width).toBeGreaterThan(mainBox!.width * 0.92);
  });
});