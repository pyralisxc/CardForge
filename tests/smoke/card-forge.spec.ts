import { expect, test, type Page } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';

const SMOKE_TEMPLATE_NAMES = new Set(['Smoke Freeform Template', 'Keyboard Save Template', 'Smoke Bulk Mapping Template']);
const STUDIO_READY_TIMEOUT = 120_000;
const STUDIO_TEST_TIMEOUT = 180_000;

test.describe.configure({ timeout: STUDIO_TEST_TIMEOUT });

test.beforeAll(async ({ request }) => {
  test.setTimeout(STUDIO_TEST_TIMEOUT);
  const templates = await request.get('/api/templates', { timeout: STUDIO_READY_TIMEOUT });
  await expect(templates).toBeOK();
});

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
  await page.goto('/about', { waitUntil: 'domcontentloaded', timeout: STUDIO_READY_TIMEOUT });
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('cardforge-browser-storage');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('CardForge browser storage is still open.'));
  }));
});

test.afterEach(async () => {
  await cleanupSmokeUserTemplates();
});

async function gotoStudio(page: Page) {
  await page.goto('/studio', { waitUntil: 'domcontentloaded', timeout: STUDIO_READY_TIMEOUT });
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

async function selectMainTab(page: Page, name: RegExp) {
  const tab = page.getByRole('tab', { name });
  await expect(tab).toBeVisible({ timeout: STUDIO_READY_TIMEOUT });
  await expect.poll(async () => {
    await tab.click({ timeout: 5_000 }).catch(() => undefined);
    return tab.getAttribute('aria-selected');
  }, { timeout: STUDIO_READY_TIMEOUT }).toBe('true');
}

async function expectGeneratorReady(page: Page) {
  await expect(page.getByText('Loading templates...', { exact: true })).toBeHidden({ timeout: STUDIO_READY_TIMEOUT });
  const createOutputButton = page.getByRole('button', { name: /Create Generated Output/i });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (await createOutputButton.isVisible().catch(() => false)) return;
    if (!(await page.getByRole('heading', { name: /No Templates Yet/i }).isVisible().catch(() => false))) break;
    await page.reload({ waitUntil: 'domcontentloaded', timeout: STUDIO_READY_TIMEOUT });
    await selectMainTab(page, /Make cards/i);
    await expect(page.getByText('Loading templates...', { exact: true })).toBeHidden({ timeout: STUDIO_READY_TIMEOUT });
  }
  await expect(createOutputButton).toBeVisible({ timeout: STUDIO_READY_TIMEOUT });
}

function createFrontTemplateButton(page: Page) {
  return page.getByRole('button', { name: 'Create new front design', exact: true });
}

function visibleCardPreviews(page: Page) {
  return page.locator('.tcg-card-preview:visible');
}

async function visibleFreeformPreviewElementCount(page: Page) {
  return page.locator('.tcg-card-preview [data-freeform-element-id]').evaluateAll((elements) => (
    elements.filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    }).length
  ));
}

async function seedBulkMappingTemplate(page: Page) {
  const template = {
      id: 'smoke-bulk-mapping-template',
      name: 'Smoke Bulk Mapping Template',
      aspectRatio: '2.5/3.5',
      templateSource: 'user',
      fieldContracts: [
        { key: 'Rank', label: 'Rank', type: 'text', required: true },
        { key: 'Suit', label: 'Suit', type: 'text', required: true },
        { key: 'CenterMark', label: 'Center Mark', type: 'text', required: true },
        { key: 'newText', label: 'New Text', type: 'text', required: false },
      ],
      freeformCanvas: {
        width: 750,
        height: 1050,
        elements: [
          { id: 'bulk-rank', type: 'text', name: 'Rank', content: '{{Rank:"A"}}', x: 80, y: 80, width: 120, height: 90, fontSize: 54, textColor: '#fff1c7' },
          { id: 'bulk-suit', type: 'text', name: 'Suit', content: '{{Suit:"♥"}}', x: 520, y: 80, width: 120, height: 90, fontSize: 54, textColor: '#fff1c7' },
          { id: 'bulk-center', type: 'text', name: 'Center Mark', content: '{{CenterMark:"♥"}}', x: 280, y: 390, width: 180, height: 150, fontSize: 82, textColor: '#f4c66b' },
          { id: 'bulk-text', type: 'text', name: 'Rules Text', content: '{{newText:"Example"}}', x: 80, y: 780, width: 590, height: 120, fontSize: 28, textColor: '#fff1c7' },
        ],
      },
    };

  await seedWorkspaceStorage(page, {
    userTemplates: [template],
    appearanceStyles: [],
    storedCards: [],
    activeTab: 'generator',
    singleCardGeneratorSelectedTemplateId: template.id,
    bulkGeneratorSelectedTemplateId: template.id,
    richTextHighlightColor: '#ffd700',
  });
}

test('renders public landing page with studio and account entry points', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /Design one card\. Add your list\. CardForge builds the set\./i })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('heading', { name: /From one good-looking card to the whole set\./i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Check your access/i })).toHaveAttribute('href', '/account');
  await expect(page.getByRole('link', { name: /Try the Studio/i }).first()).toHaveAttribute('href', '/studio');
  await expect(page.getByRole('link', { name: /See what it makes/i })).toHaveAttribute('href', '#interactive-showcase');
  await expect(page.getByRole('heading', { name: /Built independently by Cameron Locke/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /How it works/i }).first()).toHaveAttribute('href', '/about');
  await expect(page.getByRole('link', { name: /Account/i }).first()).toHaveAttribute('href', '/account');
  await expect(page.getByRole('link', { name: /Cameron Locke/i }).first()).toHaveAttribute('href', '/cameron');
  await expect(page.getByRole('link', { name: /Support Cameron/i })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Privacy/i }).first()).toHaveAttribute('href', '/privacy');
  await expect(page.getByRole('link', { name: /Developer Terms/i }).first()).toHaveAttribute('href', '/developer-terms');
  await expect(page.getByRole('link', { name: /Creator Pool/i })).toHaveCount(0);
});

test('opens a contained keyboard-accessible public menu on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const menuButton = page.getByRole('button', { name: 'Open menu' });
  await menuButton.focus();
  await page.keyboard.press('Enter');
  const menu = page.getByRole('dialog', { name: 'Navigation' });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('link', { name: 'Account' })).toHaveAttribute('href', '/account');
  await expect(menu.getByRole('link', { name: 'Try the Studio' })).toHaveAttribute('href', '/studio');
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(menuButton).toBeFocused();
});

test('renders consolidated public trust pages', async ({ page }) => {
  for (const route of [
    '/about',
    '/cameron',
    '/privacy',
    '/terms',
    '/creator-pass-terms',
    '/supporter-terms',
    '/refund',
    '/contact',
    '/developer-terms',
    '/accessibility',
    '/creator-pool',
  ]) {
    await page.goto(route);
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 30_000 });
  }

  await page.goto('/cameron');
  await expect(page.getByText(/Oregon sole proprietor/i).first()).toBeVisible();
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(2);
  for (const removedRoute of ['/access', '/examples']) {
    const response = await page.goto(removedRoute);
    expect(response?.status()).toBe(404);
  }
  await page.goto('/privacy');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'http://localhost:9002/privacy');
  await page.goto('/creator-pool');
  await expect(page.getByText(/not active payout infrastructure/i)).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await page.goto('/developer-terms');
  await expect(page.getByText(/durable platform history/i)).toBeVisible();
});

test('renders developer recruitment page for visitors without exposing the operational asset hub', async ({ page }) => {
  await page.goto('/developer');

  await expect(page.getByRole('heading', { name: /Join the community shaping the forge/i })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Approved developers get a private asset hub/i)).toBeVisible();
  await expect(page.getByRole('tab', { name: /Asset Hub/i })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /Developer Asset Hub/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Clerk setup incomplete|Sign in first|Request developer access/i }).first()).toBeVisible();
});

test('renders account profile with studio access and export status', async ({ page }) => {
  await page.goto('/account');

  await expect(page.getByRole('heading', { name: /Account setup needed|Your account|Your CardForge account/i })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Your work stays with you' })).toBeVisible();
  await expect(page.getByText(/Your projects and personal uploads stay on this device/i)).toBeVisible();
  await expect(page.getByText('Your plan')).toBeVisible();
  await expect(page.getByRole('link', { name: /Open Studio/i })).toHaveAttribute('href', '/studio');
});

test('studio reaches ready state without getting stuck in skeleton', async ({ page }) => {
  test.setTimeout(STUDIO_TEST_TIMEOUT);
  await gotoStudio(page);

  await expect(page.getByTestId('studio-ready')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('PREPARING STUDIO')).toHaveCount(0);
});

test('loads default templates and adds a generated output', async ({ page }) => {
  test.setTimeout(STUDIO_TEST_TIMEOUT);
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

  await selectMainTab(page, /Make cards/i);
  await expectGeneratorReady(page);
  await page.getByRole('button', { name: /Create Generated Output/i }).click();

  await expect(page.getByRole('heading', { name: /Generated Outputs \(1\)/i })).toBeVisible();
  await expect
    .poll(() => page.locator('.tcg-card-preview').count())
    .toBeGreaterThanOrEqual(1);
});

test('lets free users try clean export and see the export gate', async ({ page }) => {
  test.setTimeout(STUDIO_TEST_TIMEOUT);

  const template = {
      id: 'smoke-export-gate-template',
      name: 'Smoke Export Gate Template',
      aspectRatio: '63:88',
      templateSource: 'user',
      freeformCanvas: {
        width: 630,
        height: 880,
        elements: [
          {
            id: 'export-gate-rank',
            type: 'text',
            name: 'Rank',
            content: '{{Rank:"A"}}',
            x: 78,
            y: 72,
            width: 120,
            height: 80,
            textColor: '#f3ead7',
            fontSizePx: 44,
          },
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
      uniqueId: 'smoke-export-gate-1',
      templateId: template.id,
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
    singleCardGeneratorSelectedTemplateId: template.id,
    pdfMarginMm: 5,
    pdfCardSpacingMm: 0,
    pdfIncludeCutLines: false,
    pdfDuplexLayout: 'separate-pages',
    exportMode: 'physical',
    exportDpi: 300,
  });

  await gotoStudio(page);

  await expect(page.getByRole('tab', { name: /Layout Studio/i })).toBeVisible({ timeout: 90_000 });
  await selectMainTab(page, /Make cards/i);
  await expectGeneratorReady(page);
  await expect(page.getByRole('heading', { name: /Generated Outputs \(1\)/i })).toBeVisible({ timeout: 45_000 });

  const previewWatermark = page.getByTestId('generated-card-watermark').first();
  await expect(previewWatermark).toBeVisible();
  await expect(previewWatermark).toHaveAttribute('src', '/brand/cardforge-studio/watermark.svg');
  await expect(previewWatermark).toHaveCSS('opacity', '0.24');

  await visibleCardPreviews(page).first().hover();
  const exportButton = page.getByRole('button', { name: 'Export Image', exact: true });
  await expect(exportButton).toBeEnabled();

  await exportButton.click();
  await page.getByRole('menuitem', { name: 'Export front as PNG', exact: true }).click();

  await expect(page.getByText('Clean export locked', { exact: true })).toBeVisible();
  const notifications = page.getByLabel('Notifications (F8)');
  await expect(notifications.getByText(/Buy Creator Pass to unlock clean PNG, PDF, ZIP, and project-file exports/i)).toBeVisible();
  await expect(notifications.getByText(/dev access|developer/i)).toHaveCount(0);

  await selectMainTab(page, /Layout Studio/i);

  const editorWatermark = page.getByTestId('template-editor-watermark');
  await expect(editorWatermark).toBeVisible();
  await expect(editorWatermark).toHaveAttribute('src', '/brand/cardforge-studio/watermark.svg');
  await expect(editorWatermark).toHaveCSS('opacity', '0.24');
  await expect(page.getByTestId('template-library-watermark').first()).toBeVisible();

  const canvas = page.locator('[data-cardforge-canvas="true"]');
  await canvas.focus();
  await expect(canvas).toBeFocused();
});

test('creates a freeform template and renders it in the generator', async ({ page }) => {
  test.setTimeout(STUDIO_TEST_TIMEOUT);
  await gotoStudio(page);

  await selectMainTab(page, /Layout Studio/i);
  await expect(page.getByRole('heading', { name: /Layout Studio/i })).toBeVisible({ timeout: 30_000 });

  await createFrontTemplateButton(page).click();
  await page.getByRole('button', { name: 'Card setup', exact: true }).click();
  await page.getByLabel('Template Name').fill('Smoke Freeform Template');
  await page.getByRole('button', { name: 'Text', exact: true }).click();
  await page.keyboard.press('Control+K');
  await expect(page.getByRole('dialog', { name: 'Command Palette' })).toBeVisible();
  await expect(page.getByText('Insert', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Favorite Add icon', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove Add icon from favorites', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByPlaceholder('Search commands...').fill('add icon');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /Icon Layer/ }).first()).toBeVisible();
  await page.keyboard.press('Control+K');
  await expect(page.getByText('Favorites', { exact: true })).toBeVisible();
  await page.getByPlaceholder('Search commands...').fill('grid');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Control+K');
  await expect(page.getByText('Recent', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /grid/i }).first()).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Text Layer/ }).first().click();
  const textStyleSection = page.locator('button[aria-controls]').filter({ hasText: 'Text Style' }).first();
  await expect(textStyleSection).toBeVisible();
  await textStyleSection.click();
  await expect(page.getByText('Text Details', { exact: true })).toBeVisible();
  const fillEffectsSection = page.locator('button[aria-controls]').filter({ hasText: 'Fill & Effects' }).first();
  await expect(fillEffectsSection).toBeVisible();
  await fillEffectsSection.click();
  await page.getByPlaceholder('Search fill styles...').fill('parchment');
  await page.getByRole('button', { name: /Parchment/i }).first().click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Template Saved', { exact: true })).toBeVisible();

  await selectMainTab(page, /Make cards/i);
  await expectGeneratorReady(page);
  await page.getByRole('button', { name: /Create Generated Output/i }).click();

  await expect(page.getByRole('heading', { name: /Generated Outputs \(1\)/i })).toBeVisible();
  await expect
    .poll(() => page.locator('.tcg-card-preview').count())
    .toBeGreaterThanOrEqual(1);
  await expect.poll(() => visibleFreeformPreviewElementCount(page)).toBeGreaterThanOrEqual(1);


});

test('asks whether to save a changed template before leaving Layout Studio', async ({ page }) => {
  test.setTimeout(STUDIO_TEST_TIMEOUT);
  await gotoStudio(page);

  await selectMainTab(page, /Layout Studio/i);
  await expect(createFrontTemplateButton(page)).toBeVisible({ timeout: STUDIO_READY_TIMEOUT });

  await createFrontTemplateButton(page).click();
  await page.getByRole('button', { name: 'Text', exact: true }).click();
  await page.locator('#element-template-expression').fill('Unsaved Browser QA Text');

  await page.getByRole('tab', { name: /Make cards/i }).click();
  await expect(page.getByRole('heading', { name: /Save changes to/i })).toBeVisible();
  await page.getByRole('button', { name: 'Keep editing' }).click();
  await expect(page.getByRole('tab', { name: /Layout Studio/i })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#element-template-expression')).toContainText('Unsaved Browser QA Text');

  await page.getByRole('tab', { name: /Make cards/i }).click();
  await page.getByLabel('Template name').fill('Saved Browser QA Template');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByTestId('generator-panel')).toBeVisible();
});
test('adds structured row columns in the layout studio text inspector', async ({ page }) => {
  test.setTimeout(STUDIO_TEST_TIMEOUT);
  await gotoStudio(page);

  await selectMainTab(page, /Layout Studio/i);
  await expect(createFrontTemplateButton(page)).toBeVisible({ timeout: STUDIO_READY_TIMEOUT });

  await createFrontTemplateButton(page).click();
  await page.getByRole('button', { name: 'Text', exact: true }).click();

  await page.getByRole('radio', { name: /Repeating Text/i }).click();
  await expect(page.getByRole('radio', { name: /Repeating Text/i })).toBeChecked();
  await page.getByRole('button', { name: /Add Label \+ Value/i }).click();

  await expect(page.getByText(/Variables:.*label/i)).toBeVisible();
  await expect(page.getByLabel('Variable name for Label')).toBeVisible();
  await expect(page.getByLabel('Variable name for Value')).toBeVisible();
});

test('bulk generator reviews issues as data is entered without expanding the workspace', async ({ page }) => {
  await seedBulkMappingTemplate(page);
  await gotoStudio(page);
  await selectMainTab(page, /Make cards/i);
  await expectGeneratorReady(page);
  await page.getByRole('tab', { name: /Use a list/i }).click();

  await expect(page.getByText('1. Card design', { exact: true })).toBeVisible();
  await expect(page.getByText('2. Add your card data', { exact: true })).toBeVisible();

  await page.locator('#bulkData').fill('Rank,Suit,CenterMark,newText\nA,♥,♥,Ember-Claw');
  await expect(page.getByText(/Data ready — 1 card will be generated./i)).toBeVisible();
  await expect(page.getByText('Mapped Template Field', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Generate Outputs from Data/i })).toBeEnabled();
  await page.getByRole('button', { name: /Generate Outputs from Data/i }).click();
  await expect(page.getByRole('heading', { name: /Generated Outputs \(1\)/i })).toBeVisible();

  await page.locator('#bulkData').fill('Rank,Suit,CenterMark,newText\nA,,♥,Ember-Claw');
  await expect(page.getByRole('button', { name: 'Review data', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Review data', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Review data before generating');
  await expect(page.getByRole('dialog')).toContainText('Mapped Template Field');
});

test('supports a 1000-card generated gallery without rendering every preview at once', async ({ page }) => {
  test.setTimeout(STUDIO_TEST_TIMEOUT);
  await page.setViewportSize({ width: 1440, height: 900 });
  const template = {
    id: 'smoke-large-gallery-template',
    name: 'Smoke Large Gallery Template',
    aspectRatio: '63:88',
    templateSource: 'user',
    freeformCanvas: {
      width: 630,
      height: 880,
      elements: [
        {
          id: 'large-gallery-rank',
          type: 'text',
          name: 'Rank',
          content: '{{Rank:"A"}}',
          x: 78,
          y: 72,
          width: 120,
          height: 80,
          textColor: '#f3ead7',
          fontSizePx: 44,
        },
        {
          id: 'large-gallery-title',
          type: 'text',
          name: 'Card Name',
          content: '{{cardName:"Large Batch Card"}}',
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
  const storedCards = Array.from({ length: 1000 }, (_, index) => ({
    uniqueId: `smoke-large-gallery-${index + 1}`,
    templateId: template.id,
    data: {
      Rank: String((index % 13) + 1),
      Suit: index % 2 === 0 ? '♥' : '♠',
      CenterMark: index % 2 === 0 ? '♥' : '♠',
      cardName: `Large Batch Card ${index + 1}`,
    },
  }));

  await seedWorkspaceStorage(page, {
    userTemplates: [template],
    appearanceStyles: [],
    storedCards,
    selectedPaperSize: { name: 'US Letter (8.5×11 in)', widthMm: 215.9, heightMm: 279.4 },
    activeTab: 'generator',
    richTextHighlightColor: '#ffd700',
    singleCardGeneratorSelectedTemplateId: template.id,
    pdfMarginMm: 5,
    pdfCardSpacingMm: 0,
    pdfIncludeCutLines: false,
    pdfDuplexLayout: 'separate-pages',
    exportMode: 'physical',
    exportDpi: 300,
  });

  await gotoStudio(page);

  await expect(page.getByRole('heading', { name: /Generated Outputs \(1000\)/i })).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole('combobox', { name: 'Card size in generated outputs', exact: true })).toContainText('Small cards');
  await expect(page.getByRole('combobox', { name: 'Cards per row in generated outputs', exact: true })).toContainText('Auto fit');
  await expect(page.getByText('Showing 1000 matching outputs', { exact: true })).toBeVisible();
  await expect.poll(() => page.locator('.tcg-card-preview').count()).toBeLessThanOrEqual(70);
  await expect.poll(() => page.locator('.tcg-card-preview').count()).toBeGreaterThan(0);

  const firstViewportMaxCardsPerRow = await page.locator('.tcg-card-preview').evaluateAll((cards) => {
    const rowCounts = new Map<number, number>();
    cards.forEach((card) => {
      const top = Math.round(card.getBoundingClientRect().top);
      rowCounts.set(top, (rowCounts.get(top) ?? 0) + 1);
    });
    return Math.max(...rowCounts.values());
  });
  expect(firstViewportMaxCardsPerRow).toBeGreaterThanOrEqual(3);

  const virtualRows = page.getByTestId('generated-gallery-scroll').locator('[data-index]');
  const firstRenderedRowIndex = await virtualRows.first().getAttribute('data-index');
  await page.getByTestId('generated-gallery-scroll').evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    element.dispatchEvent(new Event('scroll', { bubbles: true }));
  });

  await expect.poll(() => page.locator('.tcg-card-preview').count()).toBeGreaterThan(0);
  await expect.poll(() => page.locator('.tcg-card-preview').count()).toBeLessThanOrEqual(70);
  await expect.poll(async () => virtualRows.first().getAttribute('data-index')).not.toBe(firstRenderedRowIndex);
});

test('supports keyboard-first generation and strict mode toggle', async ({ page }) => {
  await seedBulkMappingTemplate(page);
  await gotoStudio(page);
  await selectMainTab(page, /Make cards/i);

  const templateTrigger = page.locator('#deck-front-template');
  await templateTrigger.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  const addCardButton = page.getByRole('button', { name: /Create Generated Output/i });
  await addCardButton.focus();
  await page.keyboard.press('Enter');

  await expect(page.getByRole('heading', { name: /Generated Outputs \(1\)/i })).toBeVisible();
  await visibleCardPreviews(page).first().hover();
  await page.getByRole('button', { name: /Remove generated output 1/i }).click();

  await expect(page.getByRole('heading', { name: /Generated Outputs \(0\)/i })).toBeVisible();
  await expect(page.getByText('No outputs generated yet.')).toBeVisible();

  await page.getByRole('tab', { name: /Use a list/i }).click();
  await page.locator('#bulkData').fill('rulesText,typeLine\n"",CREATURE - DRAGON');

  await expect(page.getByRole('button', { name: 'Review data', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Review data', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Review data before generating');
});

test('supports keyboard save shortcut in template creator', async ({ page }) => {
  await gotoStudio(page);
  await selectMainTab(page, /Layout Studio/i);
  await expect(page.getByRole('heading', { name: /Layout Studio/i })).toBeVisible({ timeout: 30_000 });

  await createFrontTemplateButton(page).click();
  await page.getByRole('button', { name: 'Card setup', exact: true }).click();
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
  test.setTimeout(STUDIO_TEST_TIMEOUT);
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

test('supports touch-sized panel scrolling and canvas gesture ownership', async ({ page }) => {
  test.setTimeout(STUDIO_TEST_TIMEOUT);

  for (const viewport of [
    { name: 'phone landscape', width: 844, height: 390 },
    { name: 'phone portrait', width: 390, height: 844 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await gotoStudio(page);
    await expect(page.getByTestId('studio-ready')).toBeAttached({ timeout: STUDIO_READY_TIMEOUT });
    await page.getByRole('button', { name: 'Dismiss first run guide' }).click({ timeout: 5_000 }).catch(() => undefined);
    if (viewport.width >= 768) {
      await selectMainTab(page, /Layout Studio/i);
    }
    await expect(page.locator('.cardforge-maker-mobile-switcher')).toBeVisible({ timeout: STUDIO_READY_TIMEOUT });
    await page.waitForTimeout(500);

    const metrics = await page.evaluate(() => {
      const scrollRoots = [...document.querySelectorAll('.cardforge-maker-scroll')]
        .filter((root) => root.getBoundingClientRect().height > 0);
      const panelScrolls = scrollRoots.map((root) => {
        const viewport = root.querySelector<HTMLElement>('[data-radix-scroll-area-viewport]');
        return {
          rootHeight: Math.round(root.getBoundingClientRect().height),
          viewportHeight: Math.round(viewport?.getBoundingClientRect().height || 0),
          maxScroll: viewport ? viewport.scrollHeight - viewport.clientHeight : 0,
          overflowY: viewport ? getComputedStyle(viewport).overflowY : null,
          touchAction: viewport ? getComputedStyle(viewport).touchAction : null,
        };
      });

      scrollRoots.forEach((root) => {
        const viewport = root.querySelector<HTMLElement>('[data-radix-scroll-area-viewport]');
        if (viewport) viewport.scrollTop = 300;
      });

      const panelScrollPositions = scrollRoots.map((root) => (
        root.querySelector<HTMLElement>('[data-radix-scroll-area-viewport]')?.scrollTop ?? 0
      ));
      const selectedElement = document.querySelector<HTMLElement>('[data-freeform-element-id]');
      const resizeHandle = document.querySelector<HTMLElement>('[data-cardforge-resize-handle="true"]');
      const canvasScroll = document.querySelector<HTMLElement>('.cardforge-canvas-scroll');

      return {
        panelScrolls,
        panelScrollPositions,
        elementTouchAction: selectedElement ? getComputedStyle(selectedElement).touchAction : null,
        resizeHandleTouchAction: resizeHandle ? getComputedStyle(resizeHandle).touchAction : null,
        resizeHandleSize: resizeHandle ? Math.round(resizeHandle.getBoundingClientRect().width) : 0,
        canvasTouchAction: canvasScroll ? getComputedStyle(canvasScroll).touchAction : null,
        canvasPanelVisible: Boolean(document.querySelector('.cardforge-maker-canvas')?.getBoundingClientRect().height),
      };
    });

    expect(metrics.canvasPanelVisible, `${viewport.name} shows the canvas as the active phone surface`).toBe(true);
    expect(metrics.elementTouchAction, `${viewport.name} elements own drag gestures`).toBe('none');
    expect(metrics.resizeHandleTouchAction, `${viewport.name} resize handles own drag gestures`).toBe('none');
    expect(metrics.resizeHandleSize, `${viewport.name} resize handles prioritize reliable touch resizing`).toBeGreaterThanOrEqual(32);
    expect(metrics.canvasTouchAction, `${viewport.name} canvas owns custom pinch zoom and two-finger pan gestures`).toBe('none');

    const canvasBehindOverlay = () => page.locator('.cardforge-maker-canvas').evaluate((element) => (
      element.getBoundingClientRect().height > 0 && getComputedStyle(element).display !== 'none'
    ));

    for (const panel of [
      { open: 'Open editor menu', close: 'Close editor menu', name: 'Menu' },
      { open: 'Edit selected element', close: 'Close inspector', name: 'Inspector' },
    ]) {
      await page.getByRole('button', { name: panel.open }).click();
      await page.waitForTimeout(250);
      await expect.poll(canvasBehindOverlay).toBe(true);
      const panelMetrics = await page.evaluate(() => {
        const scrollRoot = [...document.querySelectorAll('.cardforge-maker-scroll')]
          .find((root) => root.getBoundingClientRect().height > 0);
        const viewport = scrollRoot?.querySelector<HTMLElement>('[data-radix-scroll-area-viewport]');
        if (viewport) viewport.scrollTop = 300;
        return {
          rootHeight: Math.round(scrollRoot?.getBoundingClientRect().height || 0),
          viewportHeight: Math.round(viewport?.getBoundingClientRect().height || 0),
          maxScroll: viewport ? viewport.scrollHeight - viewport.clientHeight : 0,
          overflowY: viewport ? getComputedStyle(viewport).overflowY : null,
          touchAction: viewport ? getComputedStyle(viewport).touchAction : null,
          scrollTop: viewport?.scrollTop ?? 0,
        };
      });
      expect(panelMetrics.rootHeight, `${viewport.name} ${panel.name} overlay has usable height`).toBeGreaterThan(180);
      expect(panelMetrics.viewportHeight, `${viewport.name} ${panel.name} overlay viewport fills its panel`).toBe(panelMetrics.rootHeight);
      expect(panelMetrics.maxScroll, `${viewport.name} ${panel.name} overlay has scrollable content`).toBeGreaterThan(200);
      expect(panelMetrics.overflowY, `${viewport.name} ${panel.name} overlay allows vertical scrolling`).toBe('auto');
      expect(panelMetrics.touchAction, `${viewport.name} ${panel.name} overlay keeps touch scroll`).toContain('pan-y');
      expect(panelMetrics.scrollTop, `${viewport.name} ${panel.name} overlay accepts scroll`).toBeGreaterThan(0);
      await page.getByRole('button', { name: panel.close }).click();
    }
  }
});
