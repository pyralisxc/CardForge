import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import JSZip from 'jszip';
import { seedGuestScaleWorkspace } from './helpers/projectScaleBrowser';

const workspaceBytes = (page: Page) => page.evaluate(async () => {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('cardforge-browser-storage', 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise<Record<string, string>>((resolve, reject) => {
      const transaction = database.transaction('key-value', 'readonly');
      const request = transaction.objectStore('key-value').openCursor();
      const result: Record<string, string> = {};
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        if (String(cursor.key).startsWith('project-workspace:')) result[String(cursor.key)] = cursor.value;
        cursor.continue();
      };
      transaction.oncomplete = () => resolve(result);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { database.close(); }
});

test('native quota failure preserves saved work and permits emergency editable recovery', async ({ page, context }, testInfo) => {
  test.setTimeout(180_000);
  await page.addInitScript(() => {
    const nativeTransaction = IDBDatabase.prototype.transaction;
    const errors: string[] = [];
    Object.assign(window, { __quotaTransactionErrors: errors });
    IDBDatabase.prototype.transaction = function (...args: Parameters<typeof nativeTransaction>) {
      const transaction = nativeTransaction.apply(this, args);
      transaction.addEventListener('abort', () => { if (transaction.error) errors.push(transaction.error.name); });
      return transaction;
    };
  });
  await seedGuestScaleWorkspace(page, 100, { cardLimit: 2, exportSample: true });
  await page.goto('/account', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^Select 100 Card Scale Set/ }).press('Enter');
  await page.locator('button[data-artifact-id="scale-card-1"]').click();
  await page.locator('[data-desk-context-rail]').getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.locator('[data-artifact-edit-workspace]')).toBeVisible();
  const session = await context.newCDPSession(page);
  const origin = new URL(page.url()).origin;
  const before = await workspaceBytes(page);
  // A zero quota reports overrideActive but does not reject writes in tested Chromium.
  await session.send('Storage.overrideQuotaForOrigin', { origin, quotaSize: 1 });
  try {
    // Chromium caches the previous space allowance for 30 seconds after a write:
    // content/browser/indexed_db/instance/bucket_context.h kBucketSpaceCacheTimeLimit.
    // Wait for the native quota cache, rather than allocating enough data to exhaust it.
    await new Promise((resolve) => setTimeout(resolve, 31_000));
    const quota = await session.send('Storage.getUsageAndQuota', { origin });
    expect(quota.overrideActive).toBe(true);
    expect(quota.quota).toBe(1);
    await page.getByRole('textbox', { name: /Card Name/i }).fill('Unsaved authored quota proof');
    await page.locator('[data-artifact-edit-workspace]').getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('button', { name: /Latest change not saved/ })).toBeVisible();
    expect(await page.evaluate(() => (window as typeof window & { __quotaTransactionErrors: string[] }).__quotaTransactionErrors)).toContain('QuotaExceededError');
    expect(await workspaceBytes(page)).toEqual(before);
    await page.getByRole('button', { name: /Latest change not saved/ }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download emergency backup', exact: true }).click();
    const download = await downloadPromise;
    const backupPath = testInfo.outputPath('quota-emergency.cardforge');
    await download.saveAs(backupPath);
    expect(await download.failure()).toBeNull();
    const zip = await JSZip.loadAsync(await readFile(backupPath));
    const manifest = JSON.parse(await zip.file('cardforge-project.json')!.async('string'));
    expect(manifest.project.artifacts).toHaveLength(2);
    expect(manifest.project.artifacts[0].card.data.cardName).toBe('Unsaved authored quota proof');
    expect(manifest.assets).toHaveLength(2);
    for (const asset of manifest.assets) {
      const bytes = await zip.file(asset.path)!.async('nodebuffer');
      expect(bytes.length).toBe(asset.size);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(asset.id);
    }
    await page.getByRole('dialog').locator('input[type="file"]').setInputFiles(backupPath);
    // Package inspection materializes required artwork through native IndexedDB;
    // quota may reject there before a replacement can even be offered.
    await expect(page.getByText('Backup was not opened', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open recovered copy', exact: true })).toHaveCount(0);
    expect(await workspaceBytes(page)).toEqual(before);
    await page.getByRole('button', { name: 'Restore & reload', exact: true }).click();
    await expect(page.getByText('Workspace was not restored', { exact: true })).toBeVisible();
    expect(await workspaceBytes(page)).toEqual(before);
    await page.screenshot({ path: testInfo.outputPath('quota-recovery-preserved.png') });

    await session.send('Storage.overrideQuotaForOrigin', { origin });
    await page.getByRole('button', { name: 'Restore & reload', exact: true }).click();
    await expect(page.getByRole('button', { name: /^Saved in this browser/ })).toBeVisible();
    const restored = await workspaceBytes(page);
    const activeKey = Object.keys(before).find((key) => key.endsWith(':workspace') && !key.includes(':__') && restored[key] !== before[key])!;
    expect(activeKey).toBeTruthy();
    expect(JSON.parse(restored[activeKey]!).revision).toBeGreaterThan(JSON.parse(before[activeKey]!).revision);
    const restoredState = JSON.parse(JSON.parse(restored[activeKey]!).value).state;
    expect(restoredState.storedCards).toHaveLength(2);
    expect(restoredState.storedCards[0].data.cardName).toBe('Scale Card 0001');

    await page.getByRole('button', { name: /^Saved in this browser/ }).click();
    await page.getByRole('dialog').locator('input[type="file"]').setInputFiles(backupPath);
    await page.getByRole('button', { name: 'Open recovered copy', exact: true }).click();
    await expect(page.getByText('Recovered copy opened', { exact: true })).toBeVisible();
    const recovered = await workspaceBytes(page);
    const recoveredState = JSON.parse(JSON.parse(recovered[activeKey]!).value).state;
    expect(recoveredState.storedCards).toHaveLength(4);
    expect(recoveredState.cardSets).toHaveLength(2);
    expect(recoveredState.storedCards.find((card: { uniqueId: string }) => card.uniqueId === 'scale-card-1').data.cardName).toBe('Scale Card 0001');
    expect(recoveredState.storedCards.filter((card: { data: { cardName: string } }) => card.data.cardName === 'Unsaved authored quota proof')).toHaveLength(1);
    const evidence = { browser: context.browser()?.version(), quota, nativeError: 'QuotaExceededError', savedBytesPreserved: true,
      backupCards: manifest.project.artifacts.length, verifiedArtworkFiles: manifest.assets.length,
      failedRestoreAndImportPreserved: true, recoveredCards: recoveredState.storedCards.length, recoveredSets: recoveredState.cardSets.length };
    console.info(`[browser-quota-evidence] ${JSON.stringify(evidence)}`);
    await testInfo.attach('quota-evidence', { body: JSON.stringify(evidence), contentType: 'application/json' });
  } finally {
    await session.send('Storage.overrideQuotaForOrigin', { origin });
    await session.detach();
  }
});

test('an unreadable native workspace preserves original bytes through explicit backup replacement', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await seedGuestScaleWorkspace(page, 100, { cardLimit: 2, exportSample: true });
  await page.goto('/account', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^Saved in this browser/ }).click();
  const backupDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download emergency backup', exact: true }).click();
  const backup = await backupDownload;
  const backupPath = testInfo.outputPath('before-corruption.cardforge');
  await backup.saveAs(backupPath);
  expect(await backup.failure()).toBeNull();
  await page.goto('/robots.txt');
  const original = '{"state":{"authoredRepairMarker":"Preserve these original bytes",';
  await page.evaluate(async (bytes) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('cardforge-browser-storage', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction('key-value', 'readwrite');
        for (const scope of ['guest', 'local']) transaction.objectStore('key-value').put(bytes, `project-workspace:${scope}:workspace`);
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(transaction.error);
      });
    } finally { database.close(); }
  }, original);
  await page.goto('/account', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^Workspace unavailable/ }).click();
  await expect(page.getByText('The saved copy could not be read. Its bytes have not been replaced.', { exact: true })).toBeVisible();
  const rawDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download original recovery data', exact: true }).click();
  const raw = await rawDownload;
  const rawPath = testInfo.outputPath('original-unreadable.json');
  await raw.saveAs(rawPath);
  expect(await readFile(rawPath, 'utf8')).toBe(original);
  const before = await workspaceBytes(page);
  expect(before['project-workspace:local:workspace']).toBe(original);
  expect(before['project-workspace:guest:workspace']).toBe(original);
  await page.getByRole('dialog').locator('input[type="file"]').setInputFiles(backupPath);
  await expect(page.getByRole('button', { name: 'Replace workspace from backup', exact: true })).toBeVisible();
  expect(await workspaceBytes(page)).toEqual(before);
  await page.getByRole('button', { name: 'Replace workspace from backup', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Select 100 Card Scale Set/ })).toBeVisible();
  const after = await workspaceBytes(page);
  expect(Object.entries(after).some(([key, value]) => key.includes(':__quarantine__:workspace') && value === original)).toBe(true);
  const current = Object.entries(after).find(([key, value]) => key.endsWith(':workspace') && !key.includes(':__') && value !== original)!;
  expect(JSON.parse(JSON.parse(current[1]).value).state.storedCards).toHaveLength(2);
  await testInfo.attach('unreadable-recovery-evidence', { body: JSON.stringify({ originalDownloadExact: true, originalPreservedInQuarantine: true, replacementCards: 2, explicitConfirmation: true }), contentType: 'application/json' });
});
