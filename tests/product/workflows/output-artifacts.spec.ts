import { readFile } from 'node:fs/promises';
import { expect, test, type Download } from '@playwright/test';
import JSZip from 'jszip';
import { createHash } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
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
  await page.getByRole('combobox', { name: 'Primary use', exact: true }).click();
  await page.getByRole('option', { name: 'Print physical cards', exact: true }).click();
  await page.getByRole('button', { name: 'Download color-managed press candidate ZIP', exact: true }).click();
  await expect(page.getByText('Press candidate export failed', { exact: true })).toBeVisible();
  expect(downloads).toBe(0);
  await page.getByText('Print PDF', { exact: true }).click();
  await page.getByRole('button', { name: 'Save as PDF', exact: true }).click();
  await expect(page.getByText('PDF export failed', { exact: true })).toBeVisible();
  expect(downloads).toBe(0);
});

test('@golden downloads actual card PNG, Set ZIP, PDF and Tabletop sheets', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true,
      value: async () => { throw new DOMException('Native file picker is unavailable.', 'NotAllowedError'); },
    });
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
  const zipDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: /^Download PNG set/ }).click();
  const pngSetFile = await zipDownload;
  // Guest browser storage is independent of the server's current export entitlement.
  const watermarkApplied = pngSetFile.suggestedFilename().includes('-watermarked');
  const zip = await JSZip.loadAsync(await save(pngSetFile));
  const images = Object.values(zip.files).filter((file) => file.name.endsWith('.png'));
  expect(images).toHaveLength(4);
  for (const file of images) expect(pngSize(await file.async('nodebuffer'))).toEqual(pngSize(png));
  await page.getByRole('combobox', { name: 'Primary use', exact: true }).click();
  await page.getByRole('option', { name: 'Print physical cards', exact: true }).click();
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
  let pressDownloads = 0;
  page.on('download', () => { pressDownloads += 1; });
  await page.route('**/color-profiles/FOGRA39L_coated.icc', (route) => route.fulfill({ status: 200, contentType: 'application/octet-stream', body: 'changed-profile' }));
  await page.getByRole('button', { name: 'Download color-managed press candidate ZIP', exact: true }).click();
  await expect(page.getByText('Press candidate export failed', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Notifications (F8)', exact: true }).getByText(/color profile.*changed/)).toBeVisible();
  expect(pressDownloads).toBe(0);
  await page.unroute('**/color-profiles/FOGRA39L_coated.icc');
  for (const close of await page.getByRole('button', { name: 'Close notification', exact: true }).all()) {
    if (await close.isVisible()) await close.click();
  }
  const pressDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download color-managed press candidate ZIP', exact: true }).click();
  const pressFile = await pressDownload;
  const pressBytes = await save(pressFile);
  expect(pressDownloads).toBe(1);
  expect(pressFile.suggestedFilename().includes('-watermarked')).toBe(watermarkApplied);
  const pressZip = await JSZip.loadAsync(pressBytes);
  const candidateBytes = await pressZip.file('candidate.pdf')!.async('nodebuffer');
  const candidateReport = JSON.parse(await pressZip.file('candidate-report.json')!.async('string'));
  const candidatePreflight = JSON.parse(await pressZip.file('cardforge-print-preflight.json')!.async('string'));
  expect(candidateReport).toMatchObject({ pressReady: false, standardsValidation: 'pending', professionalAcceptance: 'pending', declaredStandard: 'PDF/X-4', paperComposite: 'opaque-white', watermarkApplied });
  expect(candidateReport.pdfSha256).toBe(createHash('sha256').update(candidateBytes).digest('hex'));
  expect(candidateReport.pages.map((entry: { face: string }) => entry.face)).toEqual(['front', 'back', 'front', 'back']);
  expect(candidatePreflight).toMatchObject({ productionPrepared: true, pressReady: false, sourceImageDetail: { measured: true }, colorManagement: { pressStandard: 'PDF/X-4', independentValidation: 'pending', professionalAcceptance: 'pending' } });
  expect(candidatePreflight.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'standards.independent_validation_pending' }), expect.objectContaining({ code: 'resolution.source_below_300_ppi' })]));
  expect(candidateBytes.subarray(0, 8).toString()).toBe('%PDF-1.6');
  const candidatePdf = await PDFDocument.load(candidateBytes, { updateMetadata: false });
  expect(candidatePdf.getPageCount()).toBe(4);
  for (const candidatePage of candidatePdf.getPages()) {
    expect(candidatePage.getTrimBox().width * 25.4 / 72).toBeCloseTo(63, 6);
    expect(candidatePage.getTrimBox().height * 25.4 / 72).toBeCloseTo(88, 6);
    expect(candidatePage.getBleedBox().width * 25.4 / 72).toBeCloseTo(69, 6);
  }
  for (const [entry, key] of [['profiles/sRGB.icc', 'source'], ['profiles/FOGRA39L_coated.icc', 'output'], ['profiles/NOTICE.txt', 'notice']]) {
    expect(createHash('sha256').update(await pressZip.file(entry)!.async('nodebuffer')).digest('hex')).toBe(candidateReport.profileHashes[key]);
  }
  await testInfo.attach('color-managed-press-candidate.zip', { body: pressBytes, contentType: 'application/zip' });
  const digitalPdfDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download digital PDF', exact: true }).click();
  const digitalPdf = await save(await digitalPdfDownload);
  const digitalPdfText = digitalPdf.toString('latin1');
  expect(digitalPdf.subarray(0, 5).toString()).toBe('%PDF-');
  expect(digitalPdfText.match(/\/Type\s*\/Page\b/g)).toHaveLength(4);
  expect(digitalPdfText).toContain('/Subtype /Image');
  expect(digitalPdfText).toContain('/MediaBox');
  expect(digitalPdf.length).toBeLessThan(5_000_000);
  await page.getByText('Print PDF', { exact: true }).click();
  const pdfDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save as PDF', exact: true }).click();
  const pdf = await save(await pdfDownload);
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  expect(pdf.toString('latin1')).toContain('/Subtype /Image');
  expect(pdf.length).toBeLessThan(5_000_000);
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

  // A Download action must work without requesting file-system permissions.
  // Keep native file-handle streaming for actual Save flows, not this copy.
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Design', exact: true }).click();
  const projectDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download project', exact: true }).click();
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
    cardBackgroundImageUrl: variant === 'foundation' ? '/svg-stretch-regression.svg' : '',
    ...(variant === 'foundation' ? { cardBackgroundImageFit: 'fill' as const } : {}),
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
  await expect(variant === 'tint' ? card.locator('[data-freeform-element-id="stretch-tint"]') : card).toHaveCSS(variant === 'tint' ? 'mask-image' : 'background-image', /svgView/);
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

test('downloads a whole-workspace package with remote artwork and frame bytes or fails without a download', async ({ page }, testInfo) => {
  const artUrl = 'https://portable-art.example/card.png';
  const frameUrl = 'https://portable-art.example/frame.png';
  const art = await sharp({ create: { width: 32, height: 32, channels: 4, background: '#4f7dc8' } }).png().toBuffer();
  const frame = await sharp({ create: { width: 32, height: 32, channels: 4, background: '#aabbaa' } }).png().toBuffer();
  await page.route('https://portable-art.example/**', (route) => route.fulfill({ body: route.request().url() === artUrl ? art : frame, contentType: 'image/png', headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' } }));
  await seedGuestScaleWorkspace(page, 100, { cardLimit: 2, additionalSets: 1, exportSample: true, templatePatch: { cardBorderImageSource: frameUrl } });
  await page.evaluate(async (url) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('cardforge-browser-storage', 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
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
  await page.locator('button[data-artifact-id="scale-card-1"]').press('Enter');
  await page.getByRole('button', { name: 'Design', exact: true }).click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download project', exact: true }).click();
  const download = await downloading;
  const path = testInfo.outputPath('remote-artwork.cardforge');
  await download.saveAs(path);
  expect(await download.failure()).toBeNull();
  const zip = await JSZip.loadAsync(await readFile(path));
  const manifest = JSON.parse(await zip.file('cardforge-project.json')!.async('string'));
  expect(manifest.assets.filter((asset: { mimeType: string }) => asset.mimeType === 'image/png')).toHaveLength(2);
  expect(manifest.project.cardSets).toHaveLength(2);
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
  await page.getByRole('button', { name: 'Download project', exact: true }).click();
  await expect(page.getByText('Project not exported', { exact: true })).toBeVisible();
  expect(extraDownloads).toBe(0);
});
