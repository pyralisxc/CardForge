import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

import {
  closeScaleSet,
  installBrowserPerformanceObservers,
  openScaleSet,
  readBrowserPerformanceEvidence,
  resetLongTasks,
  seedGuestScaleWorkspace,
  type ProjectScale,
} from './helpers/projectScaleBrowser';

const READY_TIMEOUT = 120_000;
const OPEN_BUDGET_MS: Record<ProjectScale, number> = { 100: 2_000, 500: 3_500, 1000: 5_000 };
const INTERACTION_BUDGET_MS = 2_000;
const MAX_LONG_TASK_MS = 1_000;

const attachEvidence = async (testInfo: TestInfo, name: string, value: unknown) => {
  console.info(`[cardforge-browser-evidence:${name}] ${JSON.stringify(value)}`);
  await testInfo.attach(name, {
    body: Buffer.from(JSON.stringify(value, null, 2)),
    contentType: 'application/json',
  });
};

const prepareScalePage = async (page: Page, cardCount: ProjectScale, options: { additionalSets?: number } = {}) => {
  const previewShareUrl = process.env.CARDFORGE_E2E_PREVIEW_SHARE_URL;
  await installBrowserPerformanceObservers(page);
  if (previewShareUrl) await page.goto(previewShareUrl, { waitUntil: 'domcontentloaded', timeout: READY_TIMEOUT });
  await seedGuestScaleWorkspace(page, cardCount, options);
  await page.goto('/account', { waitUntil: 'domcontentloaded', timeout: READY_TIMEOUT });
  await expect(page.getByRole('heading', { name: 'Your creative workspace' })).toBeVisible();
  await expect(page.getByRole('button', { name: new RegExp(`^(Select|Selected) ${cardCount} Card Scale Set`) })).toBeVisible();
};

const elapsed = async (action: () => Promise<void>) => {
  const startedAt = Date.now();
  await action();
  return Date.now() - startedAt;
};

test.describe('large Artifact browser evidence', () => {
  test.describe.configure({ timeout: READY_TIMEOUT });

  for (const cardCount of [100, 500, 1000] as const) {
    test(`${cardCount} Artifacts stay complete, culled, and responsive`, async ({ page }, testInfo) => {
      await prepareScalePage(page, cardCount);
      await resetLongTasks(page);

      const openMs = await openScaleSet(page, cardCount, { expectOpeningMotion: true });
      const visualArtifacts = page.locator('[data-desk-artifact-stage] [data-artifact-id]');
      const expensivePreviews = page.locator('[data-desk-artifact-stage] [id^="card-preview-"]');
      const mountedVisuals = await visualArtifacts.count();
      const mountedExpensivePreviews = await expensivePreviews.count();
      expect(mountedVisuals).toBeGreaterThan(0);
      expect(mountedVisuals).toBeLessThan(cardCount);
      expect(mountedExpensivePreviews).toBeLessThanOrEqual(Math.min(160, mountedVisuals));

      const panMs = await elapsed(async () => {
        await page.locator('[data-desk-artifact-stage]').evaluate((stage) => {
          stage.scrollTo({ left: stage.scrollWidth, top: stage.scrollHeight });
        });
        await expect(page.locator(`[data-artifact-id="scale-card-${cardCount}"]`)).toBeVisible();
      });

      const zoomMs = await elapsed(async () => {
        await page.getByRole('button', { name: 'Zoom out' }).click();
        await expect(page.getByText('85%', { exact: true })).toBeVisible();
      });

      const searchMs = await elapsed(async () => {
        await page.getByPlaceholder('Search cards').fill(`Scale Card ${String(cardCount).padStart(4, '0')}`);
        await expect(page.getByText('1 shown', { exact: true })).toBeVisible();
        await page.getByPlaceholder('Search cards').fill('');
        await expect(page.getByText(`${cardCount} shown`, { exact: true })).toBeVisible();
      });

      await page.getByText(`Ordered Artifact navigator · ${cardCount}`, { exact: true }).click();
      const orderedOptions = page.getByRole('option');
      await expect(orderedOptions).toHaveCount(cardCount);
      await expect(page.locator('[role="listbox"] [role="group"]')).toHaveCount(10);
      await orderedOptions.first().focus();
      await page.keyboard.press('PageDown');
      await expect(page.getByRole('group', { name: new RegExp('Group 2') }).getByRole('option').first()).toBeFocused();
      await page.keyboard.press('Home');
      await expect(orderedOptions.first()).toBeFocused();
      const selectionMs = await elapsed(async () => {
        await page.keyboard.press('Space');
        await expect(orderedOptions.first()).toHaveAttribute('aria-selected', 'true');
      });
      const jumpMs = await elapsed(async () => {
        await page.keyboard.press('End');
        await expect(orderedOptions.last()).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(page.locator(`[data-artifact-id="scale-card-${cardCount}"]`)).toBeVisible();
        await expect(page.locator(`[data-artifact-id="scale-card-${cardCount}"]`)).toBeFocused();
        await expect(page.locator('[data-desk-artifact-stage]')).toHaveAttribute('data-artifact-focus-exclusive', 'true');
        await expect(visualArtifacts).toHaveCount(1);
      });
      await page.evaluate(() => window.history.back());
      await expect(page.getByRole('button', { name: 'Back to Desk' })).toBeVisible();
      await expect(page.locator('[data-desk-artifact-stage]')).toHaveAttribute('data-artifact-focus-exclusive', 'false');
      await expect(orderedOptions.last()).toBeFocused();
      const closeMs = await closeScaleSet(page);
      const browserEvidence = await readBrowserPerformanceEvidence(page);

      expect(openMs).toBeLessThan(OPEN_BUDGET_MS[cardCount]);
      expect(panMs).toBeLessThan(INTERACTION_BUDGET_MS);
      expect(zoomMs).toBeLessThan(INTERACTION_BUDGET_MS);
      expect(searchMs).toBeLessThan(INTERACTION_BUDGET_MS);
      expect(selectionMs).toBeLessThan(INTERACTION_BUDGET_MS);
      expect(jumpMs).toBeLessThan(INTERACTION_BUDGET_MS);
      expect(closeMs).toBeLessThan(INTERACTION_BUDGET_MS);
      expect(browserEvidence.maxLongTaskMs).toBeLessThan(MAX_LONG_TASK_MS);

      await attachEvidence(testInfo, `artifact-scale-${cardCount}.json`, {
        cardCount,
        mountedVisuals,
        mountedExpensivePreviews,
        timingsMs: { openMs, panMs, zoomMs, searchMs, selectionMs, jumpMs, closeMs },
        ...browserEvidence,
      });
    });
  }

  test('@golden Desk spatial controls move a real Set and restore its saved position', async ({ page }) => {
    await prepareScalePage(page, 100);
    const setButton = page.getByRole('button', { name: /^(Select|Selected) 100 Card Scale Set/ });
    const setObject = page.locator('[data-desk-set-object-id="set:scale-set-100"]');

    await setButton.click();
    await page.getByRole('button', { name: 'Move selected Sets right' }).click();
    await expect(setObject).toHaveAttribute('data-positioned', 'true');
    const savedX = await setObject.evaluate((node) => node.getAttribute('style')?.match(/--desk-x:\s*([^;]+)/)?.[1] ?? '');
    expect(savedX).not.toBe('');

    await page.reload({ waitUntil: 'domcontentloaded', timeout: READY_TIMEOUT });
    await expect(page.locator('[data-desk-set-object-id="set:scale-set-100"]')).toHaveAttribute('data-positioned', 'true');
    await expect.poll(() => page.locator('[data-desk-set-object-id="set:scale-set-100"]').evaluate((node) => node.getAttribute('style')?.match(/--desk-x:\s*([^;]+)/)?.[1] ?? '')).toBe(savedX);
  });

  test('@golden mobile Desk supports touch multi-selection, group movement, marquee, and pinch zoom', async ({ page, context }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await prepareScalePage(page, 100, { additionalSets: 1 });
    const viewport = page.locator('[data-desk-viewport]');
    const setButton = page.getByRole('button', { name: /^(Select|Selected) 100 Card Scale Set/ });
    const setObject = page.locator('[data-desk-set-object-id="set:scale-set-100"]');
    const companionButton = page.getByRole('button', { name: /^(Select|Selected) Touch Companion Set 1/ });
    const companionObject = page.locator('[data-desk-set-object-id="set:touch-companion-1"]');
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    const touch = async (type: 'touchStart' | 'touchMove' | 'touchEnd', points: Array<{ x: number; y: number; id: number }>) => {
      await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
    };
    const center = async (locator: Locator) => {
      const box = await locator.boundingBox();
      expect(box).not.toBeNull();
      return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
    };

    await expect(viewport).toBeVisible();
    await expect(page.getByRole('button', { name: 'Filter open work by source' })).toHaveCount(0);
    await expect(viewport).toHaveAttribute('aria-label', /Swipe or scroll to explore/);
    await expect(page.getByText('Swipe the Desk to look around')).toBeVisible();
    const initialZoom = Number(await viewport.getAttribute('data-zoom'));
    expect(initialZoom).toBeGreaterThan(0.6);
    await expect.poll(() => viewport.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
    await expect.poll(() => page.locator('[class*="deskToolbar"]').evaluate((toolbar) => {
      const bounds = toolbar.getBoundingClientRect();
      return Array.from(toolbar.children).every((child) => {
        const rect = child.getBoundingClientRect();
        return rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1;
      });
    })).toBe(true);
    await expect.poll(() => setButton.evaluate((node) => getComputedStyle(node).touchAction)).toBe('pan-x pan-y');

    await viewport.evaluate((node) => node.scrollTo({ left: 0, top: 0 }));
    await setButton.click();
    const beforeMoveMode = await setObject.boundingBox();
    await page.getByRole('button', { name: 'Move', exact: true }).click();
    await expect(viewport).toHaveAttribute('data-arrange-mode', 'true');
    await expect.poll(() => setButton.evaluate((node) => getComputedStyle(node).touchAction)).toBe('none');
    const afterMoveMode = await setObject.boundingBox();
    expect(beforeMoveMode).not.toBeNull();
    expect(afterMoveMode).not.toBeNull();
    expect(Math.abs(afterMoveMode!.x - beforeMoveMode!.x)).toBeLessThan(1);
    expect(Math.abs(afterMoveMode!.y - beforeMoveMode!.y)).toBeLessThan(1);

    const companionCenter = await center(companionButton);
    await touch('touchStart', [{ ...companionCenter, id: 1 }]);
    await touch('touchEnd', []);
    await expect(setButton).toHaveAttribute('aria-pressed', 'true');
    await expect(companionButton).toHaveAttribute('aria-pressed', 'true');

    const beforeGroup = await Promise.all([setObject.boundingBox(), companionObject.boundingBox()]);
    await touch('touchStart', [{ ...companionCenter, id: 2 }]);
    await touch('touchMove', [{ x: companionCenter.x + 36, y: companionCenter.y + 24, id: 2 }]);
    await touch('touchEnd', []);
    await expect.poll(async () => {
      const afterGroup = await Promise.all([setObject.boundingBox(), companionObject.boundingBox()]);
      if (beforeGroup.some((box) => !box) || afterGroup.some((box) => !box)) return false;
      const firstDelta = { x: afterGroup[0]!.x - beforeGroup[0]!.x, y: afterGroup[0]!.y - beforeGroup[0]!.y };
      const secondDelta = { x: afterGroup[1]!.x - beforeGroup[1]!.x, y: afterGroup[1]!.y - beforeGroup[1]!.y };
      return firstDelta.x > 10 && firstDelta.y > 5
        && Math.abs(firstDelta.x - secondDelta.x) < 2
        && Math.abs(firstDelta.y - secondDelta.y) < 2;
    }).toBe(true);

    await page.getByRole('button', { name: 'Clear Desk selection' }).click();
    const marqueeTarget = await companionObject.boundingBox();
    expect(marqueeTarget).not.toBeNull();
    const marqueeStart = await companionObject.evaluate((node) => {
      const tile = node.getBoundingClientRect();
      const world = node.parentElement!;
      const candidates = [
        { x: tile.left - 24, y: tile.top - 24 },
        { x: tile.right + 24, y: tile.top - 24 },
        { x: tile.left - 24, y: tile.bottom + 24 },
        { x: tile.right + 24, y: tile.bottom + 24 },
      ];
      return candidates.find((point) => document.elementFromPoint(point.x, point.y) === world) ?? null;
    });
    expect(marqueeStart).not.toBeNull();
    await touch('touchStart', [{ ...marqueeStart!, id: 5 }]);
    await touch('touchMove', [{ x: marqueeTarget!.x + marqueeTarget!.width / 2, y: marqueeTarget!.y + marqueeTarget!.height / 2, id: 5 }]);
    await touch('touchEnd', []);
    await expect(companionButton).toHaveAttribute('aria-pressed', 'true');

    const zoomBeforePinch = Number(await viewport.getAttribute('data-zoom'));
    const viewportBox = await viewport.boundingBox();
    expect(viewportBox).not.toBeNull();
    const pinchY = viewportBox!.y + Math.min(180, viewportBox!.height / 2);
    const pinchCenterX = viewportBox!.x + viewportBox!.width / 2;
    await touch('touchStart', [
      { x: pinchCenterX - 40, y: pinchY, id: 3 },
      { x: pinchCenterX + 40, y: pinchY, id: 4 },
    ]);
    await touch('touchMove', [
      { x: pinchCenterX - 70, y: pinchY, id: 3 },
      { x: pinchCenterX + 70, y: pinchY, id: 4 },
    ]);
    await touch('touchEnd', []);
    await expect.poll(async () => Number(await viewport.getAttribute('data-zoom'))).toBeGreaterThan(zoomBeforePinch);

    const cameraBeforeFocus = await viewport.evaluate((node) => ({
      left: node.scrollLeft,
      top: node.scrollTop,
      zoom: node.getAttribute('data-zoom'),
    }));
    await page.getByRole('button', { name: 'Open', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Back to Desk' })).toBeVisible();
    await page.getByRole('button', { name: 'Back to Desk' }).click();
    await expect(viewport).toBeVisible();
    await expect.poll(() => viewport.evaluate((node) => ({
      left: node.scrollLeft,
      top: node.scrollTop,
      zoom: node.getAttribute('data-zoom'),
    }))).toEqual(cameraBeforeFocus);

    await page.getByRole('button', { name: 'Fit the whole Desk in view' }).click();
    await expect.poll(async () => Number(await viewport.getAttribute('data-zoom'))).toBeLessThan(initialZoom);
    await expect.poll(() => viewport.evaluate((node) => node.scrollWidth <= node.clientWidth + 2)).toBe(true);
    await expect.poll(() => viewport.evaluate((node) => {
      const world = node.querySelector<HTMLElement>('[data-grid]');
      if (!world) return false;
      const worldRect = world.getBoundingClientRect();
      return worldRect.width <= node.clientWidth + 2 && worldRect.height <= node.clientHeight + 2;
    })).toBe(true);
    await cdp.detach();
  });

  test('Artifact focus preserves exact Set context through Back and Escape', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await prepareScalePage(page, 100);
    await openScaleSet(page, 100);
    const focusedSetId = new URL(page.url()).searchParams.get('focus');
    expect(focusedSetId).toBeTruthy();

    const stage = page.locator('[data-desk-artifact-stage]:visible');
    const visibleArtifacts = stage.locator('[data-artifact-id]');
    const first = visibleArtifacts.first();
    const second = visibleArtifacts.nth(1);
    const firstId = await first.getAttribute('data-artifact-id');
    expect(firstId).toBeTruthy();
    await first.click({ modifiers: ['Control'] });
    await second.click({ modifiers: ['Control'] });
    const before = await stage.evaluate((node) => ({ left: node.scrollLeft, top: node.scrollTop }));
    const selectedBefore = await stage.locator('[data-artifact-id][aria-pressed="true"]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-artifact-id')));

    await first.click();
    const focusedStage = page.locator('[data-focused-artifact-workspace] [data-desk-artifact-stage]');
    const primarySurface = page.locator('main[data-scroll="contained"]');
    const workSurface = page.locator('section[aria-labelledby="desk-open-work-heading"]');
    await expect(focusedStage).toHaveAttribute('data-artifact-focus-exclusive', 'true');
    await expect.poll(() => primarySurface.evaluate((node) => ({ left: node.scrollLeft, top: node.scrollTop }))).toEqual({ left: 0, top: 0 });
    await expect.poll(() => workSurface.evaluate((node) => ({ left: node.scrollLeft, top: node.scrollTop }))).toEqual({ left: 0, top: 0 });
    await expect.poll(async () => {
      const stageBox = await focusedStage.boundingBox();
      const surfaceBox = await primarySurface.boundingBox();
      if (!stageBox || !surfaceBox) return false;
      return stageBox.x >= surfaceBox.x
        && stageBox.y >= surfaceBox.y
        && stageBox.x + stageBox.width <= surfaceBox.x + surfaceBox.width
        && stageBox.y + stageBox.height <= surfaceBox.y + surfaceBox.height
        && stageBox.width / surfaceBox.width > 0.8;
    }).toBe(true);
    await expect(visibleArtifacts).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Back to Set' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Design', exact: true })).toHaveCount(0);
    await expect.poll(() => new URL(page.url()).searchParams.get('artifact')).toBe(firstId);
    await expect.poll(async () => focusedStage.locator(`[data-artifact-id="${firstId}"]`).evaluate((node) => Number.parseFloat(getComputedStyle(node).transitionDuration))).toBeLessThanOrEqual(0.001);
    await expect.poll(async () => {
      const focusedArtifactBox = await focusedStage.locator(`[data-artifact-id="${firstId}"]`).boundingBox();
      const focusedStageBox = await focusedStage.boundingBox();
      if (!focusedArtifactBox || !focusedStageBox) return 0;
      return focusedArtifactBox.height / focusedStageBox.height;
    }).toBeGreaterThan(0.55);

    await page.reload({ waitUntil: 'domcontentloaded', timeout: READY_TIMEOUT });
    await expect(page.locator('[data-desk-artifact-stage]')).toHaveAttribute('data-artifact-focus-exclusive', 'true');
    await expect(page.locator('[data-desk-artifact-stage] [data-artifact-id]')).toHaveCount(1);
    await expect(page.locator(`[data-artifact-id="${firstId}"]`)).toBeVisible();
    await expect.poll(() => new URL(page.url()).searchParams.get('artifact')).toBe(firstId);

    await page.evaluate(() => window.history.back());
    await expect(stage).toHaveAttribute('data-artifact-focus-exclusive', 'false');
    await expect(page.getByRole('button', { name: 'Back to Desk' })).toBeVisible();
    await expect.poll(() => stage.evaluate((node) => ({ left: node.scrollLeft, top: node.scrollTop }))).toEqual(before);
    await expect.poll(async () => stage.locator('[data-artifact-id][aria-pressed="true"]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-artifact-id')))).toEqual(selectedBefore);

    await page.locator(`[data-artifact-id="${firstId}"]`).click();
    await expect(page.getByRole('button', { name: 'Back to Set' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Back to Desk' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-desk="overview"]')).toBeVisible();

    await page.goto(`/account?focus=${encodeURIComponent(focusedSetId!)}&artifact=${encodeURIComponent(firstId!)}`, { waitUntil: 'domcontentloaded', timeout: READY_TIMEOUT });
    await expect(page.locator('[data-desk-artifact-stage]')).toHaveAttribute('data-artifact-focus-exclusive', 'true');
    await expect(page.locator(`[data-artifact-id="${firstId}"]`)).toBeVisible();
    await page.evaluate(() => window.history.back());
    await expect(page.getByRole('button', { name: 'Back to Desk' })).toBeVisible();
    await page.evaluate(() => window.history.back());
    await expect(page.locator('[data-desk="overview"]')).toBeVisible();
  });

  test('ordered navigator restores keyboard focus through Back, Escape, and browser Back', async ({ page }) => {
    await prepareScalePage(page, 100);
    await openScaleSet(page, 100);
    await page.getByText('Ordered Artifact navigator · 100', { exact: true }).click();
    const option = page.getByRole('option').nth(12);
    const artifactId = await option.getAttribute('id').then((id) => id?.replace('ordered-artifact-', ''));
    expect(artifactId).toBeTruthy();

    const openFromNavigator = async () => {
      await option.focus();
      await page.keyboard.press('Enter');
      await expect(page.locator(`[data-artifact-id="${artifactId}"]`)).toBeFocused();
      await expect(page.locator('[data-desk-artifact-stage]')).toHaveAttribute('data-artifact-focus-exclusive', 'true');
    };

    await openFromNavigator();
    await page.getByRole('button', { name: 'Back to Set' }).click();
    await expect(option).toBeFocused();

    await openFromNavigator();
    await page.keyboard.press('Escape');
    await expect(option).toBeFocused();

    await openFromNavigator();
    await page.evaluate(() => window.history.back());
    await expect(option).toBeFocused();
  });

  test('repeated focus and Design cycles keep post-warmup heap and transient UI growth bounded', async ({ page, context }, testInfo) => {
    test.setTimeout(300_000);
    await prepareScalePage(page, 100);
    const cdp = await context.newCDPSession(page);
    const collectHeap = async () => {
      await cdp.send('HeapProfiler.collectGarbage');
      return (await cdp.send('Runtime.getHeapUsage') as { usedSize: number }).usedSize;
    };
    const runCycle = async () => {
      await openScaleSet(page, 100);
      await page.getByRole('button', { name: 'Design', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Design Artifacts' })).toBeVisible();
      await page.getByRole('button', { name: 'Close Studio tool' }).click();
      await expect(page.getByRole('dialog', { name: 'Design Artifacts' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Back to Desk' })).toBeVisible();
      await closeScaleSet(page);
      const closeStorageNotice = page.getByRole('button', { name: 'Close notification' });
      if (await closeStorageNotice.isVisible()) await closeStorageNotice.click();
    };

    for (let warmup = 0; warmup < 3; warmup += 1) await runCycle();
    const baselineDomNodes = await page.locator('*').count();
    const baselineHeap = await collectHeap();
    const baselineBrowserEvidence = await readBrowserPerformanceEvidence(page);
    const heapReadings = [baselineHeap];
    const measuredCycles = 8;
    for (let cycle = 0; cycle < measuredCycles; cycle += 1) {
      await runCycle();
      heapReadings.push(await collectHeap());
      expect(await page.getByRole('dialog').count()).toBe(0);
    }
    const finalDomNodes = await page.locator('*').count();
    const finalHeap = heapReadings.at(-1) ?? baselineHeap;
    const browserEvidence = await readBrowserPerformanceEvidence(page);
    const heapAllowance = Math.max(8 * 1024 * 1024, baselineHeap * 0.25);
    const heapGrowthPerCycle = Math.max(0, finalHeap - baselineHeap) / measuredCycles;
    const activeObjectUrlGrowth = browserEvidence.objectUrls.active - baselineBrowserEvidence.objectUrls.active;

    await attachEvidence(testInfo, 'artifact-lifecycle-soak.json', {
      warmupCycles: 3,
      measuredCycles,
      baselineDomNodes,
      finalDomNodes,
      heapReadings,
      heapAllowance,
      heapGrowthPerCycle,
      baselineObjectUrls: baselineBrowserEvidence.objectUrls,
      activeObjectUrlGrowth,
      ...browserEvidence,
    });
    expect(finalDomNodes).toBeLessThanOrEqual(baselineDomNodes + 25);
    expect(finalHeap).toBeLessThanOrEqual(baselineHeap + heapAllowance);
    expect(heapGrowthPerCycle).toBeLessThan(1024 * 1024);
    expect(activeObjectUrlGrowth).toBeLessThanOrEqual(0);
    await cdp.detach();
  });

  test('Desk baseline defers heavy contextual tool bundles until invocation', async ({ page }, testInfo) => {
    const scripts = new Set<string>();
    const scriptPayloads: Array<Promise<string>> = [];
    page.on('response', (response) => {
      if (response.request().resourceType() !== 'script') return;
      scripts.add(response.url());
      scriptPayloads.push(Promise.race([
        response.text().catch(() => ''),
        new Promise<string>((resolve) => setTimeout(() => resolve(''), 2_000)),
      ]));
    });
    await prepareScalePage(page, 100);
    await expect.poll(() => scripts.size).toBeGreaterThan(0);
    const baselineScripts = new Set(scripts);
    const baselinePayloadCount = scriptPayloads.length;
    const baselineCorpus = (await Promise.all(scriptPayloads.slice(0, baselinePayloadCount))).join('\n');
    const deferredMarkers = {
      design: 'studio-ready',
      output: 'raster-export-heading',
      pipeline: 'Unable to prepare a Pipeline submission.',
      owner: 'site-control-map-heading',
    } as const;
    for (const marker of Object.values(deferredMarkers)) expect(baselineCorpus).not.toContain(marker);

    await openScaleSet(page, 100);
    await page.getByRole('button', { name: 'Design', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Design Artifacts' })).toBeVisible();
    await expect.poll(() => [...scripts].filter((url) => !baselineScripts.has(url)).length).toBeGreaterThan(0);
    const designDelta = [...scripts].filter((url) => !baselineScripts.has(url));
    await expect.poll(async () => (await Promise.all(scriptPayloads.slice(baselinePayloadCount))).join('\n').includes('studio-ready')).toBe(true);

    await attachEvidence(testInfo, 'desk-lazy-bundle-evidence.json', {
      baselineScriptCount: baselineScripts.size,
      designInvocationScriptCount: scripts.size,
      deferredScriptCount: designDelta.length,
      deferredScripts: designDelta.map((url) => new URL(url).pathname),
      absentBaselineMarkers: deferredMarkers,
      deterministicProxy: 'Browser-loaded script bodies exclude Design, Output, Pipeline, and Owner implementation markers at Desk baseline; Design invocation then fetches additional scripts containing the Studio marker.',
    });
  });
});
