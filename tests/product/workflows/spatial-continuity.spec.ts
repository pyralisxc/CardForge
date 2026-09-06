import { devices, expect, test } from '@playwright/test';
import { seedGuestScaleWorkspace } from './helpers/projectScaleBrowser';

test.describe('persistent Artifact scene', () => {
  test.setTimeout(120_000);

  test('@golden carries the same artifact node from stack through editing and back', async ({ page }, testInfo) => {
    await seedGuestScaleWorkspace(page, 100, { staleToolTemplate: true });
    await page.goto('/account', { waitUntil: 'domcontentloaded' });
    const visual = page.locator('[data-scene-artifact="scale-card-1"]');
    await expect(visual).toHaveAttribute('data-scene-depth', 'stack');
    await expect(page.locator('[data-scene-depth="stack"]')).toHaveCount(5);
    const original = await visual.elementHandle();
    expect(original).not.toBeNull();
    await page.screenshot({ path: testInfo.outputPath('desk.png') });
    const set = page.getByRole('button', { name: /^(Select|Selected) 100 Card Scale Set/ });
    await set.click();
    await original!.evaluate((node) => {
      (window as unknown as { trajectory: Promise<Array<{ x: number; y: number; connected: boolean }>> }).trajectory = new Promise((resolve) => {
        document.addEventListener('keydown', () => {
          const samples: Array<{ x: number; y: number; connected: boolean }> = [];
          const started = performance.now();
          const sample = () => {
            const rect = node.getBoundingClientRect();
            samples.push({ x: Math.round(rect.x), y: Math.round(rect.y), connected: node.isConnected });
            if (performance.now() - started < 2200) requestAnimationFrame(sample); else resolve(samples);
          };
          sample();
        }, { once: true });
      });
    });
    await set.press('Enter');
    const trajectory = await page.evaluate(() => (window as unknown as { trajectory: Promise<Array<{ x: number; y: number; connected: boolean }>> }).trajectory);
    await testInfo.attach('opening-trajectory', { body: JSON.stringify(trajectory), contentType: 'application/json' });
    expect(trajectory.every((sample) => sample.connected)).toBe(true);
    expect(new Set(trajectory.map(({ x, y }) => `${x},${y}`)).size).toBeGreaterThan(3);
    await expect(visual).toHaveAttribute('data-scene-depth', 'board');
    expect(await original!.evaluate((node) => node.isConnected)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('set.png') });
    await page.locator('button[data-artifact-id="scale-card-1"]').click();
    await expect(visual).toHaveAttribute('data-scene-depth', 'focus');
    expect(await original!.evaluate((node) => node.isConnected)).toBe(true);
    await visual.getByRole('button', { name: /^Show back of/ }).click();
    await expect(visual).toHaveAttribute('data-scene-face', 'back');
    await page.locator('[data-desk-context-rail]').getByRole('button', { name: 'Edit', exact: true }).click();
    await expect(page.locator('[data-artifact-edit-workspace]')).toBeVisible();
    await expect(visual).toHaveAttribute('data-scene-depth', 'edit');
    await expect(visual).toHaveAttribute('data-scene-face', 'back');
    expect(await original!.evaluate((node) => node.isConnected)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('edit.png') });
    const editor = page.locator('[data-artifact-edit-workspace]');
    await editor.getByRole('button', { name: /^Show front of/ }).click();
    await expect(visual).toHaveAttribute('data-scene-face', 'front');
    await editor.getByRole('button', { name: /^Show back of/ }).click();
    await expect(visual).toHaveAttribute('data-scene-face', 'back');
    const artwork = editor.getByRole('textbox', { name: /Artwork/ }).first();
    await artwork.fill('/brand/cardforge-studio/brand-mark.svg');
    await editor.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(visual).toHaveAttribute('data-scene-depth', 'focus');
    await page.locator('[data-desk-context-rail]').getByRole('button', { name: 'Edit', exact: true }).click();
    await expect(artwork).toHaveValue('/brand/cardforge-studio/brand-mark.svg');
    await artwork.fill('/brand/cardforge-studio/brand-mark.svg?draft=1');
    await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
    await expect(visual).toHaveAttribute('data-scene-depth', 'focus');
    await page.getByRole('button', { name: 'Back to Set', exact: true }).click();
    await expect(visual).toHaveAttribute('data-scene-depth', 'board');
    await expect(visual).toHaveAttribute('data-scene-face', 'back');
    await page.getByRole('button', { name: 'Back to Desk', exact: true }).click();
    await expect(visual).toHaveAttribute('data-scene-depth', 'stack');
    expect(await original!.evaluate((node) => node.isConnected)).toBe(true);
    await original!.dispose();
  });
});

test.describe('compact scene with reduced motion', () => {
  test.use({ viewport: devices['Pixel 7'].viewport, isMobile: true, hasTouch: true, contextOptions: { reducedMotion: 'reduce' } });
  test.setTimeout(120_000);
  test('@golden preserves the artifact through touch focus and tool close', async ({ page }) => {
    await seedGuestScaleWorkspace(page, 100);
    await page.goto('/account', { waitUntil: 'domcontentloaded' });
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
    const visual = page.locator('[data-scene-artifact="scale-card-1"]');
    await expect(visual).toHaveAttribute('data-scene-depth', 'stack');
    const original = await visual.elementHandle();
    await page.getByRole('button', { name: /^(Select|Selected) 100 Card Scale Set/ }).tap();
    await page.getByRole('button', { name: 'Open', exact: true }).tap();
    await page.locator('button[data-artifact-id="scale-card-1"]').tap();
    await expect(visual).toHaveAttribute('data-scene-depth', 'focus');
    await page.locator('[data-desk-context-rail]').getByRole('button', { name: 'Edit', exact: true }).tap();
    await expect(visual).toHaveAttribute('data-scene-depth', 'edit');
    await expect.poll(async () => {
      const bounds = await visual.boundingBox();
      return Boolean(bounds && bounds.x >= 0 && bounds.x + bounds.width <= page.viewportSize()!.width);
    }).toBe(true);
    await page.locator('[data-artifact-edit-workspace]').getByRole('button', { name: 'Cancel', exact: true }).tap();
    await expect(visual).toHaveAttribute('data-scene-depth', 'focus');
    expect(await original!.evaluate((node) => node.isConnected)).toBe(true);
    await original!.dispose();
  });
});
