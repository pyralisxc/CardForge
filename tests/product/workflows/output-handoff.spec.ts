import { buildSync } from 'esbuild';
import { expect, test } from '@playwright/test';
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { readFile } from 'node:fs/promises';
const bundle = buildSync({ entryPoints: ['tests/product/fixtures/outputHandoff.tsx'], bundle: true, platform: 'browser', format: 'iife', write: false, outfile: '/tmp/cardforge-output-handoff-fixture.js', define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' } }).outputFiles.find((file) => file.path.endsWith('.js'))!.text;
const id = 'a2393740-a748-42cc-a942-1aa7c16641db';
const intent = { documentId: id, revision: 2, setId: 'scale-set-100', cardIds: ['scale-card-2', 'scale-card-1'], paper: 'A4 (210×297 mm)', marginMm: 7, spacingMm: 2, cutLines: false, duplex: 'same-page', mode: 'virtual', quality: 150 };
async function mount(page: import('@playwright/test').Page, accept: boolean, hold = false, staleAfter = 0, revision: string | null = '2', malformedAfter = 0) {
 let requests = 0; let release!: () => void;
 const gate = new Promise<void>((resolve) => { release = resolve; });
 page.removeAllListeners('dialog'); page.on('dialog', (dialog) => accept ? dialog.accept() : dialog.dismiss());
 page.on('pageerror', error => console.log('BROWSER_ERROR', error.message));
 await page.route('**/*', async (route) => {
  const url = new URL(route.request().url());
  if (url.pathname === '/proof') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head></head><body></body></html>' });
  if (url.pathname === `/api/studio-documents/${id}`) { requests++; if (hold) await gate; if (staleAfter && requests > staleAfter) return route.fulfill({ status: 409, json: { error: 'stale' } }); if (malformedAfter && requests > malformedAfter) return route.fulfill({ status: 200, contentType: 'text/html', body: '<html>sign in</html>' }); const doc = await page.evaluate(() => (window as unknown as { outputDocument: unknown }).outputDocument); return route.fulfill({ json: { document: { id, revision: 2, creationSource: 'studio', document: doc }, assets: [], watermark: { required: false } } }); }
  if (url.pathname.startsWith('/fonts/') || url.pathname === '/brand/cardforge-studio/watermark.svg') return route.continue();
  return route.abort();
 });
 const params = new URLSearchParams({ document: id, outputIntent: JSON.stringify(intent) }); if (revision !== null) params.set('revision', revision);
 await page.goto(`http://cardforge.test/proof?${params}`); await page.addScriptTag({ content: bundle });
 return { requests: () => requests, release };
}
test('explicit confirmation imports ordered exact source and does not request a PDF until clicked', async ({ page }) => {
 let downloads = 0; page.on('download', () => downloads++); const state = await mount(page, true);
  await expect(page.getByTestId('selected')).toHaveText('scale-card-2,scale-card-1'); expect(state.requests()).toBe(1); expect(downloads).toBe(0);
 const download = page.waitForEvent('download'); await page.getByRole('button', { name: /PDF/i }).click(); const file = await download;
 const bytes = await readFile((await file.path())!); const pdf = await PDFDocument.load(bytes); expect(pdf.getPageCount()).toBe(1); expect(pdf.getPage(0).getWidth()).toBeCloseTo(210 * 72 / 25.4, 1); expect(pdf.getPage(0).getHeight()).toBeCloseTo(297 * 72 / 25.4, 1);
 const faces = pdf.context.enumerateIndirectObjects().filter(([, value]) => value instanceof PDFRawStream && String(value.dict.get(PDFName.of('Subtype'))) === '/Image' && value.dict.has(PDFName.of('SMask')));
 expect(faces).toHaveLength(3); for (const [, value] of faces) { const image = value as PDFRawStream; expect(String(image.dict.get(PDFName.of('Width')))).toBe('744'); expect(String(image.dict.get(PDFName.of('Height')))).toBe('1040'); }
 expect(state.requests()).toBe(3);
});
test('cancel leaves workspace untouched and concurrent local work aborts import', async ({ page }) => {
 const cancelled = await mount(page, false); await expect(page.getByTestId('selected')).toHaveText(''); expect(cancelled.requests()).toBe(0);
 await page.goto('about:blank'); const pending = await mount(page, true, true); await expect.poll(() => pending.requests()).toBe(1); await page.evaluate(() => (window as unknown as { changeWorkspace: () => void }).changeWorkspace()); pending.release();
 await expect(page.getByTestId('message')).toContainText('workspace changed'); await expect(page.getByTestId('selected')).toHaveText('');
});

test('stale source blocks PDF download before rendering', async ({ page }) => {
 let downloads = 0; page.on('download', () => downloads++); const state = await mount(page, true, false, 1);
 await expect(page.getByTestId('selected')).toHaveText('scale-card-2,scale-card-1');
 await page.getByRole('button', { name: /PDF/i }).click();
 await expect(page.getByRole('region', { name: 'Notifications (F8)' }).getByText(/source or account access could not be revalidated/i)).toBeVisible();
 expect(state.requests()).toBe(2); expect(downloads).toBe(0);
});

test('a source change during render blocks the download request', async ({ page }) => {
 let downloads = 0; page.on('download', () => downloads++); const state = await mount(page, true, false, 2);
 await expect(page.getByTestId('selected')).toHaveText('scale-card-2,scale-card-1');
 await page.getByRole('button', { name: /PDF/i }).click();
 await expect(page.getByRole('region', { name: 'Notifications (F8)' }).getByText(/source or account access could not be revalidated/i)).toBeVisible();
 expect(state.requests()).toBe(3); expect(downloads).toBe(0);
});

test('missing revision fails closed before confirmation or import', async ({ page }) => {
 const state = await mount(page, false, false, 0, null);
 await expect(page.getByTestId('message')).toContainText('exact document revision is required');
 expect(state.requests()).toBe(0); await expect(page.getByTestId('selected')).toHaveText('');
});

test('a successful HTML sign-in response cannot authorize a download', async ({ page }) => {
 let downloads = 0; page.on('download', () => downloads++); const state = await mount(page, true, false, 0, '2', 1);
 await expect(page.getByTestId('selected')).toHaveText('scale-card-2,scale-card-1');
 await page.getByRole('button', { name: /PDF/i }).click();
 await expect(page.getByRole('region', { name: 'Notifications (F8)' }).getByText(/source or account access could not be revalidated/i)).toBeVisible();
 expect(state.requests()).toBe(2); expect(downloads).toBe(0);
});
