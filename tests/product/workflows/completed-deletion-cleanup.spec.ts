import { expect, test } from '@playwright/test';
import { seedGuestScaleWorkspace } from './helpers/projectScaleBrowser';

const deletedUrl = 'https://example.invalid/completed-public-artwork.png';

test('cleans confirmed deleted card artwork, saves recovery, and keeps a shared sibling on reload', async ({ page }, testInfo) => {
  await seedGuestScaleWorkspace(page, 100, { cardLimit: 2, exportSample: true });
  await page.evaluate(async (url) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('cardforge-browser-storage', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('key-value', 'readwrite');
      const store = tx.objectStore('key-value');
      const key = 'project-workspace:local:workspace';
      const request = store.get(key);
      request.onsuccess = () => {
        const record = JSON.parse(request.result);
        const payload = JSON.parse(record.value);
        payload.state.storedCards[0].data.artwork = url;
        record.value = JSON.stringify(payload);
        store.put(JSON.stringify(record), key);
      };
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, deletedUrl);
  await page.route('**/api/catalog/completed-deletions', (route) => route.fulfill({ json: { deletedUrls: route.request().postDataJSON().urls.includes(deletedUrl) ? [deletedUrl] : [] } }));
  await page.goto('/account', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Deleted artwork removed', { exact: true })).toBeVisible();
  const recovered = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => { const request = indexedDB.open('cardforge-browser-storage', 1); request.onsuccess = () => resolve(request.result); });
    const value = await new Promise<string>((resolve) => { const request = db.transaction('key-value').objectStore('key-value').get('project-workspace:local:__recovery__:workspace'); request.onsuccess = () => resolve(request.result); });
    db.close(); return value;
  });
  expect(recovered).toContain(deletedUrl);
  await page.getByRole('button', { name: /^Select 100 Card Scale Set/ }).press('Enter');
  await page.locator('button[data-artifact-id="scale-card-1"]').press('Enter');
  await expect(page.getByLabel('100 Card Scale Set focused Artifact viewport', { exact: true }).locator('[data-freeform-element-id="scale-artwork"]')).toHaveCount(0);
  await expect(page.locator('[data-freeform-element-id="scale-template-title"]').filter({ visible: true }).first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('cleaned-card.png') });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByLabel('100 Card Scale Set focused Artifact viewport', { exact: true }).locator('[data-freeform-element-id="scale-artwork"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to Set', exact: true }).click();
  await page.locator('button[data-artifact-id="scale-card-2"]').press('Enter');
  await expect(page.getByLabel('100 Card Scale Set focused Artifact viewport', { exact: true }).locator('[data-freeform-element-id="scale-artwork"]').filter({ visible: true }).first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('shared-sibling-preserved.png') });
});
