import { expect, test } from '@playwright/test';
import { openScaleSet, seedGuestScaleWorkspace } from './helpers/projectScaleBrowser';

test('matching back creates a new back and returns to the same Generate context', async ({ page }) => {
  test.setTimeout(120_000);
  await seedGuestScaleWorkspace(page, 100, { staleToolTemplate: true });
  await page.goto('/account');
  await openScaleSet(page, 100);
  await page.getByRole('button', { name: 'Generate', exact: true }).click();
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
