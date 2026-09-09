import { devices, expect, test } from '@playwright/test';
import { seedGuestScaleWorkspace } from './helpers/projectScaleBrowser';

test.describe('persistent Artifact scene', () => {
  test.setTimeout(120_000);

  test('preserves the Set search through rename and browser Back', async ({ page }) => {
    await seedGuestScaleWorkspace(page, 100);
    await page.goto('/account', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /^Select 100 Card Scale Set/ }).press('Enter');
    const search = page.getByRole('textbox', { name: 'Search cards in this work' });
    await search.fill('Scale Card 0001');
    await page.getByRole('button', { name: 'More Set actions' }).click();
    await page.getByRole('menuitem', { name: 'Rename', exact: true }).click();
    await page.getByRole('textbox', { name: 'Set name', exact: true }).fill('Renamed scale Set');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(search).toHaveValue('Scale Card 0001');
    await page.locator('button[data-artifact-id="scale-card-1"]').click();
    await expect(page.locator('[data-focused-artifact-workspace]')).toBeVisible();
    await page.goBack();
    await expect(search).toHaveValue('Scale Card 0001');
    await expect(page.locator('button[data-artifact-id]')).toHaveCount(1);
  });

  test('finds overlapped Sets by name and keeps the card field stable under Organize', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 585 });
    await seedGuestScaleWorkspace(page, 100, { additionalSets: 8, templateContent: true });
    await page.goto('/account', { waitUntil: 'domcontentloaded' });
    await page.getByRole('textbox', { name: 'Search open work' }).fill('100 Card Scale Set');
    const set = page.getByRole('button', { name: /^Select 100 Card Scale Set/ });
    await set.click();
    await page.getByRole('button', { name: 'Open', exact: true }).click();
    const field = page.locator('[data-desk-artifact-stage]');
    const before = await field.boundingBox();
    expect(before!.height).toBeGreaterThan(300);
    await page.getByRole('button', { name: /^Organize/ }).click();
    await expect(page.getByRole('combobox', { name: 'Arrange cards' })).toBeVisible();
    expect((await field.boundingBox())!.height).toBe(before!.height);
    await page.screenshot({ path: testInfo.outputPath('short-organize.png') });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('combobox', { name: 'Arrange cards' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Back to Desk' })).toBeVisible();
  });

  test('@golden keeps focused work and controls inside a short viewport after panning the Desk', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 585 });
    await seedGuestScaleWorkspace(page, 100, { templateContent: true, additionalSets: 8 });
    await page.goto('/account', { waitUntil: 'domcontentloaded' });
    const set = page.getByRole('button', { name: /^(Select|Selected) 100 Card Scale Set/ });
    // Overlapping spatial objects remain reachable through their keyboard controls.
    await set.press('Space');
    await page.locator('[data-desk-viewport]').evaluate((node) => node.scrollTo({ left: 400, top: 300 }));
    await page.keyboard.press('Enter');
    await page.locator('button[data-artifact-id="scale-card-1"]').click();
    const workspace = page.locator('[data-focused-artifact-workspace]');
    await expect(workspace).toBeVisible();
    await expect.poll(async () => {
      const header = await page.locator('[data-desk-context-rail]').boundingBox();
      const controls = await page.getByLabel('Focused Artifact controls').boundingBox();
      return Boolean(header && controls && controls.y >= header.y + header.height && controls.y + controls.height < 585);
    }).toBe(true);
    await expect.poll(async () => {
      const card = await page.locator('[data-scene-artifact="scale-card-1"]').boundingBox();
      const stage = await page.getByLabel('100 Card Scale Set focused Artifact viewport').boundingBox();
      return Boolean(card && stage && card.y >= stage.y - 1 && card.y + card.height <= stage.y + stage.height + 1);
    }).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('short-focused-card.png') });
  });

  test('@golden carries the same artifact node from stack through editing and back', async ({ page }, testInfo) => {
    await seedGuestScaleWorkspace(page, 100, { staleToolTemplate: true });
    await page.goto('/account', { waitUntil: 'domcontentloaded' });
    const visual = page.locator('[data-scene-artifact="scale-card-1"]');
    await expect(visual).toHaveAttribute('data-scene-depth', 'stack');
    await expect(page.locator('[data-scene-depth="stack"]')).toHaveCount(5);
    const original = await visual.elementHandle();
    expect(original).not.toBeNull();
    await expect.poll(async () => {
      const title = await page.locator('[data-set-object] strong').first().boundingBox();
      const bottoms = await page.locator('[data-scene-depth="stack"]').evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect().bottom));
      return Boolean(title && bottoms.every((bottom) => bottom < title.y));
    }).toBe(true);
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
    await expect(visual).toHaveAttribute('data-scene-face', 'back');
    await page.locator('[data-desk-context-rail]').getByRole('button', { name: 'Edit', exact: true }).click();
    await expect(artwork).toHaveValue('/brand/cardforge-studio/brand-mark.svg');
    await artwork.fill('/brand/cardforge-studio/brand-mark.svg?draft=1');
    await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
    await expect(visual).toHaveAttribute('data-scene-depth', 'focus');
    await expect(visual).toHaveAttribute('data-scene-face', 'back');
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
