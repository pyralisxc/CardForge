import { expect, test, type Page } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';

const SMOKE_TEMPLATE_NAMES = new Set(['Smoke Freeform Template', 'Keyboard Save Template']);

async function cleanupSmokeUserTemplates() {
  const directory = path.join(process.cwd(), 'data', 'user-templates');
  let entries: string[] = [];
  try {
    entries = await fs.readdir(directory);
  } catch {
    return;
  }

  await Promise.all(entries.map(async (entry) => {
    if (!entry.endsWith('.json')) return;
    const filePath = path.join(directory, entry);
    try {
      const parsed = JSON.parse(await fs.readFile(filePath, 'utf8')) as { name?: string };
      if (parsed.name && SMOKE_TEMPLATE_NAMES.has(parsed.name)) {
        await fs.rm(filePath, { force: true });
      }
    } catch {
      // Leave non-smoke or invalid files untouched.
    }
  }));
}

test.beforeEach(async ({ page }) => {
  await cleanupSmokeUserTemplates();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    window.localStorage.clear();
  });
});

test.afterEach(async () => {
  await cleanupSmokeUserTemplates();
});

async function gotoStudio(page: Page) {
  await page.goto('/studio', { waitUntil: 'domcontentloaded', timeout: 120_000 });
}

async function selectMainTab(page: Page, name: RegExp) {
  const tab = page.getByRole('tab', { name });
  await expect(tab).toBeVisible({ timeout: 90_000 });
  await expect.poll(async () => {
    await tab.click({ timeout: 5_000 }).catch(() => undefined);
    return tab.getAttribute('aria-selected');
  }, { timeout: 90_000 }).toBe('true');
}

test('renders public landing page with studio and account entry points', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /Forge cards, templates, and bulk sets/i })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('link', { name: /Start Creating/i }).first()).toHaveAttribute('href', '/studio');
  await expect(page.getByRole('link', { name: /Account & Export/i })).toHaveAttribute('href', '/account');
  await expect(page.getByText(/No sign-in required to create/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /Privacy/i })).toHaveAttribute('href', '/privacy');
});

test('renders account profile with studio access and export status', async ({ page }) => {
  await page.goto('/account');

  await expect(page.getByRole('heading', { name: /Connect Clerk|Your Forge: Starter Library|Your Forge: Creator Pass|Your forge is ready/i })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Maker and generator available/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: /A living company timeline for what support unlocks next/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Open Studio/i })).toHaveAttribute('href', '/studio');
});

test('loads default templates and adds a generated output', async ({ page }) => {
  test.setTimeout(120_000);
  await gotoStudio(page);

  const stylesheetHref = await page.locator('link[rel="stylesheet"][href*="/_next/static/css"]').first().getAttribute('href');
  expect(stylesheetHref).toBeTruthy();
  await expect((await page.request.get(stylesheetHref!))).toBeOK();

  await expect
    .poll(() => page.locator('body').evaluate(element => getComputedStyle(element).fontFamily))
    .not.toContain('Times New Roman');
  await expect
    .poll(() => page.locator('body').evaluate(element => getComputedStyle(element).backgroundColor))
    .not.toBe('rgba(0, 0, 0, 0)');
  await expect
    .poll(() => page.locator('header').evaluate(element => getComputedStyle(element).backgroundColor))
    .not.toBe('rgba(0, 0, 0, 0)');
  await expect
    .poll(() => page.locator('header').evaluate(element => getComputedStyle(element).backgroundColor))
    .not.toBe('rgb(255, 255, 255)');
  await expect(page.getByRole('tab', { name: /Layout Studio/i })).toBeVisible({ timeout: 90_000 });

  await selectMainTab(page, /Generate/i);
  await expect(page.getByRole('button', { name: /Create Generated Output/i })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: /Create Generated Output/i }).click();

  await expect(page.getByRole('heading', { name: /Generated Outputs \(1\)/i })).toBeVisible();
  await expect
    .poll(() => page.locator('.tcg-card-preview').count())
    .toBeGreaterThanOrEqual(1);
});

test('lets free users try clean export and see the export gate', async ({ page }) => {
  test.setTimeout(120_000);
  const entitlement = await page.request.get('/api/account/entitlement');
  await expect(entitlement).toBeOK();
  const entitlementJson = await entitlement.json() as { canExportClean?: boolean };
  test.skip(entitlementJson.canExportClean === true, 'Export is already unlocked in this environment.');

  await page.addInitScript(() => {
    window.localStorage.setItem('card-forge-app-storage-v3', JSON.stringify({
      state: {
        userTemplates: [],
        appearanceStyles: [],
        storedCards: [{
          uniqueId: 'smoke-export-gate-1',
          templateId: 'default-playing-card-theme',
          data: {
            Rank: 'A',
            Suit: '♥',
            CenterMark: '♥',
            cardName: 'Smoke Export Gate',
          },
        }],
        selectedPaperSize: { name: 'US Letter (8.5×11 in)', widthMm: 215.9, heightMm: 279.4 },
        activeTab: 'generator',
        richTextHighlightColor: '#ffd700',
        singleCardGeneratorSelectedTemplateId: 'default-playing-card-theme',
        pdfMarginMm: 5,
        pdfCardSpacingMm: 0,
        pdfIncludeCutLines: false,
        pdfDuplexLayout: 'separate-pages',
        exportMode: 'physical',
        exportDpi: 300,
      },
      version: 1,
    }));
  });

  await gotoStudio(page);

  await expect(page.getByRole('tab', { name: /Layout Studio/i })).toBeVisible({ timeout: 90_000 });
  await selectMainTab(page, /Generate/i);
  await expect(page.getByRole('heading', { name: /Generated Outputs \(1\)/i })).toBeVisible({ timeout: 45_000 });

  await page.locator('.tcg-card-preview').first().hover();
  const exportButton = page.getByRole('button', { name: 'Export Image', exact: true });
  await expect(exportButton).toBeEnabled();

  await exportButton.click();
  await page.getByRole('menuitem', { name: 'Export front as PNG', exact: true }).click();

  await expect(page.getByText('Clean export locked', { exact: true })).toBeVisible();
});

test('creates a freeform template and renders it in the generator', async ({ page }) => {
  test.setTimeout(45_000);
  await gotoStudio(page);

  await selectMainTab(page, /Layout Studio/i);
  await expect(page.getByRole('heading', { name: /Layout Studio/i })).toBeVisible({ timeout: 30_000 });

  await page.getByRole('button', { name: 'Create new template', exact: true }).click();
  await page.getByRole('tab', { name: 'Template', exact: true }).click();
  await page.getByLabel('Template Name').fill('Smoke Freeform Template');
  await page.getByRole('tab', { name: 'Element', exact: true }).click();
  await page.getByRole('button', { name: 'Text', exact: true }).click();
  await page.getByRole('button', { name: 'Aged Parchment', exact: true }).first().click();
  await expect(page.getByRole('button', { name: /Text Layer/ }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Template Saved', { exact: true })).toBeVisible();

  await selectMainTab(page, /Generate/i);
  await page.getByRole('button', { name: /Create Generated Output/i }).click();

  await expect(page.getByRole('heading', { name: /Generated Outputs \(1\)/i })).toBeVisible();
  await expect
    .poll(() => page.locator('.tcg-card-preview').count())
    .toBeGreaterThanOrEqual(1);
  await expect(page.locator('[data-freeform-element-id]').first()).toBeVisible();

  await page.getByRole('tab', { name: /Data Import/i }).click();
  await page.locator('#bulk-file-upload-csv').setInputFiles({
    name: 'freeform-bulk.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Rank,Suit,CenterMark,newText\nA,♥,♥,Bulk Arcane One\nK,♠,♠,Bulk Arcane Two\n'),
  });
  await expect(page.locator('#bulkData')).toContainText('Bulk Arcane One');
  await page.getByRole('button', { name: /Generate Outputs from Data/i }).dispatchEvent('click');

  await expect(page.getByRole('heading', { name: /Generated Outputs \(3\)/i })).toBeVisible();
  await expect
    .poll(() => page.locator('.tcg-card-preview').count())
    .toBeGreaterThanOrEqual(3);
  await expect
    .poll(() => page.locator('[data-freeform-element-id]').count())
    .toBeGreaterThanOrEqual(3);
});

test('bulk generator uses advanced mapping toggle and strict mode gating', async ({ page }) => {
  await gotoStudio(page);
  await selectMainTab(page, /Generate/i);
  await page.getByRole('tab', { name: /Data Import/i }).click();

  await page.locator('#bulkData').fill('Rank,Suit,CenterMark,newText\nA,,♥,Ember-Claw');

  await expect(page.getByText('Mapped Template Field', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mapping Editor', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Auto-map Again', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show Unmapped Only', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Mapping Editor', exact: true }).dispatchEvent('click');
  await page.getByLabel('Map CSV column newText to template field').dispatchEvent('click');
  await page.getByRole('option', { name: 'Ignore', exact: true }).dispatchEvent('click');
  await page.getByRole('button', { name: 'Show Unmapped Only', exact: true }).dispatchEvent('click');
  await expect(page.getByText(/Showing \d+ unmapped columns\./i)).toBeVisible();

  await page.getByRole('button', { name: 'Auto-map Again', exact: true }).dispatchEvent('click');
  await expect(page.getByText('Auto-mapping refreshed', { exact: true })).toBeVisible();

  const generateButton = page.getByRole('button', { name: /Generate Outputs from Data/i });
  await expect(generateButton).toBeEnabled();

  await page.getByLabel('Toggle strict mode for bulk generation').dispatchEvent('click');
  await expect(page.getByText(/Strict Mode is on\./i)).toBeVisible();
  await expect(generateButton).toBeDisabled();

  await page.getByRole('button', { name: 'Fill with TBD', exact: true }).dispatchEvent('click');
  await expect(page.getByText('Missing value for Suit', { exact: true })).toBeHidden();
  await expect(generateButton).toBeDisabled();

  await page.getByLabel('Toggle strict mode for bulk generation').dispatchEvent('click');
  await expect(page.getByText(/Strict Mode is off\./i)).toBeVisible();
  await expect(generateButton).toBeEnabled();
});

test('supports a 1000-card generated gallery without rendering every preview at once', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const storedCards = Array.from({ length: 1000 }, (_, index) => ({
    uniqueId: `smoke-large-gallery-${index + 1}`,
    templateId: 'default-playing-card-theme',
    data: {
      Rank: String((index % 13) + 1),
      Suit: index % 2 === 0 ? '♥' : '♠',
      CenterMark: index % 2 === 0 ? '♥' : '♠',
      cardName: `Large Batch Card ${index + 1}`,
    },
  }));

  await page.addInitScript((seedCards) => {
    window.localStorage.setItem('card-forge-app-storage-v3', JSON.stringify({
      state: {
        userTemplates: [],
        appearanceStyles: [],
        storedCards: seedCards,
        selectedPaperSize: { name: 'US Letter (8.5×11 in)', widthMm: 215.9, heightMm: 279.4 },
        activeTab: 'generator',
        richTextHighlightColor: '#ffd700',
        singleCardGeneratorSelectedTemplateId: 'default-playing-card-theme',
        pdfMarginMm: 5,
        pdfCardSpacingMm: 0,
        pdfIncludeCutLines: false,
        pdfDuplexLayout: 'separate-pages',
        exportMode: 'physical',
        exportDpi: 300,
      },
      version: 1,
    }));
  }, storedCards);

  await gotoStudio(page);

  await expect(page.getByRole('heading', { name: /Generated Outputs \(1000\)/i })).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole('combobox', { name: 'Gallery density', exact: true })).toContainText('Compact grid');
  await expect(page.getByText('Page 1 of 17 - showing 1-60 of 1000 matching outputs', { exact: true })).toBeVisible();
  await expect.poll(() => page.locator('.tcg-card-preview').count()).toBeLessThanOrEqual(70);
  await expect.poll(() => page.locator('.tcg-card-preview').count()).toBeGreaterThan(0);

  const firstPageMaxCardsPerRow = await page.locator('.tcg-card-preview').evaluateAll((cards) => {
    const rowCounts = new Map<number, number>();
    cards.forEach((card) => {
      const top = Math.round(card.getBoundingClientRect().top);
      rowCounts.set(top, (rowCounts.get(top) ?? 0) + 1);
    });
    return Math.max(...rowCounts.values());
  });
  expect(firstPageMaxCardsPerRow).toBeGreaterThanOrEqual(3);

  await page.getByRole('button', { name: 'Next gallery page', exact: true }).click();

  await expect(page.getByText('Page 2 of 17 - showing 61-120 of 1000 matching outputs', { exact: true })).toBeVisible();
  await expect.poll(() => page.locator('.tcg-card-preview').count()).toBeGreaterThan(0);
  await expect.poll(() => page.locator('.tcg-card-preview').count()).toBeLessThanOrEqual(70);
});

test('supports keyboard-first generation and strict mode toggle', async ({ page }) => {
  await gotoStudio(page);
  await selectMainTab(page, /Generate/i);

  const templateTrigger = page.locator('#singleTemplateSelect');
  await templateTrigger.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  const addCardButton = page.getByRole('button', { name: /Create Generated Output/i });
  await addCardButton.focus();
  await page.keyboard.press('Enter');

  await expect(page.getByRole('heading', { name: /Generated Outputs \(1\)/i })).toBeVisible();

  await page.getByRole('tab', { name: /Data Import/i }).click();
  await page.locator('#bulkData').fill('rulesText,typeLine\n"",CREATURE - DRAGON');

  const strictModeToggle = page.getByLabel('Toggle strict mode for bulk generation');
  await expect(strictModeToggle).toBeVisible();
  await strictModeToggle.dispatchEvent('click');

  await expect(page.getByText(/Strict Mode is on\./i)).toBeVisible();
});

test('supports keyboard save shortcut in template creator', async ({ page }) => {
  await gotoStudio(page);
  await selectMainTab(page, /Layout Studio/i);
  await expect(page.getByRole('heading', { name: /Layout Studio/i })).toBeVisible({ timeout: 30_000 });

  await page.getByRole('button', { name: 'Create new template', exact: true }).click();
  await page.getByRole('tab', { name: 'Template', exact: true }).click();
  await page.getByLabel('Template Name').fill('Keyboard Save Template');

  await page.keyboard.press('Control+s');
  await expect(page.getByText('Template Saved', { exact: true })).toBeVisible();
});

test('supports keyboard arrow movement on template canvas', async ({ page }) => {
  await gotoStudio(page);
  await selectMainTab(page, /Layout Studio/i);

  const canvas = page.locator('[data-cardforge-canvas="true"]');
  await expect(canvas).toBeVisible({ timeout: 30_000 });

  const selectedElement = canvas.locator('[data-selected="true"][data-element-locked="false"]').first();
  await expect(selectedElement).toBeVisible();
  const beforeLeft = await selectedElement.evaluate((element) => parseFloat((element as HTMLElement).style.left || '0'));

  await canvas.focus();
  await page.keyboard.press('ArrowRight');

  await expect.poll(async () => {
    return selectedElement.evaluate((element) => parseFloat((element as HTMLElement).style.left || '0'));
  }).toBeGreaterThan(beforeLeft);
});

test('keeps selected overlapped canvas element stable while clicking, dragging, and deleting', async ({ page }) => {
  test.setTimeout(75_000);
  await gotoStudio(page);
  await selectMainTab(page, /Layout Studio/i);

  const canvas = page.locator('[data-cardforge-canvas="true"]');
  await expect(canvas).toBeVisible({ timeout: 60_000 });

  await page.getByRole('button', { name: 'Text', exact: true }).click();
  await page.getByRole('button', { name: 'Shape', exact: true }).click();

  const initialCount = await canvas.locator('[data-freeform-element-id]').count();
  const selectedElement = canvas.locator('[data-selected="true"][data-element-locked="false"]').first();
  await expect(selectedElement).toBeVisible();

  const selectedId = await selectedElement.getAttribute('data-freeform-element-id');
  expect(selectedId).toBeTruthy();

  const selectedById = canvas.locator(`[data-freeform-element-id="${selectedId}"]`);
  const beforeLeft = await selectedById.evaluate((element) => parseFloat((element as HTMLElement).style.left || '0'));
  const beforeTop = await selectedById.evaluate((element) => parseFloat((element as HTMLElement).style.top || '0'));

  await selectedById.click({ position: { x: 24, y: 24 }, force: true });
  await selectedById.click({ position: { x: 24, y: 24 }, force: true });
  await expect(canvas.locator(`[data-selected="true"][data-freeform-element-id="${selectedId}"]`)).toBeVisible();

  const box = await selectedById.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.move(box!.x + 24, box!.y + 24);
  await page.mouse.down();
  await page.mouse.move(box!.x + 44, box!.y + 34, { steps: 4 });
  await page.mouse.up();

  await expect.poll(async () => selectedById.evaluate((element) => parseFloat((element as HTMLElement).style.left || '0'))).toBeGreaterThan(beforeLeft);
  await expect.poll(async () => selectedById.evaluate((element) => parseFloat((element as HTMLElement).style.top || '0'))).toBeGreaterThan(beforeTop);
  await expect(canvas.locator(`[data-selected="true"][data-freeform-element-id="${selectedId}"]`)).toBeVisible();

  await canvas.focus();
  await page.keyboard.press('Delete');

  await expect(selectedById).toHaveCount(0);
  await expect.poll(() => canvas.locator('[data-freeform-element-id]').count()).toBe(initialCount - 1);

  await page.keyboard.press('Control+z');

  await expect(selectedById).toHaveCount(1);
  await expect(canvas.locator(`[data-selected="true"][data-freeform-element-id="${selectedId}"]`)).toBeVisible();
});

test('supports keyboard lock toggle in layer tree', async ({ page }) => {
  await gotoStudio(page);
  await selectMainTab(page, /Layout Studio/i);

  const lockButton = page.locator('button[aria-label^="Lock layer "]').first();
  await expect(lockButton).toBeVisible({ timeout: 30_000 });
  await lockButton.focus();
  await page.keyboard.press('Enter');

  const unlockButton = page.locator('button[aria-label^="Unlock layer "]').first();
  await expect(unlockButton).toBeVisible();
});

test('supports keyboard visibility toggle in layer tree', async ({ page }) => {
  await gotoStudio(page);
  await selectMainTab(page, /Layout Studio/i);

  const hideButton = page.locator('button[aria-label^="Hide layer "]').first();
  await expect(hideButton).toBeVisible({ timeout: 30_000 });
  await hideButton.focus();
  await page.keyboard.press('Enter');

  const showButton = page.locator('button[aria-label^="Show layer "]').first();
  await expect(showButton).toBeVisible();
});
