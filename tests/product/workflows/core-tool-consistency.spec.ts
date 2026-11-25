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
  const creation = page.getByRole('dialog', { name: 'Create a card back Template', exact: true });
  await expect(creation).toBeVisible();
  await expect(creation.getByRole('combobox', { name: 'Choose card format' })).toContainText('63 × 88 mm');
  await creation.getByRole('textbox', { name: 'Template name' }).fill('Matching back proof');
  await creation.getByRole('button', { name: 'Create and open canvas' }).click();
  await expect(page.getByRole('region', { name: 'Design', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download Set', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open project', exact: true })).toHaveCount(0);
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
  await expect(page.getByRole('button', { name: 'Download Set', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open project', exact: true })).toBeVisible();
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

test('Library finds cards by the same authored name field as Desk', async ({ page }) => {
  test.setTimeout(120_000);
  await seedGuestScaleWorkspace(page, 100, { cardLimit: 2, titleField: 'Card Title' });
  await page.goto('/account?section=library');
  await page.locator('[id^="library-object-set:"]').filter({ hasText: '100 Card Scale Set' }).click();
  await expect(page.getByRole('button', { name: 'Edit Scale Card 0001', exact: true })).toBeVisible();
  await page.getByPlaceholder('Search cards').fill('0002');
  await expect(page.getByRole('button', { name: 'Edit Scale Card 0002', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit Scale Card 0001', exact: true })).toHaveCount(0);
});

for (const width of [1440, 390]) test(`Library edits the same card and retains the Set after reload at ${width}px`, async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width, height: 900 });
  await seedGuestScaleWorkspace(page, 100, { cardLimit: 2, exportSample: true });
  await page.goto('/account?section=library');
  const openSet = () => page.locator('[id^="library-object-set:"]').filter({ hasText: '100 Card Scale Set' }).click();
  await openSet();
  const readWorkspaces = () => page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('cardforge-browser-storage');
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    const records = await Promise.all(['guest', 'local'].map((scope) => new Promise<string>((resolve, reject) => {
      const request = database.transaction('key-value').objectStore('key-value').get(`project-workspace:${scope}:workspace`);
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    })));
    database.close();
    return records.map((record) => JSON.parse(JSON.parse(record).value).state);
  });
  // Startup can normalize Template identities; capture the actual workspace baseline.
  await page.waitForTimeout(500);
  const before = await readWorkspaces();
  await page.getByRole('button', { name: 'Edit Scale Card 0001', exact: true }).click();
  const editor = page.locator('[data-artifact-edit-workspace]');
  await expect(editor.getByRole('button', { name: 'All fields', exact: true })).toHaveCount(1);
  await editor.getByRole('button', { name: 'All fields', exact: true }).click();
  const title = editor.getByRole('textbox', { name: /Card title|Card name/i }).first();
  await title.fill('Revised in Library');
  await page.getByRole('button', { name: 'Close card editor', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toContainText('unsaved');
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(title).toHaveValue('Revised in Library');
  await editor.getByRole('button', { name: 'Save & Done', exact: true }).click();
  await expect(page).toHaveURL(/section=library/);
  await expect(page.getByRole('button', { name: 'Edit Revised in Library', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit Scale Card 0002', exact: true })).toBeVisible();
  await page.reload();
  await openSet();
  await expect(page.getByRole('button', { name: 'Edit Revised in Library', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit Scale Card 0002', exact: true })).toBeVisible();
  const workspaces = await readWorkspaces();
  const scope = workspaces.findIndex((state) => state.storedCards.some((card: { data: { cardName?: string } }) => card.data.cardName === 'Revised in Library'));
  expect(scope).toBeGreaterThanOrEqual(0);
  const saved = workspaces[scope];
  expect(saved.storedCards).toHaveLength(2);
  expect(saved.storedCards[0]).toMatchObject({ uniqueId: 'scale-card-1', setId: 'scale-set-100', templateId: before[scope].storedCards[0].templateId, data: { cardName: 'Revised in Library', artwork: `cardforge-browser-asset://${'1'.padStart(64, '0')}` } });
  expect(saved.storedCards[1]).toMatchObject({ uniqueId: 'scale-card-2', setId: 'scale-set-100', templateId: before[scope].storedCards[1].templateId, data: { cardName: 'Scale Card 0002', artwork: `cardforge-browser-asset://${'2'.padStart(64, '0')}` } });
});
