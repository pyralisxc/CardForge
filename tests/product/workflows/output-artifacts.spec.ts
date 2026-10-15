import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect, test, type Download } from '@playwright/test';
import JSZip from 'jszip';
import { openScaleSet, seedGuestScaleWorkspace } from './helpers/projectScaleBrowser';

test('@golden gives an empty Set one creation next step before output controls', async ({ page }, testInfo) => {
  await seedGuestScaleWorkspace(page, 100, { cardLimit: 0 });
  await page.goto('/account', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^Select 100 Card Scale Set/ }).press('Enter');
  await expect(page.getByPlaceholder('Search cards in this Set')).toHaveCount(0);
  await page.getByRole('button', { name: 'Output', exact: true }).click();

  const output = page.getByRole('region', { name: 'Output Set', exact: true });
  await expect(output.getByText('Prepare this Set for export', { exact: true })).toBeVisible();
  await expect(output.getByText('Add cards before exporting', { exact: true })).toBeVisible();
  await expect(output.getByText(/Return to Desk, then create a design or generate cards/)).toBeVisible();
  await expect(output.getByText('Primary use', { exact: true })).toHaveCount(0);
  await expect(output.getByRole('button', { name: /^Download PNG set/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Return to Desk', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('empty-set-output.png') });
});

test('does not download a success artifact when authored artwork fails to load', async ({ page }) => {
  await seedGuestScaleWorkspace(page, 100, { cardLimit: 1 });
  await page.goto('/account', { waitUntil: 'domcontentloaded' });
  await openScaleSet(page, 100);
  await page.locator('button[data-artifact-id="scale-card-1"]').focus();
  await page.keyboard.press('Enter');
  await page.locator('[data-desk-context-rail]').getByRole('button', { name: 'Edit', exact: true }).click();
  await page.locator('[data-artifact-edit-workspace]').getByRole('button', { name: 'All fields', exact: true }).click();
  await page.getByRole('textbox', { name: /Artwork/ }).first().fill('/missing-proof-artwork.png');
  await page.locator('[data-artifact-edit-workspace]').getByRole('button', { name: 'Save & Done', exact: true }).click();
  let downloads = 0;
  page.on('download', () => { downloads += 1; });
  await page.getByTestId('single-card-export-trigger').click();
  await page.getByTestId('single-card-export-png-front').click();
  await expect(page.getByText(/A card image could not be loaded/)).toBeVisible();
  expect(downloads).toBe(0);
  for (const close of await page.getByRole('button', { name: 'Close notification', exact: true }).all()) {
    if (await close.isVisible()) await close.click();
  }
  await page.getByRole('button', { name: 'Back to Set', exact: true }).click();
  await page.getByRole('button', { name: 'Output', exact: true }).click();
  await page.getByRole('combobox', { name: 'What would you like to make?', exact: true }).click();
  await page.getByRole('option', { name: 'Print at home', exact: true }).click();
  await page.getByRole('button', { name: 'Save as PDF', exact: true }).click();
  await expect(page.getByText('PDF export failed', { exact: true })).toBeVisible();
  expect(downloads).toBe(0);
});

test('@golden downloads actual card PNG, Set ZIP, PDF and Tabletop sheets', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await seedGuestScaleWorkspace(page, 100, { staleToolTemplate: true, cardLimit: 2, exportSample: true, lowResolutionArtwork: true });
  await page.goto('/account', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^Select 100 Card Scale Set/ }).press('Enter');
  await page.locator('button[data-artifact-id="scale-card-1"]').press('Enter');
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
  const digitalManifest = JSON.parse(await zip.file('digital-output-images/cardforge-digital-images-manifest.json')!.async('string'));
  expect(digitalManifest.faces.map((face: {face: string}) => face.face)).toEqual(['front', 'back', 'front', 'back']);
  expect(digitalManifest.faces[0]).toMatchObject({ widthPx: 2232, heightPx: 3117 });
  for (const file of images) expect(pngSize(await file.async('nodebuffer'))).toEqual(pngSize(png));
  await page.getByRole('combobox', { name: 'What would you like to make?', exact: true }).click();
  await page.getByRole('option', { name: 'Digital reading PDF', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Paper Size', exact: true })).toHaveCount(0);
  const digitalPdfDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download digital PDF', exact: true }).click();
  const digitalPdf = await save(await digitalPdfDownload);
  const digitalText = digitalPdf.toString('latin1');
  expect(digitalText.match(/\/Type \/Page\b/g)).toHaveLength(4);
  expect(digitalText).toContain('one trimmed face per page, front then back');
  expect(digitalText).not.toContain('/CropBox');
  await page.getByRole('combobox', { name: 'What would you like to make?', exact: true }).click();
  await page.getByRole('option', { name: 'Files for a print shop', exact: true }).click();
  const productionDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: /^Download print production PNG ZIP/ }).click();
  const productionZip = await JSZip.loadAsync(await save(await productionDownload));
  const preflightEntry = Object.values(productionZip.files).find((file) => file.name.endsWith('cardforge-print-preflight.json'))!;
  const preflight = JSON.parse(await preflightEntry.async('string'));
  expect(preflight.sourceImageDetail.measured).toBe(true);
  expect(preflight.sourceImageDetail.images).toHaveLength(8);
  expect(preflight.sourceImageDetail.coverage).toBe('rendered-image-elements-and-backgrounds');
  expect(preflight.sourceImageDetail.images.filter((image: { scope: string }) => image.scope.includes(':background:'))).toHaveLength(4);
  expect(preflight.sourceImageDetail.images.every((image: { naturalWidth: number }) => image.naturalWidth === 64)).toBe(true);
  expect(preflight.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'resolution.source_below_300_ppi' })]));
  expect(preflight.pressReady).toBe(false);
  await page.getByText('Advanced professional PDF · PDF/X-4 candidate', { exact: true }).click();
  const pdfxDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF/X-4 candidate ZIP', exact: true }).click();
  const pdfxZip = await JSZip.loadAsync(await save(await pdfxDownload));
  const pdfxFaces = Object.values(pdfxZip.files).filter((file) => file.name.endsWith('.pdf'));
  expect(pdfxFaces).toHaveLength(4);
  const pdfxManifest = JSON.parse(await pdfxZip.file('print-production-pdfx-candidates/cardforge-print-production-manifest.json')!.async('string'));
  expect(pdfxManifest).toMatchObject({ productionPrepared: true, pressReady: false, standardsValidated: false, destinationChecked: false, outputIntent: { condition: 'CGATS21-2-CRPC6' } });
  const candidatePreflight = JSON.parse(await pdfxZip.file('print-production-pdfx-candidates/cardforge-print-preflight.json')!.async('string'));
  expect(candidatePreflight.colorManagement.pressStandard).toBe('PDF/X-4');
  expect(candidatePreflight.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'standards.independent_validation_missing' })]));
  for (const [index, file] of pdfxFaces.entries()) {
    const bytes = await file.async('nodebuffer');
    const text = bytes.toString('latin1');
    expect(text).toContain('/GTS_PDFX');
    expect(text).toContain('/DefaultRGB');
    expect(text).toContain('/TrimBox');
    expect(text).toContain('/BleedBox');
    expect(text.match(/\/Type \/Page\b/g)).toHaveLength(1);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(pdfxManifest.faces[index].sha256);
  }

  await page.getByRole('combobox', { name: 'What would you like to make?', exact: true }).click();
  await page.getByRole('option', { name: 'Print at home', exact: true }).click();
  const pdfDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save as PDF', exact: true }).click();
  const pdf = await save(await pdfDownload);
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  expect(pdf.toString('latin1')).toContain('/Subtype /Image');
  expect(pdf.length).toBeLessThan(5_000_000);
  for (const close of await page.getByRole('button', { name: 'Close notification', exact: true }).all()) {
    if (await close.isVisible()) await close.click();
  }
  await page.getByRole('combobox', { name: 'What would you like to make?', exact: true }).click();
  await page.getByRole('option', { name: 'Play in Tabletop Simulator', exact: true }).click();
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

test('@golden keeps compact output simple and reveals destination-specific depth', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedGuestScaleWorkspace(page, 100, { cardLimit: 1 });
  await page.goto('/account', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^Select 100 Card Scale Set/ }).press('Enter');
  await page.getByRole('button', { name: 'More Set actions', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Output', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Download PNG set/ })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Raster quality', exact: true })).toBeHidden();
  await page.getByText('Advanced image quality · High detail', { exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Raster quality', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'What would you like to make?', exact: true }).click();
  await page.getByRole('option', { name: 'Digital reading PDF', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Download digital PDF', exact: true })).toBeVisible();
  await expect(page.getByText('Advanced paper and layout', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Advanced deck detail', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('compact-digital-output.png') });
});
