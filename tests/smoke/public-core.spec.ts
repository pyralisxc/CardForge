import { expect, test, type Page } from '@playwright/test';

const READY_TIMEOUT = 120_000;
const TEST_TIMEOUT = 180_000;

test.describe.configure({ timeout: TEST_TIMEOUT });

async function resetBrowserStorage(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: READY_TIMEOUT });
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('cardforge-browser-storage');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('CardForge browser storage is still open.'));
  }));
}

function observeRuntimeFailures(page: Page) {
  const failures: string[] = [];

  page.on('pageerror', (error) => {
    failures.push(`Uncaught browser error: ${error.message}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 500) {
      failures.push(`HTTP ${response.status()}: ${response.url()}`);
    }
  });

  return failures;
}

async function seedWorkspaceStorage(page: Page, state: Record<string, unknown>) {
  await page.evaluate((workspaceState) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('cardforge-browser-storage', 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('key-value')) {
        request.result.createObjectStore('key-value');
      }
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction('key-value', 'readwrite');
      transaction.objectStore('key-value').put(
        JSON.stringify({ state: workspaceState, version: 1 }),
        'project-workspace:workspace',
      );
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => {
        database.close();
        reject(transaction.error);
      };
    };
  }), state);
}

function visibleGeneratedCardPreviews(page: Page) {
  return page.getByTestId('generated-gallery-scroll').locator('.tcg-card-preview:visible');
}

test('serves the public shell and core APIs', async ({ request }) => {
  for (const route of ['/', '/studio']) {
    const response = await request.get(route, { timeout: READY_TIMEOUT });
    expect(response.ok(), `${route} returned HTTP ${response.status()}`).toBe(true);
  }

  for (const route of ['/api/templates', '/api/billing/status']) {
    const response = await request.get(route, { timeout: READY_TIMEOUT });
    expect(response.ok(), `${route} returned HTTP ${response.status()}`).toBe(true);
    expect(response.headers()['content-type']).toContain('application/json');
    expect(await response.json()).toEqual(expect.any(Object));
  }
});

test('creates one generated output without runtime failures', async ({ page }) => {
  await resetBrowserStorage(page);
  const runtimeFailures = observeRuntimeFailures(page);
  const response = await page.goto('/studio', { waitUntil: 'domcontentloaded', timeout: READY_TIMEOUT });

  expect(response?.ok(), `/studio returned HTTP ${response?.status()}`).toBe(true);
  await expect(page.getByTestId('studio-ready')).toBeVisible({ timeout: READY_TIMEOUT });
  await page.getByTestId('studio-tab-generator').click();

  const createOutput = page.getByTestId('create-generated-output');
  await expect(createOutput).toBeEnabled({ timeout: READY_TIMEOUT });
  await createOutput.click();
  await expect(visibleGeneratedCardPreviews(page).first()).toBeVisible({ timeout: READY_TIMEOUT });

  expect(runtimeFailures).toEqual([]);
});

test('keeps clean image export gated for free users', async ({ page }) => {
  await resetBrowserStorage(page);
  const template = {
    id: 'public-smoke-export-template',
    name: 'Public Smoke Export Template',
    aspectRatio: '63:88',
    templateSource: 'user',
    freeformCanvas: {
      width: 630,
      height: 880,
      elements: [
        {
          id: 'export-gate-title',
          type: 'text',
          name: 'Card Name',
          content: '{{cardName:"Smoke Export Gate"}}',
          x: 90,
          y: 390,
          width: 450,
          height: 96,
          textColor: '#f3ead7',
          fontSizePx: 32,
        },
      ],
    },
  };

  await seedWorkspaceStorage(page, {
    userTemplates: [template],
    appearanceStyles: [],
    storedCards: [{
      uniqueId: 'public-smoke-export-card',
      templateId: template.id,
      data: { cardName: 'Smoke Export Gate' },
    }],
    activeTab: 'generator',
    singleCardGeneratorSelectedTemplateId: template.id,
    richTextHighlightColor: '#ffd700',
  });

  const runtimeFailures = observeRuntimeFailures(page);
  await page.goto('/studio', { waitUntil: 'domcontentloaded', timeout: READY_TIMEOUT });
  await expect(page.getByTestId('studio-ready')).toBeVisible({ timeout: READY_TIMEOUT });
  await page.getByTestId('studio-tab-generator').click();

  const preview = visibleGeneratedCardPreviews(page).first();
  await expect(preview).toBeVisible({ timeout: READY_TIMEOUT });
  await expect(page.getByTestId('generated-card-watermark').first()).toBeVisible();
  await preview.click();

  const unexpectedDownload = page
    .waitForEvent('download', { timeout: 3_000 })
    .then(() => true)
    .catch(() => false);
  await page.getByTestId('single-card-export-trigger').click();
  await page.getByTestId('single-card-export-png-front').click();

  await expect(page.getByLabel('Notifications (F8)').locator('[data-state="open"]')).toBeVisible();
  expect(await unexpectedDownload).toBe(false);
  await expect(page.getByTestId('generated-card-watermark').first()).toBeVisible();
  expect(runtimeFailures).toEqual([]);
});
