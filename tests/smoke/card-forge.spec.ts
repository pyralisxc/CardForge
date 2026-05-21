import { expect, test } from '@playwright/test';
import { BlobReader, ZipReader } from '@zip.js/zip.js';
import { PDFDocument } from 'pdf-lib';
import { promises as fs } from 'fs';
import path from 'path';

const SMOKE_TEMPLATE_NAMES = new Set(['Smoke Freeform Template', 'Keyboard Save Template', 'Rich Text Parity Template', 'Maker Authored Rich Text Template', 'Maker Authored List Template', 'Maker Authored Ordered List Template', 'Structured Row Pressure Template']);

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
  await page.addInitScript(() => {
    window.localStorage.clear();
  });
});

test.afterEach(async () => {
  await cleanupSmokeUserTemplates();
});

test('loads default templates and adds a generated card', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/');

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
  await expect(page.getByRole('heading', { name: /Card Template Maker/i })).toBeVisible({ timeout: 30_000 });

  await page.getByRole('tab', { name: /Card Generator/i }).click();
  await expect(page.getByRole('button', { name: /Create Generated Card/i })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: /Create Generated Card/i }).click();

  await expect(page.getByRole('heading', { name: /Generated Reference Cards \(1\)/i })).toBeVisible();
  await expect
    .poll(() => page.locator('.tcg-card-preview').count())
    .toBeGreaterThanOrEqual(1);
});

test('creates a freeform template and renders it in the generator', async ({ page }) => {
  test.setTimeout(45_000);
  await page.goto('/');

  await page.getByRole('tab', { name: /Card Template Maker/i }).click();
  await expect(page.getByRole('heading', { name: /Card Template Maker/i })).toBeVisible({ timeout: 30_000 });

  await page.getByRole('button', { name: 'Create new template', exact: true }).click();
  await page.getByRole('tab', { name: 'Template', exact: true }).click();
  await page.getByLabel('Template Name').fill('Smoke Freeform Template');
  await page.getByRole('tab', { name: 'Element', exact: true }).click();
  await page.getByRole('button', { name: 'Text', exact: true }).click();
  await page.getByRole('button', { name: 'Aged Parchment', exact: true }).first().click();
  await expect(page.getByRole('button', { name: /Text Layer/ }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Template Saved', { exact: true })).toBeVisible();

  await page.getByRole('tab', { name: /Card Generator/i }).click();
  await page.getByRole('button', { name: /Create Generated Card/i }).click();

  await expect(page.getByRole('heading', { name: /Generated Reference Cards \(1\)/i })).toBeVisible();
  await expect
    .poll(() => page.locator('.tcg-card-preview').count())
    .toBeGreaterThanOrEqual(1);
  await expect(page.locator('[data-freeform-element-id]').first()).toBeVisible();

  await page.getByRole('tab', { name: /Bulk Import/i }).click();
  await page.locator('#bulk-file-upload-csv').setInputFiles({
    name: 'freeform-bulk.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Rank,Suit,CenterMark,newText\nA,♥,♥,Bulk Arcane One\nK,♠,♠,Bulk Arcane Two\n'),
  });
  await expect(page.locator('#bulkData')).toContainText('Bulk Arcane One');
  await page.getByRole('button', { name: /Generate Cards from Data/i }).dispatchEvent('click');

  await expect(page.getByRole('heading', { name: /Generated Reference Cards \(3\)/i })).toBeVisible();
  await expect
    .poll(() => page.locator('.tcg-card-preview').count())
    .toBeGreaterThanOrEqual(3);
  await expect
    .poll(() => page.locator('[data-freeform-element-id]').count())
    .toBeGreaterThanOrEqual(3);
});

test('bulk generator uses advanced mapping toggle and strict mode gating', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: /Card Generator/i }).click();
  await page.getByRole('tab', { name: /Bulk Import/i }).click();

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

  const generateButton = page.getByRole('button', { name: /Generate Cards from Data/i });
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

test('bulk generator supports indexed structured row CSV columns', async ({ page }) => {
  test.setTimeout(90_000);
  const structuredTemplate = {
    id: 'smoke-bulk-structured-template',
    name: 'Bulk Structured Rows Template',
    aspectRatio: '63:88',
    templateSource: 'user',
    templateUsage: 'standard',
    frameStyle: 'freeform',
    baseBackgroundColor: '#05070d',
    baseTextColor: '#f7e7ba',
    freeformCanvas: {
      width: 630,
      height: 880,
      elements: [
        { id: 'structured-bg', type: 'shape', name: 'Background', x: 0, y: 0, width: 630, height: 880, zIndex: 0, shapeKind: 'rectangle', fillColor: '#05070d', strokeColor: '#d5ad54', strokeWidth: 4 },
        { id: 'name-element', type: 'text', name: 'Name', content: '{{Name:"Gatehouse"}}', x: 64, y: 80, width: 500, height: 80, zIndex: 1, fontSizePx: 30, textColor: '#f7e7ba' },
        { id: 'exits-element', type: 'text', name: 'Exit Routes', content: '{{Exits:""}}', x: 64, y: 200, width: 500, height: 360, zIndex: 2, fontSizePx: 24, textColor: '#f7e7ba' },
      ],
    },
    fieldContracts: [
      { key: 'Name', label: 'Name', type: 'richText', elementId: 'name-element', required: true },
      {
        key: 'Exits',
        label: 'Exits',
        type: 'structuredList',
        elementId: 'exits-element',
        required: true,
        structuredListColumns: [
          { key: 'position', label: 'Position', placeholder: 'North' },
          { key: 'description', label: 'Description', placeholder: 'Leads to the market.' },
        ],
        structuredListColumnSeparator: ': ',
        structuredListRowSeparatorText: 'Choose carefully',
        structuredListColumnStyles: {
          position: { fontWeight: 'font-bold', textColor: '#38bdf8' },
          description: { fontStyle: 'italic', textColor: '#22aa66' },
        },
      },
    ],
  };

  await page.addInitScript((template) => {
    window.localStorage.setItem('card-forge-app-storage-v3', JSON.stringify({
      state: {
        userTemplates: [template],
        appearanceStyles: [],
        storedCards: [],
        selectedPaperSize: { name: 'US Letter (8.5x11 in)', widthMm: 215.9, heightMm: 279.4 },
        activeTab: 'generator',
        richTextHighlightColor: '#ffd700',
        singleCardGeneratorSelectedTemplateId: template.id,
        pdfMarginMm: 5,
        pdfCardSpacingMm: 0,
        pdfIncludeCutLines: false,
        pdfDuplexLayout: 'separate-pages',
        exportMode: 'physical',
        exportDpi: 300,
      },
      version: 1,
    }));
  }, structuredTemplate);

  await page.goto('/');
  await page.getByRole('tab', { name: /Card Generator/i }).click();
  await page.getByRole('tab', { name: /Bulk Import/i }).click();
  await expect(page.getByText(/Structured rows use indexed CSV columns/i)).toBeVisible({ timeout: 30_000 });

  await page.locator('#bulkData').fill(
    'Name,Exits[1].Position,Exits[1].Description,Exits[2].Position,Exits[2].Description\n' +
    '**Gatehouse**,North,Market road,East,Broken bridge'
  );
  await page.getByRole('button', { name: /Generate Cards from Data/i }).dispatchEvent('click');

  const preview = page.locator('.tcg-card-preview').first();
  await expect(page.getByRole('heading', { name: /Generated Reference Cards \(1\)/i })).toBeVisible();
  await expect(preview).toContainText('Gatehouse');
  await expect(preview).toContainText('North');
  await expect(preview).toContainText('Market road');
  await expect(preview).toContainText('Choose carefully');
  await expect(preview).toContainText('East');
  await expect(preview.locator('[data-rich-text-mark="bold"]')).toHaveCount(1);
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

  await page.goto('/');

  await expect(page.getByRole('heading', { name: /Generated Reference Cards \(1000\)/i })).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole('combobox', { name: 'Gallery density', exact: true })).toContainText('Compact grid');
  await expect(page.getByText('Page 1 of 17 - showing 1-60 of 1000 matching cards', { exact: true })).toBeVisible();
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

  await expect(page.getByText('Page 2 of 17 - showing 61-120 of 1000 matching cards', { exact: true })).toBeVisible();
  await expect.poll(() => page.locator('.tcg-card-preview').count()).toBeGreaterThan(0);
  await expect.poll(() => page.locator('.tcg-card-preview').count()).toBeLessThanOrEqual(70);
});

test('rehydrates persisted user templates as generated-card fallback storage', async ({ page }) => {
  test.setTimeout(90_000);
  const persistedTemplate = {
    id: 'smoke-persisted-user-template',
    name: 'Persisted Storage Template',
    aspectRatio: '63:88',
    templateSource: 'user',
    templateUsage: 'standard',
    frameStyle: 'standard',
    cardBorderWidth: '4px',
    cardBorderStyle: 'solid',
    cardBorderRadius: '0.5rem',
    baseBackgroundColor: '#020617',
    baseTextColor: '#f8fafc',
    fieldContracts: [
      {
        key: 'ProbeName',
        elementId: 'persisted-title',
        label: 'Probe Name',
        type: 'richText',
        required: true,
        textColor: '#14f1ff',
        fontWeight: 'font-bold',
        fontSizePx: 28,
      },
      {
        key: 'ProbeRules',
        elementId: 'persisted-rules',
        label: 'Probe Rules',
        type: 'rules',
        multiline: true,
        required: true,
      },
    ],
    freeformCanvas: {
      width: 630,
      height: 880,
      gridSize: 18,
      elements: [
        {
          id: 'persisted-frame',
          type: 'shape',
          name: 'Persisted Frame',
          x: 30,
          y: 30,
          width: 570,
          height: 820,
          zIndex: 0,
          opacity: 1,
          visible: true,
          locked: false,
          shapeKind: 'rectangle',
          fillColor: 'rgba(2,6,23,0.96)',
          strokeColor: '#14f1ff',
          strokeWidth: 4,
          borderRadius: 'rounded-xl',
        },
        {
          id: 'persisted-title',
          type: 'text',
          name: 'Persisted Title',
          parentId: 'persisted-frame',
          x: 64,
          y: 76,
          width: 502,
          height: 72,
          zIndex: 2,
          opacity: 1,
          visible: true,
          locked: false,
          content: '{{ProbeName:"Fallback Name"}}',
          generatorFieldKind: 'richText',
          generatorFieldRequired: true,
          fontSizePx: 28,
          fontWeight: 'font-bold',
          textAlign: 'center',
          textColor: '#f8fafc',
          padding: 'p-2',
        },
        {
          id: 'persisted-rules',
          type: 'text',
          name: 'Persisted Rules',
          parentId: 'persisted-frame',
          x: 64,
          y: 540,
          width: 502,
          height: 180,
          zIndex: 3,
          opacity: 1,
          visible: true,
          locked: false,
          content: '{{ProbeRules:"[ability] Fallback ability"}}',
          generatorFieldKind: 'rules',
          generatorFieldRequired: true,
          fontSizePx: 16,
          fontWeight: 'font-normal',
          textAlign: 'left',
          textColor: '#f8fafc',
          padding: 'p-3',
        },
      ],
    },
    backCanvas: {
      width: 630,
      height: 880,
      gridSize: 18,
      elements: [
        {
          id: 'persisted-back',
          type: 'shape',
          name: 'Persisted Back',
          x: 30,
          y: 30,
          width: 570,
          height: 820,
          zIndex: 0,
          opacity: 1,
          visible: true,
          locked: false,
          shapeKind: 'rectangle',
          fillColor: '#020617',
          strokeColor: '#14f1ff',
          strokeWidth: 4,
        },
      ],
    },
  };

  await page.addInitScript((template) => {
    window.localStorage.setItem('card-forge-app-storage-v3', JSON.stringify({
      state: {
        userTemplates: [template],
        appearanceStyles: [],
        storedCards: [
          {
            uniqueId: 'persisted-card-valid',
            templateId: template.id,
            data: {
              ProbeName: '**Round Trip Relic**',
              ProbeRules: '[ability] Flying\n[flavor] Persisted user template survived reload.',
            },
          },
          {
            uniqueId: 'persisted-card-missing-template',
            templateId: 'missing-template-for-hidden-card',
            data: { ProbeName: 'Hidden Card' },
          },
        ],
        selectedPaperSize: { name: 'US Letter (8.5x11 in)', widthMm: 215.9, heightMm: 279.4 },
        activeTab: 'generator',
        richTextHighlightColor: '#14f1ff',
        singleCardGeneratorSelectedTemplateId: template.id,
        pdfMarginMm: 8,
        pdfCardSpacingMm: 2,
        pdfIncludeCutLines: true,
        pdfDuplexLayout: 'same-page',
        exportMode: 'physical',
        exportDpi: 300,
      },
      version: 1,
    }));
  }, persistedTemplate);

  await page.goto('/');

  await expect(page.getByRole('heading', { name: /Generated Reference Cards \(1\)/i })).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText('Persisted Storage Template', { exact: true })).toBeVisible();
  await expect(page.locator('.tcg-card-preview')).toHaveCount(1);
  await expect(page.locator('.tcg-card-preview').first()).toContainText('Round Trip Relic');
  await expect(page.locator('.tcg-card-preview').first()).toContainText('Persisted user template survived reload');

  await page.reload();

  await expect(page.getByRole('heading', { name: /Generated Reference Cards \(1\)/i })).toBeVisible({ timeout: 45_000 });
  await expect(page.locator('.tcg-card-preview')).toHaveCount(1);
  await expect(page.locator('.tcg-card-preview').first()).toContainText('Round Trip Relic');

  const persistedState = await page.evaluate(() => JSON.parse(window.localStorage.getItem('card-forge-app-storage-v3') || '{}'));
  expect(persistedState.state.userTemplates.some((template: { id?: string }) => template.id === 'smoke-persisted-user-template')).toBe(true);
  expect(persistedState.state.storedCards).toHaveLength(2);
  expect(persistedState.state.pdfDuplexLayout).toBe('same-page');
  expect(persistedState.state.pdfCardSpacingMm).toBe(2);
});

test('preserves rich text formatting through generator, edit dialog, bulk import, and per-card PNG export', async ({ page }) => {
  test.setTimeout(120_000);
  const richTextTemplate = {
    id: 'smoke-rich-text-parity-template',
    name: 'Rich Text Parity Template',
    aspectRatio: '63:88',
    templateSource: 'user',
    templateUsage: 'standard',
    frameStyle: 'standard',
    cardBorderWidth: '4px',
    cardBorderStyle: 'solid',
    cardBorderRadius: '0.5rem',
    baseBackgroundColor: '#030712',
    baseTextColor: '#f8fafc',
    fieldContracts: [
      {
        key: 'HeroName',
        elementId: 'rich-title',
        label: 'Hero Name',
        type: 'richText',
        contentModel: 'richText',
        required: true,
        textColor: '#f8fafc',
        fontWeight: 'font-bold',
        textDecoration: 'underline',
        fontSizePx: 30,
      },
      {
        key: 'RulesText',
        elementId: 'rich-rules',
        label: 'Rules Text',
        type: 'rules',
        contentModel: 'rulesBlocks',
        multiline: true,
        required: true,
      },
    ],
    freeformCanvas: {
      width: 630,
      height: 880,
      gridSize: 18,
      elements: [
        {
          id: 'rich-frame',
          type: 'shape',
          name: 'Rich Text Frame',
          x: 30,
          y: 30,
          width: 570,
          height: 820,
          zIndex: 0,
          opacity: 1,
          visible: true,
          locked: false,
          shapeKind: 'rectangle',
          fillColor: '#030712',
          strokeColor: '#38bdf8',
          strokeWidth: 4,
          borderRadius: 'rounded-xl',
        },
        {
          id: 'rich-title',
          type: 'text',
          name: 'Hero Title',
          parentId: 'rich-frame',
          x: 64,
          y: 76,
          width: 502,
          height: 92,
          zIndex: 2,
          opacity: 1,
          visible: true,
          locked: false,
          content: 'Hero: {{HeroName:"Fallback Hero"}}',
          generatorFieldKind: 'richText',
          generatorFieldRequired: true,
          fontSizePx: 30,
          fontWeight: 'font-bold',
          textDecoration: 'underline',
          textAlign: 'center',
          textColor: '#f8fafc',
          padding: 'p-2',
        },
        {
          id: 'rich-rules',
          type: 'text',
          name: 'Rules Text',
          parentId: 'rich-frame',
          x: 74,
          y: 505,
          width: 482,
          height: 235,
          zIndex: 3,
          opacity: 1,
          visible: true,
          locked: false,
          content: '{{RulesText:"[ability] Fallback ability"}}',
          generatorFieldKind: 'rules',
          generatorFieldRequired: true,
          fontSizePx: 17,
          fontWeight: 'font-normal',
          textAlign: 'left',
          textColor: '#f8fafc',
          padding: 'p-3',
        },
      ],
    },
  };

  await page.addInitScript((template) => {
    window.localStorage.setItem('card-forge-app-storage-v3', JSON.stringify({
      state: {
        userTemplates: [template],
        appearanceStyles: [],
        storedCards: [
          {
            uniqueId: 'rich-text-card-valid',
            templateId: template.id,
            data: {
              cardName: 'Azure Blade and shadow',
              HeroName: '**Azure Blade** and _shadow_',
              RulesText: '[ability] **Strike** hard\n- _Swift_\n- [color:#38bdf8]Blue Fire[/color]\n[flavor] ==Remember the forge==',
            },
          },
        ],
        selectedPaperSize: { name: 'US Letter (8.5x11 in)', widthMm: 215.9, heightMm: 279.4 },
        activeTab: 'generator',
        richTextHighlightColor: '#38bdf8',
        singleCardGeneratorSelectedTemplateId: template.id,
        pdfMarginMm: 5,
        pdfCardSpacingMm: 0,
        pdfIncludeCutLines: false,
        pdfDuplexLayout: 'separate-pages',
        exportMode: 'digital',
        exportDpi: 300,
      },
      version: 1,
    }));
  }, richTextTemplate);

  await page.goto('/');

  await expect(page.getByRole('heading', { name: /Generated Reference Cards \(1\)/i })).toBeVisible({ timeout: 45_000 });
  const preview = page.locator('.tcg-card-preview').first();
  await expect(preview).toContainText('Azure Blade');
  await expect(preview).toContainText('shadow');
  await expect(preview).toContainText('Strike');
  await expect(preview).toContainText('Swift');
  await expect(preview).toContainText('Blue Fire');
  await expect(preview).toContainText('Remember the forge');
  await expect(preview.locator('[data-rich-text-mark~="bold"]').filter({ hasText: 'Azure Blade' })).toBeVisible();
  await expect(preview.locator('[data-rich-text-mark~="italic"]').filter({ hasText: 'shadow' })).toBeVisible();
  await expect(preview.locator('[data-rich-text-mark~="color"]').filter({ hasText: 'Blue Fire' })).toBeVisible();
  await expect(preview.locator('[data-rich-text-mark~="highlight"]').filter({ hasText: 'Remember the forge' })).toBeVisible();
  await expect(preview.locator('ul li').filter({ hasText: 'Swift' })).toBeVisible();

  await preview.click();
  const editDialog = page.getByRole('dialog', { name: /Edit:/i });
  await expect(editDialog).toBeVisible();
  await expect(editDialog.getByText('Hero Name', { exact: true }).first()).toBeVisible();
  await expect(editDialog.getByText('Rules Text', { exact: true }).first()).toBeVisible();
  await expect(editDialog.locator('.cardforge-rich-text-editor')).toHaveCount(3);
  await page.getByRole('button', { name: /Save Changes/i }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(editDialog).toBeHidden();

  await page.getByRole('tab', { name: 'Single', exact: true }).click();
  await page.getByRole('button', { name: /Create Generated Card/i }).click();
  await expect(page.getByRole('heading', { name: /Generated Reference Cards \(2\)/i })).toBeVisible();

  await page.getByRole('tab', { name: /Bulk Import/i }).click();
  await page.locator('#bulkData').fill('HeroName,RulesText\nBulk **Bright** Hero,"[ability] **Bulk Strike**\n- _Bulk Swift_\n[flavor] ==Bulk flavor=="\n');
  await page.getByRole('button', { name: /Generate Cards from Data/i }).dispatchEvent('click');
  await expect(page.getByRole('heading', { name: /Generated Reference Cards \(3\)/i })).toBeVisible();
  await expect(page.locator('.tcg-card-preview').filter({ hasText: 'Bulk Bright Hero' })).toBeVisible();
  await expect(page.locator('.tcg-card-preview').filter({ hasText: 'Bulk flavor' })).toBeVisible();

  await page.getByRole('tab', { name: /Export & Sets/i }).click();
  await page.getByRole('tab', { name: 'Single', exact: true }).click();
  await preview.hover();
  const pngDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Export Image/i }).first().click();
  await page.getByRole('menuitem', { name: /Export front as PNG/i }).click();
  const pngDownload = await pngDownloadPromise;
  const pngPath = path.join(test.info().outputDir, pngDownload.suggestedFilename());
  await pngDownload.saveAs(pngPath);
  const pngBytes = await fs.readFile(pngPath);

  expect(pngDownload.suggestedFilename()).toMatch(/azure-blade-and-shadow-front\.png/);
  expect([...pngBytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
});

test('preserves Maker-authored rich text variables through save and generator preview', async ({ page }) => {
  test.setTimeout(120_000);
  const makerTemplate = {
    id: 'smoke-maker-authored-rich-text-template',
    name: 'Maker Authored Rich Text Template',
    aspectRatio: '63:88',
    templateSource: 'user',
    templateUsage: 'standard',
    frameStyle: 'freeform',
    baseBackgroundColor: '#030712',
    baseTextColor: '#f8fafc',
    freeformCanvas: {
      width: 630,
      height: 880,
      gridSize: 18,
      elements: [
        {
          id: 'maker-rich-text',
          type: 'text',
          name: 'Maker Rich Text',
          x: 72,
          y: 110,
          width: 480,
          height: 260,
          zIndex: 1,
          opacity: 1,
          visible: true,
          locked: false,
          content: 'Variable',
          generatorFieldKind: 'richText',
          generatorFieldRequired: false,
          fontSizePx: 24,
          fontWeight: 'font-normal',
          textAlign: 'left',
          textColor: '#f8fafc',
          padding: 'p-3',
        },
      ],
    },
  };

  await page.addInitScript((template) => {
    window.localStorage.setItem('card-forge-app-storage-v3', JSON.stringify({
      state: {
        userTemplates: [template],
        appearanceStyles: [],
        storedCards: [],
        selectedPaperSize: { name: 'US Letter (8.5x11 in)', widthMm: 215.9, heightMm: 279.4 },
        activeTab: 'template-maker',
        richTextHighlightColor: '#ffd700',
        singleCardGeneratorSelectedTemplateId: template.id,
        pdfMarginMm: 5,
        pdfCardSpacingMm: 0,
        pdfIncludeCutLines: false,
        pdfDuplexLayout: 'separate-pages',
        exportMode: 'digital',
        exportDpi: 300,
      },
      version: 1,
    }));
  }, makerTemplate);

  await page.goto('/');
  await expect(page.getByRole('tab', { name: /Card Template Maker/i })).toBeVisible({ timeout: 30_000 });
  const makerEditor = page.locator('.cardforge-rich-text-editor').first();
  await expect(makerEditor).toBeVisible({ timeout: 30_000 });

  await makerEditor.click();
  await page.keyboard.press('Control+a');
  await page.getByRole('button', { name: 'Make variable', exact: true }).click();
  await expect(page.getByText('Variable created', { exact: true })).toBeVisible();

  await makerEditor.click();
  await page.keyboard.press('Control+a');
  await page.getByRole('button', { name: 'Bold', exact: true }).click();
  await makerEditor.click();
  await page.keyboard.press('Control+a');
  await page.getByRole('button', { name: 'Highlight', exact: true }).click();
  await makerEditor.click();
  await page.keyboard.press('Control+a');
  await page.getByRole('button', { name: 'Text color', exact: true }).click();
  await page.getByRole('button', { name: 'Apply Color', exact: true }).click();

  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Template Saved', { exact: true })).toBeVisible();

  const savedContent = await page.evaluate(() => {
    const persisted = JSON.parse(window.localStorage.getItem('card-forge-app-storage-v3') || '{}');
    const template = persisted.state.userTemplates.find((item: { id?: string }) => item.id === 'smoke-maker-authored-rich-text-template');
    return template?.freeformCanvas?.elements?.find((element: { id?: string }) => element.id === 'maker-rich-text')?.content || '';
  });

  expect(savedContent).toContain('{{maker_rich_text_var_1');
  expect(savedContent).toContain('Variable');
  expect(savedContent).toContain('**');
  expect(savedContent).toContain('==');
  expect(savedContent).toContain('[color:#f5d27b]');

  await page.getByRole('tab', { name: /Card Generator/i }).click();
  await page.getByRole('button', { name: /Create Generated Card/i }).click();
  await expect(page.getByRole('heading', { name: /Generated Reference Cards \(1\)/i })).toBeVisible();

  const preview = page.locator('.tcg-card-preview').first();
  await expect(preview).toContainText('Variable');
  await expect(preview.locator('[data-rich-text-mark~="bold"]').filter({ hasText: 'Variable' })).toBeVisible();
  await expect(preview.locator('[data-rich-text-mark~="highlight"]').filter({ hasText: 'Variable' })).toBeVisible();
  await expect(preview.locator('[data-rich-text-mark~="color"]').filter({ hasText: 'Variable' })).toBeVisible();
});

test('preserves Maker-authored list formatting through save and generator preview', async ({ page }) => {
  test.setTimeout(90_000);
  const listTemplate = {
    id: 'smoke-maker-authored-list-template',
    name: 'Maker Authored List Template',
    aspectRatio: '63:88',
    templateSource: 'user',
    templateUsage: 'standard',
    frameStyle: 'freeform',
    baseBackgroundColor: '#030712',
    baseTextColor: '#f8fafc',
    freeformCanvas: {
      width: 630,
      height: 880,
      gridSize: 18,
      elements: [
        {
          id: 'maker-list-text',
          type: 'text',
          name: 'Maker List Text',
          x: 72,
          y: 110,
          width: 480,
          height: 260,
          zIndex: 1,
          opacity: 1,
          visible: true,
          locked: false,
          content: 'First action\nSecond action',
          generatorFieldKind: 'richText',
          generatorFieldRequired: false,
          fontSizePx: 24,
          fontWeight: 'font-normal',
          textAlign: 'left',
          textColor: '#f8fafc',
          padding: 'p-3',
        },
      ],
    },
  };

  await page.addInitScript((template) => {
    window.localStorage.setItem('card-forge-app-storage-v3', JSON.stringify({
      state: {
        userTemplates: [template],
        appearanceStyles: [],
        storedCards: [],
        selectedPaperSize: { name: 'US Letter (8.5x11 in)', widthMm: 215.9, heightMm: 279.4 },
        activeTab: 'template-maker',
        richTextHighlightColor: '#ffd700',
        singleCardGeneratorSelectedTemplateId: template.id,
        pdfMarginMm: 5,
        pdfCardSpacingMm: 0,
        pdfIncludeCutLines: false,
        pdfDuplexLayout: 'separate-pages',
        exportMode: 'digital',
        exportDpi: 300,
      },
      version: 1,
    }));
  }, listTemplate);

  await page.goto('/');
  await expect(page.getByRole('tab', { name: /Card Template Maker/i })).toBeVisible({ timeout: 30_000 });
  const makerEditor = page.locator('.cardforge-rich-text-editor').first();
  await expect(makerEditor).toBeVisible({ timeout: 30_000 });

  await makerEditor.click();
  await page.keyboard.press('Control+a');
  await page.getByRole('button', { name: 'Bullet list', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Template Saved', { exact: true })).toBeVisible();

  const savedContent = await page.evaluate(() => {
    const persisted = JSON.parse(window.localStorage.getItem('card-forge-app-storage-v3') || '{}');
    const template = persisted.state.userTemplates.find((item: { id?: string }) => item.id === 'smoke-maker-authored-list-template');
    return template?.freeformCanvas?.elements?.find((element: { id?: string }) => element.id === 'maker-list-text')?.content || '';
  });

  expect(savedContent.trimEnd()).toBe('- First action\n- Second action');

  await page.getByRole('tab', { name: /Card Generator/i }).click();
  await page.getByRole('button', { name: /Create Generated Card/i }).click();
  await expect(page.getByRole('heading', { name: /Generated Reference Cards \(1\)/i })).toBeVisible();

  const preview = page.locator('.tcg-card-preview').first();
  await expect(preview.locator('ul')).toBeVisible();
  await expect(preview.locator('li').filter({ hasText: 'First action' })).toBeVisible();
  await expect(preview.locator('li').filter({ hasText: 'Second action' })).toBeVisible();
});

test('preserves Maker-authored ordered list formatting through save and generator preview', async ({ page }) => {
  test.setTimeout(90_000);
  const orderedListTemplate = {
    id: 'smoke-maker-authored-ordered-list-template',
    name: 'Maker Authored Ordered List Template',
    aspectRatio: '63:88',
    templateSource: 'user',
    templateUsage: 'standard',
    frameStyle: 'freeform',
    baseBackgroundColor: '#030712',
    baseTextColor: '#f8fafc',
    freeformCanvas: {
      width: 630,
      height: 880,
      gridSize: 18,
      elements: [
        {
          id: 'maker-ordered-list-text',
          type: 'text',
          name: 'Maker Ordered List Text',
          x: 72,
          y: 110,
          width: 480,
          height: 260,
          zIndex: 1,
          opacity: 1,
          visible: true,
          locked: false,
          content: 'First step\nSecond step',
          generatorFieldKind: 'richText',
          generatorFieldRequired: false,
          fontSizePx: 24,
          fontWeight: 'font-normal',
          textAlign: 'left',
          textColor: '#f8fafc',
          padding: 'p-3',
        },
      ],
    },
  };

  await page.addInitScript((template) => {
    window.localStorage.setItem('card-forge-app-storage-v3', JSON.stringify({
      state: {
        userTemplates: [template],
        appearanceStyles: [],
        storedCards: [],
        selectedPaperSize: { name: 'US Letter (8.5x11 in)', widthMm: 215.9, heightMm: 279.4 },
        activeTab: 'template-maker',
        richTextHighlightColor: '#ffd700',
        singleCardGeneratorSelectedTemplateId: template.id,
        pdfMarginMm: 5,
        pdfCardSpacingMm: 0,
        pdfIncludeCutLines: false,
        pdfDuplexLayout: 'separate-pages',
        exportMode: 'digital',
        exportDpi: 300,
      },
      version: 1,
    }));
  }, orderedListTemplate);

  await page.goto('/');
  const makerEditor = page.locator('.cardforge-rich-text-editor').first();
  await expect(makerEditor).toBeVisible({ timeout: 30_000 });

  await makerEditor.click();
  await page.keyboard.press('Control+a');
  await page.getByRole('button', { name: 'Numbered list', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Template Saved', { exact: true })).toBeVisible();

  const savedContent = await page.evaluate(() => {
    const persisted = JSON.parse(window.localStorage.getItem('card-forge-app-storage-v3') || '{}');
    const template = persisted.state.userTemplates.find((item: { id?: string }) => item.id === 'smoke-maker-authored-ordered-list-template');
    return template?.freeformCanvas?.elements?.find((element: { id?: string }) => element.id === 'maker-ordered-list-text')?.content || '';
  });

  expect(savedContent.trimEnd()).toBe('1. First step\n2. Second step');

  await page.getByRole('tab', { name: /Card Generator/i }).click();
  await page.getByRole('button', { name: /Create Generated Card/i }).click();
  await expect(page.getByRole('heading', { name: /Generated Reference Cards \(1\)/i })).toBeVisible();

  const preview = page.locator('.tcg-card-preview').first();
  await expect(preview.locator('ol')).toBeVisible();
  await expect(preview.locator('li').filter({ hasText: 'First step' })).toBeVisible();
  await expect(preview.locator('li').filter({ hasText: 'Second step' })).toBeVisible();
});

test('warns when structured rows exceed estimated text block capacity', async ({ page }) => {
  test.setTimeout(120_000);
  const pressureTemplate = {
    id: 'smoke-structured-row-pressure-template',
    name: 'Structured Row Pressure Template',
    aspectRatio: '63:88',
    templateSource: 'user',
    templateUsage: 'standard',
    frameStyle: 'freeform',
    baseBackgroundColor: '#030712',
    baseTextColor: '#f8fafc',
    freeformCanvas: {
      width: 630,
      height: 880,
      elements: [
        {
          id: 'note-element',
          type: 'text',
          name: 'Note',
          content: '{{Note:"Short"}}',
          x: 72,
          y: 40,
          width: 120,
          height: 40,
          zIndex: 1,
          fontSizePx: 20,
          textAutoFit: true,
          textMinFontSizePx: 10,
          lineHeight: '1.2',
          textColor: '#f8fafc',
        },
        {
          id: 'exits-element',
          type: 'text',
          name: 'Exit Routes',
          content: '{{Exits:""}}',
          x: 72,
          y: 120,
          width: 240,
          height: 120,
          zIndex: 1,
          fontSizePx: 20,
          textAutoFit: true,
          textMinFontSizePx: 10,
          lineHeight: '1.2',
          textColor: '#f8fafc',
        },
      ],
    },
    fieldContracts: [
      {
        key: 'Note',
        label: 'Note',
        type: 'richText',
        elementId: 'note-element',
        textAutoFit: true,
        minFontSizePx: 10,
      },
      {
        key: 'Exits',
        label: 'Exits',
        type: 'structuredList',
        elementId: 'exits-element',
        textAutoFit: true,
        minFontSizePx: 10,
        structuredListColumns: [
          { key: 'position', label: 'Position' },
          { key: 'description', label: 'Description' },
        ],
        structuredListColumnSeparator: ': ',
      },
    ],
  };

  await page.addInitScript((template) => {
    window.localStorage.setItem('card-forge-app-storage-v3', JSON.stringify({
      state: {
        userTemplates: [template],
        appearanceStyles: [],
        storedCards: [],
        selectedPaperSize: { name: 'US Letter (8.5x11 in)', widthMm: 215.9, heightMm: 279.4 },
        activeTab: 'generator',
        richTextHighlightColor: '#ffd700',
        singleCardGeneratorSelectedTemplateId: template.id,
        pdfMarginMm: 5,
        pdfCardSpacingMm: 0,
        pdfIncludeCutLines: false,
        pdfDuplexLayout: 'separate-pages',
        exportMode: 'digital',
        exportDpi: 300,
      },
      version: 1,
    }));
  }, pressureTemplate);

  await page.goto('/');
  await page.getByRole('tab', { name: /Card Generator/i }).click();
  await expect(page.getByText(/5 characters should fit at the template font size/i)).toBeVisible({ timeout: 30_000 });
  const noteEditor = page.locator('.cardforge-rich-text-editor').first();
  await noteEditor.click();
  await page.keyboard.press('Control+a');
  await page.keyboard.type('x'.repeat(300));
  await expect(page.getByText(/300 characters will likely overflow this text box/i)).toBeVisible();
  await expect(page.getByText(/1 row should fit at the template font size/i)).toBeVisible({ timeout: 30_000 });

  const addRow = page.getByRole('button', { name: 'Add row', exact: true });
  for (let index = 0; index < 29; index += 1) {
    await addRow.click();
  }

  await expect(page.getByText(/30 rows will likely overflow this text box/i)).toBeVisible();
  await page.getByRole('button', { name: /Create Generated Card/i }).click();
  await expect(page.getByRole('heading', { name: /Generated Reference Cards \(1\)/i })).toBeVisible();
  const overflowingPreviewText = page.locator('[data-freeform-element-id="note-element"][data-text-fit-status="overflow"]').first();
  await expect(overflowingPreviewText).toBeVisible();
  await expect(page.getByText('Text clipping', { exact: true }).first()).toBeVisible();
});

test('downloads print PDF and front/back PNG ZIP from generated cards', async ({ page }) => {
  test.setTimeout(120_000);
  const exportTemplate = {
    id: 'smoke-export-template',
    name: 'Smoke Export Template',
    aspectRatio: '63:88',
    templateSource: 'user',
    templateUsage: 'standard',
    frameStyle: 'standard',
    cardBorderWidth: '4px',
    cardBorderStyle: 'solid',
    cardBorderRadius: '0.5rem',
    baseBackgroundColor: '#020617',
    baseTextColor: '#f8fafc',
    fieldContracts: [
      {
        key: 'ExportName',
        elementId: 'export-title',
        label: 'Export Name',
        type: 'richText',
        required: true,
        textColor: '#f8fafc',
        fontWeight: 'font-bold',
        fontSizePx: 32,
      },
    ],
    freeformCanvas: {
      width: 630,
      height: 880,
      gridSize: 18,
      elements: [
        {
          id: 'export-front-frame',
          type: 'shape',
          name: 'Export Front Frame',
          x: 30,
          y: 30,
          width: 570,
          height: 820,
          zIndex: 0,
          opacity: 1,
          visible: true,
          locked: false,
          shapeKind: 'rectangle',
          fillColor: '#020617',
          strokeColor: '#38bdf8',
          strokeWidth: 4,
          borderRadius: 'rounded-xl',
        },
        {
          id: 'export-title',
          type: 'text',
          name: 'Export Title',
          x: 70,
          y: 110,
          width: 490,
          height: 96,
          zIndex: 1,
          opacity: 1,
          visible: true,
          locked: false,
          content: '{{ExportName:"Export Probe"}}',
          generatorFieldKind: 'richText',
          generatorFieldRequired: true,
          fontSizePx: 32,
          fontWeight: 'font-bold',
          textAlign: 'center',
          textColor: '#f8fafc',
          padding: 'p-2',
        },
      ],
    },
    backCanvas: {
      width: 630,
      height: 880,
      gridSize: 18,
      elements: [
        {
          id: 'export-back-frame',
          type: 'shape',
          name: 'Export Back Frame',
          x: 30,
          y: 30,
          width: 570,
          height: 820,
          zIndex: 0,
          opacity: 1,
          visible: true,
          locked: false,
          shapeKind: 'rectangle',
          fillColor: '#050816',
          strokeColor: '#f97316',
          strokeWidth: 4,
          borderRadius: 'rounded-xl',
        },
        {
          id: 'export-back-label',
          type: 'text',
          name: 'Export Back Label',
          x: 80,
          y: 390,
          width: 470,
          height: 72,
          zIndex: 1,
          opacity: 1,
          visible: true,
          locked: false,
          content: 'CARD BACK',
          fontSizePx: 34,
          fontWeight: 'font-bold',
          textAlign: 'center',
          textColor: '#f97316',
          padding: 'p-2',
        },
      ],
    },
  };

  await page.addInitScript((template) => {
    window.localStorage.setItem('card-forge-app-storage-v3', JSON.stringify({
      state: {
        userTemplates: [template],
        appearanceStyles: [],
        storedCards: [
          {
            uniqueId: 'smoke-export-card',
            templateId: template.id,
            data: { ExportName: '**Commercial Export Probe**' },
          },
        ],
        selectedPaperSize: { name: 'US Letter (8.5x11 in)', widthMm: 215.9, heightMm: 279.4 },
        activeTab: 'generator',
        richTextHighlightColor: '#ffd700',
        singleCardGeneratorSelectedTemplateId: template.id,
        pdfMarginMm: 5,
        pdfCardSpacingMm: 0,
        pdfIncludeCutLines: true,
        pdfDuplexLayout: 'separate-pages',
        exportMode: 'physical',
        exportDpi: 300,
      },
      version: 1,
    }));
  }, exportTemplate);

  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Generated Reference Cards \(1\)/i })).toBeVisible({ timeout: 45_000 });
  await page.getByRole('tab', { name: /Export & Sets/i }).click();

  const pdfDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Save as PDF/i }).click();
  const pdfDownload = await pdfDownloadPromise;
  const pdfPath = path.join(test.info().outputDir, pdfDownload.suggestedFilename());
  await pdfDownload.saveAs(pdfPath);
  const pdfBytes = await fs.readFile(pdfPath);
  const pdf = await PDFDocument.load(pdfBytes);
  const [firstPage] = pdf.getPages();
  const { width, height } = firstPage.getSize();

  expect(pdfDownload.suggestedFilename()).toMatch(/Smoke-Export-Template-print-duplex-sheets-\d{4}-\d{2}-\d{2}\.pdf/);
  expect(pdf.getPageCount()).toBe(2);
  expect(Math.round(width)).toBe(612);
  expect(Math.round(height)).toBe(792);
  expect(pdfBytes.subarray(0, 4).toString()).toBe('%PDF');

  const zipDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Export Print PNG ZIP/i }).click();
  const zipDownload = await zipDownloadPromise;
  const zipPath = path.join(test.info().outputDir, zipDownload.suggestedFilename());
  await zipDownload.saveAs(zipPath);
  const zipBytes = await fs.readFile(zipPath);
  const zipReader = new ZipReader(new BlobReader(new Blob([new Uint8Array(zipBytes)])));
  const zipEntries = await zipReader.getEntries();
  const zipEntryNames = zipEntries.map((entry) => entry.filename).sort();
  await zipReader.close();

  expect(zipDownload.suggestedFilename()).toBe('cardforge-physical-print-card-faces.zip');
  expect(zipBytes.subarray(0, 2).toString()).toBe('PK');
  expect(zipEntryNames).toEqual([
    'physical-print-card-faces/001_card-1_back.png',
    'physical-print-card-faces/001_card-1_front.png',
  ]);
});

test('normalizes old template-maker tab value from persisted browser storage', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('card-forge-app-storage-v3', JSON.stringify({
      state: {
        userTemplates: [],
        appearanceStyles: [],
        storedCards: [],
        selectedPaperSize: { name: 'US Letter (8.5x11 in)', widthMm: 215.9, heightMm: 279.4 },
        activeTab: 'template-maker-2',
        richTextHighlightColor: '#ffd700',
        singleCardGeneratorSelectedTemplateId: null,
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

  await page.goto('/');

  await expect(page.getByRole('heading', { name: /Card Template Maker/i })).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => {
    const persistedState = await page.evaluate(() => JSON.parse(window.localStorage.getItem('card-forge-app-storage-v3') || '{}'));
    return persistedState.state.activeTab;
  }).toBe('template-maker');
});

test('supports keyboard-first generation and strict mode toggle', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: /Card Generator/i }).click();

  const templateTrigger = page.locator('#singleTemplateSelect');
  await templateTrigger.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  const addCardButton = page.getByRole('button', { name: /Create Generated Card/i });
  await addCardButton.focus();
  await page.keyboard.press('Enter');

  await expect(page.getByRole('heading', { name: /Generated Reference Cards \(1\)/i })).toBeVisible();

  await page.getByRole('tab', { name: /Bulk Import/i }).click();
  await page.locator('#bulkData').fill('rulesText,typeLine\n"",CREATURE - DRAGON');

  const strictModeToggle = page.getByLabel('Toggle strict mode for bulk generation');
  await expect(strictModeToggle).toBeVisible();
  await strictModeToggle.dispatchEvent('click');

  await expect(page.getByText(/Strict Mode is on\./i)).toBeVisible();
});

test('supports repeated mobile menu open close and tab switching', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await expect(page.getByRole('button', { name: /Menu \(Card Template Maker\)/i })).toBeVisible({ timeout: 30_000 });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.getByRole('button', { name: /Menu/i }).click();
    await expect(page.getByRole('heading', { name: 'Navigation', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'Navigation', exact: true })).toBeHidden();
  }

  await page.getByRole('button', { name: /Menu/i }).click();
  await page.getByRole('button', { name: /Card Generator/i }).click();
  await expect(page.getByRole('button', { name: /Menu \(Card Generator\)/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Create Generated Card/i })).toBeVisible({ timeout: 30_000 });

  await page.getByRole('button', { name: /Menu/i }).click();
  await page.getByRole('button', { name: /Card Template Maker/i }).click();
  await expect(page.getByRole('button', { name: /Menu \(Card Template Maker\)/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Card Template Maker/i })).toBeVisible({ timeout: 30_000 });
});

test('supports keyboard save shortcut in template creator', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: /Card Template Maker/i }).click();
  await expect(page.getByRole('heading', { name: /Card Template Maker/i })).toBeVisible({ timeout: 30_000 });

  await page.getByRole('button', { name: 'Create new template', exact: true }).click();
  await page.getByRole('tab', { name: 'Template', exact: true }).click();
  await page.getByLabel('Template Name').fill('Keyboard Save Template');

  await page.keyboard.press('Control+s');
  await expect(page.getByText('Template Saved', { exact: true })).toBeVisible();
});

test('supports keyboard arrow movement on template canvas', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: /Card Template Maker/i }).click();

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

test('supports undo and redo after mixed canvas move and resize operations', async ({ page }) => {
  test.setTimeout(90_000);
  const transformTemplate = {
    id: 'smoke-undo-redo-transform-template',
    name: 'Smoke Undo Redo Transform Template',
    aspectRatio: '63:88',
    templateSource: 'user',
    templateUsage: 'standard',
    frameStyle: 'freeform',
    baseBackgroundColor: '#020617',
    baseTextColor: '#f8fafc',
    freeformCanvas: {
      width: 630,
      height: 880,
      gridSize: 10,
      elements: [
        {
          id: 'transform-target',
          type: 'shape',
          name: 'Transform Target',
          x: 160,
          y: 180,
          width: 120,
          height: 90,
          zIndex: 1,
          opacity: 1,
          visible: true,
          locked: false,
          shapeKind: 'rectangle',
          fillColor: '#0f172a',
          strokeColor: '#38bdf8',
          strokeWidth: 4,
          borderRadius: 'rounded-xl',
        },
      ],
    },
  };

  await page.addInitScript((template) => {
    window.localStorage.setItem('card-forge-app-storage-v3', JSON.stringify({
      state: {
        userTemplates: [template],
        appearanceStyles: [],
        storedCards: [],
        selectedPaperSize: { name: 'US Letter (8.5x11 in)', widthMm: 215.9, heightMm: 279.4 },
        activeTab: 'template-maker',
        richTextHighlightColor: '#ffd700',
        singleCardGeneratorSelectedTemplateId: template.id,
        pdfMarginMm: 5,
        pdfCardSpacingMm: 0,
        pdfIncludeCutLines: false,
        pdfDuplexLayout: 'separate-pages',
        exportMode: 'physical',
        exportDpi: 300,
      },
      version: 1,
    }));
  }, transformTemplate);

  await page.goto('/');
  const canvas = page.locator('[data-cardforge-canvas="true"]');
  const target = page.locator('[data-freeform-element-id="transform-target"]');
  await expect(page.locator('[data-selection-overlay-for="transform-target"]')).toBeVisible({ timeout: 30_000 });

  const initialLeft = await target.evaluate((element) => parseFloat((element as HTMLElement).style.left || '0'));
  const initialWidth = await target.evaluate((element) => parseFloat((element as HTMLElement).style.width || '0'));

  await canvas.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => target.evaluate((element) => parseFloat((element as HTMLElement).style.left || '0'))).toBeGreaterThan(initialLeft);
  const movedLeft = await target.evaluate((element) => parseFloat((element as HTMLElement).style.left || '0'));

  const eastZoneBox = await page.locator('[data-resize-zone="e"]').boundingBox();
  expect(eastZoneBox).toBeTruthy();
  await page.mouse.move(eastZoneBox!.x + eastZoneBox!.width / 2, eastZoneBox!.y + eastZoneBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(eastZoneBox!.x + eastZoneBox!.width / 2 + 70, eastZoneBox!.y + eastZoneBox!.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => target.evaluate((element) => parseFloat((element as HTMLElement).style.width || '0'))).toBeGreaterThan(initialWidth);

  await canvas.focus();
  await page.keyboard.press('Control+z');
  await expect.poll(async () => target.evaluate((element) => Math.round(parseFloat((element as HTMLElement).style.width || '0')))).toBe(Math.round(initialWidth));
  await expect.poll(async () => target.evaluate((element) => parseFloat((element as HTMLElement).style.left || '0'))).toBe(movedLeft);

  await page.keyboard.press('Control+z');
  await expect.poll(async () => target.evaluate((element) => parseFloat((element as HTMLElement).style.left || '0'))).toBe(initialLeft);

  await page.keyboard.press('Control+y');
  await expect.poll(async () => target.evaluate((element) => parseFloat((element as HTMLElement).style.left || '0'))).toBe(movedLeft);
});

test('supports keyboard lock toggle in layer tree', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: /Card Template Maker/i }).click();

  const lockButton = page.locator('button[aria-label^="Lock layer "]').first();
  await expect(lockButton).toBeVisible({ timeout: 30_000 });
  await lockButton.focus();
  await page.keyboard.press('Enter');

  const unlockButton = page.locator('button[aria-label^="Unlock layer "]').first();
  await expect(unlockButton).toBeVisible();
});

test('supports keyboard visibility toggle in layer tree', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: /Card Template Maker/i }).click();

  const hideButton = page.locator('button[aria-label^="Hide layer "]').first();
  await expect(hideButton).toBeVisible({ timeout: 30_000 });
  await hideButton.focus();
  await page.keyboard.press('Enter');

  const showButton = page.locator('button[aria-label^="Show layer "]').first();
  await expect(showButton).toBeVisible();
});

test('keeps selected element resize controls above overlapping layers while preserving depth cycling', async ({ page }) => {
  test.setTimeout(90_000);
  const overlappingTemplate = {
    id: 'smoke-overlap-editor-template',
    name: 'Smoke Overlap Editor Template',
    aspectRatio: '63:88',
    templateSource: 'user',
    templateUsage: 'standard',
    frameStyle: 'freeform',
    baseBackgroundColor: '#020617',
    baseTextColor: '#f8fafc',
    freeformCanvas: {
      width: 630,
      height: 880,
      gridSize: 20,
      elements: [
        {
          id: 'artwork-parent',
          type: 'shape',
          name: 'Artwork Parent',
          x: 160,
          y: 170,
          width: 180,
          height: 180,
          zIndex: 1,
          opacity: 1,
          visible: true,
          locked: false,
          shapeKind: 'rectangle',
          fillColor: '#0f172a',
          strokeColor: '#38bdf8',
          strokeWidth: 4,
          borderRadius: 'rounded-xl',
        },
        {
          id: 'glaze-overlay',
          type: 'shape',
          name: 'Oversized Glaze Overlay',
          x: 130,
          y: 140,
          width: 260,
          height: 260,
          zIndex: 8,
          opacity: 0.55,
          visible: true,
          locked: false,
          shapeKind: 'rectangle',
          fillColor: '#f97316',
          strokeColor: '#facc15',
          strokeWidth: 6,
          borderRadius: 'rounded-xl',
        },
      ],
    },
  };

  await page.addInitScript((template) => {
    window.localStorage.setItem('card-forge-app-storage-v3', JSON.stringify({
      state: {
        userTemplates: [template],
        appearanceStyles: [],
        storedCards: [],
        selectedPaperSize: { name: 'US Letter (8.5x11 in)', widthMm: 215.9, heightMm: 279.4 },
        activeTab: 'template-maker',
        richTextHighlightColor: '#ffd700',
        singleCardGeneratorSelectedTemplateId: template.id,
        pdfMarginMm: 5,
        pdfCardSpacingMm: 0,
        pdfIncludeCutLines: false,
        pdfDuplexLayout: 'separate-pages',
        exportMode: 'physical',
        exportDpi: 300,
      },
      version: 1,
    }));
  }, overlappingTemplate);

  await page.goto('/');
  await expect(page.getByRole('tab', { name: /Card Template Maker/i })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-selection-overlay-for="artwork-parent"]')).toBeVisible({ timeout: 30_000 });

  const parentElement = page.locator('[data-freeform-element-id="artwork-parent"]');
  const overlayElement = page.locator('[data-freeform-element-id="glaze-overlay"]');
  const parentBoxBefore = await parentElement.boundingBox();
  const overlayBox = await overlayElement.boundingBox();
  const eastResizeZone = page.locator('[data-resize-zone="e"]');
  const eastZoneBox = await eastResizeZone.boundingBox();

  expect(parentBoxBefore).toBeTruthy();
  expect(overlayBox).toBeTruthy();
  expect(eastZoneBox).toBeTruthy();
  expect(eastZoneBox!.x + eastZoneBox!.width / 2).toBeGreaterThanOrEqual(overlayBox!.x);
  expect(eastZoneBox!.x + eastZoneBox!.width / 2).toBeLessThanOrEqual(overlayBox!.x + overlayBox!.width);

  await page.mouse.move(eastZoneBox!.x + eastZoneBox!.width / 2, eastZoneBox!.y + eastZoneBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(eastZoneBox!.x + eastZoneBox!.width / 2 + 80, eastZoneBox!.y + eastZoneBox!.height / 2, { steps: 8 });
  await page.mouse.up();

  await expect.poll(async () => {
    const box = await parentElement.boundingBox();
    return Math.round(box?.width ?? 0);
  }).toBeGreaterThan(Math.round(parentBoxBefore!.width));

  const parentBoxAfter = await parentElement.boundingBox();
  await page.mouse.click(parentBoxAfter!.x + parentBoxAfter!.width / 2, parentBoxAfter!.y + parentBoxAfter!.height / 2);
  await expect(page.locator('[data-selection-overlay-for="glaze-overlay"]')).toBeVisible();
  await page.mouse.click(parentBoxAfter!.x + parentBoxAfter!.width / 2, parentBoxAfter!.y + parentBoxAfter!.height / 2);
  await expect(page.locator('[data-selection-overlay-for="artwork-parent"]')).toBeVisible();
});

test('resizes a tiny rotated selected element with usable edge targets in a dense stack', async ({ page }) => {
  test.setTimeout(90_000);
  const denseTemplate = {
    id: 'smoke-tiny-rotated-editor-template',
    name: 'Smoke Tiny Rotated Editor Template',
    aspectRatio: '63:88',
    templateSource: 'user',
    templateUsage: 'standard',
    frameStyle: 'freeform',
    baseBackgroundColor: '#020617',
    baseTextColor: '#f8fafc',
    freeformCanvas: {
      width: 630,
      height: 880,
      gridSize: 10,
      elements: [
        {
          id: 'tiny-rune',
          type: 'shape',
          name: 'Tiny Rotated Rune',
          x: 238,
          y: 248,
          width: 10,
          height: 10,
          rotation: 45,
          zIndex: 1,
          opacity: 1,
          visible: true,
          locked: false,
          shapeKind: 'rectangle',
          fillColor: '#38bdf8',
          strokeColor: '#f8fafc',
          strokeWidth: 2,
          borderRadius: 'rounded-sm',
        },
        {
          id: 'dense-glow',
          type: 'shape',
          name: 'Dense Glow Above',
          x: 208,
          y: 218,
          width: 92,
          height: 92,
          zIndex: 8,
          opacity: 0.4,
          visible: true,
          locked: false,
          shapeKind: 'ellipse',
          fillColor: '#f97316',
          strokeColor: '#facc15',
          strokeWidth: 4,
        },
        {
          id: 'dense-frame',
          type: 'shape',
          name: 'Dense Frame Above',
          x: 190,
          y: 200,
          width: 132,
          height: 132,
          zIndex: 12,
          opacity: 0.32,
          visible: true,
          locked: false,
          shapeKind: 'rectangle',
          fillColor: 'transparent',
          strokeColor: '#a855f7',
          strokeWidth: 5,
          borderRadius: 'rounded-xl',
        },
      ],
    },
  };

  await page.addInitScript((template) => {
    window.localStorage.setItem('card-forge-app-storage-v3', JSON.stringify({
      state: {
        userTemplates: [template],
        appearanceStyles: [],
        storedCards: [],
        selectedPaperSize: { name: 'US Letter (8.5x11 in)', widthMm: 215.9, heightMm: 279.4 },
        activeTab: 'template-maker',
        richTextHighlightColor: '#ffd700',
        singleCardGeneratorSelectedTemplateId: template.id,
        pdfMarginMm: 5,
        pdfCardSpacingMm: 0,
        pdfIncludeCutLines: false,
        pdfDuplexLayout: 'separate-pages',
        exportMode: 'physical',
        exportDpi: 300,
      },
      version: 1,
    }));
  }, denseTemplate);

  await page.goto('/');
  await expect(page.locator('[data-selection-overlay-for="tiny-rune"]')).toBeVisible({ timeout: 30_000 });

  const tinyElement = page.locator('[data-freeform-element-id="tiny-rune"]');
  const widthBefore = await tinyElement.evaluate((element) => parseFloat((element as HTMLElement).style.width || '0'));
  const eastResizeZone = page.locator('[data-resize-zone="e"]');
  const eastZoneBox = await eastResizeZone.boundingBox();

  expect(eastZoneBox).toBeTruthy();
  expect(eastZoneBox!.width).toBeGreaterThanOrEqual(10);
  expect(eastZoneBox!.height).toBeGreaterThanOrEqual(14);

  await page.mouse.move(eastZoneBox!.x + eastZoneBox!.width / 2, eastZoneBox!.y + eastZoneBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(eastZoneBox!.x + eastZoneBox!.width / 2 + 80, eastZoneBox!.y + eastZoneBox!.height / 2 + 80, { steps: 8 });
  await page.mouse.up();

  await expect.poll(async () => {
    return tinyElement.evaluate((element) => parseFloat((element as HTMLElement).style.width || '0'));
  }).toBeGreaterThan(widthBefore);
});
