import { expect, test } from '@playwright/test';

test('loads default templates and adds a generated card', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.removeItem('card-forge-app-storage-v2');
  });

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
  await expect(page.getByRole('heading', { name: /Card Template Maker 2\.0/i })).toBeVisible();

  await page.getByRole('tab', { name: /Card Generator/i }).click();
  await expect(page.getByRole('button', { name: /Add Card to Preview List/i })).toBeVisible();
  await page.getByRole('button', { name: /Add Card to Preview List/i }).click();

  await expect(page.getByRole('heading', { name: /Generated Cards \(1\)/i })).toBeVisible();
  await expect
    .poll(() => page.locator('.tcg-card-preview').count())
    .toBeGreaterThanOrEqual(1);
});

test('creates a freeform 2.0 template and renders it in the generator', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.removeItem('card-forge-app-storage-v2');
  });

  await page.goto('/');

  await page.getByRole('tab', { name: /Card Template Maker 2\.0/i }).click();
  await expect(page.getByRole('heading', { name: /Card Template Maker 2\.0/i })).toBeVisible();

  await page.getByRole('tab', { name: 'Template', exact: true }).click();
  await page.getByLabel('Template Name').fill('Smoke Freeform Template');
  await page.getByRole('tab', { name: 'Element', exact: true }).click();
  await page.getByRole('button', { name: 'Text', exact: true }).click();
  await page.getByRole('button', { name: 'Aged Parchment', exact: true }).first().click();
  await expect(page.getByRole('button', { name: /Text Layer/ }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Template Saved', { exact: true })).toBeVisible();

  await page.getByRole('tab', { name: /Card Generator/i }).click();
  await page.getByRole('button', { name: /Add Card to Preview List/i }).click();

  await expect(page.getByRole('heading', { name: /Generated Cards \(1\)/i })).toBeVisible();
  await expect
    .poll(() => page.locator('.tcg-card-preview').count())
    .toBeGreaterThanOrEqual(1);
  await expect(page.locator('[data-freeform-element-id]').first()).toBeVisible();

  await page.locator('#bulk-file-upload-csv').setInputFiles({
    name: 'freeform-bulk.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('newText\nBulk Arcane One\nBulk Arcane Two\n'),
  });
  await expect(page.locator('#bulkData')).toContainText('Bulk Arcane One');
  await page.getByRole('button', { name: /Generate Cards from Data/i }).click();

  await expect(page.getByRole('heading', { name: /Generated Cards \(3\)/i })).toBeVisible();
  await expect
    .poll(() => page.locator('.tcg-card-preview').count())
    .toBeGreaterThanOrEqual(3);
  await expect
    .poll(() => page.locator('[data-freeform-element-id]').count())
    .toBeGreaterThanOrEqual(3);
});

test('bulk generator uses advanced mapping toggle and strict mode gating', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.removeItem('card-forge-app-storage-v2');
  });

  await page.goto('/');
  await page.getByRole('tab', { name: /Card Generator/i }).click();

  await page.locator('#bulkData').fill('rulesText,typeLine,setCode,cardNumber,cost,power,toughness,Title\n"",CREATURE - DRAGON,DRK,001/100,3,2,2,Ember-Claw');

  await expect(page.getByText('Auto Match Result', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Advanced Mapping', exact: true })).toBeVisible();

  const generateButton = page.getByRole('button', { name: /Generate Cards from Data/i });
  await expect(generateButton).toBeEnabled();

  await page.getByLabel('Toggle strict mode for bulk generation').click();
  await expect(page.getByText(/Strict Mode is on\./i)).toBeVisible();
  await expect(generateButton).toBeDisabled();

  await page.getByRole('button', { name: 'Fill with TBD', exact: true }).click();
  await expect(page.getByText('Missing value for rulesText', { exact: true })).toBeHidden();
});
