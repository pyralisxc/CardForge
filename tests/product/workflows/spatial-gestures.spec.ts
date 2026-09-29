import { devices, expect, test, type Locator } from '@playwright/test';
import { openScaleSet, seedGuestScaleWorkspace } from './helpers/projectScaleBrowser';

test.describe('spatial touch workspace', () => {
  test.use({ viewport: devices['Pixel 7'].viewport, isMobile: true, hasTouch: true });
  test('@golden browses focused Artifacts without changing the Set, while magnified card inspection still pans', async ({ page, context }, testInfo) => {
    test.setTimeout(120_000);
    await seedGuestScaleWorkspace(page, 100);
    await page.goto('/account');
    await openScaleSet(page, 100);
    const spatialArtifacts = page.locator('[data-desk-artifact-stage] button[data-artifact-id]');
    await expect(spatialArtifacts).toHaveCount(100);
    const firstBoardSlot = page.locator('[data-scene-slot="scale-card-1"][data-scene-slot-depth="board"]');
    await expect(firstBoardSlot).toHaveAttribute('data-scene-inline-board', 'true');
    const boardCard = page.locator('button[data-artifact-id="scale-card-1"]');
    await boardCard.focus();
    await boardCard.press('Enter');
    const workspace = page.locator('[data-focused-artifact-workspace]');
    await expect(workspace).toBeVisible();
    const controls = workspace.locator('[aria-label="Focused Artifact tools"]');
    await expect(controls).toBeVisible();
    await expect(controls.getByRole('button', { name: 'Browse this Set', exact: true })).toBeVisible();
    await expect(page.locator('[data-desk-context-rail]').getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
    await expect(controls.getByRole('button', { name: 'Download individual card', exact: true })).toBeVisible();
    expect(await controls.evaluate((node) => node.scrollHeight <= node.clientHeight + 2)).toBe(true);
    expect(await controls.evaluate((node) => node.scrollWidth <= node.clientWidth + 2)).toBe(true);
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(controls.getByRole('button', { name: 'Browse this Set', exact: true })).toBeInViewport({ ratio: 1 });
      await page.locator('[data-desk-context-rail]').getByRole('button', { name: 'Edit', exact: true }).click();
      const done = controls.getByRole('button', { name: 'Done', exact: true });
      await expect(done).toBeInViewport({ ratio: 1 });
      await expect(controls.getByRole('button', { name: 'More focused Artifact actions', exact: true })).toBeInViewport({ ratio: 1 });
      expect(await controls.evaluate((node) => node.scrollWidth <= node.clientWidth + 2)).toBe(true);
      await done.click();
    }
    await page.setViewportSize(devices['Pixel 7'].viewport);
    const focusedCard = workspace.locator('button[data-artifact-id]');
    await expect(focusedCard).toHaveAttribute('data-artifact-id', 'scale-card-1');
    const stage = page.getByLabel('100 Card Scale Set focused Artifact viewport');
    const box = (await stage.boundingBox())!;
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const cdp = await context.newCDPSession(page);
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', points: Array<{ x: number; y: number; id: number }>) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });

    await touch('touchStart', [{ ...point, id: 9 }]);
    await touch('touchEnd', []);
    await touch('touchStart', [{ ...point, id: 10 }]);
    await touch('touchEnd', []);
    await expect(workspace).toHaveAttribute('data-editing', 'true');
    await controls.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(workspace).toHaveAttribute('data-editing', 'false');

    await touch('touchStart', [{ ...point, id: 1 }]);
    await touch('touchMove', [{ x: point.x + 96, y: point.y, id: 1 }]);
    await touch('touchEnd', []);
    await expect(focusedCard).toHaveAttribute('data-artifact-id', 'scale-card-2');
    await focusedCard.press('ArrowRight');
    await expect(focusedCard).toHaveAttribute('data-artifact-id', 'scale-card-3');

    await controls.getByRole('button', { name: 'More focused Artifact actions', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Zoom in', exact: true }).click();
    await expect(stage).toHaveAttribute('data-auto-fit', 'false');
    await touch('touchStart', [{ ...point, id: 2 }]);
    await touch('touchMove', [{ x: point.x - 96, y: point.y, id: 2 }]);
    await touch('touchEnd', []);
    await expect(focusedCard).toHaveAttribute('data-artifact-id', 'scale-card-3');

    await controls.getByRole('button', { name: 'More focused Artifact actions', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Fit Artifact', exact: true }).click();
    await workspace.getByRole('button', { name: 'Browse this Set', exact: true }).click();
    await page.getByRole('button', { name: 'Open Artifact to the left', exact: true }).click();
    await expect(focusedCard).toHaveAttribute('data-artifact-id', 'scale-card-2');
    // Browsing creates artifact history; open space is a direct return affordance
    // and must leave focus without replaying previous Artifact history.
    const stageBox = (await stage.boundingBox())!;
    const frameBox = (await workspace.locator('[data-focused-artifact-frame]').boundingBox())!;
    const backdropPoint = { x: stageBox.x + 8, y: stageBox.y + 8 };
    expect(backdropPoint.x < frameBox.x || backdropPoint.y < frameBox.y).toBe(true);
    await stage.tap({ position: { x: backdropPoint.x - stageBox.x, y: backdropPoint.y - stageBox.y } });
    await expect(workspace).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('focused-artifact-browse.png') });
  });

  test('@golden pans, holds to move, pinches, and restores the same Set camera', async ({ page, context }, testInfo) => {
    test.setTimeout(120_000);
    await seedGuestScaleWorkspace(page, 100, { staleToolTemplate: true });
    await page.goto('/account');
    const cdp = await context.newCDPSession(page);
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel', points: Array<{ x: number; y: number; id: number }>) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
    const center = async (locator: Locator) => {
      const b = (await locator.boundingBox())!;
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    };
    const storage = page.getByTitle('Open Locations & connections');
    await expect(storage).toBeVisible();
    await storage.tap();
    await expect(page.getByRole('region', { name: 'Locations & connections', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Done', exact: true }).tap();
    const desk = page.locator('[data-desk-viewport]');
    const set = page.getByRole('button', { name: /^(Select|Selected) 100 Card Scale Set/ });
    await expect(desk).toBeVisible();
    expect((await desk.boundingBox())!.height).toBeGreaterThan(500);
    // Fit Work keeps the visible authored object complete and readable without
    // changing its world coordinates; Whole Desk remains a separate action.
    await expect(set).toBeInViewport({ ratio: 0.99 });
    const setBox = (await set.boundingBox())!;
    const deskBox = (await desk.boundingBox())!;
    expect(setBox.width).toBeGreaterThan(44);
    expect(setBox.height).toBeGreaterThan(44);
    expect(setBox.x).toBeGreaterThanOrEqual(deskBox.x - 1);
    expect(setBox.y).toBeGreaterThanOrEqual(deskBox.y - 1);
    expect(setBox.x + setBox.width).toBeLessThanOrEqual(deskBox.x + deskBox.width + 1);
    expect(setBox.y + setBox.height).toBeLessThanOrEqual(deskBox.y + deskBox.height + 1);
    const setObject = page.locator('[data-desk-set-object-id="set:scale-set-100"]');
    const before = await setObject.getAttribute('style');
    const p = await center(set);
    await touch('touchStart', [{ ...p, id: 1 }]);
    await expect(set).toHaveAttribute('data-spatial-held', 'true');
    await touch('touchMove', [{ x: p.x + 40, y: p.y + 35, id: 1 }]);
    await touch('touchEnd', []);
    await expect(setObject).not.toHaveAttribute('style', before!);
    await openScaleSet(page, 100);
    const stage = page.locator('[data-desk-artifact-stage]').first();
    await expect(stage).toBeVisible();
    expect((await stage.boundingBox())!.height).toBeGreaterThan(420);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 2)).toBe(true);
    await expect(stage).toHaveAttribute('data-camera-mode', 'fit-work');
    const card = page.locator('button[data-artifact-id="scale-card-1"]');
    const tile = card.locator('..');
    const originalPosition = await tile.getAttribute('style');
    const cardPoint = await center(card);
    const fitWorkZoom = Number(await stage.getAttribute('data-zoom'));
    // Deliberate zoom creates the pannable Custom camera before a swipe explores the Set.
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await expect(stage).toHaveAttribute('data-camera-mode', 'custom');
    await expect.poll(async () => Number(await stage.getAttribute('data-zoom'))).toBeGreaterThan(fitWorkZoom);
    const cameraBeforePan = await stage.evaluate((node) => ({
      x: Number(node.getAttribute('data-camera-x')),
      y: Number(node.getAttribute('data-camera-y')),
    }));
    await touch('touchStart', [{ ...cardPoint, id: 2 }]);
    await touch('touchMove', [{ x: cardPoint.x - 50, y: cardPoint.y, id: 2 }]);
    await touch('touchEnd', []);
    await expect.poll(async () => Number(await stage.getAttribute('data-camera-x'))).toBeGreaterThan(cameraBeforePan.x);
    await expect(stage).toHaveAttribute('data-camera-mode', 'custom');
    await expect(page.locator('[data-focused-artifact-workspace]')).toHaveCount(0);
    await page.getByRole('button', { name: 'Fit Work', exact: true }).click();
    await expect(stage).toHaveAttribute('data-camera-mode', 'fit-work');
    await expect(stage).toHaveAttribute('data-relative-zoom', '1.00');
    await expect(card).toBeVisible();
    await expect(tile).toHaveAttribute('style', originalPosition!);
    const start = await center(card);
    await touch('touchStart', [{ ...start, id: 3 }]);
    await expect(card).toHaveAttribute('data-spatial-held', 'true');
    await touch('touchMove', [{ x: start.x + 45, y: start.y + 50, id: 3 }]);
    await touch('touchEnd', []);
    await expect(tile).not.toHaveAttribute('style', originalPosition!);
    const movedPosition = await tile.getAttribute('style');
    await expect(page.locator('[data-focused-artifact-workspace]')).toHaveCount(0);
    await page.getByRole('button', { name: 'Undo Artifact move' }).click();
    await expect(tile).toHaveAttribute('style', originalPosition!);
    await page.getByRole('button', { name: 'Redo Artifact move' }).click();
    await expect(tile).toHaveAttribute('style', movedPosition!);
    const pinchPoint = await center(stage);
    const world = page.locator('[data-artifact-world]');
    const worldAtPinch = async () => {
      const rect = (await world.boundingBox())!;
      const zoom = Number(await stage.getAttribute('data-zoom'));
      return { x: (pinchPoint.x - rect.x) / zoom, y: (pinchPoint.y - rect.y) / zoom };
    };
    const anchorBefore = await worldAtPinch();
    await touch('touchStart', [{ x: pinchPoint.x - 50, y: pinchPoint.y, id: 4 }, { x: pinchPoint.x + 50, y: pinchPoint.y, id: 5 }]);
    await touch('touchMove', [{ x: pinchPoint.x - 80, y: pinchPoint.y, id: 4 }, { x: pinchPoint.x + 80, y: pinchPoint.y, id: 5 }]);
    await touch('touchEnd', []);
    await expect.poll(async () => Number(await stage.getAttribute('data-relative-zoom'))).toBeGreaterThan(1.25);
    const anchorAfter = await worldAtPinch();
    const zoomAfter = Number(await stage.getAttribute('data-zoom'));
    expect(Math.abs(anchorAfter.x - anchorBefore.x) * zoomAfter).toBeLessThan(3);
    expect(Math.abs(anchorAfter.y - anchorBefore.y) * zoomAfter).toBeLessThan(3);
    await expect(tile).toHaveAttribute('style', movedPosition!);
    await expect(page.locator('[data-focused-artifact-workspace]')).toHaveCount(0);
    await page.getByRole('button', { name: 'Fit Work', exact: true }).click();
    await expect(stage).toHaveAttribute('data-camera-mode', 'fit-work');
    // Transform-camera travel is interruptible and owns no scroll surface.
    // Wait for the semantic Fit Work target before sampling object coordinates.
    await expect(stage).toHaveAttribute('data-relative-zoom', '1.00');
    // Cancellation is an object-local gesture; exercise it while Fit Work keeps
    // the moved card deliberately readable before changing camera semantics.
    const cancelPoint = await center(card);
    await expect.poll(() => page.evaluate(({ x, y }) => (
      document.elementFromPoint(x, y)?.closest('button[data-artifact-id]')?.getAttribute('data-artifact-id') ?? null
    ), cancelPoint)).toBe('scale-card-1');
    await touch('touchStart', [{ ...cancelPoint, id: 6 }]);
    await page.waitForTimeout(400);
    await touch('touchMove', [{ x: cancelPoint.x + 120, y: cancelPoint.y + 96, id: 6 }]);
    await expect.poll(() => tile.getAttribute('style')).not.toBe(movedPosition!);
    await touch('touchCancel', []);
    await expect(tile).toHaveAttribute('style', movedPosition!);
    await page.getByRole('button', { name: 'Whole Set', exact: true }).click();
    await expect(stage).toHaveAttribute('data-camera-mode', 'whole');
    const box = (await world.boundingBox())!;
    await touch('touchStart', [{ x: box.x + 3, y: box.y + 3, id: 7 }]);
    await expect(stage).toHaveAttribute('data-spatial-held', 'true');
    await touch('touchMove', [{ x: box.x + 320, y: box.y + 185, id: 7 }]);
    await touch('touchEnd', []);
    expect(await stage.locator('button[aria-pressed="true"]').count()).toBeGreaterThan(1);
    await page.screenshot({ path: testInfo.outputPath('mobile-set.png') });
    // Selection is visual state. Deliberate focus is a separate activation.
    await card.tap();
    await expect(card).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-focused-artifact-workspace]')).toHaveCount(0);
    await card.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-focused-artifact-workspace]')).toBeVisible();
    await page.getByRole('button', { name: 'Back to Set', exact: true }).click();
    await expect(tile).toHaveAttribute('style', movedPosition!);
  });
});

test('@golden desktop uses the full viewport and zoom leaves card positions stable', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await seedGuestScaleWorkspace(page, 100);
  await page.goto('/account');
  await openScaleSet(page, 100);
  const stage = page.locator('[data-desk-artifact-stage]').first();
  const bounds = (await stage.boundingBox())!;
  await page.screenshot({ path: testInfo.outputPath('desktop-set.png') });
  expect(bounds.width).toBeGreaterThan(1700);
  await expect.poll(async () => (await stage.boundingBox())!.height).toBeGreaterThan(700);
  await expect(stage).toHaveAttribute('data-camera-mode', 'fit-work');
  const card = page.locator('button[data-artifact-id="scale-card-1"]');
  const position = await card.locator('..').getAttribute('style');
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(stage).toHaveAttribute('data-camera-mode', 'custom');
  await expect(card.locator('..')).toHaveAttribute('style', position!);
  await expect(page.locator('[data-scene-depth="board"][data-scene-moving="true"]')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('desktop-set.png') });
  await page.getByRole('button', { name: /^Organize/ }).click();
  await page.getByRole('combobox', { name: 'Arrange cards' }).click();
  await page.getByRole('option', { name: 'Arrange as grid', exact: true }).click();
  await page.getByRole('button', { name: /^Organize/ }).click();
  await expect(stage).toHaveAttribute('data-arrangement', 'grid');
  const arrangedPositions = await page.locator('[data-artifact-world] > div[style]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('style')));
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('[data-artifact-world] > div[style]')).toHaveCount(arrangedPositions.length);
  expect(await page.locator('[data-artifact-world] > div[style]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('style')))).toEqual(arrangedPositions);
  await page.setViewportSize({ width: 1_920, height: 1_080 });
  await page.getByRole('button', { name: 'Whole Set', exact: true }).click();
  await expect(stage).toHaveAttribute('data-camera-mode', 'whole');
  const secondTile = page.locator('button[data-artifact-id="scale-card-11"]').locator('..');
  const secondPosition = await secondTile.getAttribute('style');
  const first = (await card.boundingBox())!;
  await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
  await page.mouse.down();
  await page.mouse.move(first.x + first.width / 2 + 40, first.y + first.height / 2 + 32, { steps: 5 });
  await page.mouse.up();
  await expect(stage).toHaveAttribute('data-arrangement', 'manual');
  await expect(secondTile).toHaveAttribute('style', secondPosition!);
});
