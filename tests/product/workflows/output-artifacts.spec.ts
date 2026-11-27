import { readFile, writeFile } from 'node:fs/promises';
import { expect, test, type Download } from '@playwright/test';
import JSZip from 'jszip';
import { decodePDFRawStream, PDFArray, PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import sharp from 'sharp';
import { openScaleSet, seedGuestScaleWorkspace } from './helpers/projectScaleBrowser';
import { createProjectScaleFixture } from '../../fixtures/projectScale';
import { buildCardForgeProjectSnapshot, encodeCardForgeProjectPackage } from '@/features/project/lib/projectPackageCodec';

test('@golden gives an empty Set one creation next step before output controls', async ({ page }, testInfo) => {
  await seedGuestScaleWorkspace(page, 100, { cardLimit: 0 });
  await page.goto('/account', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^Select 100 Card Scale Set/ }).press('Enter');
  await expect(page.locator('button[data-artifact-id]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Output', exact: true }).click();

  const output = page.getByRole('region', { name: 'Output Set', exact: true });
  await expect(output.getByText('Prepare this Set for export', { exact: true })).toBeVisible();
  await expect(output.getByText('Add cards before exporting', { exact: true })).toBeVisible();
  await expect(output.getByText(/Return to Desk, then create a design or generate cards/)).toBeVisible();
  await expect(output.getByText('Individual image profile', { exact: true })).toHaveCount(0);
  await expect(output.getByRole('button', { name: /^Download PNG set/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Return to Desk', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('empty-set-output.png') });
});

test('starts new work at Standard and retains a chosen raster quality on reload', async ({ page }) => {
  const document = createProjectScaleFixture(100);
  document.storedCards = document.storedCards.slice(0, 1);
  const bytes = await encodeCardForgeProjectPackage(await buildCardForgeProjectSnapshot({ document, name: 'Quality preference' }));
  await page.goto('/account', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Create your first Set', exact: true }).click();
  await page.getByLabel('Choose a .cardforge Set file', { exact: true }).setInputFiles({
    name: 'quality.cardforge', mimeType: 'application/octet-stream', buffer: Buffer.from(bytes),
  });
  await page.getByRole('button', { name: 'Output', exact: true }).click();
  const quality = page.getByRole('combobox', { name: 'Raster quality', exact: true });
  await expect(quality).toHaveText('Standard');
  await expect(page.getByText(/Approximately 300 PPI for the finished face at this template's intended size/)).toBeVisible();
  await quality.click();
  await page.getByRole('option', { name: 'High detail', exact: true }).click();
  await expect(quality).toHaveText('High detail');
  await expect(page.getByText(/Approximately 900 PPI for the finished face at this template's intended size/)).toBeVisible();
  await quality.click();
  await page.getByRole('option', { name: 'Maximum', exact: true }).click();
  await expect(page.getByText(/Approximately 1800 PPI for the finished face at this template's intended size/)).toBeVisible();
  await quality.click();
  await page.getByRole('option', { name: 'High detail', exact: true }).click();
  await expect.poll(() => page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('cardforge-browser-storage');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const values = await Promise.all(['guest', 'local'].map((scope) => new Promise<string | undefined>((resolve, reject) => {
      const request = database.transaction('key-value').objectStore('key-value').get(`project-workspace:${scope}:workspace`);
      request.onsuccess = () => resolve(request.result as string | undefined);
      request.onerror = () => reject(request.error);
    })));
    database.close();
    return values.some((value) => value && JSON.parse(JSON.parse(value).value).state.exportDpi === 300);
  })).toBe(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(quality).toHaveText('High detail');
  await expect(page.getByText(/Approximately 900 PPI for the finished face at this template's intended size/)).toBeVisible();
  await quality.click();
  await page.getByRole('option', { name: 'Standard', exact: true }).click();
  await expect(page.getByText(/Approximately 300 PPI for the finished face at this template's intended size/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download color-managed press candidate ZIP', exact: true })).toHaveCount(0);
});

test('does not download a success artifact when authored artwork fails to load', async ({ page }) => {
  test.setTimeout(60_000);
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
  await expect(page.getByRole('region', { name: 'Notifications (F8)' }).getByText(/A card image could not be loaded/)).toBeVisible();
  expect(downloads).toBe(0);
  for (const close of await page.getByRole('button', { name: 'Close notification', exact: true }).all()) {
    if (await close.isVisible()) await close.click();
  }
  await page.getByRole('button', { name: 'Back to Set', exact: true }).click();
  await page.getByRole('button', { name: 'Output', exact: true }).click();
  await page.getByRole('button', { name: 'Print or save PDF', exact: true }).click();
  await expect(page.getByText('Browser print could not be prepared', { exact: true })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Browser print: export failed.' })).toBeVisible();
  expect(downloads).toBe(0);
});

test('@golden @preview downloads actual card PNG, Set ZIP, PDF and Tabletop sheets', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await page.addInitScript(() => {
    window.print = () => { (window as unknown as { printRequests: number }).printRequests = 1; };
  });
  await seedGuestScaleWorkspace(page, 100, { staleToolTemplate: true, cardLimit: 2, exportSample: true, lowResolutionArtwork: true });
  await page.goto('/account', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^Select 100 Card Scale Set/ }).press('Enter');
  await page.locator('button[data-artifact-id="scale-card-1"]').press('Enter');
  const authoredTitle = page.locator('[data-freeform-element-id="scale-template-title"]').filter({ visible: true }).first();
  await expect(authoredTitle.locator('p')).toHaveCSS('font-family', /CardForge Cinzel/);
  await expect.poll(() => page.evaluate(() => Array.from(document.fonts).some(
    (font) => font.family.replaceAll('"', '') === 'CardForge Cinzel' && font.status === 'loaded',
  ))).toBe(true);
  await testInfo.attach('authored-cinzel-native-card', {
    body: await page.screenshot(), contentType: 'image/png',
  });
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
  await testInfo.attach('authored-cinzel-export-front', { body: png, contentType: 'image/png' });
  await page.getByRole('button', { name: 'Back to Set', exact: true }).click();
  await page.getByRole('button', { name: 'Output', exact: true }).click();
  const printPanel = page.locator('details').filter({ has: page.getByText('Print or save PDF', { exact: true }) });
  await expect(printPanel).toHaveAttribute('open', '');
  await expect(printPanel.getByRole('button', { name: 'Print or save PDF', exact: true })).toBeVisible();
  const upsell = page.getByRole('button', { name: 'Get watermark-free downloads', exact: true });
  if (await upsell.isVisible()) expect((await printPanel.boundingBox())!.y).toBeLessThan((await upsell.boundingBox())!.y);
  const zipDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: /^Download PNG set/ }).click();
  const pngSetFile = await zipDownload;
  const zip = await JSZip.loadAsync(await save(pngSetFile));
  const images = Object.values(zip.files).filter((file) => file.name.endsWith('.png'));
  expect(images).toHaveLength(4);
  for (const file of images) expect(pngSize(await file.async('nodebuffer'))).toEqual(pngSize(png));
  await page.getByRole('combobox', { name: 'Individual image profile', exact: true }).click();
  await page.getByRole('option', { name: 'Digital images', exact: true }).click();
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
  await page.getByRole('button', { name: 'Print or save PDF', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { printRequests?: number }).printRequests)).toBe(1);
  const printDocument = await PDFDocument.load(await page.pdf({ printBackground: true, preferCSSPageSize: true }));
  expect(printDocument.getPageCount()).toBe(2);
  expect(printDocument.getPages()[0].getWidth()).toBeGreaterThan(500);
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  const tabletopDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: /^Export .* TTS ZIP$/ }).click();
  const tabletop = await JSZip.loadAsync(await save(await tabletopDownload));
  const sheets = Object.values(tabletop.files).filter((file) => file.name.endsWith('.png'));
  expect(sheets).toHaveLength(2);
  for (const file of sheets) expect(Math.max(...Object.values(pngSize(await file.async('nodebuffer'))))).toBeLessThanOrEqual(4096);
  const manifest = Object.values(tabletop.files).find((file) => file.name.endsWith('.json'));
  expect(manifest).toBeTruthy();
  expect(JSON.parse(await manifest!.async('string'))).toBeTruthy();

  // A Download action must work without requesting file-system permissions.
  // Keep native file-handle streaming for actual Save flows, not this copy.
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'More Set actions', exact: true }).click();
  const projectDownload = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Download Set', exact: true }).click();
  const projectZip = await JSZip.loadAsync(await save(await projectDownload));
  const project = JSON.parse(await projectZip.file('cardforge-project.json')!.async('string'));
  expect(project.projectRevision).toMatch(/^[a-f0-9]{64}$/u);
  expect(project.project.cardSets).toHaveLength(1);
  expect(project.project.artifacts).toHaveLength(2);
});


for (const variant of ['texture', 'tint', 'foundation'] as const) {
test(`@golden keeps complete SVG ${variant} Stretch composition in the native card and actual PNG export`, async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const source = '<svg xmlns="http://www.w3.org/2000/svg" width="720" height="720" viewBox="0 0 720 720"><rect width="360" height="360" fill="#0055ff"/><rect x="360" width="360" height="360" fill="#00aa55"/><rect y="360" width="360" height="360" fill="#aa3300"/><rect x="360" y="360" width="360" height="360" fill="#ffcc00"/></svg>';
  await page.route('**/svg-stretch-regression.svg', (route) => route.fulfill({ body: source, contentType: 'image/svg+xml' }));
  await seedGuestScaleWorkspace(page, 100, { cardLimit: 1, templatePatch: {
    ...(variant === 'foundation' ? { cardBackgroundImageUrl: '/svg-stretch-regression.svg', cardBackgroundImageFit: 'fill' as const } : {}),
    appearance: { material: { baseColor: '#ff00ff', ...(variant === 'texture' ? { texture: { kind: 'uploaded', imageSource: '/svg-stretch-regression.svg', tileMode: 'stretch', intensity: 100 } } : {}) } },
    freeformCanvas: { width: 630, height: 880, elements: variant === 'tint' ? [{
      id: 'stretch-tint', name: 'Tinted SVG', type: 'text', content: '', padding: 'p-0', borderWidth: '_none_', backgroundColor: '#2546c7', fillColor: '#2546c7', x: 0, y: 0, width: 630, height: 880, zIndex: 1,
      appearance: { assetSource: '/svg-stretch-regression.svg', assetRenderMode: 'tint', assetTintColor: '#2546c7', tileMode: 'stretch', material: { fillColor: '#2546c7' } },
    }] : [] },
  } });
  await page.goto('/account', { waitUntil: 'domcontentloaded' });
  await openScaleSet(page, 100);
  await page.locator('button[data-artifact-id="scale-card-1"]').press('Enter');
  const card = page.locator('[data-focused-artifact-frame] .tcg-card-preview');
  await expect(card).toBeVisible();
  await expect(variant === 'tint' ? card.locator('[data-freeform-element-id="stretch-tint"]') : variant === 'texture' ? card.locator(':scope > [data-appearance-layer="0"]') : card).toHaveCSS(variant === 'tint' ? 'mask-image' : 'background-image', /svgView/);
  const verifyCorners = async (png: Buffer) => {
    const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (const [x, y, expected] of [[0.1, 0.1, [0, 85, 255]], [0.9, 0.1, [0, 170, 85]], [0.1, 0.9, [170, 51, 0]], [0.9, 0.9, [255, 204, 0]]] as const) {
      const offset = (Math.floor(info.height * y) * info.width + Math.floor(info.width * x)) * info.channels;
      expect([...data.subarray(offset, offset + 3)]).toEqual(variant === 'tint' ? [37, 70, 199] : expected);
    }
  };
  const native = await card.screenshot();
  await verifyCorners(native);
  await testInfo.attach('svg-stretch-native-card', { body: native, contentType: 'image/png' });
  await page.getByTestId('single-card-export-trigger').click();
  const download = page.waitForEvent('download');
  await page.getByTestId('single-card-export-png-front').click();
  const artifact = await download;
  const file = testInfo.outputPath(artifact.suggestedFilename());
  await artifact.saveAs(file);
  expect(await artifact.failure()).toBeNull();
  const exported = await readFile(file);
  await verifyCorners(exported);
  await testInfo.attach('svg-stretch-actual-export', { body: exported, contentType: 'image/png' });
});
}

test('downloads one Set with remote artwork and frame bytes or fails without a download', async ({ page }, testInfo) => {
  const artUrl = 'https://portable-art.example/card.png';
  const frameUrl = 'https://portable-art.example/frame.png';
  const art = await sharp({ create: { width: 32, height: 32, channels: 4, background: '#4f7dc8' } }).png().toBuffer();
  const frame = await sharp({ create: { width: 32, height: 32, channels: 4, background: '#aabbaa' } }).png().toBuffer();
  await page.route('https://portable-art.example/**', (route) => route.fulfill({ body: route.request().url() === artUrl ? art : frame, contentType: 'image/png', headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' } }));
  await seedGuestScaleWorkspace(page, 100, { cardLimit: 2, additionalSets: 1, exportSample: true, templatePatch: { cardBorderImageSource: frameUrl } });
  await page.evaluate(async (url) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('cardforge-browser-storage'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('key-value', 'readwrite');
      const store = tx.objectStore('key-value');
      for (const scope of ['guest', 'local']) {
        const key = `project-workspace:${scope}:workspace`;
        const request = store.get(key);
        request.onsuccess = () => {
          const record = JSON.parse(request.result);
          const value = JSON.parse(record.value);
          for (const card of value.state.storedCards) card.data.artwork = url;
          value.state.storedCards[0].data.cardName = 'QA REV R2 SAVED 20261021';
          value.state.storedCards[0].data.rank = 'K';
          record.value = JSON.stringify(value);
          store.put(JSON.stringify(record), key);
        };
      }
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, artUrl);
  await page.goto('/account', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^Select 100 Card Scale Set/ }).press('Enter');
  await page.getByRole('button', { name: 'More Set actions', exact: true }).click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Download Set', exact: true }).click();
  const download = await downloading;
  const path = testInfo.outputPath('remote-artwork.cardforge');
  await download.saveAs(path);
  expect(await download.failure()).toBeNull();
  const zip = await JSZip.loadAsync(await readFile(path));
  const manifest = JSON.parse(await zip.file('cardforge-project.json')!.async('string'));
  expect(manifest.assets.filter((asset: { mimeType: string }) => asset.mimeType === 'image/png')).toHaveLength(2);
  expect(manifest.project.cardSets).toHaveLength(1);
  expect(manifest.project.artifacts).toHaveLength(2);
  expect(JSON.stringify(manifest.project)).toContain('QA REV R2 SAVED 20261021');
  expect(JSON.stringify(manifest.project)).not.toContain('portable-art.example');
  const bytes = await Promise.all(manifest.assets.map((asset: { path: string }) => zip.file(asset.path)!.async('nodebuffer')));
  expect(bytes.some((value: Buffer) => value.equals(art))).toBe(true);
  expect(bytes.some((value: Buffer) => value.equals(frame))).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('portable-download.png') });

  await page.unroute('https://portable-art.example/**');
  await page.route('https://portable-art.example/**', (route) => route.fulfill({ status: 404, headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' } }));
  let extraDownloads = 0;
  page.on('download', () => { extraDownloads += 1; });
  await page.getByRole('button', { name: 'More Set actions', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Download Set', exact: true }).click();
  await expect(page.getByText('Set not downloaded', { exact: true })).toBeVisible();
  expect(extraDownloads).toBe(0);

  await page.goto('/account?section=library&scope=personal&tool=design&artifact=scale-template');
  await expect(page.getByRole('region', { name: 'Design Template', exact: true })).toBeVisible();
  await page.locator('input[type="file"][accept*=".cardforge"]').first().setInputFiles(path);
  await expect(page.getByRole('alertdialog', { name: 'Import project file?' })).toBeVisible();
  await page.getByRole('button', { name: 'Replace Workspace', exact: true }).click();
  await expect(page.getByRole('alertdialog', { name: 'Replace the entire workspace?' })).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  const savedWorkspaces = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('cardforge-browser-storage'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const records = await Promise.all(['guest', 'local'].map((scope) => new Promise<string>((resolve, reject) => { const request = db.transaction('key-value').objectStore('key-value').get(`project-workspace:${scope}:workspace`); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); })));
    db.close();
    return records.map((record) => JSON.parse(JSON.parse(record).value).state.cardSets as Array<{ id: string; name: string }>);
  });
  const savedSets = savedWorkspaces.find((sets) => sets.length === 2);
  expect(savedSets).toBeDefined();
  expect(savedSets!.filter((set) => set.name === '100 Card Scale Set')).toHaveLength(1);
});

test('keeps export progress and one download when leaving and reopening Output', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await seedGuestScaleWorkspace(page, 100, { cardLimit: 12, exportSample: true });
  await page.goto('/account', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^Select 100 Card Scale Set/ }).press('Enter');
  const rail = page.locator('[data-desk-context-rail]');
  const openOutput = async () => {
    await rail.getByRole('button', { name: 'More Set actions', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Output', exact: true }).click();
  };
  await openOutput();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /^Download PNG set/ }).click();
  const status = page.getByRole('status').filter({ hasText: /PNG set · 100 Card Scale Set:.*(?:Rendering|Finalizing)/ });
  await expect(status).toBeVisible();
  await rail.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByRole('searchbox', { name: 'Search cards in this Set' })).toBeVisible();
  await expect(status).toBeVisible();
  await openOutput();
  await expect(page.getByRole('button', { name: /^Download PNG set/ })).toBeDisabled();
  const artifact = await download;
  expect(await artifact.failure()).toBeNull();
  await expect(page.getByRole('status').filter({ hasText: 'PNG set · 100 Card Scale Set: download requested. Check your browser downloads.' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Download PNG set/ })).toBeEnabled();
});

test('browser print does not claim a saved PDF or retain a prepared copy', async ({ page }) => {
  await page.addInitScript(() => { window.print = () => { (window as unknown as { printRequests: number }).printRequests = 1; }; });
  await seedGuestScaleWorkspace(page, 100, { cardLimit: 2, staleToolTemplate: true, exportSample: true });
  await page.goto('/account', { waitUntil: 'domcontentloaded' }); await openScaleSet(page, 100);
  await page.getByRole('button', { name: 'Output', exact: true }).click();
  await page.getByRole('button', { name: 'Print or save PDF', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { printRequests?: number }).printRequests)).toBe(1);
  await expect(page.getByRole('status').filter({ hasText: 'Browser print: browser print requested' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save again', exact: true })).toHaveCount(0);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: 'Save again', exact: true })).toHaveCount(0);
});

test('browser print fails closed if clean account access cannot be verified', async ({ page }) => {
  let allowAccess = true;
  await page.route('**/api/account/entitlement', async route => {
    if (!allowAccess) { await route.fulfill({ status: 503, json: { error: 'simulated outage' } }); return; }
    const response = await route.fetch(); const entitlement = await response.json();
    await route.fulfill({ json: { ...entitlement, canExportClean: true, capabilities: { ...entitlement.capabilities, canExportClean: true } } });
  });
  await page.addInitScript(() => { window.print = () => { (window as unknown as { printRequests: number }).printRequests = 1; }; });
  await seedGuestScaleWorkspace(page, 100, { cardLimit: 1, exportSample: true });
  await page.goto('/account', { waitUntil: 'domcontentloaded' }); await openScaleSet(page, 100);
  await page.getByRole('button', { name: 'Output', exact: true }).click();
  await expect(page.getByText('This output has no CardForge watermark.')).toBeVisible();
  allowAccess = false;
  await page.getByRole('button', { name: 'Print or save PDF', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Clean download access could not be verified' })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { printRequests?: number }).printRequests)).toBeUndefined();
});

test('browser print supports more than ten PDF pages in one job', async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => { window.print = () => { (window as unknown as { printRequests: number }).printRequests = 1; }; });
  await seedGuestScaleWorkspace(page, 100, { cardLimit: 6, staleToolTemplate: true, exportSample: true });
  await page.goto('/account', { waitUntil: 'domcontentloaded' }); await openScaleSet(page, 100);
  await page.getByRole('button', { name: 'Output', exact: true }).click();
  await page.getByRole('combobox', { name: 'PDF layout', exact: true }).click();
  await page.getByRole('option', { name: 'One face per card-sized page', exact: true }).click();
  await page.getByRole('button', { name: 'Print or save PDF', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { printRequests?: number }).printRequests)).toBe(1);
  const pdf = await PDFDocument.load(await page.pdf({ printBackground: true, preferCSSPageSize: true }));
  expect(pdf.getPageCount()).toBe(12);
});

test('exports a general PNG grid without a reserved game slot', async ({ page }) => {
  test.setTimeout(120_000);
  await seedGuestScaleWorkspace(page, 100, { cardLimit: 4, staleToolTemplate: true, exportSample: true });
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('cardforge-browser-storage'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    for (const scope of ['guest', 'local']) {
      const key = `project-workspace:${scope}:workspace`;
      const record = await new Promise<string>((resolve, reject) => { const request = db.transaction('key-value').objectStore('key-value').get(key); request.onsuccess = () => resolve(request.result as string); request.onerror = () => reject(request.error); });
      const outer = JSON.parse(record), inner = JSON.parse(outer.value); delete inner.state.storedCards[1].backingTemplateId; delete inner.state.storedCards[1].backingData; outer.value = JSON.stringify(inner);
      await new Promise<void>((resolve, reject) => { const tx = db.transaction('key-value', 'readwrite'); tx.objectStore('key-value').put(JSON.stringify(outer), key); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
    }
    db.close();
  });
  await page.goto('/account', { waitUntil: 'domcontentloaded' });
  await openScaleSet(page, 100);
  await page.getByRole('button', { name: 'Output', exact: true }).click();
  await page.getByLabel('Columns', { exact: true }).fill('2');
  await page.getByLabel('Rows', { exact: true }).fill('2');
  await page.getByText('Preview grid', { exact: true }).click();
  await expect(page.getByText(/Showing up to the first 16 slots on the first sheet\. Empty slots/)).toBeVisible();
  await page.getByRole('button', { name: 'Preview backs', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Preview backs', exact: true })).toBeVisible();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PNG spritesheets', exact: true }).click();
  const stream = await (await pending).createReadStream();
  if (!stream) throw new Error('Spritesheet ZIP was unavailable.');
  const chunks: Buffer[] = []; for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const zip = await JSZip.loadAsync(Buffer.concat(chunks));
  const manifest = JSON.parse(await zip.file('spritesheets/manifest.json')!.async('string'));
  expect(manifest).toMatchObject({ format: 'cardforge-spritesheets-v1', columns: 2, rows: 2 });
  expect(manifest.sheets[0].cards.map((card: { slot: number }) => card.slot)).toEqual([1, 2, 3, 4]);
  const png = await zip.file(`spritesheets/${manifest.sheets[0].frontFile}`)!.async('nodebuffer');
  const info = await sharp(png).metadata();
  expect(info.width).toBe(manifest.sheets[0].cardWidthPx * 2);
  expect(info.height).toBe(manifest.sheets[0].cardHeightPx * 2);
  const lastCellBytes = await sharp(png).extract({ left: manifest.sheets[0].cardWidthPx, top: manifest.sheets[0].cardHeightPx, width: manifest.sheets[0].cardWidthPx, height: manifest.sheets[0].cardHeightPx }).ensureAlpha().png().toBuffer();
  const lastCell = await sharp(lastCellBytes).stats();
  expect(lastCell.channels[3].max).toBeGreaterThan(0);
  expect(manifest.sheets[0].cards.map((card: { hasBack: boolean }) => card.hasBack)).toEqual([true, false, true, true]);
  const back = await zip.file(`spritesheets/${manifest.sheets[0].backFile}`)!.async('nodebuffer');
  const missingBackBytes = await sharp(back).extract({ left: manifest.sheets[0].cardWidthPx, top: 0, width: manifest.sheets[0].cardWidthPx, height: manifest.sheets[0].cardHeightPx }).ensureAlpha().png().toBuffer();
  const missingBack = await sharp(missingBackBytes).stats();
  expect(missingBack.channels[3].max).toBe(0);
});

test('does not download a clean spritesheet if current access cannot be verified', async ({ page }) => {
  test.setTimeout(90_000);
  let allowAccess = true;
  await page.route('**/api/account/entitlement', async route => {
    if (!allowAccess) { await route.fulfill({ status: 503, json: { error: 'simulated outage' } }); return; }
    const response = await route.fetch(); const entitlement = await response.json();
    await route.fulfill({ json: { ...entitlement, canExportClean: true, capabilities: { ...entitlement.capabilities, canExportClean: true } } });
  });
  await seedGuestScaleWorkspace(page, 100, { cardLimit: 1, exportSample: true });
  await page.goto('/account', { waitUntil: 'domcontentloaded' }); await openScaleSet(page, 100);
  await page.getByRole('button', { name: 'Output', exact: true }).click();
  await expect(page.getByText('This output has no CardForge watermark.')).toBeVisible();
  let downloads = 0; page.on('download', () => { downloads += 1; }); allowAccess = false;
  await page.getByRole('button', { name: 'Download PNG spritesheets', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Clean download access could not be verified' })).toBeVisible();
  expect(downloads).toBe(0);
});

test('prints card-sized PDF pages from the shared preview', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => { window.print = () => { (window as unknown as { printRequests: number }).printRequests = 1; }; });
  await seedGuestScaleWorkspace(page, 100, { cardLimit: 2, staleToolTemplate: true, exportSample: true });
  await page.goto('/account', { waitUntil: 'domcontentloaded' });
  await openScaleSet(page, 100);
  await page.getByRole('button', { name: 'Output', exact: true }).click();
  await page.getByRole('combobox', { name: 'PDF layout', exact: true }).click();
  await page.getByRole('option', { name: 'One face per card-sized page', exact: true }).click();
  await page.getByText('Preview card pages (4 pages)', { exact: true }).click();
  await expect(page.getByText('Showing the first 2 pages.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Print or save PDF', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { printRequests?: number }).printRequests)).toBe(1);
  const view = page.locator('[data-cardforge-native-print]');
  await expect(view.locator('[data-cardforge-print-sheet]')).toHaveCount(4);
  const bytes = await page.pdf({ printBackground: true, preferCSSPageSize: true });
  await writeFile(testInfo.outputPath('card-sized-pages.pdf'), bytes);
  const pdf = await PDFDocument.load(bytes);
  expect(pdf.getPageCount()).toBe(4);
  expect(pdf.getPage(0).getWidth()).toBeLessThan(300);
  expect(pdf.getPage(0).getHeight()).toBeLessThan(400);
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await expect(view).toHaveCount(0);
});

test('prepares a browser print view and releases it after printing', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => { window.print = () => { (window as unknown as { printRequests: number }).printRequests = 1; }; });
  await seedGuestScaleWorkspace(page, 100, { cardLimit: 2, staleToolTemplate: true, exportSample: true });
  await page.goto('/account', { waitUntil: 'domcontentloaded' });
  await openScaleSet(page, 100);
  await page.getByRole('button', { name: 'Output', exact: true }).click();
  await page.getByRole('button', { name: 'Print or save PDF', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { printRequests?: number }).printRequests)).toBe(1);
  await expect(page.getByRole('status').filter({ hasText: 'Browser print: browser print requested' })).toBeVisible();
  const view = page.locator('[data-cardforge-native-print]');
  await expect(view.locator('[data-cardforge-print-sheet]')).toHaveCount(2);
  await page.emulateMedia({ media: 'print' });
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(255, 255, 255)');
  const bytes = await page.pdf({ printBackground: true, preferCSSPageSize: true });
  await writeFile(testInfo.outputPath('native-print.pdf'), bytes);
  const pdf = await PDFDocument.load(bytes);
  expect(pdf.getPageCount()).toBe(2);
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await expect(view).toHaveCount(0);
});

test('places nine cards on each side of a tight Letter browser print sheet', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => { window.print = () => { (window as unknown as { printRequests: number }).printRequests = 1; }; });
  await seedGuestScaleWorkspace(page, 100, { cardLimit: 9, staleToolTemplate: true, exportSample: true });
  await page.goto('/account', { waitUntil: 'domcontentloaded' });
  await openScaleSet(page, 100);
  await page.getByRole('button', { name: 'Output', exact: true }).click();
  await page.locator('#pdfMargin').fill('3');
  await page.locator('#pdfCardSpacing').fill('4');
  await page.getByRole('button', { name: 'Print or save PDF', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { printRequests?: number }).printRequests)).toBe(1);
  const sheets = page.locator('[data-cardforge-print-sheet]');
  await expect(sheets).toHaveCount(2);
  await expect(sheets.nth(0).locator('.tcg-card-preview')).toHaveCount(9);
  await expect(sheets.nth(1).locator('.tcg-card-preview')).toHaveCount(9);
  const bytes = await page.pdf({ printBackground: true, preferCSSPageSize: true });
  await writeFile(testInfo.outputPath('native-nine-up.pdf'), bytes);
  const pdf = await PDFDocument.load(bytes);
  expect(pdf.getPageCount()).toBe(2);
  const textBlocks = pdf.getPages().map((sheet) => {
    const contents = sheet.node.lookup(PDFName.of('Contents'));
    const streams = contents instanceof PDFArray ? Array.from({ length: contents.size() }, (_, i) => contents.lookup(i)) : [contents];
    const text = streams.map((stream) => stream instanceof PDFRawStream ? Buffer.from(decodePDFRawStream(stream).decode()).toString('latin1') : '').join('\n');
    return (text.match(/\bBT\b/g) ?? []).length;
  });
  expect(textBlocks[0]).toBeGreaterThanOrEqual(9);
  expect(textBlocks[0]).toBe(textBlocks[1]);
});


test('can remove a browser print view after returning to Output', async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => { window.print = () => { (window as unknown as { printRequests: number }).printRequests = 1; }; });
  await seedGuestScaleWorkspace(page, 100, { cardLimit: 2, staleToolTemplate: true, exportSample: true });
  await page.goto('/account', { waitUntil: 'domcontentloaded' });
  await openScaleSet(page, 100);
  await page.getByRole('button', { name: 'Output', exact: true }).click();
  await page.getByRole('button', { name: 'Print or save PDF', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { printRequests?: number }).printRequests)).toBe(1);
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Output', exact: true }).click();
  const remove = page.getByRole('button', { name: 'Remove temporary print view', exact: true });
  await expect(remove).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await remove.click();
  await expect(page.locator('[data-cardforge-native-print]')).toHaveCount(0);
});
