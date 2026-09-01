import { expect, test, type Page, type TestInfo } from '@playwright/test';

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

const prepareScalePage = async (page: Page, cardCount: ProjectScale) => {
  const previewShareUrl = process.env.CARDFORGE_E2E_PREVIEW_SHARE_URL;
  await installBrowserPerformanceObservers(page);
  if (previewShareUrl) await page.goto(previewShareUrl, { waitUntil: 'domcontentloaded', timeout: READY_TIMEOUT });
  await seedGuestScaleWorkspace(page, cardCount);
  await page.goto('/account', { waitUntil: 'domcontentloaded', timeout: READY_TIMEOUT });
  await expect(page.getByRole('heading', { name: 'Your creative workspace' })).toBeVisible();
  await expect(page.getByRole('button', { name: `Focus ${cardCount} Card Scale Set` })).toBeVisible();
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

      const openMs = await openScaleSet(page, cardCount);
      const visualArtifacts = page.locator('[data-home-artifact-stage] [data-artifact-id]');
      const expensivePreviews = page.locator('[data-home-artifact-stage] [id^="card-preview-"]');
      const mountedVisuals = await visualArtifacts.count();
      const mountedExpensivePreviews = await expensivePreviews.count();
      expect(mountedVisuals).toBeGreaterThan(0);
      expect(mountedVisuals).toBeLessThan(cardCount);
      expect(mountedExpensivePreviews).toBeLessThanOrEqual(Math.min(160, mountedVisuals));

      const panMs = await elapsed(async () => {
        await page.locator('[data-home-artifact-stage]').evaluate((stage) => {
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
      await orderedOptions.first().focus();
      const selectionMs = await elapsed(async () => {
        await page.keyboard.press('Space');
        await expect(orderedOptions.first()).toHaveAttribute('aria-selected', 'true');
      });
      const jumpMs = await elapsed(async () => {
        await page.keyboard.press('End');
        await expect(orderedOptions.last()).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(page.locator(`[data-artifact-id="scale-card-${cardCount}"]`)).toBeVisible();
      });
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
    };

    for (let warmup = 0; warmup < 3; warmup += 1) await runCycle();
    const baselineDomNodes = await page.locator('*').count();
    const baselineHeap = await collectHeap();
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

    expect(finalDomNodes).toBeLessThanOrEqual(baselineDomNodes + 25);
    expect(finalHeap).toBeLessThanOrEqual(baselineHeap + heapAllowance);
    expect(heapGrowthPerCycle).toBeLessThan(1024 * 1024);
    expect(browserEvidence.objectUrls.active).toBe(0);
    await attachEvidence(testInfo, 'artifact-lifecycle-soak.json', {
      warmupCycles: 3,
      measuredCycles,
      baselineDomNodes,
      finalDomNodes,
      heapReadings,
      heapAllowance,
      heapGrowthPerCycle,
      ...browserEvidence,
    });
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
