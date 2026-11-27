import { buildSync } from 'esbuild';
import { expect, test } from '@playwright/test';

const bundle = buildSync({ entryPoints: ['tests/product/fixtures/pipelineUploadRecovery.tsx'], bundle: true,
  platform: 'browser', format: 'iife', write: false, define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' } });
const path = 'pipeline-owned-v1/11111111-1111-4111-8111-111111111111/source.png';
const submissionId = '22222222-2222-4222-8222-222222222222';

for (const committed of [true, false, null, 'discard', 'discard-unconfirmed', 'discard-completed', 'corrupt'] as const) test(`recovers the same upload after ${String(committed)} lost acknowledgement`, async ({ page }) => {
  let planCount = 0; let uploadCount = 0; let posts = 0; let cleanups = 0; let owned = false;
  let cleanupState: 'none' | 'committed' | 'completed' = 'none';
  const payloads: unknown[] = [];
  await page.route('**/*', async route => {
    const request = route.request(); const url = new URL(request.url());
    if (url.pathname === '/__upload-recovery') return route.fulfill({ contentType: 'text/html', body: '<html><body></body></html>' });
    if (url.pathname === '/api/pipeline/upload-plan' && request.method() === 'POST') {
      planCount++; return route.fulfill({ json: { upload: { signedUrl: 'http://localhost:9002/__signed-upload?secret=fixture', storagePath: path, fileName: 'fixture.png', fileSizeBytes: 4, mimeType: 'image/png', maxFileSizeBytes: 100 } } });
    }
    if (url.pathname === '/api/pipeline/upload-plan' && request.method() === 'DELETE') {
      cleanups++;
      if (committed === 'discard-unconfirmed') { cleanupState = 'committed'; return route.abort('failed'); }
      cleanupState = 'completed';
      return committed === 'discard-completed' ? route.abort('failed') : route.fulfill({ json: { removed: true } });
    }
    if (url.pathname === '/__signed-upload') { uploadCount++; return route.fulfill({ status: 200 }); }
    if (url.pathname === '/api/pipeline' && request.method() === 'POST') {
      expect(request.headers()['x-pipeline-contributor']).toBe('fixture-author');
      if (url.searchParams.has('lookup')) {
        if (committed === null || cleanupState === 'committed') return route.fulfill({ status: 503, json: { error: 'uncertain' } });
        return route.fulfill({ json: { receipt: cleanupState === 'completed' ? { state: 'discarded', submissionId: null } : owned ? { state: 'owned', submissionId } : { state: 'pending', submissionId: null } } });
      }
      payloads.push(request.postDataJSON()); posts++;
      if (posts === 1) { owned = committed === true; return route.abort('failed'); }
      owned = true; return route.fulfill({ status: 201, json: { submitted: true } });
    }
    return route.abort();
  });
  const boot = async (actor = 'fixture-author') => {
    await page.goto(`http://localhost:9002/__upload-recovery?actor=${actor}`);
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
  };
  await boot();
  await page.getByLabel('Specialties').selectOption('general');
  await page.locator('#pipeline-asset-name').fill('Fixture icon');
  await page.getByLabel('Icon source file').setInputFiles({ name: 'fixture.png', mimeType: 'image/png', buffer: Buffer.from([1, 2, 3, 4]) });
  await page.getByLabel('Creator, sources, licenses and publication rights').fill('Original test art; publication rights held.');
  await page.getByLabel('AI assistance').selectOption('none');
  await page.getByRole('button', { name: 'Send to Forge Review' }).click();
  await expect(page.getByText('Submission outcome unconfirmed', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Saved submission attempt' })).toBeVisible();
  const saved = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('cardforge-browser-storage'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    return await new Promise<unknown>((resolve, reject) => { const request = db.transaction('key-value').objectStore('key-value').get('pipeline-upload-attempt-v1:fixture-author'); request.onsuccess = () => { db.close(); resolve(request.result); }; request.onerror = () => reject(request.error); });
  });
  expect(JSON.stringify(saved)).not.toContain('__signed-upload');
  expect(JSON.stringify(saved)).not.toContain('secret=fixture');
  expect(cleanups).toBe(0);
  if (committed === 'corrupt') {
    await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('cardforge-browser-storage'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction('key-value', 'readwrite'); const store = transaction.objectStore('key-value');
        const request = store.get('pipeline-upload-attempt-v1:fixture-author');
        request.onsuccess = () => { const attempt = request.result; attempt.payload.name = 'Changed snapshot'; store.put(attempt, 'pipeline-upload-attempt-v1:fixture-author'); };
        transaction.oncomplete = () => { db.close(); resolve(); }; transaction.onerror = () => reject(transaction.error);
      });
    });
    await boot();
    await expect(page.getByRole('alert')).toContainText('cannot be read safely');
    await expect(page.getByRole('button', { name: 'Send to Forge Review' })).toBeDisabled();
    expect(posts).toBe(1); expect(cleanups).toBe(0); return;
  }
  await boot('another-actor');
  await expect(page.getByRole('region', { name: 'Saved submission attempt' })).toHaveCount(0);
  await boot();
  await page.getByRole('button', { name: 'Check submission outcome' }).click();
  if (committed === null) {
    await expect(page.getByRole('alert')).toContainText('still unconfirmed');
    await expect(page.getByRole('button', { name: 'Retry original submission' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Send to Forge Review' })).toBeDisabled();
    expect(planCount).toBe(1); expect(uploadCount).toBe(1); expect(cleanups).toBe(0); expect(posts).toBe(1);
    return;
  }
  if (committed === 'discard' || committed === 'discard-unconfirmed' || committed === 'discard-completed') {
    await page.getByRole('button', { name: 'Discard pending upload' }).click();
    if (committed === 'discard') await expect(page.getByRole('region', { name: 'Saved submission attempt' })).toHaveCount(0);
    else {
      await expect(page.getByRole('region', { name: 'Saved submission attempt' })).toBeVisible();
      await expect(page.getByRole('alert')).toContainText('cleanup could not be confirmed');
      await expect(page.getByRole('button', { name: 'Discard pending upload' })).toHaveCount(0);
      await boot();
      await page.getByRole('button', { name: 'Check submission outcome' }).click();
      if (committed === 'discard-completed') {
        await expect(page.getByText('Pending upload discarded', { exact: true })).toBeVisible();
        await expect(page.getByRole('region', { name: 'Saved submission attempt' })).toHaveCount(0);
      } else {
        await expect(page.getByRole('alert')).toContainText('still unconfirmed');
        await expect(page.getByRole('region', { name: 'Saved submission attempt' })).toBeVisible();
      }
    }
    expect(cleanups).toBe(1); expect(posts).toBe(1); expect(planCount).toBe(1);
    return;
  }
  if (!committed) await page.getByRole('button', { name: 'Retry original submission' }).click();
  await expect(page.getByRole('region', { name: 'Saved submission attempt' })).toContainText(submissionId);
  expect(planCount).toBe(1); expect(uploadCount).toBe(1); expect(cleanups).toBe(0);
  expect(posts).toBe(committed ? 1 : 2);
  if (!committed) expect(payloads[1]).toEqual(payloads[0]);
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Saved submission attempt' })).toHaveCount(0);
});

for (const missing of ['locks', 'indexedDB'] as const) test(`explains unavailable ${missing} before uploading`, async ({ page }) => {
  let plans = 0;
  await page.addInitScript((feature) => {
    if (feature === 'locks') Object.defineProperty(navigator, 'locks', { value: undefined, configurable: true });
    else Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true });
  }, missing);
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__upload-recovery') return route.fulfill({ contentType: 'text/html', body: '<html><body></body></html>' });
    if (url.pathname === '/api/pipeline/upload-plan') plans++;
    return route.abort();
  });
  await page.goto('http://localhost:9002/__upload-recovery');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await expect(page.getByRole('alert').filter({ hasText: 'Safe submission recovery' })).toContainText('browser storage and cross-tab locking');
  await expect(page.getByRole('button', { name: 'Send to Forge Review' })).toBeDisabled();
  expect(plans).toBe(0);
});
