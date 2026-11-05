import { buildSync } from 'esbuild';
import { expect, test } from '@playwright/test';
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import JSZip from 'jszip';
const bundle = buildSync({ entryPoints: ['tests/product/fixtures/outputHandoff.tsx'], bundle: true, platform: 'browser', format: 'iife', write: false, outfile: '/tmp/cardforge-output-handoff-fixture.js', define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' } }).outputFiles.find((file) => file.path.endsWith('.js'))!.text;
const workbenchBundle = buildSync({ entryPoints: ['tests/product/fixtures/outputHandoffWorkbench.tsx'], bundle: true, platform: 'browser', format: 'iife', write: false, outfile: '/tmp/cardforge-output-workbench-fixture.js', define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' } }).outputFiles.find((file) => file.path.endsWith('.js'))!.text;
const id = 'a2393740-a748-42cc-a942-1aa7c16641db';
const intent = { documentId: id, revision: 2, setId: 'scale-set-100', cardIds: ['scale-card-2', 'scale-card-1'], paper: 'A4 (210×297 mm)', marginMm: 7, spacingMm: 2, cutLines: false, duplex: 'same-page', mode: 'virtual', quality: 150 };
async function mount(page: import('@playwright/test').Page, accept: boolean, hold = false, staleAfter = 0, revision: string | null = '2', malformedAfter = 0, assetProof = false, source: 'studio' | 'gpt' = 'studio', seedLocal = false, initialFault: 'wrong-id' | 'source' | 'watermark' | null = null, rejectAck = false) {
 let requests = 0; let release!: () => void;
 const gate = new Promise<void>((resolve) => { release = resolve; });
 page.removeAllListeners('dialog'); page.on('dialog', (dialog) => accept ? dialog.accept() : dialog.dismiss());
 page.on('pageerror', error => console.log('BROWSER_ERROR', error.message));
 await page.route('**/*', async (route) => {
  const url = new URL(route.request().url());
  if (url.pathname === '/proof') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head></head><body></body></html>' });
  if (url.pathname === '/__synthetic-asset') return route.fulfill({ status: 200, contentType: 'image/webp', body: Buffer.from([1, 2, 4]) });
  if (url.pathname === `/api/studio-documents/${id}/installation`) return rejectAck ? route.fulfill({ status: 503, json: { error: 'unavailable' } }) : route.fulfill({ json: { ok: true, lastInstalledRevision: 2 } });
  if (url.pathname === `/api/studio-documents/${id}`) { requests++; if (hold) await gate; if (staleAfter && requests > staleAfter) return route.fulfill({ status: 409, json: { error: 'stale' } }); if (malformedAfter && requests > malformedAfter) return route.fulfill({ status: 200, contentType: 'text/html', body: '<html>sign in</html>' }); const doc = await page.evaluate(() => (window as unknown as { outputDocument: unknown }).outputDocument); return route.fulfill({ json: { document: { id: initialFault === 'wrong-id' ? '20000000-0000-4000-8000-000000000002' : id, revision: 2, creationSource: initialFault === 'source' ? 'unknown' : source, document: doc }, assets: assetProof ? [{ id: createHash('sha256').update(Buffer.from([1, 2, 3])).digest('hex'), kind: 'image', mimeType: 'image/webp', size: 3, signedUrl: 'http://localhost/__synthetic-asset' }] : [], watermark: initialFault === 'watermark' ? { required: false } : { required: false, canExportClean: true }, outputIntent: { ...intent, layout: 'sheet' } } }); }
  if (url.pathname.startsWith('/fonts/') || url.pathname === '/brand/cardforge-studio/watermark.svg') return route.continue();
  return route.abort();
 });
 const params = new URLSearchParams({ document: id, outputRef: '10000000-0000-4000-8000-000000000001' }); if (revision !== null) params.set('revision', revision); if (assetProof) params.set('assetProof', createHash('sha256').update(Buffer.from([1, 2, 3])).digest('hex')); if (seedLocal) params.set('seedLocal', '1');
 await page.goto(`http://localhost/proof?${params}`); await page.addScriptTag({ content: bundle });
 return { requests: () => requests, release };
}
test('explicit confirmation imports ordered exact source and does not request a PDF until clicked', async ({ page }) => {
 let downloads = 0; page.on('download', () => downloads++); const state = await mount(page, true);
  await expect(page.getByTestId('selected')).toHaveText('scale-card-2,scale-card-1'); await expect(page.getByTestId('settings')).toHaveText('scale-set-100|A4 (210×297 mm)|7|2|false|same-page|virtual|150'); expect(state.requests()).toBe(1); expect(downloads).toBe(0);
 const download = page.waitForEvent('download'); await page.getByRole('button', { name: /PDF/i }).click(); const file = await download;
 const bytes = await readFile((await file.path())!); const pdf = await PDFDocument.load(bytes); expect(pdf.getPageCount()).toBe(1); expect(pdf.getPage(0).getWidth()).toBeCloseTo(210 * 72 / 25.4, 1); expect(pdf.getPage(0).getHeight()).toBeCloseTo(297 * 72 / 25.4, 1);
 const faces = pdf.context.enumerateIndirectObjects().filter(([, value]) => value instanceof PDFRawStream && String(value.dict.get(PDFName.of('Subtype'))) === '/Image' && value.dict.has(PDFName.of('SMask')));
 expect(faces).toHaveLength(3); for (const [, value] of faces) { const image = value as PDFRawStream; expect(String(image.dict.get(PDFName.of('Width')))).toBe('744'); expect(String(image.dict.get(PDFName.of('Height')))).toBe('1040'); }
 expect(state.requests()).toBe(3);
});
test('@golden cancel leaves workspace untouched and concurrent local work aborts import', async ({ page }) => {
 const cancelled = await mount(page, false, false, 0, '2', 0, false, 'studio', true); await expect(page.getByTestId('selected')).toHaveText(''); expect(cancelled.requests()).toBe(0); expect(await page.evaluate(() => (window as unknown as { localCardIds: () => string[] }).localCardIds())).toContain('existing-local');
 await page.goto('about:blank'); const pending = await mount(page, true, true); await expect.poll(() => pending.requests()).toBe(1); await page.evaluate(() => (window as unknown as { changeWorkspace: () => void }).changeWorkspace()); pending.release();
 await expect(page.getByTestId('message')).toContainText('workspace changed'); await expect(page.getByTestId('selected')).toHaveText('');
});

test('@golden stale source blocks PDF download before rendering', async ({ page }) => {
 let downloads = 0; page.on('download', () => downloads++); const state = await mount(page, true, false, 1);
 await expect(page.getByTestId('selected')).toHaveText('scale-card-2,scale-card-1');
 await page.getByRole('button', { name: /PDF/i }).click();
 await expect(page.getByRole('region', { name: 'Notifications (F8)' }).getByText(/source or account access could not be revalidated/i)).toBeVisible();
 expect(state.requests()).toBe(2); expect(downloads).toBe(0);
});

test('@golden a source change during render blocks the download request', async ({ page }) => {
 let downloads = 0; page.on('download', () => downloads++); const state = await mount(page, true, false, 2);
 await expect(page.getByTestId('selected')).toHaveText('scale-card-2,scale-card-1');
 await page.getByRole('button', { name: /PDF/i }).click();
 await expect(page.getByRole('region', { name: 'Notifications (F8)' }).getByText(/source or account access could not be revalidated/i)).toBeVisible();
 expect(state.requests()).toBe(3); expect(downloads).toBe(0);
});

test('missing revision fails closed before confirmation or import', async ({ page }) => {
 const state = await mount(page, false, false, 0, null);
 await expect(page.getByTestId('message')).toContainText('exact document revision are required');
 expect(state.requests()).toBe(0); await expect(page.getByTestId('selected')).toHaveText('');
});

test('a successful HTML sign-in response cannot authorize a download', async ({ page }) => {
 let downloads = 0; page.on('download', () => downloads++); const state = await mount(page, true, false, 0, '2', 1);
 await expect(page.getByTestId('selected')).toHaveText('scale-card-2,scale-card-1');
 await page.getByRole('button', { name: /PDF/i }).click();
 await expect(page.getByRole('region', { name: 'Notifications (F8)' }).getByText(/source or account access could not be revalidated/i)).toBeVisible();
 expect(state.requests()).toBe(2); expect(downloads).toBe(0);
});

test('rejects wrong private bytes before replacing local work', async ({ page }) => {
 const state = await mount(page, true, false, 0, '2', 0, true);
 await expect(page.getByTestId('message')).toContainText('recorded digest');
 expect(state.requests()).toBe(1); await expect(page.getByTestId('selected')).toHaveText('');
});
test('GPT adoption accepts its known metadata normalization', async ({ page }) => {
 const state = await mount(page, true, false, 0, '2', 0, false, 'gpt');
 await expect(page.getByTestId('selected')).toHaveText('scale-card-2,scale-card-1'); expect(state.requests()).toBe(1);
});

test('@golden lost installation acknowledgement cannot cause reload to reimport local work', async ({ page }) => {
 const state = await mount(page, true, false, 0, '2', 0, false, 'gpt', false, null, true);
 await expect(page.getByTestId('message')).toContainText('applied locally');
 expect(state.requests()).toBe(1);
 await page.reload(); await page.addScriptTag({ content: bundle });
 await expect(page.getByTestId('message')).toContainText('already opened');
 expect(state.requests()).toBe(1);
});

test('reload of an applied reference fails closed instead of reimporting', async ({ page }) => {
 const state = await mount(page, true);
 await expect(page.getByTestId('selected')).toHaveText('scale-card-2,scale-card-1'); expect(state.requests()).toBe(1);
 await page.reload(); await page.addScriptTag({ content: bundle });
 await expect(page.getByTestId('message')).toContainText('already opened');
 expect(state.requests()).toBe(1); await expect(page.getByTestId('selected')).toHaveText('');
});

test('a new reference is processed and browser back to an applied reference fails closed', async ({ page }) => {
 const state = await mount(page, true);
 await expect(page.getByTestId('selected')).toHaveText('scale-card-2,scale-card-1'); expect(state.requests()).toBe(1);
 await page.evaluate(() => { const url = new URL(location.href); url.searchParams.set('outputRef', '20000000-0000-4000-8000-000000000002'); history.pushState({}, '', url); window.dispatchEvent(new PopStateEvent('popstate')); });
 await expect.poll(() => state.requests()).toBe(2); await expect(page.getByTestId('selected')).toHaveText('scale-card-2,scale-card-1');
 await page.goBack(); await expect(page.getByTestId('message')).toContainText('already opened');
 await expect(page.getByTestId('selected')).toHaveText(''); expect(state.requests()).toBe(2);
});

for (const fault of ['wrong-id', 'source', 'watermark'] as const) test(`malformed ${fault} response leaves existing local work untouched`, async ({ page }) => {
 const state = await mount(page, true, false, 0, '2', 0, false, 'studio', true, fault);
 await expect(page.getByTestId('message')).toContainText('source response is invalid');
 expect(state.requests()).toBe(1); expect(await page.evaluate(() => (window as unknown as { localCardIds: () => string[] }).localCardIds())).toContain('existing-local');
 await expect(page.getByTestId('selected')).toHaveText('');
});

test('@golden actual Workbench applies exact selection and settings before the explicit PDF action', async ({ page }) => {
 let sourceRequests = 0; let downloads = 0; let stale = false; page.on('download', () => downloads++); page.on('dialog', dialog => dialog.accept());
 page.on('pageerror', error => console.log('WORKBENCH_ERROR', error.message));
 await page.route('**/*', async (route) => {
  const url = new URL(route.request().url());
  if (url.pathname === '/proof') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head></head><body></body></html>' });
  if (url.pathname === '/api/account/entitlement') return route.fulfill({ json: await page.evaluate(() => (window as unknown as { outputEntitlement: unknown }).outputEntitlement) });
  if (url.pathname === '/api/catalog/studio-bootstrap') return route.fulfill({ json: { templates: { defaults: [], userTemplates: [] }, styles: { styles: [] }, fonts: { fonts: [] }, studioDefaults: { defaultTemplateId: null } } });
  if (url.pathname === '/api/catalog/completed-deletions') return route.fulfill({ json: { deleted: [] } });
  if (url.pathname === `/api/studio-documents/${id}`) { sourceRequests++; if (stale) return route.fulfill({ status: 409, json: { error: 'stale' } }); return route.fulfill({ json: { document: { id, revision: 2, creationSource: 'studio', document: await page.evaluate(() => (window as unknown as { outputDocument: unknown }).outputDocument) }, assets: [], watermark: { required: false, canExportClean: true }, outputIntent: { ...intent, layout: 'sheet' } } }); }
  return route.abort();
 });
 const params = new URLSearchParams({ document: id, revision: '2', outputRef: '10000000-0000-4000-8000-000000000001' });
 await page.goto(`http://localhost/proof?${params}`); await page.addScriptTag({ content: workbenchBundle });
 await expect(page.getByText('Prepared selection: 2 cards, in the requested order.')).toBeVisible();
 expect(downloads).toBe(0); await expect(page.getByLabel(/Margins/)).toHaveValue('7'); await expect(page.getByLabel(/Card spacing/)).toHaveValue('2');
 const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Save as PDF', exact: true }).click();
 const pdf = await PDFDocument.load(await readFile((await (await download).path())!)); expect(pdf.getPageCount()).toBe(1); expect(pdf.getPage(0).getWidth()).toBeCloseTo(210 * 72 / 25.4, 1); const faces = pdf.context.enumerateIndirectObjects().filter(([, value]) => value instanceof PDFRawStream && String(value.dict.get(PDFName.of('Subtype'))) === '/Image' && value.dict.has(PDFName.of('SMask'))); expect(faces).toHaveLength(3);
 const zipDownload = page.waitForEvent('download'); await page.getByRole('button', { name: /Download PNG set/ }).click();
 const zip = await JSZip.loadAsync(await readFile((await (await zipDownload).path())!));
 expect(Object.keys(zip.files).filter((name) => name.endsWith('.png'))).toEqual(['digital-output-images/001_Scale_Card_0002_front.png', 'digital-output-images/001_Scale_Card_0002_back.png', 'digital-output-images/002_Scale_Card_0001_front.png']);
 stale = true; const beforeBlockedZip = downloads; await page.getByRole('button', { name: /Download PNG set/ }).click();
 await expect(page.getByRole('region', { name: 'Notifications (F8)' }).getByText(/source or account access could not be revalidated/i)).toBeVisible(); expect(downloads).toBe(beforeBlockedZip);
 const beforeReload = sourceRequests; await page.reload(); await page.addScriptTag({ content: workbenchBundle });
 await expect(page.getByRole('alert').filter({ hasText: 'This prepared Output is not active' })).toBeVisible();
 expect(sourceRequests).toBe(beforeReload); await expect(page.getByRole('button', { name: 'Save as PDF', exact: true })).toHaveCount(0);
});

const deskBuild = buildSync({ minify: true, entryPoints: ['tests/product/fixtures/outputHandoffDesk.tsx'], bundle: true, platform: 'browser', format: 'iife', write: false, outfile: '/tmp/cardforge-output-desk-fixture.js', define: { 'process.env.NODE_ENV': '"production"', 'process.env.NEXT_RUNTIME': '"browser"', 'process.env': '{}' } });
const deskBundle = deskBuild.outputFiles.find(file => file.path.endsWith('.js'))!.text;
async function mountDesk(page: import('@playwright/test').Page, fault: 'stale' | 'invalid' | 'cancel' | 'concurrent' | null = null) {
 let requests = 0; let confirmations = 0; let release!: () => void;
 const pending = new Promise<void>(resolve => { release = resolve; });
 page.on('dialog', dialog => { confirmations++; return fault === 'cancel' ? dialog.dismiss() : dialog.accept(); });
 page.on('pageerror', error => console.log('DESK_OUTPUT_ERROR', error.message));
 await page.route('**/*', async route => {
  const url = new URL(route.request().url());
  if (url.pathname === '/account') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head></head><body></body></html>' });
  if (url.pathname === '/api/account/entitlement') return route.fulfill({ json: await page.evaluate(() => (window as unknown as { outputEntitlement: unknown }).outputEntitlement) });
  if (url.pathname === '/api/catalog/studio-bootstrap') return route.fulfill({ json: { templates: { defaults: [], userTemplates: [] }, styles: { styles: [] }, fonts: { fonts: [] }, studioDefaults: { defaultTemplateId: null } } });
  if (url.pathname === '/api/catalog/completed-deletions') return route.fulfill({ json: { deleted: [] } });
  if (url.pathname === `/api/studio-documents/${id}`) {
   requests++; if (fault === 'concurrent') await pending;
   if (fault === 'stale') return route.fulfill({ status: 409, json: { error: { code: 'revision_conflict', kind: 'conflict', message: 'Exact source revision is stale', retryable: false, correlationId: 'synthetic-output-stale' } } });
   return route.fulfill({ json: { document: { id, revision: 2, creationSource: 'studio', document: await page.evaluate(() => (window as unknown as { outputDocument: unknown }).outputDocument) }, assets: [], watermark: { required: false, canExportClean: true }, outputIntent: { ...intent, cardIds: ['scale-card-3', 'scale-card-1'], layout: 'sheet' } } });
  }
  return route.fulfill({ status: 503, json: { error: { code: 'fixture_unavailable', kind: 'unavailable', message: 'Provider excluded from synthetic Output proof', retryable: false } } });
 });
 const params = new URLSearchParams({ tool: 'output', document: id, revision: '2', outputRef: fault === 'invalid' ? '' : '10000000-0000-4000-8000-000000000001' });
 if (fault === 'cancel') params.set('seedLocal', '1');
 await page.goto(`http://localhost/account?${params}`);
 for (const file of deskBuild.outputFiles.filter(file => file.path.endsWith('.css'))) await page.addStyleTag({ content: file.text });
 await page.addScriptTag({ content: deskBundle });
 return { requests: () => requests, confirmations: () => confirmations, release };
}

test('@golden actual Desk bootstraps exact prepared Output before a local Set exists', async ({ page }) => {
 let downloads = 0; page.on('download', () => downloads++);
 const source = await mountDesk(page);
 await expect(page.getByText('Prepared selection: 2 cards, in the requested order.')).toBeVisible();
 await expect(page.getByLabel(/Margins/)).toHaveValue('7'); await expect(page.getByLabel(/Card spacing/)).toHaveValue('2');
 expect(source.requests()).toBe(1); expect(downloads).toBe(0);
 expect(new URL(page.url()).searchParams.get('outputRef')).toBe('10000000-0000-4000-8000-000000000001');
 const download = page.waitForEvent('download'); await page.getByRole('button', { name: /Download PNG set/ }).click();
 const zip = await JSZip.loadAsync(await readFile((await (await download).path())!));
 expect(Object.keys(zip.files).filter(name => name.endsWith('.png'))).toEqual(['digital-output-images/001_CHARLIE_front.png', 'digital-output-images/001_CHARLIE_back.png', 'digital-output-images/002_ALPHA_front.png']);
 await page.reload(); await page.addScriptTag({ content: deskBundle });
 await expect(page.getByRole('alert').filter({ hasText: 'This prepared Output is not active' })).toBeVisible();
 await expect(page.getByRole('button', { name: 'Save as PDF', exact: true })).toHaveCount(0);
});

for (const fault of ['stale', 'invalid', 'cancel', 'concurrent'] as const) test(`@golden actual Desk keeps ${fault} Output handoff fail-closed`, async ({ page }) => {
 let downloads = 0; page.on('download', () => downloads++);
 const source = await mountDesk(page, fault);
 if (fault === 'concurrent') { await expect.poll(source.requests).toBe(1); await page.evaluate(() => (window as unknown as { changeWorkspace: () => void }).changeWorkspace()); source.release(); }
 const notices = page.getByRole('region', { name: 'Notifications (F8)' });
 if (fault === 'cancel') await expect.poll(source.confirmations).toBe(1);
 else await expect(notices.getByText(fault === 'stale' ? /source revision is stale/ : fault === 'invalid' ? /valid Output reference/ : /workspace changed/)).toBeVisible();
 await expect(page.getByRole('button', { name: 'Save as PDF', exact: true })).toHaveCount(0);
 const state = await page.evaluate(() => (window as unknown as { outputState: () => { cards: string[] } }).outputState());
 expect(state.cards).toEqual(fault === 'cancel' ? ['existing-local'] : fault === 'concurrent' ? ['concurrent-local'] : []);
 expect(source.requests()).toBe(fault === 'invalid' || fault === 'cancel' ? 0 : 1); expect(downloads).toBe(0);
});
