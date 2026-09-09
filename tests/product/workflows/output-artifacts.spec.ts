import { readFile } from 'node:fs/promises';
import { expect, test, type Download } from '@playwright/test';
import JSZip from 'jszip';
import { seedGuestScaleWorkspace } from './helpers/projectScaleBrowser';

test('does not download a success artifact when authored artwork fails to load', async ({ page }) => {
  await seedGuestScaleWorkspace(page, 100, { cardLimit: 1 });
  await page.goto('/account', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^Select 100 Card Scale Set/ }).press('Enter');
  await page.locator('button[data-artifact-id="scale-card-1"]').click();
  await page.locator('[data-desk-context-rail]').getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByRole('textbox', { name: /Artwork/ }).first().fill('/missing-proof-artwork.png');
  await page.locator('[data-artifact-edit-workspace]').getByRole('button', { name: 'Save', exact: true }).click();
  let downloads = 0;
  page.on('download', () => { downloads += 1; });
  await page.getByTestId('single-card-export-trigger').click();
  await page.getByTestId('single-card-export-png-front').click();
  await expect(page.getByText(/A card image could not be loaded/)).toBeVisible();
  expect(downloads).toBe(0);
});

test('downloads actual card PNG, Set ZIP, PDF and Tabletop sheets', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await seedGuestScaleWorkspace(page, 100, { staleToolTemplate: true, cardLimit: 2, exportSample: true });
  await page.goto('/account', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^Select 100 Card Scale Set/ }).press('Enter');
  await page.locator('button[data-artifact-id="scale-card-1"]').click();
  const save = async (download: Download) => {
    const path = testInfo.outputPath(download.suggestedFilename());
    await download.saveAs(path);
    expect(await download.failure()).toBeNull();
    return readFile(path);
  };
  const pngSize = (bytes: Buffer) => {
    expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  };
  await page.getByTestId('single-card-export-trigger').click();
  const pngDownload = page.waitForEvent('download');
  await page.getByTestId('single-card-export-png-front').click();
  const png = await save(await pngDownload);
  expect(pngSize(png)).toEqual({ width: 2232, height: 3117 });
  await page.getByRole('button', { name: 'Back to Set', exact: true }).click();
  await page.getByRole('button', { name: 'Output', exact: true }).click();
  const zipDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: /^Download PNG set/ }).click();
  const zip = await JSZip.loadAsync(await save(await zipDownload));
  const images = Object.values(zip.files).filter((file) => file.name.endsWith('.png'));
  expect(images).toHaveLength(4);
  for (const file of images) expect(pngSize(await file.async('nodebuffer'))).toEqual(pngSize(png));
  await page.getByText('Print PDF', { exact: true }).click();
  const pdfDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save as PDF', exact: true }).click();
  const pdf = await save(await pdfDownload);
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  expect(pdf.toString('latin1')).toContain('/Subtype /Image');
  for (const close of await page.getByRole('button', { name: 'Close notification', exact: true }).all()) {
    if (await close.isVisible()) await close.click();
  }
  const tabletopDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: /^Export .* TTS ZIP$/ }).click();
  const tabletop = await JSZip.loadAsync(await save(await tabletopDownload));
  const sheets = Object.values(tabletop.files).filter((file) => file.name.endsWith('.png'));
  expect(sheets).toHaveLength(2);
  for (const file of sheets) expect(Math.max(...Object.values(pngSize(await file.async('nodebuffer'))))).toBeLessThanOrEqual(4096);
  const manifest = Object.values(tabletop.files).find((file) => file.name.endsWith('.json'));
  expect(manifest).toBeTruthy();
  expect(JSON.parse(await manifest!.async('string'))).toBeTruthy();
});
