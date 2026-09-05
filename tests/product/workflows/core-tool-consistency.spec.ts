import { expect, test } from '@playwright/test';
import { openScaleSet, seedGuestScaleWorkspace } from './helpers/projectScaleBrowser';

test('Personal Library renders native local artwork and fonts and identifies missing sources', async ({ page }) => {
  test.setTimeout(120_000);
  await seedGuestScaleWorkspace(page, 100);
  await page.evaluate(async () => {
    const font = await (await fetch('/fonts/lato/Lato-Regular.ttf')).blob();
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('cardforge-browser-storage', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('key-value', 'readwrite');
      const store = transaction.objectStore('key-value');
      for (const scope of ['guest', 'local']) {
        const imageId = '1'.padStart(64, '0');
        const fontId = 'f'.repeat(64);
        store.put(font, `project-content-asset:${scope}:${fontId}`);
        store.put(JSON.stringify([
          { id: 'proof-artwork', name: 'Proof artwork', kind: 'image', url: `cardforge-browser-asset://${imageId}` },
          { id: 'missing-artwork', name: 'Missing artwork', kind: 'image', url: '' },
        ]), `project-assets:${scope}:cardforge-maker-custom-images`);
        store.put(JSON.stringify([
          { id: 'proof-font', name: 'Proof font', value: 'font-personal-proof-font', mimeType: 'font/ttf', dataUrl: `cardforge-browser-asset://${fontId}`, fileSizeBytes: font.size },
        ]), `project-assets:${scope}:cardforge-maker-custom-fonts`);
      }
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  });
  await page.goto('/account?section=library');
  const artwork = page.getByRole('img', { name: 'Proof artwork preview', exact: true });
  await expect(artwork).toBeVisible();
  await expect.poll(() => artwork.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByLabel('Proof font font preview', { exact: true })).toBeVisible();
  await expect(page.getByText('Source missing. Restore a backup.', { exact: true })).toBeVisible();
});

test('matching back creates a new back and returns to the same Generate context', async ({ page }) => {
  test.setTimeout(120_000);
  await seedGuestScaleWorkspace(page, 100, { staleToolTemplate: true });
  await page.goto('/account');
  await openScaleSet(page, 100);
  await page.getByRole('button', { name: 'Generate', exact: true }).click();
  await page.getByRole('button', { name: 'Continue to card data', exact: true }).click();
  await page.getByRole('textbox', { name: 'Add your card list' }).fill('cardName,rules\nDraft card,Keep this input');
  await page.getByRole('button', { name: 'Change setup', exact: true }).click();
  await page.getByRole('button', { name: 'Create matching back', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Design Artifacts', exact: true })).toBeVisible();
  const creation = page.getByRole('dialog');
  await expect(creation.getByRole('combobox', { name: 'Choose card format' })).toContainText('63 × 88 mm');
  await creation.getByRole('textbox', { name: 'Template name' }).fill('Matching back proof');
  await creation.getByRole('button', { name: 'Create and open canvas' }).click();
  await expect(page.getByText('Create and save a matching back, then choose whether to apply it to this set.')).toBeVisible();
  await page.getByRole('button', { name: 'Back to Generate', exact: true }).click();
  if (await page.getByRole('alertdialog').isVisible()) await page.getByRole('button', { name: 'Close Design', exact: true }).click();
  await expect(page.locator('#deck-front-template')).toContainText('Scale Fixture Template');
  await expect(page.locator('#deck-backing-template')).toContainText('Scale Fixture Back');
  await page.getByRole('button', { name: 'Continue to card data', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Add your card list' })).toHaveValue('cardName,rules\nDraft card,Keep this input');
  await page.locator('[data-desk-context-rail]').getByRole('button', { name: 'Review & close' }).click();
  await expect(page.getByRole('alertdialog')).toContainText('unsaved');
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
});

test('standalone Library Template keeps drafts across cancelled close and navigation', async ({ page }) => {
  test.setTimeout(120_000);
  await seedGuestScaleWorkspace(page, 100);
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('cardforge-browser-storage', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('key-value', 'readwrite');
      const store = transaction.objectStore('key-value');
      for (const scope of ['guest', 'local']) {
        const key = `project-workspace:${scope}:workspace`;
        const request = store.get(key);
        request.onsuccess = () => {
          const record = JSON.parse(request.result);
          const value = JSON.parse(record.value);
          value.state.cardSets = [];
          value.state.storedCards = [];
          value.state.activeCardSet = null;
          record.value = JSON.stringify(value);
          store.put(JSON.stringify(record), key);
        };
      }
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  });
  await page.goto('/account?section=library&scope=personal&tool=design&artifact=scale-template');
  await expect(page.getByRole('region', { name: 'Design Template', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Card Setup', exact: true }).click();
  const name = page.getByLabel('Template name', { exact: true });
  await name.fill('Unsaved Library draft');
  await page.getByRole('button', { name: 'Close Design', exact: true }).first().click();
  await expect(page.getByRole('alertdialog')).toContainText('Discard unsaved changes');
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(name).toHaveValue('Unsaved Library draft');
  await page.getByRole('link', { name: 'Desk', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toContainText('Leave with unsaved changes');
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(name).toHaveValue('Unsaved Library draft');
  await page.getByRole('button', { name: 'Close Design', exact: true }).first().click();
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Design Template', exact: true })).toHaveCount(0);
  await expect(page).not.toHaveURL(/tool=design/);
  await page.goBack();
  await expect(page).not.toHaveURL(/tool=design/);
});
