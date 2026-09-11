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

  test('@golden Desk shell removes duplicate account tiles and opens Storage in context', async ({ page }) => {
    await seedGuestScaleWorkspace(page, 100);
    await page.goto('/account', { waitUntil: 'domcontentloaded', timeout: READY_TIMEOUT });

    await expect(page.getByPlaceholder('Search Desk work')).toBeVisible();
    await expect(page.getByPlaceholder('Find work')).toHaveCount(0);
    await expect(page.getByText('Access', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Connections', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Security', { exact: true })).toHaveCount(0);
    await expect(page.getByText(/1 open project/)).toBeVisible();

    const storage = page.getByRole('button', { name: /Storage/ }).first();
    await expect(storage).toBeVisible();
    await storage.click();
    await expect(page.getByRole('region', { name: 'Storage and connections' })).toBeVisible();
    await expect(page).toHaveURL(/\/account(?:\?|$)/);
  });

  test('@golden Desk delete menu removes the exact device Set and persists after reload', async ({ page }) => {
    await seedGuestScaleWorkspace(page, 100);
    await page.goto('/account', { waitUntil: 'domcontentloaded', timeout: READY_TIMEOUT });

    const setObject = page.locator('[data-desk-set-object-id="set:scale-set-100"]');
    await expect(setObject).toBeVisible();
    await page.getByRole('button', { name: 'Actions for 100 Card Scale Set' }).click();
    await page.getByRole('menuitem', { name: 'Delete device copy' }).click();
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

    const boardBox = await board.boundingBox();
    const mainBox = await page.locator('main[data-scene-viewport]').boundingBox();
    expect(boardBox).not.toBeNull();
    expect(mainBox).not.toBeNull();
    expect(boardBox!.width).toBeGreaterThan(mainBox!.width * 0.92);
  });
});
