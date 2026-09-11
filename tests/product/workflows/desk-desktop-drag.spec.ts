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
});